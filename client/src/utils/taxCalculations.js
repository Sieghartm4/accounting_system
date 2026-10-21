// ─────────────────────────────────────────────────────────────────────────────
// Shared financial calculator for all transaction modules
// (sales, receipts, purchase, cash disbursements)
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth so the auto-generated journal entries always balance.

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

// Per-item financial breakdown.
//
// Discount semantics (standardized across all modules):
//   PERCENT -> gross × (discount / 100)
//   FIXED   -> the entered value is the discount total for the whole line
//
// VAT on the discounted (net) consideration, per BIR rule that VAT is
// computed on the net selling price after discount:
//   VAT-EX  -> VAT = discounted × rate / 100            (added on top)
//   VAT-INC -> VAT = discounted − discounted/(1 + rate) (extracted from it)
//
// Booked values keep the journal balanced with a standalone Discount line:
//   income/expense line = grossEx (pre-discount, tax-exclusive)
//   VAT line            = vatAmount (on the discounted base)
//   discount line       = discountBook (net of VAT for VAT-INC items)
//   settled amount      = what actually changes hands before WHT
// Identity: settled − wht + discountBook = grossEx + vatAmount
export function computeLineFinancials(item) {
  const qty = parseFloat(item.qty) || 0
  const price = parseFloat(item.price) || 0
  const discountValue = parseFloat(item.discount) || 0
  const discountType = item.discountType || item.discount_type || 'PERCENT'
  const vatPct = parseFloat(item.vatRate) || 0
  const whtPct = parseFloat(item.whtRate) || 0
  const vatType = item.vatType || 'VAT-EX'

  const gross = qty * price
  const discountAmount =
    discountType === 'PERCENT' ? gross * (discountValue / 100) : discountValue
  const discounted = gross - discountAmount

  const isVatInc = vatType === 'VAT-INC' && vatPct > 0

  const vatAmount = isVatInc
    ? discounted - discounted / (1 + vatPct / 100)
    : discounted * (vatPct / 100)
  const netBase = isVatInc ? discounted / (1 + vatPct / 100) : discounted
  const grossEx = isVatInc ? gross / (1 + vatPct / 100) : gross
  const discountBook = isVatInc ? discountAmount / (1 + vatPct / 100) : discountAmount

  const whtAmount = netBase * (whtPct / 100)
  const settledAmount = isVatInc ? discounted : discounted + vatAmount

  return {
    qty,
    price,
    discountValue,
    discountType,
    vatPct,
    whtPct,
    vatType,
    isVatInc,
    gross,
    discountAmount,
    discounted,
    vatAmount,
    netBase,
    grossEx,
    discountBook,
    whtAmount,
    settledAmount,
  }
}

// Rounded per-item components - every downstream entry amount uses these so
// totals balance to the centava regardless of item count.
export function computeRoundedLineFinancials(item) {
  const f = computeLineFinancials(item)
  return {
    ...f,
    gross: round2(f.gross),
    discountAmount: round2(f.discountAmount),
    discounted: round2(f.discounted),
    vatAmount: round2(f.vatAmount),
    netBase: round2(f.netBase),
    grossEx: round2(f.grossEx),
    discountBook: round2(f.discountBook),
    whtAmount: round2(f.whtAmount),
    settledAmount: round2(f.settledAmount),
  }
}

