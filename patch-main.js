#!/usr/bin/env node
// Patch main.js: fix fan mode fallback for AC devices whose SupportedCaps
// are missing fanSpeeds (Mysa cloud bug — some AC-V1-0 units don't report
// fanSpeeds in their modes). Default to all fan modes instead of just "auto".

const fs = require('fs');
const mainFile = '/app/dist/main.js';
let content = fs.readFileSync(mainFile, 'utf8');

const fallbackOld = 't.size===0?["auto"]';
const fallbackNew = 't.size===0?["auto","low","medium","high"]';
if (content.includes(fallbackOld)) {
  content = content.replace(fallbackOld, fallbackNew);
  fs.writeFileSync(mainFile, content);
  console.log('✓ main.js patched: fan mode fallback now includes auto/low/medium/high');
} else {
  console.error('✗ main.js fan mode fallback string not found — code may have changed');
  process.exit(1);
}
