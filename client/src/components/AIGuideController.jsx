import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useCopilotReadable, useCopilotAction } from '@copilotkit/react-core'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

import { buildSiteMap } from '../routesConfig'
import { DOC_CONTENT } from '../pages/user_documentation/UserDocumentation'
import ACCOUNTING_RULEBOOK from '../lib/accounting-knowledge.json'

const SITE_MAP = buildSiteMap()

const GUIDE_ENTRIES = Object.entries(DOC_CONTENT).map(([id, entry]) => {
  const parts = [entry.title, entry.body]
  if (Array.isArray(entry.bullets)) {
    for (const bullet of entry.bullets) parts.push(`${bullet.label}: ${bullet.desc}`)
  }
  if (Array.isArray(entry.steps)) {
    for (const step of entry.steps) parts.push(`${step.label}: ${step.desc}`)
  }
  if (entry.note) parts.push(entry.note)
  return {
    id,
    title: entry.title,
    text: parts.filter(Boolean).join(' ')
  }
})

const searchGuideEntries = (query, limit = 3) => {
  const tokens = tokenize(query || '')
  if (tokens.length === 0) return GUIDE_ENTRIES.slice(0, limit)
  return GUIDE_ENTRIES.map((entry) => {
    const title = normalize(entry.title)
    const haystack = normalize(`${entry.title} ${entry.text}`)
    let score = 0
    for (const token of tokens) {
      if (title.includes(token)) score += 3
      if (haystack.includes(token)) score += 1
    }
    return { ...entry, score }
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const GENERIC_WORDS = new Set([
  'button',
  'element',
  'field',
  'input',
  'selector',
  'dropdown',
  'link',
  'the',
  'a',
  'an',
  'on',
  'in',
  'to',
  'of',
  'this',
  'that',
  'please',
  'click',
  'here',
  'page',
  'form',
  'box',
  'tab'
])

const CANDIDATE_SELECTOR =
  'button, a, [role="button"], input, select, textarea, [data-tour], label'

const FIELD_SELECTOR = 'input, select, textarea'

const DROPDOWN_HINT = /select|search|choose|pick|assign/i

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isVisible = (el) => {
  if (!el || !el.getClientRects) return false
  if (el.getClientRects().length === 0) return false
  const style = window.getComputedStyle(el)
  return style.visibility !== 'hidden' && style.display !== 'none'
}

const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim()

const tokenize = (value) =>
  normalize(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !GENERIC_WORDS.has(token))

const elementHaystack = (el) => {
  const attrs = [
    el.textContent,
    el.getAttribute && el.getAttribute('aria-label'),
    el.getAttribute && el.getAttribute('title'),
    el.getAttribute && el.getAttribute('placeholder'),
    el.getAttribute && el.getAttribute('name'),
    el.getAttribute && el.getAttribute('id'),
    el.getAttribute && el.getAttribute('data-tour'),
    el.getAttribute && el.getAttribute('alt')
  ]
  return normalize(attrs.filter(Boolean).join(' '))
}

const scoreElement = (el, tokens, phrase) => {
  if (tokens.length === 0) return 0
  const haystack = elementHaystack(el)
  let score = 0
  for (const token of tokens) {
    if (haystack.includes(token)) score += 1
  }
  if (phrase && phrase.length > 1 && haystack.includes(phrase)) score += tokens.length
  return score
}

const getFieldLabel = (el) => {
  if (!el) return ''
  if (el.labels && el.labels.length > 0) {
    return Array.from(el.labels)
      .map((label) => label.textContent)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const wrapping = el.closest && el.closest('label')
  if (wrapping) return normalize(wrapping.textContent)

  let node = el.parentElement
  for (let depth = 0; depth < 3 && node; depth += 1) {
    const labels = node.querySelectorAll('label')
    const fields = node.querySelectorAll(FIELD_SELECTOR)
    if (labels.length === 1 && Array.from(fields).includes(el)) {
      return normalize(labels[0].textContent)
    }
    node = node.parentElement
  }

  const cell = el.closest && el.closest('td')
  const table = el.closest && el.closest('table')
  if (cell && table) {
    const row = cell.parentElement
    const headerRow = table.querySelector('thead tr')
    if (row && headerRow) {
      const index = Array.from(row.children).indexOf(cell)
      const header = headerRow.children[index]
      if (header) return normalize(header.textContent)
    }
  }
  return ''
}

const fieldHaystack = (el) => {
  const parts = [
    getFieldLabel(el),
    el.getAttribute && el.getAttribute('aria-label'),
    el.getAttribute && el.getAttribute('title'),
    el.getAttribute && el.getAttribute('placeholder'),
    el.getAttribute && el.getAttribute('name'),
    el.getAttribute && el.getAttribute('id'),
    el.getAttribute && el.getAttribute('type'),
    el.textContent
  ]
  return normalize(parts.filter(Boolean).join(' '))
}

const describeElement = (el) => {
  const tag = el.tagName.toLowerCase()
  const type = (el.getAttribute('type') || tag).toLowerCase()
  const label = getFieldLabel(el)
  const text = normalize(el.textContent).slice(0, 90)
  const placeholder = el.getAttribute('placeholder') || ''
  const name = el.getAttribute('name') || ''
  const aria = el.getAttribute('aria-label') || ''
  const role = el.getAttribute('role') || ''
  const isField = tag === 'input' || tag === 'textarea' || tag === 'select'
  const summary = isField
    ? [
        `${type} field`,
        label ? `label "${label}"` : '',
        placeholder ? `placeholder "${placeholder}"` : ''
      ]
        .filter(Boolean)
        .join(', ')
    : [
        role ? `${tag} (${role})` : tag,
        text ? `"${text}"` : '',
        aria ? `aria-label "${aria}"` : ''
      ]
        .filter(Boolean)
        .join(', ')
  return {
    tag,
    type,
    label,
    text,
    placeholder,
    name,
    aria,
    role,
    disabled: !!el.disabled,
    summary
  }
}

const findElementByDescription = (description, title = '') => {
  let tokens = tokenize(description)
  if (tokens.length === 0) tokens = tokenize(title)
  if (tokens.length === 0) return null
  const phrase = normalize(description)

  const candidates = Array.from(document.querySelectorAll(CANDIDATE_SELECTOR))
  let best = null
  let bestScore = 0
  for (const el of candidates) {
    if (!isVisible(el)) continue
    const score = scoreElement(el, tokens, phrase)
    if (score === 0) continue
    if (score > bestScore) {
      best = el
      bestScore = score
    }
  }
  return best
}

const findFieldByDescription = (description, title = '') => {
  let tokens = tokenize(description)
  if (tokens.length === 0) tokens = tokenize(title)
  if (tokens.length === 0) return null
  const phrase = normalize(description)

  const candidates = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(
    (el) =>
      isVisible(el) &&
      !el.disabled &&
      (el.getAttribute('type') || '').toLowerCase() !== 'hidden'
  )

  let best = null
  let bestScore = 0
  for (const el of candidates) {
    const haystack = fieldHaystack(el)
    let score = 0
    for (const token of tokens) {
      if (haystack.includes(token)) score += 1
    }
    if (phrase.length > 1 && haystack.includes(phrase)) score += tokens.length
    if (score === 0) continue
    if (score > bestScore) {
      best = el
      bestScore = score
    }
  }
  return best
}

const setNativeValue = (el, value) => {
  const proto = Object.getPrototypeOf(el)
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (descriptor && descriptor.set) descriptor.set.call(el, value)
  else el.value = value
}

const setNativeChecked = (el, checked) => {
  const proto = Object.getPrototypeOf(el)
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'checked')
  if (descriptor && descriptor.set) descriptor.set.call(el, checked)
  else el.checked = checked
}

const dispatchInputEvents = (el) => {
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

const getPortalOptionElements = () => {
  const found = []
  for (const container of Array.from(document.body.children)) {
    const style = window.getComputedStyle(container)
    if (!(style.position === 'absolute' || style.position === 'fixed')) continue
    if (parseInt(style.zIndex || '0', 10) < 1000) continue
    for (const el of Array.from(container.querySelectorAll('div, li, button, span'))) {
      if (!isVisible(el)) continue
      if (el.childElementCount > 2) continue
      const text = normalize(el.textContent)
      if (!text || text.length > 160) continue
      found.push({ el, text })
    }
  }
  return found.filter(
    (option) =>
      !found.some(
        (other) => other.el !== option.el && option.el.contains(other.el)
      )
  )
}

const waitForDropdownOptions = async (timeout = 450) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const options = getPortalOptionElements()
    if (options.length > 0) return options
    await sleep(80)
  }
  return []
}

const filterPortalOptions = (options, value) => {
  const tokens = tokenize(value)
  const needle = normalize(value)
  let best = null
  let bestScore = 0
  for (const option of options) {
    let score = 0
    for (const token of tokens) {
      if (option.text.includes(token)) score += 1
    }
    if (needle && option.text.includes(needle)) score += tokens.length + 2
    if (score > bestScore) {
      best = option
      bestScore = score
    }
  }
  if (!best && !needle) best = options[0]
  return best
}

const clickOptionElement = (el) => {
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }))
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }))
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
}

