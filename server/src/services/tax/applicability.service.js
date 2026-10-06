'use strict'

/**
 * Applicability engine.
 *
 * Answers the question the catalog exists to answer: "which of these returns
 * does THIS taxpayer actually have to file?" — from the taxpayer profile and
 * from evidence in the ledger, never from a hardcoded list.
 *
 * Two ideas worth stating plainly:
 *
 * 1. A form can be applicable because the taxpayer *says* so (profile
 *    registration flags) or because the ledger *shows* it (EWT postings
 *    exist). Those are different kinds of evidence and they can disagree.
 *    When they do, the engine returns `conflict` with both readings rather
 *    than picking one — a corporation whose profile says "not an EWT agent"
 *    but which has EWT postings is a real filing risk, and hiding it behind a
 *    single boolean would bury it.
 *
 * 2. Nothing is silently dropped. Every form gets a verdict, and a verdict
 *    always carries a human-readable reason built from the rule's own `why`.
 */

// ---------------------------------------------------------------------------
// Rule AST
// ---------------------------------------------------------------------------
//   { all: [rule, ...] }                     every rule must pass
//   { any: [rule, ...] }                     at least one must pass
//   { not: rule }                            negation
//   { fact, equals | notEquals | in | notIn | greater_than
//               | greater_or_equal | less_than | isTrue | exists }  leaf
//   { fact, truthy }                         boolean shorthand
//   { always: true|false }                   constant, for tests
// ---------------------------------------------------------------------------

const evaluateRule = (rule, facts) => {
  if (!rule || typeof rule !== 'object') {
    return { pass: true, reason: '' }
  }

  if (rule.all) {
    const results = rule.all.map((child) => evaluateRule(child, facts))
    const passed = results.every((r) => r.pass)
    return {
      pass: passed,
      reason: results
        .filter((r) => r.reason)
        .map((r) => r.reason)
        .join('; '),
      unmet: results.filter((r) => !r.pass).flatMap((r) => r.unmet || []),
    }
  }

  if (rule.any) {
    const results = rule.any.map((child) => evaluateRule(child, facts))
    const passed = results.some((r) => r.pass)
    // Report the *first* satisfied branch's reason, not a concatenation of all
    // of them — the reasons read as justifications, so a list of every
    // considered alternative is noise.
    const satisfied = results.find((r) => r.pass)
    return {
      pass: passed,
      reason: satisfied ? satisfied.reason : '',
      unmet: passed ? [] : results.flatMap((r) => r.unmet || []),
    }
  }

  if (rule.not) {
    const inner = evaluateRule(rule.not, facts)
    return {
      pass: !inner.pass,
      reason: inner.pass ? `not (${rule.why || inner.reason})` : '',
      unmet: inner.pass ? [] : [rule.not],
    }
  }

  if (Object.prototype.hasOwnProperty.call(rule, 'always')) {
    return {
      pass: Boolean(rule.always),
      reason: rule.always ? rule.why || '' : `because ${rule.why || 'the rule is false'}`,
      unmet: rule.always ? [] : [rule],
    }
  }

  // leaf
  const factValue = facts[rule.fact]
  let pass = false

  if (rule.equals !== undefined) {
    pass = looseEquals(factValue, rule.equals)
  } else if (rule.notEquals !== undefined) {
    pass = !looseEquals(factValue, rule.notEquals)
  } else if (rule.in) {
    pass = rule.in.some((candidate) => looseEquals(factValue, candidate))
  } else if (rule.notIn) {
    pass = !rule.notIn.some((candidate) => looseEquals(factValue, candidate))
  } else if (rule.truthy !== undefined) {
    pass = rule.truthy ? Boolean(factValue) : !factValue
  } else if (rule.greater_than !== undefined) {
    pass = Number(factValue) > Number(rule.greater_than)
  } else if (rule.greater_or_equal !== undefined) {
    pass = Number(factValue) >= Number(rule.greater_or_equal)
  } else if (rule.less_than !== undefined) {
    pass = Number(factValue) < Number(rule.less_than)
  } else if (rule.less_or_equal !== undefined) {
    pass = Number(factValue) <= Number(rule.less_or_equal)
  } else if (rule.exists !== undefined) {
    const present = factValue !== null && factValue !== undefined && factValue !== ''
    pass = rule.exists ? present : !present
  } else {
    // A leaf with no comparison is a malformed rule. Failing closed here
    // would hide a form; failing open would file one. Report it loudly
    // instead and let the caller surface the defect.
    return {
      pass: false,
      reason: '',
      error: `Malformed applicability rule for fact "${rule.fact}": no comparison operator`,
    }
  }

  return {
    pass,
    reason: pass ? rule.why || '' : rule.why || `fact ${rule.fact} did not satisfy the rule`,
    unmet: pass ? [] : [rule],
  }
}

