#!/usr/bin/env node
// Patch mysa-js-sdk fanSpeedMaps for AC-V1-X devices (CodeNum=1117, fanSpeeds=[1,2,4,6])
// The SDK hardcodes universal fn values (low=3, medium=5, high=7, max=8) but CodeNum=1117
// devices use fn=2 (low), fn=4 (medium), fn=6 (high). Fix both the SEND and RECEIVE maps.

const fs = require('fs');
const file = '/app/node_modules/mysa-js-sdk/dist/index.js';
let content = fs.readFileSync(file, 'utf8');
let patched = 0;

// 1. Fix SEND map in setDeviceState: use fn=2/4/6 for low/medium/high
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
// Original: 1:"auto", 3:"low", 5:"medium", 7:"high", 8:"max"
const rx1Old = '1: "auto",\n              3: "low",';
const rx1New = '1: "auto",\n              2: "low",\n              3: "low",';
if (content.includes(rx1Old)) {
  content = content.replace(rx1Old, rx1New);
  patched++;
  console.log('✓ RECEIVE map patched: fn=2 added as "low"');
} else {
  console.error('✗ RECEIVE map entry for fn=1/3 not found — SDK may have changed');
  process.exit(1);
}

const rx2Old = '5: "medium",\n              7: "high",';
const rx2New = '4: "medium",\n              5: "medium",\n              6: "high",\n              7: "high",';
if (content.includes(rx2Old)) {
  content = content.replace(rx2Old, rx2New);
  patched++;
  console.log('✓ RECEIVE map patched: fn=4 added as "medium", fn=6 added as "high"');
} else {
  console.error('✗ RECEIVE map entry for fn=5/7 not found — SDK may have changed');
  process.exit(1);
}

fs.writeFileSync(file, content);
console.log(`SDK patched successfully (${patched} replacements): SEND map low=2/medium=4/high=6; RECEIVE map added fn=2,4,6 entries`);