const selectDropdownOption = async (value, timeout = 450) => {
  const options = await waitForDropdownOptions(timeout)
  if (options.length === 0) return null
  const best = filterPortalOptions(options, value)
  if (!best) return null
  clickOptionElement(best.el)
  await sleep(120)
  return best.text
}

const readComboboxOptions = async (el) => {
  el.focus()
  const options = await waitForDropdownOptions(260)
  const texts = []
  for (const option of options) {
    if (!texts.includes(option.text)) texts.push(option.text)
  }
  el.blur()
  await sleep(220)
  return texts
}

const chooseSelectOption = (selectEl, value) => {
  const options = Array.from(selectEl.options).filter(
    (option) => option.value !== '' || normalize(option.text)
  )
  if (options.length === 0) return null
  const needle = normalize(value)
  const tokens = tokenize(value)
  let chosen =
    options.find((option) => normalize(option.value) === needle) ||
    options.find((option) => normalize(option.text) === needle) ||
    options.find((option) => needle && normalize(option.text).includes(needle)) ||
    options.find(
      (option) =>
        tokens.length > 0 &&
        tokens.every((token) => normalize(option.text).includes(token))
    )
  if (!chosen && !needle) chosen = options.find((option) => option.value !== '') || options[0]
  if (!chosen) return null
  setNativeValue(selectEl, chosen.value)
  dispatchInputEvents(selectEl)
  return normalize(chosen.text) || chosen.value
}

const fillRowCombobox = async (inputEl, value) => {
  if (!inputEl || inputEl.disabled) return null
  if (value === undefined || value === null || value === '') return null
  inputEl.focus()
  await sleep(80)
  setNativeValue(inputEl, String(value))
  dispatchInputEvents(inputEl)
  const chosen = await selectDropdownOption(String(value), 1600)
  inputEl.blur()
  await sleep(150)
  return chosen
}

const fillSalesRow = async (row, productInput, item) => {
  const done = []
  if (item.product) {
    const chosen = await fillRowCombobox(productInput, item.product)
    done.push(chosen ? `product=${item.product}` : `product FAILED (not selected)`)
  }
  if (item.description) {
    const desc = row.querySelector('input[placeholder="Details..."]')
    if (desc && !desc.disabled) {
      setNativeValue(desc, String(item.description))
      dispatchInputEvents(desc)
      done.push('description ok')
    }
  }
  if (item.qty !== undefined && item.qty !== null && item.qty !== '') {
    const qty =
      row.querySelector('input[placeholder="1"]') ||
      Array.from(row.querySelectorAll('input[type="number"]')).find((el) => !el.disabled)
    if (qty) {
      setNativeValue(qty, String(item.qty))
      dispatchInputEvents(qty)
      done.push(`qty=${item.qty}`)
    }
  }
  if (item.price !== undefined && item.price !== null && item.price !== '') {
    const price = row.querySelector('input[placeholder="0.00"]')
    if (price) {
      setNativeValue(price, String(item.price))
      dispatchInputEvents(price)
      done.push(`price=${item.price}`)
    }
  }
  if (item.discount !== undefined && item.discount !== null && item.discount !== '') {
    const disc = row.querySelector('input[placeholder="0"]')
    if (disc) {
      setNativeValue(disc, String(item.discount))
      dispatchInputEvents(disc)
      done.push(`disc=${item.discount}`)
    }
  }
  const rowSelects = Array.from(row.querySelectorAll('select'))
  if (item.vatType && rowSelects[0]) {
    if (chooseSelectOption(rowSelects[0], item.vatType)) done.push(`vat=${item.vatType}`)
  }
  if (item.discountType && rowSelects[1]) {
    if (chooseSelectOption(rowSelects[1], item.discountType)) done.push(`discType=${item.discountType}`)
  }
  if (item.responsibilityCenter) {
    const resp = row.querySelector('input[placeholder="Select"]')
    if (resp) {
      const chosen = await fillRowCombobox(resp, item.responsibilityCenter)
      if (chosen) done.push('resp center ok')
    }
  }
  return done.join(', ')
}

const fillField = async (fieldDescription, value) => {
  const el = await waitForField(fieldDescription)
  if (!el) return { ok: false, field: fieldDescription, detail: 'field not found' }
  const label =
    getFieldLabel(el) ||
    el.getAttribute('placeholder') ||
    el.getAttribute('name') ||
    fieldDescription
  const tag = el.tagName.toLowerCase()
  const type = (el.getAttribute('type') || '').toLowerCase()

  if (tag === 'select') {
    const chosen = chooseSelectOption(el, value)
    return chosen
      ? { ok: true, field: label, detail: `selected "${chosen}"` }
      : { ok: false, field: label, detail: 'no selectable options' }
  }

  if (type === 'checkbox' || type === 'radio') {
    const truthy = value === true || ['true', 'yes', 'y', '1', 'checked', 'on'].includes(normalize(value))
    setNativeChecked(el, truthy)
    dispatchInputEvents(el)
    return { ok: true, field: label, detail: truthy ? 'checked' : 'unchecked' }
  }

  el.focus()
  setNativeValue(el, value === undefined || value === null ? '' : String(value))
  dispatchInputEvents(el)

  const chosen = await selectDropdownOption(value)
  if (chosen) return { ok: true, field: label, detail: `set and selected the option "${chosen}"` }

  return { ok: true, field: label, detail: `set to "${value}"` }
}

const NEW_PAGE_BUTTONS = {
  sales: 'New Sales',
  receipts: 'New Receipt',
  payments: 'New Payment',
  collections: 'New Collection',
  disbursement: 'New Disbursement',
  purchase: 'New Purchase',
  adjustments: 'New Adjustment'
}

