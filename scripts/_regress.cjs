const fs=require('fs');
const p='D:/5L_SYSTEMS/accounting_system/server/src/controller/receipt.controller.js';
const orig=fs.readFileSync(p,'utf8');
// Reintroduce the exact regression in a scratch copy and confirm the guard fails.
fs.writeFileSync(p, orig.replace(
  'STATE UPDATE: ${updates.find((u) => u.id === result.id).currentState} → ${result.nextState}',
  'STATE UPDATE: ${updates.find((u) => u.id === result.id).currentState} → ${nextState}'));
console.log('  regression reintroduced');
