import test from 'node:test'
import assert from 'node:assert/strict'
import { getItemResponsibilityCenter } from './responsibilityCenterDefaults.js'

test('uses the item-specific responsibility center when present', () => {
  const item = { responsibilityCenter: 'RC-01' }
  assert.equal(getItemResponsibilityCenter(item, 'RC-02'), 'RC-01')
})

test('falls back to the bulk/default responsibility center when the item has none', () => {
  const item = { description: 'Line item' }
  assert.equal(getItemResponsibilityCenter(item, 'RC-03'), 'RC-03')
})