const transactionPageKey = (input) => {
  const raw = String(input || '').trim().toLowerCase()
  if (!raw) return null
  const seg = raw.replace(/^\/+/, '').replace(/[_\s]+/g, ' ').replace(/\/$/, '')
  for (const key of Object.keys(NEW_PAGE_BUTTONS)) {
    if (seg === key) return key
  }
  const described = seg
    .replace(/\b(the|a|an|form|page|screen|new|create|add|record|transaction)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (described.includes('purchase order')) return null
  for (const key of Object.keys(NEW_PAGE_BUTTONS)) {
    if (described === key || described.includes(key) || key.startsWith(described)) return key
  }
  return null
}

const PARTY_HINT = /select (customer|vendor)|(customer|vendor|payee|supplier)/i

const findPartyField = () =>
  Array.from(document.querySelectorAll(FIELD_SELECTOR)).find(
    (el) => isVisible(el) && !el.disabled && PARTY_HINT.test(el.getAttribute('placeholder') || '')
  )

const findReferenceField = () => {
  const candidates = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(
    (el) => isVisible(el) && !el.disabled
  )
  return (
    candidates.find((el) => /reference/.test(fieldHaystack(el))) ||
    candidates.find((el) => /\b(ref|ref no|doc ref|transaction no)\b/.test(fieldHaystack(el))) ||
    candidates.find((el) => (el.getAttribute('placeholder') || '').startsWith('INV-'))
  )
}

const isTransactionFormOpen = async () => {
  await sleep(250)
  return (
    !!findPartyField() ||
    !!findReferenceField() ||
    !!findElementByDescription('Save Draft') ||
    !!findElementByDescription('Post Transaction')
  )
}

const getProductRowInputs = () =>
  Array.from(document.querySelectorAll('input[placeholder="Search product..."]')).filter(
    (el) => isVisible(el) && !el.disabled
  )

const describeCurrentPage = () => {
  const digest = { sections: [], buttons: [], fields: [], dropdowns: [], fileInputs: 0 }
  for (const heading of document.querySelectorAll('h2, h3')) {
    const text = normalize(heading.textContent)
    if (text && text.length < 60) digest.sections.push(text)
  }
  for (const btn of document.querySelectorAll('button, [role="button"]')) {
    if (!isVisible(btn)) continue
    const text = normalize(btn.textContent)
    if (text && text.length < 40) digest.buttons.push(text)
  }
  for (const el of document.querySelectorAll(FIELD_SELECTOR)) {
    if (!isVisible(el) || el.disabled) continue
    if ((el.getAttribute('type') || '').toLowerCase() === 'hidden') continue
    if (el.type === 'file') {
      digest.fileInputs += 1
      continue
    }
    const label =
      getFieldLabel(el) ||
      el.getAttribute('placeholder') ||
      el.getAttribute('name') ||
      el.tagName.toLowerCase()
    const fieldType = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase()
    const required = el.required || el.getAttribute('aria-required') === 'true'
    digest.fields.push(
      `${String(label).slice(0, 80)} (${fieldType}${required ? ', required' : ''})`
    )
    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options)
        .map((option) => normalize(option.text))
        .filter(Boolean)
        .slice(0, 30)
        .join(' | ')
      if (options) digest.dropdowns.push(`${String(label).slice(0, 50)}: ${options}`)
    }
  }
  digest.sections = [...new Set(digest.sections)].slice(0, 30)
  digest.buttons = [...new Set(digest.buttons)].slice(0, 30)
  digest.fields = [...new Set(digest.fields)].slice(0, 60)
  digest.dropdowns = [...new Set(digest.dropdowns)].slice(0, 15)
  return digest
}

const findRemarksField = () => {
  const candidates = Array.from(document.querySelectorAll('textarea')).filter(
    (el) => isVisible(el) && !el.disabled
  )
  return (
    candidates.find((el) => /remark|note|memo|justif/i.test(fieldHaystack(el))) ||
    candidates.find((el) =>
      /remark|note|memo|justif/i.test(el.getAttribute('placeholder') || '')
    ) ||
    candidates[0] || null
  )
}

const fillRemarks = async (remarks) => {
  const el = findRemarksField()
  if (!el) return { ok: false, detail: 'no remarks textarea found' }
  el.focus()
  setNativeValue(el, String(remarks))
  dispatchInputEvents(el)
  return { ok: true, detail: 'set' }
}

const fillAttachmentRows = async (attachments) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return []
  const report = []
  let fileNameInputs = () =>
    Array.from(document.querySelectorAll('input[placeholder="e.g. Invoice_Scan"]')).filter(
      (el) => isVisible(el)
    )
  for (let index = 0; index < attachments.length; index += 1) {
    if (index >= fileNameInputs().length) {
      const addFileBtn = findElementByDescription('Add File')
      if (addFileBtn) {
        addFileBtn.click()
        await sleep(250)
      } else {
        report.push(`Attachment ${index + 1} FAILED: no "Add File" button`)
        continue
      }
      if (index >= fileNameInputs().length) {
        report.push(`Attachment ${index + 1} FAILED: row not added`)
        continue
      }
    }
    const row = fileNameInputs()[index].closest('tr')
    const attachment = attachments[index]
    if (!row) continue
    if (attachment.fileName) {
      const input = row.querySelector('input[placeholder="e.g. Invoice_Scan"]')
      if (input) {
        setNativeValue(input, String(attachment.fileName))
        dispatchInputEvents(input)
      }
    }
    if (attachment.remarks) {
      const note = row.querySelector('input[placeholder="Add note..."]')
      if (note) {
        setNativeValue(note, String(attachment.remarks))
        dispatchInputEvents(note)
      }
    }
    report.push(
      `Attachment ${index + 1}: row ready — the file itself must be chosen by the user (browser security)`
    )
  }
  return report
}

const resolveRoute = (input) => {
  if (!input) return null
  const raw = String(input).trim()
  if (raw.length === 0) return null
  const keys = Object.keys(SITE_MAP)
  const keySlug = (key) =>
    key.replace(/^\//, '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '')

  if (raw.startsWith('/')) {
    const target = slug(raw)
    if (!target) return null
    const exact = keys.find((key) => keySlug(key) === target)
    if (exact) return exact
    const partial = keys.find(
      (key) => keySlug(key).includes(target) || target.includes(keySlug(key))
    )
    return partial || null
  }

  const cleaned = raw
    .toLowerCase()
    .replace(/\b(page|route|section|tab|screen|the|go|to)\b/g, ' ')
    .trim()
  const target = slug(cleaned)
  if (!target) return null
  const exact = keys.find((key) => keySlug(key) === target)
  if (exact) return exact
  const partial = keys.find(
    (key) => keySlug(key).includes(target) || target.includes(keySlug(key))
  )
  return partial || null
}

const WORKFLOWS = {
  'create and collect a sale': [
    'Step 1: navigateTo(\'sales\') and fill the customer, dates and line items, then createTransactionRecord with action draft or post.',
    'Step 2: navigateTo(\'receipts\'), select the posted invoice, record the payment from the customer.'
  ],
  'create and post a sale': [
    'Step 1: navigateTo(\'sales\'), fill customer, dates and line items via createTransactionRecord, choose action post.'
  ],
  'record a receipt': [
    'Step 1: navigateTo(\'receipts\'), pick the customer, enter the amount and detail, then createTransactionRecord action draft or post.'
  ],
  'record a payment': [
    'Step 1: navigateTo(\'payments\'), pick the vendor, enter the amount and detail, then createTransactionRecord action draft or post.'
  ],
  'record a disbursement': [
    'Step 1: navigateTo(\'disbursement\'), pick the vendor, enter the amount and detail, then createTransactionRecord action draft or post.'
  ],
  'create and pay a purchase': [
    'Step 1: navigateTo(\'purchase\'), fill vendor, dates and line items via createTransactionRecord, then post.',
    'Step 2: navigateTo(\'payments\') and record the payment to the vendor.'
  ],
  'create a product or service': [
    'Step 1: navigateTo(\'product_service\'), open the add form with the Add Product button, fill the details and save.'
  ],
  'add a customer': [
    'Step 1: navigateTo(\'customers\'), click the add customer button, fill the customer form and save.'
  ],
  'add a vendor': [
    'Step 1: navigateTo(\'vendors\'), click the add vendor button, fill the vendor form and save.'
  ],
  'create an adjustment entry': [
    'Step 1: navigateTo(\'adjustments\'), fill the account and amount entries with the generic fill actions, then save.'
  ],
  'do bank reconciliation': [
    'Step 1: navigateTo(\'bank-reconciliation\'), load the bank statement, match transactions and save.'
  ]
}

const waitForElement = async (description, title, timeout = 1500) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const el = findElementByDescription(description, title)
    if (el) return el
    await sleep(100)
  }
  return null
}

