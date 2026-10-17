const fs=require('fs');
const p='D:/5L_SYSTEMS/accounting_system/server/src/controller/receipt.controller.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace(
  'STATE UPDATE: ${updates.find((u) => u.id === result.id).currentState} → ${nextState}',
  'STATE UPDATE: ${updates.find((u) => u.id === result.id).currentState} → ${result.nextState}');
fs.writeFileSync(p,s);
console.log('  restored: ' + /currentState\} → \$\{result\.nextState\}/.test(s));
