#!/usr/bin/env node
// Patch mysa-js-sdk fanSpeedMaps for AC-V1-X devices (CodeNum=1117)
//
// Fan speed mapping for these devices:
//   SEND:    auto=1, low=2, medium=4, high=6  (matching SupportedCaps fanSpeeds [1,2,4,6])
//   RECEIVE: fn=1->auto, fn=2->low, fn=3->low (SDK original), fn=4->medium,
//            fn=5->medium, fn=6->high, fn=7->high
//
// The SDK hardcodes: SEND low=3,medium=5,high=7,max=8 / RECEIVE 3=low,5=medium,7=high,8=max
// We patch SEND to low=2,medium=4,high=6 and RECEIVE to add fn=2,4,6 mappings.

const fs = require('fs');
const file = '/app/node_modules/mysa-js-sdk/dist/index.js';
let content = fs.readFileSync(file, 'utf8');
let patched = 0;

// 1. Fix SEND map: low=2, medium=4, high=6
const sendOld = '    const fanSpeedMap = { auto: 1, low: 3, medium: 5, high: 7, max: 8 };';
const sendNew = '    const fanSpeedMap = { auto: 1, low: 2, medium: 4, high: 6 };';
if (content.includes(sendOld)) {
  content = content.replace(sendOld, sendNew);
  patched++;
  console.log('✓ SEND map patched: low=2, medium=4, high=6');
} else {
  console.error('✗ SEND map string not found — SDK may have changed');
  process.exit(1);
}

// 2. Fix RECEIVE map: add fn=2->low, fn=4->medium, fn=6->high
const rx1Old = '1: "auto",\n              3: "low",';
const rx1New = '1: "auto",\n              2: "low",\n              3: "low",';
if (content.includes(rx1Old)) {
  content = content.replace(rx1Old, rx1New);
  patched++;
  console.log('✓ RECEIVE map patched: fn=2 added as "low"');
} else {
  console.error('✗ RECEIVE map entry for fn=1/3 not found');
  process.exit(1);
}

const rx2Old = '5: "medium",\n              7: "high",';
const rx2New = '4: "medium",\n              5: "medium",\n              6: "high",\n              7: "high",';
if (content.includes(rx2Old)) {
  content = content.replace(rx2Old, rx2New);
  patched++;
  console.log('✓ RECEIVE map patched: fn=4->medium, fn=6->high added');
} else {
  console.error('✗ RECEIVE map entry for fn=5/7 not found');
  process.exit(1);
}

fs.writeFileSync(file, content);
console.log(`SDK patched (${patched} replacements). Final maps:`);
console.log('  SEND:    { auto:1, low:2, medium:4, high:6 }');
console.log('  RECEIVE: { 1:auto, 2:low, 3:low, 4:medium, 5:medium, 6:high, 7:high, 8:max }');