// MySQL returns TINYINT(1) as 0/1 and booleans come back as true/false
// depending on the driver, so every boolean-ish fact is normalised before
// comparison. Without this, `vat_registered` stored as 1 compares unequal to
// `true` and every VAT form reads as not applicable.
const looseEquals = (actual, expected) => {
  if (expected === true || expected === false) {
    return toBool(actual) === expected
  }
  if (typeof expected === 'number' && typeof actual === 'string') {
    return Number(actual) === expected
  }
  if (actual === null || actual === undefined) return expected === null
  return String(actual) === String(expected)
}

const toBool = (value) => {
  if (value === true || value === false) return value
  if (value === 1 || value === 0) return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (['1', 'true', 't', 'yes', 'y', 'active'].includes(normalized)) return true
    if (['0', 'false', 'f', 'no', 'n', 'inactive', ''].includes(normalized)) return false
  }
  return Boolean(value)
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

/**
 * Build the fact bag the rules are evaluated against.
 *
 * Profile facts are copied in flat; ledger-evidence facts are namespaced under
 * `evidence` by the caller and merged. A fact the engine cannot resolve is
 * `undefined`, and every rule referencing it evaluates false — so an
 * incomplete profile makes the engine report forms as *unknown* rather than
 * confidently applicable, which is the correct direction to fail.
 */
const buildFacts = ({ profile, evidence = {} } = {}) => {
  // "No evidence object" and "an evidence object that says false" are different
  // claims, and only the second one may drive a conflict.
  const hasEvidence = evidence && Object.keys(evidence).length > 0

  const facts = {
    // Profile-derived. A taxpayer who has never been profiled is explicitly
    // "unknown" rather than defaulted to a corporation, so nothing gets
    // recommended on a guess.
    taxpayer_type: profile?.taxpayer_type ?? null,
    legal_classification: profile?.legal_classification ?? null,
    vat_registered: toBool(profile?.vat_registered),
    vat_filing_frequency: profile?.vat_filing_frequency ?? null,
    vat_exemption: profile?.vat_exemption ?? null,
    ewt_agent: toBool(profile?.ewt_agent),
    ewt_remitter: toBool(profile?.ewt_remitter),
    avat: toBool(profile?.avat),
    subject_to_income_tax: profile?.subject_to_income_tax
      ? true
      : profile?.subject_to_income_tax === null || profile?.subject_to_income_tax === undefined
        ? null
        : false,
    fiscal_year_basis: profile?.fiscal_year_basis ?? null,
    fiscal_year_end_month: profile?.fiscal_year_end_month ?? null,
    self_employed_professional: toBool(profile?.self_employed_professional),
    has_prior_year_income_tax: toBool(profile?.has_prior_year_income_tax),

    // Evidence-derived. The ledger is the authority on what the taxpayer
    // actually did, independent of what they told us they do.
    //
    // These stay null when the caller supplied no evidence, rather than
    // collapsing to false. `toBool(undefined)` is false, which is
    // indistinguishable from a real reading of "the ledger has no VAT
    // postings" — so a taxpayer who registered for VAT got told their books
    // contained no VAT, purely because nobody passed a ledger window. A rule
    // that asks "is this definitely false" must not fire on an unknown.
    has_ewt_postings: hasEvidence ? toBool(evidence.has_ewt_postings) : null,
    has_cwt_postings: hasEvidence ? toBool(evidence.has_cwt_postings) : null,
    has_vat_postings: hasEvidence ? toBool(evidence.has_vat_postings) : null,
    has_input_vat_postings: hasEvidence ? toBool(evidence.has_input_vat_postings) : null,
    has_compensation_postings: hasEvidence ? toBool(evidence.has_compensation_postings) : null,
    compensation_pays_receipts: hasEvidence ? Number(evidence.compensation_pays_receipts || 0) : null,
    ewt_postings_count: hasEvidence ? Number(evidence.ewt_postings_count || 0) : null,
    cwt_postings_count: hasEvidence ? Number(evidence.cwt_postings_count || 0) : null,
    vat_output_amount: hasEvidence ? Number(evidence.vat_output_amount || 0) : null,
    vat_input_amount: hasEvidence ? Number(evidence.vat_input_amount || 0) : null,
    evidence_window: evidence.window || null,
  }

  return facts
}

// Facts the engine is willing to treat as "the taxpayer has told us enough".
const PROFILE_FACTS_REQUIRED_FOR_CONFIDENCE = [
  'taxpayer_type',
  'vat_registered',
  'subject_to_income_tax',
]

const isProfileComplete = (profile) =>
  PROFILE_FACTS_REQUIRED_FOR_CONFIDENCE.every(
    (key) => profile && profile[key] !== null && profile[key] !== undefined,
  )

// ---------------------------------------------------------------------------
// Conflicts: profile says one thing, the ledger says another.
// ---------------------------------------------------------------------------

