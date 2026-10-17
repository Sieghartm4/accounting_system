const fs=require('fs');
const p='D:/5L_SYSTEMS/accounting_system/server/src/controller/receipt.controller.js';
const s=fs.readFileSync(p,'utf8');
fs.writeFileSync(p, s.replace('currentState} → ${nextState}', 'currentState} → ${result.nextState}'));