// Totals over a set of items, computed on rounded per-item values so that
// Sum(debits) === Sum(credits) exactly for auto-generated entries.
export function computeTotals(items) {
  const lines = items.map((item) => ({
    item,
    f: computeRoundedLineFinancials(item),
  }))

  const t = lines.reduce(
    (acc, { item, f }) => {
      acc.lines.push({ item, f })
      acc.gross += f.gross
      acc.discount += f.discountAmount
      acc.discounted += f.discounted
      acc.vat += f.vatAmount
      acc.netOfVat += f.netBase
      acc.wht += f.whtAmount
      acc.grossEx += f.grossEx
      acc.discountBook += f.discountBook

      if (f.vatPct > 0) {
        acc.vatableSales += f.netBase
        acc.discountOnVatable += f.discountAmount
      } else if (f.whtPct > 0) {
        acc.zeroRatedSales += f.discounted
      } else {
        acc.vatExemptSales += f.discounted
      }

      acc.amountDue += f.settledAmount - f.whtAmount
      return acc
    },
    {
      lines: [],
      gross: 0,
      discount: 0,
      discounted: 0,
      vat: 0,
      netOfVat: 0,
      wht: 0,
      grossEx: 0,
      discountBook: 0,
      vatableSales: 0,
      vatExemptSales: 0,
      zeroRatedSales: 0,
      discountOnVatable: 0,
      amountDue: 0,
    },
  )

  return {
    lines,
    totals: {
      gross: round2(t.gross),
      discount: round2(t.discount),
      discounted: round2(t.discounted),
      vat: round2(t.vat),
      netOfVat: round2(t.netOfVat),
      wht: round2(t.wht),
      grossEx: round2(t.grossEx),
      discountBook: round2(t.discountBook),
      vatableSales: round2(t.vatableSales),
      vatExemptSales: round2(t.vatExemptSales),
      zeroRatedSales: round2(t.zeroRatedSales),
      discountOnVatable: round2(t.discountOnVatable),
      amountDue: round2(t.amountDue),
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart-of-accounts guards
// ─────────────────────────────────────────────────────────────────────────────
// The auto-generated entries reference standard accounts by name. If any of
// them is missing the generated journal silently becomes unbalanced, so the
// post handlers check for them explicitly before submitting.

const findAccountByTerms = (chartsOfAccounts, terms) =>
  chartsOfAccounts.find((a) => {
    const label = String(a.name || a.account_name || '').toLowerCase()
    return terms.some((term) => label.includes(term))
  })

// side: 'sales' | 'receipts' | 'purchase' | 'disbursements'
// (receipts/disbursements journals credit/debit income directly and settle
// immediately, so they do not reference AR/AP)
export function findMissingAutoAccounts({ items, chartsOfAccounts, side }) {
  if (!items || items.length === 0 || !chartsOfAccounts) return []
  const { totals } = computeTotals(items)
  const missing = []

  if (side === 'purchase' || side === 'disbursements') {
    if (side === 'purchase') {
      if (!findAccountByTerms(chartsOfAccounts, ['accounts payable']))
        missing.push('Accounts Payable')
    }
    if (
      totals.discountBook > 0 &&
      !findAccountByTerms(chartsOfAccounts, ['purchase discounts'])
    )
      missing.push('Purchase Discounts')
    if (
      totals.wht > 0 &&
      !findAccountByTerms(chartsOfAccounts, [
        'withholding tax - compensation',
        'withholding tax - expanded',
      ])
    )
      missing.push('Withholding Tax Payable')
    if (totals.vat > 0 && !findAccountByTerms(chartsOfAccounts, ['input vat']))
      missing.push('Input VAT')
  } else {
    if (side === 'sales') {
      if (!findAccountByTerms(chartsOfAccounts, ['accounts receivable']))
        missing.push('Accounts Receivable')
    }
    if (
      totals.discountBook > 0 &&
      !findAccountByTerms(chartsOfAccounts, ['sales discounts'])
    )
      missing.push('Sales Discounts')
    if (
      totals.wht > 0 &&
      !findAccountByTerms(chartsOfAccounts, [
        'creditable withholding tax',
        'creditable witholding tax',
      ])
    )
      missing.push('Creditable Withholding Tax')
    if (totals.vat > 0 && !findAccountByTerms(chartsOfAccounts, ['output vat']))
      missing.push('Output VAT')
  }

  return missing
}

// Returns a label for the missing cash/bank account, or null if found.
export function findMissingPaymentAccount({
  modeOfPayment,
  bankName,
  chartsOfAccounts,
}) {
  const mode = String(modeOfPayment || '').toUpperCase()
  if (mode === 'CASH') {
    const found =
      findAccountByTerms(chartsOfAccounts, ['cash on hand']) ||
      findAccountByTerms(chartsOfAccounts, ['petty cash'])
    return found ? null : 'Cash on Hand'
  }
  if (mode === 'CHECK' || mode === 'BANK_TRANSFER') {
    const found =
      (bankName && findAccountByTerms(chartsOfAccounts, [String(bankName).toLowerCase()])) ||
      findAccountByTerms(chartsOfAccounts, ['cash in bank'])
    return found ? null : `Cash in Bank${bankName ? ` (${bankName})` : ''}`
  }
  return `Cash / Bank account (mode: ${modeOfPayment || 'not selected'})`
}