const CONFLICT_RULES = [
  {
    id: 'ewt_remitter_vs_postings',
    detect: (facts) =>
      facts.ewt_remitter === false &&
      facts.has_ewt_postings === true &&
      facts.ewt_postings_count > 0,
    severity: 'error',
    message:
      'The ledger has expanded-withholding-tax postings but the profile does not register the taxpayer as an EWT remitting agent. Either the profile is incomplete or the EWT postings are misposted.',
    suggested_forms: ['0619E', '1601EQ'],
  },
  {
    id: 'vat_not_registered_vs_output',
    detect: (facts) =>
      facts.vat_registered === false && facts.vat_output_amount > 0,
    severity: 'error',
    message:
      'Output VAT has been posted but the profile does not register the taxpayer for VAT. Sales are being taxed without a 2550 declaration to report them on.',
    suggested_forms: ['2550M', '2550Q'],
  },
  {
    id: 'vat_registered_vs_no_postings',
    detect: (facts) =>
      facts.vat_registered === true &&
      facts.has_vat_postings === false,
    severity: 'warning',
    message:
      'The profile registers the taxpayer for VAT but no VAT-tagged postings exist in the evidence window. The 2550 will reconcile to zero — confirm the VAT tagging on sales documents.',
    suggested_forms: ['2550M'],
  },
  {
    id: 'cwt_postings_without_agent',
    detect: (facts) =>
      facts.has_cwt_postings === true && facts.ewt_agent === false,
    severity: 'warning',
    message:
      'Creditable tax withheld postings exist but the profile does not register the taxpayer as a withholding agent. 2307 certificates may be owed to payees.',
    suggested_forms: ['2307'],
  },
]

const detectConflicts = (facts) =>
  CONFLICT_RULES.filter((rule) => rule.detect(facts)).map((rule) => ({
    id: rule.id,
    severity: rule.severity,
    message: rule.message,
    suggested_forms: rule.suggested_forms,
  }))

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * @param {object[]} forms  catalog forms
 * @param {object}   ctx     { profile, evidence }
 * @returns {{ facts, profileComplete, conflicts, results }}
 */
const evaluateApplicability = (forms, { profile, evidence } = {}) => {
  const facts = buildFacts({ profile, evidence })
  const conflicts = detectConflicts(facts)
  const profileComplete = isProfileComplete(profile)

  const results = forms.map((form) => {
    const evaluated = evaluateRule(form.applicability, facts)
    const hasError = containsError(form.applicability, facts)

    // Forms implicated by a conflict are promoted to 'conflict' so the UI
    // does not bury them under a green "not applicable".
    const conflict = conflicts.find((c) =>
      c.suggested_forms.includes(String(form.form_code)),
    )

    let status
    if (hasError) {
      status = 'error'
    } else if (conflict && conflict.severity === 'error' && !evaluated.pass) {
      status = 'conflict'
    } else if (evaluated.pass) {
      status = conflict ? 'conflict' : 'applicable'
    } else {
      status = conflict ? 'conflict' : 'not_applicable'
    }

    return {
      form_code: form.form_code,
      category: form.category,
      short_title: form.short_title,
      frequency: form.frequency,
      status,
      reason: evaluated.reason || (evaluated.pass ? 'applicability conditions met' : ''),
      unmet: (evaluated.unmet || []).map(describeUnmet),
      error: evaluated.error || null,
      conflict: conflict
        ? { id: conflict.id, severity: conflict.severity, message: conflict.message }
        : null,
      prerequisite_forms: form.prerequisite_forms || [],
    }
  })

  return { facts, profileComplete, conflicts, results }
}

const containsError = (rule, facts) => {
  const evaluated = evaluateRule(rule, facts)
  return Boolean(evaluated.error)
}

const describeUnmet = (rule) => {
  if (!rule || typeof rule !== 'object') return String(rule)
  if (rule.fact) {
    const expected =
      rule.equals !== undefined
        ? `= ${rule.equals}`
        : rule.in
          ? `in [${rule.in.join(', ')}]`
          : rule.truthy !== undefined
            ? `= ${rule.truthy}`
            : rule.greater_than !== undefined
              ? `> ${rule.greater_than}`
              : ''
    return `${rule.fact} ${expected}`.trim()
  }
  if (rule.all) return `all of: [${rule.all.map(describeUnmet).join('; ')}]`
  if (rule.any) return `any of: [${rule.any.map(describeUnmet).join('; ')}]`
  if (rule.not) return `not (${describeUnmet(rule.not)})`
  return 'unrecognised rule'
}

module.exports = {
  evaluateApplicability,
  evaluateRule,
  buildFacts,
  detectConflicts,
  toBool,
  looseEquals,
  CONFLICT_RULES,
  PROFILE_FACTS_REQUIRED_FOR_CONFIDENCE,
}