const waitForField = async (description, title, timeout = 1500) => {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const el = findFieldByDescription(description, title)
    if (el) return el
    await sleep(100)
  }
  return null
}

const AIGuideController = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const locationRef = useRef(location)
  const navigateRef = useRef(navigate)

  const pageDigestRef = useRef('')
  const [pageDigest, setPageDigest] = useState(() => describeCurrentPage())

  useEffect(() => {
    locationRef.current = location
  }, [location])

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  const refreshPageDigestNow = () => {
    let next
    try {
      next = describeCurrentPage()
    } catch {
      return
    }
    const key = JSON.stringify(next)
    if (key !== pageDigestRef.current) {
      pageDigestRef.current = key
      setPageDigest(next)
    }
  }

  useEffect(() => {
    const settle = setTimeout(refreshPageDigestNow, 900)
    const interval = setInterval(refreshPageDigestNow, 4000)
    return () => {
      clearTimeout(settle)
      clearInterval(interval)
    }
  }, [location.pathname])

  const refreshPageDigest = () => setTimeout(refreshPageDigestNow, 700)

  const goToRoute = async (targetRoute) => {
    const route = resolveRoute(targetRoute)
    if (route && locationRef.current.pathname !== route) {
      navigateRef.current(route)
      await sleep(250)
      return route
    }
    return locationRef.current.pathname
  }

  const showFallbackTour = (steps) => {
    const stepData = steps.map((s) => ({
      title: (s.popover && s.popover.title) || '',
      description: (s.popover && s.popover.description) || '',
      element: s.element || null
    }))
    const removeCard = () => {
      const card = document.getElementById('ai-guide-fallback')
      if (card) card.remove()
    }
    if (document.getElementById('ai-guide-fallback')) removeCard()

    const card = document.createElement('div')
    card.id = 'ai-guide-fallback'
    card.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483000;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;'
    const box = document.createElement('div')
    box.style.cssText =
      'background:#fff;color:#111;max-width:480px;width:92%;border-radius:14px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.45);'
    const titleEl = document.createElement('h3')
    titleEl.style.cssText = 'margin:0 0 8px;font-size:17px;'
    const descEl = document.createElement('p')
    descEl.style.cssText = 'margin:0 0 16px;font-size:14px;line-height:1.5;white-space:pre-wrap;'
    const footer = document.createElement('div')
    footer.style.cssText = 'display:flex;gap:8px;justify-content:space-between;align-items:center;'
    const dots = document.createElement('span')
    dots.style.cssText = 'font-size:12px;color:#666;'
    const makeBtn = (label) => {
      const btn = document.createElement('button')
      btn.textContent = label
      btn.style.cssText =
        'border:1px solid #cbd5e1;background:#f1f5f9;color:#111;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;'
      return btn
    }
    const prev = makeBtn('\u2039 Prev')
    const next = makeBtn('Next \u203A')
    const close = makeBtn('Close')
    close.style.background = '#0f172a'
    close.style.color = '#fff'

    let index = 0
    const render = () => {
      const s = stepData[index] || {}
      titleEl.textContent = s.title || 'Step'
      descEl.textContent = s.description || ''
      dots.textContent = `${index + 1} / ${stepData.length}`
      prev.disabled = index === 0
      next.disabled = index === stepData.length - 1
      if (s.element && s.element.scrollIntoView) {
        try {
          s.element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        } catch (err) {
          void err
        }
      }
    }
    prev.addEventListener('click', () => {
      index = Math.max(0, index - 1)
      render()
    })
    next.addEventListener('click', () => {
      index = Math.min(stepData.length - 1, index + 1)
      render()
    })
    const destroy = () => {
      removeCard()
      close.removeEventListener('click', destroy)
    }
    close.addEventListener('click', destroy)
    card.addEventListener('click', (e) => {
      if (e.target === card) destroy()
    })

    box.appendChild(titleEl)
    box.appendChild(descEl)
    footer.appendChild(dots)
    footer.appendChild(prev)
    footer.appendChild(next)
    footer.appendChild(close)
    box.appendChild(footer)
    card.appendChild(box)
    document.body.appendChild(card)
    render()
  }

  const launchDriverTour = (steps) => {
    let driverObj = null
    try {
      driverObj = driver({ showProgress: true, allowClose: true, allowKeyboardControl: true, steps })
      driverObj.drive()
    } catch (err) {
      console.error('[AI Guide] driver.js threw:', err)
      driverObj = null
    }
    setTimeout(() => {
      const overlay = document.querySelector('.driver-overlay') || document.querySelector('.driver-popover')
      if (!overlay) {
        console.warn('[AI Guide] driver overlay not found - falling back to a step card.')
        showFallbackTour(steps)
      } else {
        console.log('[AI Guide] driver overlay active:', overlay.className)
      }
    }, 450)
  }

  const highlight = (element, title, explanation) => {
    launchDriverTour([
      {
        element,
        popover: {
          title: title || 'Here',
          description: explanation || ''
        }
      }
    ])
  }

  const runGuidedTour = async (entry, targetRoute) => {
    if (targetRoute) await goToRoute(targetRoute)
    await sleep(800)

    const tourSteps = []
    tourSteps.push({
      popover: {
        title: entry.title,
        description: entry.body || 'Follow the highlighted steps.'
      }
    })

    const guideSteps =
      Array.isArray(entry.steps) && entry.steps.length > 0
        ? entry.steps
        : Array.isArray(entry.bullets)
          ? entry.bullets
          : []

    for (const step of guideSteps) {
      const label = step.label || ''
      const desc = step.desc || ''
      const el = findElementByDescription(label, label)
      if (el) {
        const isOpener =
          /add|new|open|create/i.test(label) &&
          !/save|post|submit|delete|update|apply|approve/i.test(label)
        if (isOpener && el.tagName === 'BUTTON' && !el.disabled) {
          el.click()
          await sleep(600)
        }
        tourSteps.push({
          element: el,
          popover: { title: label, description: desc }
        })
      } else {
        tourSteps.push({ popover: { title: label, description: desc } })
      }
    }

    if (entry.note) {
      tourSteps.push({ popover: { title: 'Note', description: entry.note } })
    }

    launchDriverTour(tourSteps)
    return `Started the "${entry.title}" walkthrough (${guideSteps.length} steps).`
  }

  const actionVerb = (text) => {
    if (/add|new|create/i.test(text)) return 'add a new record'
    if (/edit/i.test(text)) return 'edit the selected record'
    if (/delete/i.test(text)) return 'remove the selected record'
    if (/search|filter/i.test(text)) return 'filter or search the list'
    if (/export|download/i.test(text)) return 'export the data'
    if (/import|upload/i.test(text)) return 'import data from a file'
    if (/post|book|approve/i.test(text)) return 'finalize the transaction'
    if (/print/i.test(text)) return 'print the document'
    if (/save/i.test(text)) return 'save your changes'
    return 'perform this action'
  }

  const guideCurrentPage = () => {
    const route = SITE_MAP.find((r) => r.path === locationRef.current.pathname)
    const label = route ? route.label : locationRef.current.pathname
    const steps = []
    let intro = route ? route.summary : 'Here are the key elements of this page.'
    if (route && route.keyElements && route.keyElements.length) {
      intro += ` Key elements: ${route.keyElements.slice(0, 8).join(', ')}.`
    }
    steps.push({ popover: { title: `This page: ${label}`, description: intro } })

    const digest = describeCurrentPage()
    let buttonCount = 0
    for (const text of digest.buttons) {
      if (buttonCount >= 6) break
      if (!/add|new|create|search|filter|export|import|upload|post|approv|save|edit|view|print|download/i.test(text)) continue
      const el = findElementByDescription(text, text)
      if (!el) continue
      steps.push({
        element: el,
        popover: { title: `Button: ${text}`, description: `Click this to ${actionVerb(text)}.` }
      })
      buttonCount += 1
    }

    let fieldCount = 0
    for (const item of digest.fields) {
      if (fieldCount >= 6) break
      const name = String(item).split(' (')[0]
      const el = findFieldByDescription(name, name)
      if (!el) continue
      steps.push({
        element: el,
        popover: { title: `Field: ${name}`, description: 'Enter data here.' }
      })
      fieldCount += 1
    }

    if (steps.length === 1) {
      steps.push({
        popover: { title: label, description: 'No interactive elements detected on this page.' }
      })
    }

    launchDriverTour(steps)
    return `Started the tour of ${label} (${steps.length - 1} highlighted spots).`
  }

  useCopilotReadable({
    description:
      'The ONLY valid routes of this app, generated directly from the real router config. Use these exact paths; never guess or invent a path.',
    value: {
      currentPath: location.pathname,
      siteMap: SITE_MAP
    }
  })

  useCopilotReadable({
    description:
      'Known multi-page workflows. If the user asks how to do one of these, follow the listed steps. If a workflow is not listed here, say you do not know it - never improvise a flow.',
    value: {
      knownWorkflows: WORKFLOWS
    }
  })

  useCopilotReadable({
    description:
      'ACCOUNTING RULEBOOK (Domain Knowledge Index): how each financial event is classified and WHERE it is recorded in this app. For ANY question like "where do I record X" or "what category does X belong to", FIRST look up X in this rulebook. Match the user\u2019s intent to the closest real category here, then call guideUserToCategory(categoryKey) so the user is TAKEN to the right page and the right button is highlighted with an explanation. Only use real categoryKey values listed below - never invent a category, never invent the Other Income / Capital Gains category for operating sales, and never treat trading/other income as standard product sales.',
    value: {
      rulebook: {
        accountingKnowledge: ACCOUNTING_RULEBOOK
      }
    }
  })

  useCopilotReadable({
    description:
      'The sections of the official user guide that are available. For any "how do I..." question, call searchDocumentation(query) and answer from the returned section text.',
    value: {
      guideSections: GUIDE_ENTRIES.map((entry) => `${entry.id} ${entry.title}`)
    }
  })

  useCopilotReadable({
    description:
      'The LIVE structure of the current page, read from the screen right now: every section, button, field, dropdown and attachment input. Read this before choosing which fields to fill — it lists the full form including "Add Product / Service" row buttons, the Remarks textarea and the attachments ("Add File") area that manual overviews omit.',
    value: {
      currentPath: location.pathname,
      pageStructure: pageDigest
    }
  })

  useCopilotReadable({
    description: 'Structured facts about how each form must be filled',
    value:
      'FORM FACTS (structured, apply ONLY when acting on that page): ' +
      'Transaction forms (/sales, /receipts, /payments, /disbursement, /purchase): their line items table starts EMPTY and rows appear only after clicking "Add Product / Service"; each row has Product/Service, COA, Description, Qty, Price, Discount, Discount Type, VAT %, WHT % and Resp. Center (Product/Service, COA, VAT and WHT are searchable dropdowns). Journal Entries are auto-calculated and never edited. Sales and Purchase also have Terms, Date Delivered and Date Due. ' +
      'Attachments and Remarks (every transaction form): ends with an "Attachments" card whose rows are added via "Add File" (File Name input, a real file input, a per-file Remarks input) and a "Remarks & Internal Notes" textarea. You CANNOT choose real files (browser security): prepare the rows and tell the user to select the files. ' +
      'Before finishing any transaction ALWAYS ask draft or post, and never click either button without an explicit answer. ' +
      '/adjustments: no "Add Product / Service" rows, account-and-amount based, DOES have Remarks and Attachments, filled with generic fill actions. ' +
      'All other pages: use clickElement and fillForm.'
  })

  useCopilotReadable({
    description: 'Rules for how the assistant must guide the user',
    value:
      'Guide behavior - classify every message first. '
      + 'COMMAND (imperative: "go to X", "create a sale", "fill this", "approve this"): act immediately, no narration, confirm only before posting/approving/deleting a transaction. "go to <page>" calls navigateTo. '
      + 'QUESTION (interrogative: "how do I make a customer", "where is the trial balance", "what does this do"): "how do I ..." calls startGuide so the user is SHOWN the steps on screen with highlights (do not only answer in chat); "where is X" calls navigateToAndHighlight. General page guidance ("guide me on this page", "guide me around", "what can I do here", "explain this page", "teach me this page", "give me a tour of this page") calls guideThisPage. Never reply with a list of options ("would you like to...", "do you want to...") and never ask what to do. Never take a destructive action from a question. '
      + 'For a single field such as a search box, a filter, or a date range, use interactWithCurrentPage(fieldLabel, value). '
      + 'Convert natural-language dates yourself into the target field format; never ask the user to reformat. '
      + 'Only apply a page\u2019s rules when acting on that page; never apply one page\u2019s rules to another page or to navigation. '
      + 'Only reference routes, fields and buttons that appear in the provided site map and live page structure. Never guess a path. '
      + 'If a route or workflow is not in the provided data, say you do not know it - do not invent one. '
      + 'Never invent restrictions, permissions or "authorization" requirements beyond what is stated for the current page. '
      + 'For a "how do I..." question you may also call searchDocumentation(query) to read the guide text. '
      + 'Creating ANY transaction ALWAYS calls createTransactionRecord (never fillForm). Before it, read the live page structure and ask the user for: the customer/vendor, dates, the exact line items (never invent products, quantities or prices), the remarks, whether files must be attached, and draft vs post.'
  })

  useCopilotAction({
    name: 'inspectForm',
    description:
      'List the form fields on the current page with their labels, types, required state, and the available options for dropdowns. Use this before filling a form so you can choose values or ask the user.',
    parameters: [
      {
        name: 'targetRoute',
        type: 'string',
        description: 'Optional route to navigate to before inspecting the form',
        required: false
      }
    ],
    handler: async ({ targetRoute }) => {
      await goToRoute(targetRoute)
      await sleep(200)
      const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(
        (el) =>
          isVisible(el) &&
          !el.disabled &&
          (el.getAttribute('type') || '').toLowerCase() !== 'hidden'
      )
      if (fields.length === 0) {
        return `No form fields are visible on ${locationRef.current.pathname}. If the form is not open, use inspectPage to find the button that opens it and click it first.`
      }
      const lines = []
      let probes = 0
      for (let index = 0; index < fields.length; index += 1) {
        const el = fields[index]
        const label =
          getFieldLabel(el) ||
          el.getAttribute('placeholder') ||
          el.getAttribute('name') ||
          `field ${index + 1}`
        const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase()
        const required = el.required || el.getAttribute('aria-required') === 'true'
        let extra = ''
        if (el.tagName === 'SELECT') {
          const opts = Array.from(el.options)
            .map((option) => normalize(option.text))
            .filter((text) => text && !/^select/.test(text))
          if (opts.length) extra = ` | options: ${opts.slice(0, 25).join(', ')}`
        } else if (
          (type === 'text' || type === 'search' || type === '') &&
          DROPDOWN_HINT.test(el.getAttribute('placeholder') || '') &&
          probes < 12
        ) {
          probes += 1
          const opts = await readComboboxOptions(el)
          if (opts.length) extra = ` | dropdown options: ${opts.slice(0, 25).join(', ')}`
        }
        lines.push(`- ${label} (${type}${required ? ', required' : ''})${extra}`)
      }
      return `Form fields on ${locationRef.current.pathname} (${
        fields.length
      }):\n${lines.join('\n')}`
    },
    render: ({ status }) =>
      status === 'complete' ? 'Checked the form.' : 'Reading the form\u2026'
  })

  useCopilotAction({
    name: 'navigateTo',
    description:
      'Navigate to a page WITHOUT highlighting anything. Use this for plain navigation commands like "go to sales", "open the dashboard", or "take me to the payments page". Always allowed on any page.',
    parameters: [
      {
        name: 'targetRoute',
        type: 'string',
        description: 'The page name or route to navigate to, e.g. "sales" or "/sales"',
        required: true
      }
    ],
    handler: async ({ targetRoute }) => {
      const route = await goToRoute(targetRoute)
      refreshPageDigest()
      return `Navigated to ${route}.`
    },
    render: ({ status, result }) =>
      status === 'complete' && typeof result === 'string'
        ? result
        : 'Navigating\u2026'
  })

  useCopilotAction({
    name: 'readPage',
    description:
      'Return the structured description of the current page (what it is, what is on it, whether it needs line items) so you can describe it without guessing.',
    parameters: [],
    handler: async () => {
      await sleep(150)
      const route = locationRef.current.pathname
      const entry = SITE_MAP[route] || {
        label: 'Unknown page',
        summary: 'Unknown page',
        keyElements: [],
        requiresLineItems: false
      }
      return `Page ${route} (${entry.label}): ${entry.summary}. Needs line items: ${
        entry.requiresLineItems
      }. Elements: ${(entry.keyElements || []).join(', ') || 'none listed.'}`
    },
    render: ({ status }) =>
      status === 'complete' ? 'Read the page.' : 'Reading page\u2026'
  })

  useCopilotAction({
    name: 'searchDocumentation',
    description:
      'Search the official user guide for how a page or task works. Call this for any "how do I..." question and answer from the returned guide text instead of guessing.',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'What the user wants to know, e.g. "create a sales invoice"',
        required: true
      }
    ],
    handler: async ({ query }) => {
      const results = searchGuideEntries(query)
      if (results.length === 0) {
        return `The user guide has no section matching "${query}".`
      }
      return results
        .map(
          (result) =>
            `# ${result.title} (section ${result.id})\n${result.text.slice(0, 1500)}`
        )
        .join('\n\n')
    },
    render: ({ status }) =>
      status === 'complete' ? 'Checked the user guide.' : 'Searching the guide\u2026'
  })

  useCopilotAction({
    name: 'startGuide',
    description:
      'Start an interactive on-screen walkthrough for a task. It navigates to the right page and highlights each step with a spotlight and popover, following the official user guide. Use this for any "how do I ..." question so the user is shown, not just told.',
    parameters: [
      {
        name: 'topic',
        type: 'string',
        description: 'The task or guide section, e.g. "make a customer", "create a sales invoice"',
        required: true
      },
      {
        name: 'targetRoute',
        type: 'string',
        description: 'The route to open first, e.g. /customers. Omit to stay on the current page.',
        required: false
      }
    ],
    handler: async ({ topic, targetRoute }) => {
      const results = searchGuideEntries(topic)
      if (results.length === 0) {
        return `The user guide has no section matching "${topic}", so I cannot start a walkthrough.`
      }
      return runGuidedTour(results[0], targetRoute)
    },
    render: ({ status }) =>
      status === 'complete' ? 'Started the walkthrough.' : 'Preparing the walkthrough\u2026'
  })

  useCopilotAction({
    name: 'guideThisPage',
    description:
      'Run an interactive spotlight tour of the CURRENT page: highlight each useful button and field with popovers explaining what they do. Use for general page-guidance requests like "guide me on this page", "guide me around", "show me what I can do here", "explain this page", "teach me this page", "give me a tour of this page". NEVER answer such requests with a list of options or a clarifying question.',
    parameters: [],
    handler: async () => {
      const raw = guideCurrentPage()
      refreshPageDigest()
      return raw
    },
    render: ({ status }) =>
      status === 'complete' ? 'Started the page tour.' : 'Scanning the page\u2026'
  })

  useCopilotAction({
    name: 'interactWithCurrentPage',
    description:
      'Set or fill a field on the current page by matching the label the user used, in their own words (e.g. "date from", "start date", "search", "customer"). Use this for search boxes, filters, date ranges and any single field you were not given an explicit action for. Handles text, date, select and searchable dropdown fields.',
    parameters: [
      {
        name: 'fieldLabel',
        type: 'string',
        description: 'The field as the user described it, e.g. "date from" or "search"',
        required: true
      },
      {
        name: 'value',
        type: 'string',
        description: 'The value to set (already converted to the format the field expects)',
        required: true
      }
    ],
    handler: async ({ fieldLabel, value }) => {
      const el = findFieldByDescription(fieldLabel, fieldLabel)
      if (!el) {
        return `No field matching "${fieldLabel}" is visible on ${locationRef.current.pathname}.`
      }
      if (el.tagName === 'SELECT') {
        const applied = await selectDropdownOption(value, 1200)
        refreshPageDigest()
        return applied
          ? `Set "${fieldLabel}" to "${value}".`
          : `Could not choose "${value}" in "${fieldLabel}".`
      }
      const type = (el.getAttribute('type') || '').toLowerCase()
      const placeholder = el.getAttribute('placeholder') || ''
      if ((type === 'text' || type === 'search' || type === '') && DROPDOWN_HINT.test(placeholder)) {
        await fillRowCombobox(el, value)
      } else {
        el.focus()
        setNativeValue(el, type === 'date' ? value : String(value))
        dispatchInputEvents(el)
      }
      refreshPageDigest()
      return `Set "${fieldLabel}" to "${value}".`
    },
    render: ({ status }) =>
      status === 'complete' ? 'Updated the field.' : 'Finding the field\u2026'
  })

  useCopilotAction({
    name: 'navigateToAndHighlight',
    description:
      'Navigate to a route (optional) and highlight a specific element, then explain it. Use this to point something out and let the user confirm it is what they meant.',
    parameters: [
      {
        name: 'targetRoute',
        type: 'string',
        description: 'Route to navigate to (e.g., /sales). Leave empty to stay on the current page.',
        required: false
      },
      {
        name: 'elementDescription',
        type: 'string',
        description:
          'Text, label, button name, or placeholder that identifies the element to highlight (e.g., "New Sales button", "Document Reference").',
        required: true
      },
      {
        name: 'title',
        type: 'string',
        description: 'Short title for the highlight popover',
        required: true
      },
      {
        name: 'explanation',
        type: 'string',
        description: 'Explanation shown to the user about this element',
        required: true
      }
    ],
    handler: async ({ targetRoute, elementDescription, title, explanation }) => {
      const route = await goToRoute(targetRoute)
      const element = await waitForElement(elementDescription, title)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await sleep(150)
        highlight(element, title, explanation)
        const info = describeElement(element)
        return `Highlighted ${info.summary} on ${route}. Explanation: ${explanation}`
      }
      const fallback = document.querySelector('main') || document.body
      highlight(fallback, title, explanation)
      return `I could not find an element matching "${elementDescription}" on ${route}, so I highlighted the page. Tell the user what you were looking for and ask them to point it out.`
    },
    render: ({ status, result }) =>
      status === 'complete' && typeof result === 'string'
        ? result
        : 'Navigating and highlighting\u2026'
  })

  useCopilotAction({
    name: 'guideUserToCategory',
    description:
      'Given a natural-language accounting/transaction request from the user, classify it against the ACCOUNTING_RULEBOOK and TAKES the user to the real page where that category is recorded, highlighting the real "New \u2026" button that starts the record, with a plain-language explanation. ALWAYS look the request up in ACCOUNTING_RULEBOOK (keyed by ACCOUNTING_RULEBOOK.categoryKey) to find (1) the real route and (2) the real targetLabel button to highlight. NEVER invent a category, NEVER invent a page or an element label that is not in ACCOUNTING_RULEBOOK, and NEVER treat Other Income / capital gains / trading income as standard product sales. If the user\u2019s request does not match any entry in ACCOUNTING_RULEBOOK, say so and ask for clarification - do not improvise.',
    parameters: [
      {
        name: 'categoryKey',
        type: 'string',
        description:
          'The ACCOUNTING_RULEBOOK.categoryKey that best matches the user\u2019s request (e.g. "sales", "receipts", "payments", "disbursement", "collections", "purchase", "purchaseOrder", "adjustments", "advances", "otherIncome", "vat", "withholdingTax", "trialBalance", "generalLedger", "incomeStatement", "journalEntries", "agingReceivables", "agingPayables", "balanceSheet", "bankReconciliation", "auditTrail", "customerTransactions", "vendorTransactions", "taxCompliance"). Map the user\u2019s natural-language intent to the closest real categoryKey.',
        required: true
      }
    ],
    handler: async ({ categoryKey }) => {
      const rule = ACCOUNTING_RULEBOOK.categoryRules?.[categoryKey]
      if (!rule) {
        return `"${categoryKey}" is not a categoryKey in ACCOUNTING_RULEBOOK. Ask the user to clarify what they want, then remap it to a valid categoryKey - do not improvise a category, route, or element label.`
      }
      const { route, targetLabel, explanation } = rule
      const navigateResult = await goToRoute(route)
      await new Promise((resolve) => setTimeout(resolve, 150))
      const element = await waitForElement(targetLabel, targetLabel)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        await new Promise((resolve) => setTimeout(resolve, 100))
        highlight(element, targetLabel, explanation)
        const info = describeElement(element)
        return `I took you to the ${rule.type} page (${route}) and highlighted the "${info.summary}" button that records it. ${explanation}`
      }
      const fallback = document.querySelector('main') || document.body
      highlight(fallback, rule.type, explanation)
      return `I navigated to ${route} (${rule.type}) but could not find the "${targetLabel}" button to highlight. I highlighted the page instead. Ask the user to point out the button that creates it.`
    },
    render: ({ status }) =>
      status === 'complete' ? 'Category located.' : 'Locating the category\u2026'
  })

  useCopilotAction({
    name: 'clickElement',
    description:
      'Navigate (optional) and click a button, link, or interactive element on the page, then report what was clicked.',
    parameters: [
      {
        name: 'elementDescription',
        type: 'string',
        description: 'Text, label, or name of the element to click (e.g., "New Sales button")',
        required: true
      },
      {
        name: 'targetRoute',
        type: 'string',
        description: 'Optional route to navigate to before clicking',
        required: false
      }
    ],
    handler: async ({ elementDescription, targetRoute }) => {
      const route = await goToRoute(targetRoute)
      const element =
        findElementByDescription(elementDescription) ||
        (await waitForElement(elementDescription))
      if (!element) {
        return `I could not find "${elementDescription}" to click on ${route}. Use inspectPage to list what is available, then ask the user which one they meant.`
      }
      const info = describeElement(element)
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await sleep(150)
      element.click()
      await sleep(400)
      refreshPageDigest()
      return `Clicked ${info.summary} on ${route}. Confirm with the user whether this is what they wanted.`
    },
    render: ({ status, result }) =>
      status === 'complete' && typeof result === 'string'
        ? result
        : 'Clicking the element\u2026'
  })

  useCopilotAction({
    name: 'fillForm',
    description:
      'Fill one or more form fields by label, placeholder, or name. For dropdowns the value is matched to an available option. If a value cannot be matched or the field is ambiguous, the result lists what happened so you can ask the user.',
    parameters: [
      {
        name: 'fields',
        type: 'object',
        description:
          'Object mapping field labels/placeholders to values, e.g. {"Document Reference":"ADJ-001","Posting Date":"2026-09-18"}. Use inspectForm first when the form has dropdowns.',
        required: true
      }
    ],
    handler: async ({ fields }) => {
      const entries = Object.entries(fields || {})
      if (entries.length === 0) return 'No fields were provided to fill.'
      const results = []
      for (const [fieldDescription, value] of entries) {
        const result = await fillField(fieldDescription, value)
        results.push(result)
      }
      const lines = results.map((result) =>
        result.ok
          ? `- ${result.field}: ${result.detail}`
          : `- ${result.field}: FAILED (${result.detail})`
      )
      const failed = results.filter((result) => !result.ok).length
      const header =
        failed === 0
          ? 'Filled the form'
          : `Filled ${results.length - failed} of ${results.length} fields`
      refreshPageDigest()
      return `${header} on ${locationRef.current.pathname}:\n${lines.join(
        '\n'
      )}\n\nConfirm the values with the user and ask about any field that failed.`
    },
    render: ({ status, result }) =>
      status === 'complete' && typeof result === 'string'
        ? result
        : 'Filling in the form\u2026'
  })

  useCopilotAction({
    name: 'createTransactionRecord',
    description:
      'Create ANY transaction record in ONE call covering the WHOLE form: opens the right form if needed, selects the customer/vendor, fills the reference, terms/dates, remarks and attachment rows (via "Add File"), then adds one row per line item (clicking "Add Product / Service" as needed) and fills each row. Journal Entries are calculated automatically and are never touched. Only after the user explicitly confirms, pass action="draft" or action="post".',
    parameters: [
      {
        name: 'page',
        type: 'string',
        description:
          'Which form to open: "sales", "receipts", "payments", "collections", "disbursement", "purchase" or "adjustments". Leave empty to use the current page.',
        required: false
      },
      {
        name: 'party',
        type: 'string',
        description: 'Customer or vendor (or payee) to select, as shown in the party dropdown',
        required: true
      },
      {
        name: 'reference',
        type: 'string',
        description: 'Document reference / number for the transaction',
        required: false
      },
      {
        name: 'termsOption',
        type: 'string',
        description: 'Terms option for forms that have it, e.g. the label in the Terms dropdown',
        required: false
      },
      {
        name: 'termsNumber',
        type: 'string',
        description: 'Terms number of days for forms that have it, e.g. "30"',
        required: false
      },
      {
        name: 'dateDelivered',
        type: 'string',
        description: 'Delivery date (YYYY-MM-DD) for forms that have it',
        required: false
      },
      {
        name: 'dateDue',
        type: 'string',
        description: 'Due date (YYYY-MM-DD) for forms that have it',
        required: false
      },
      {
        name: 'remarks',
        type: 'string',
        description: 'Text for the "Remarks & Internal Notes" textarea at the bottom of the form',
        required: false
      },
      {
        name: 'attachments',
        type: 'array',
        description:
          'Attachment rows to prepare in the Attachments card. Each object has keys: fileName and remarks. The actual file must still be selected by the user (the AI cannot pick files), so the handler adds the rows and fills the File Name and Remarks boxes.',
        required: false
      },
      {
        name: 'extraFields',
        type: 'object',
        description:
          'Any remaining labeled fields on this form, mapped by their label or placeholder to a value, e.g. {"OR Number":"1234","Bank Name":"BDO"}.',
        required: false
      },
      {
        name: 'items',
        type: 'array',
        description:
          'Line items for forms that use product rows (sales, receipts, payments, collections, disbursement, purchase). Each item is an object with keys: product (required), description, qty, price, vatType ("VAT-EX"/"VAT-INC"), discount, discountType ("PERCENT"/"FIXED"), responsibilityCenter. Never invent or duplicate items. Leave empty for adjustments.',
        required: false
      },
      {
        name: 'action',
        type: 'string',
        description: 'Finalize as "draft" or "post" ONLY after the user explicitly confirms. Otherwise leave empty.',
        required: false
      }
    ],
    handler: async ({
      page,
      party,
      reference,
      termsOption,
      termsNumber,
      dateDelivered,
      dateDue,
      remarks,
      attachments,
      extraFields,
      items,
      action
    }) => {
      const itemList = Array.isArray(items) ? items : []
      const report = []
      const key = transactionPageKey(page) || transactionPageKey(locationRef.current.pathname)
      const route = await goToRoute(key ? `/${key}` : null)
      await sleep(300)

      if (!(await isTransactionFormOpen())) {
        const newBtn = findElementByDescription(NEW_PAGE_BUTTONS[key] || 'New')
        if (newBtn) {
          newBtn.click()
          await sleep(700)
        }
      }

      const partyField = findPartyField()
      const refField = findReferenceField()
      if (!partyField && !refField) {
        return `I could not find the ${key || route} form. Ask the user to open it (click the "New" button), then try again.`
      }

      if (party && partyField) {
        const chosen = await fillRowCombobox(partyField, party)
        report.push(
          chosen ? `Party: ${party}` : `Party FAILED: could not select "${party}"`
        )
      } else if (party) {
        report.push(`Party FAILED: no customer/vendor field found on ${route}`)
      }

      if (reference && refField) {
        const result = await fillField('reference', reference)
        report.push(
          result.ok ? `Reference: ${reference}` : `Reference FAILED (${result.detail})`
        )
      } else if (reference && !refField) {
        report.push('Reference FAILED: no reference field found')
      }

      if (termsOption) {
        const result = await fillField('Terms', termsOption)
        report.push(
          result.ok ? `Terms: ${termsOption}` : 'Terms FAILED (no matching option)'
        )
      }
      if (termsNumber) {
        const result = await fillField('Number', termsNumber)
        report.push(result.ok ? `Terms days: ${termsNumber}` : 'Terms days FAILED')
      }
      if (dateDelivered) {
        const result = await fillField('Date Delivered', dateDelivered)
        report.push(result.ok ? `Date Delivered: ${dateDelivered}` : 'Date Delivered FAILED')
      }
      if (dateDue) {
        const result = await fillField('Date Due', dateDue)
        report.push(result.ok ? `Date Due: ${dateDue}` : 'Date Due FAILED')
      }
      if (remarks) {
        const result = await fillRemarks(remarks)
        report.push(
          result.ok ? `Remarks: set` : `Remarks FAILED (${result.detail})`
        )
      }
      if (Array.isArray(attachments) && attachments.length > 0) {
        const attachmentReport = await fillAttachmentRows(attachments)
        report.push(...attachmentReport)
        const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(
          (el) => isVisible(el)
        ).length
        if (fileInputs > 0) {
          report.push(
            `Reminder: ${fileInputs} file input(s) present — the user must pick the actual files.`
          )
        }
      }
      if (extraFields && typeof extraFields === 'object') {
        for (const [label, value] of Object.entries(extraFields)) {
          const result = await fillField(label, value)
          report.push(result.ok ? `${label}: ${value}` : `${label} FAILED (${result.detail})`)
        }
      }

      if (itemList.length > 0) {
        let productInputs = getProductRowInputs()
        let filledRows = 0
        for (let index = 0; index < itemList.length; index += 1) {
          const item =
            itemList[index] && typeof itemList[index] === 'object' ? itemList[index] : {}
          if (index >= productInputs.length) {
            const addBtn = findElementByDescription('Add Product / Service')
            if (addBtn) {
              addBtn.click()
              await sleep(350)
            }
            productInputs = getProductRowInputs()
            if (index >= productInputs.length) {
              report.push(`Item ${index + 1} FAILED: could not add row ${index + 1}`)
              continue
            }
          }
          const row = productInputs[index].closest('tr')
          if (!row) {
            report.push(`Item ${index + 1} FAILED: row not found`)
            continue
          }
          const detail = await fillSalesRow(row, productInputs[index], item)
          report.push(`Item ${index + 1}: ${detail}`)
          filledRows += 1
        }
        report.push(`Filled ${filledRows} of ${itemList.length} item row(s)`)
      }

      let finalStep = ''
      if (action === 'draft') {
        const draftBtn = findElementByDescription('Save Draft')
        if (draftBtn) {
          draftBtn.click()
          finalStep = '; clicked Save Draft'
        } else {
          finalStep = '; Save Draft button not found'
        }
      } else if (action === 'post') {
        const postBtn = findElementByDescription('Post Transaction')
        if (postBtn) {
          postBtn.click()
          finalStep = '; clicked Post Transaction'
        } else {
          finalStep = '; Post Transaction button not found'
        }
      }

      refreshPageDigest()
      const unresolvedFiles = Array.from(
        document.querySelectorAll('input[type="file"]')
      ).filter((el) => isVisible(el)).length
      if (unresolvedFiles > 0 && !finalStep.includes('not found')) {
        finalStep += `; ${unresolvedFiles} file input(s) still need the user to select the actual files`
      }

      const summary = report.join(' | ')
      return `${key || route} — ${report.length} step(s) reported: ${summary}${finalStep}. Ask the user to review before finalizing.`
    },
    render: ({ status }) =>
      status === 'complete' ? 'Transaction record created.' : 'Creating the transaction record\u2026'
  })

  return null
}

export default AIGuideController
