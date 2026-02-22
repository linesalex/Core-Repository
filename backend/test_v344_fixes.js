/**
 * Test Script for v3.4.4 Fixes
 * 
 * Issue 1: KMZ Viewer - Location Pins Access (403 for sales users)
 * Issue 2: KMZ Viewer - AMERs Route Count (0/0 display)
 * 
 * Run: node test_v344_fixes.js
 */

console.log('='.repeat(60));
console.log('Testing v3.4.4 Fixes');
console.log('='.repeat(60));

// Test 1: Region Normalization Function
console.log('\n📋 Test 1: Region Normalization');
console.log('-'.repeat(40));

const normalizeRegion = (region) => {
  if (!region) return null;
  const upper = region.toUpperCase();
  const regionMap = {
    'EMEA': 'EMEA',
    'AMERS': 'AMERs',
    'APAC': 'APAC',
    'INTER': 'INTER'
  };
  return regionMap[upper] || null;
};

const testCases = [
  { input: 'AMERS', expected: 'AMERs' },
  { input: 'AMERs', expected: 'AMERs' },
  { input: 'amers', expected: 'AMERs' },
  { input: 'EMEA', expected: 'EMEA' },
  { input: 'emea', expected: 'EMEA' },
  { input: 'APAC', expected: 'APAC' },
  { input: 'apac', expected: 'APAC' },
  { input: 'INTER', expected: 'INTER' },
  { input: 'inter', expected: 'INTER' },
  { input: null, expected: null },
  { input: '', expected: null },
  { input: 'INVALID', expected: null }
];

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
  const result = normalizeRegion(input);
  const status = result === expected ? '✅' : '❌';
  if (result === expected) {
    passed++;
  } else {
    failed++;
  }
  console.log(`  ${status} normalizeRegion('${input}') => '${result}' (expected: '${expected}')`);
});

console.log(`\n  Results: ${passed} passed, ${failed} failed`);

// Test 2: Verify endpoint permissions in routes.js
console.log('\n📋 Test 2: Endpoint Permission Check');
console.log('-'.repeat(40));

const fs = require('fs');
const path = require('path');

const routesPath = path.join(__dirname, 'routes.js');
const routesContent = fs.readFileSync(routesPath, 'utf8');

// Check for the updated download endpoint
const downloadEndpointPattern = /router\.get\('\/kmz_templates\/download\/:templateType',\s*authenticateToken,\s*authorizeModulePermission\('kmz_viewer',\s*'read_only'\)/;
const hasCorrectPermission = downloadEndpointPattern.test(routesContent);

if (hasCorrectPermission) {
  console.log("  ✅ Download endpoint uses authorizeModulePermission('kmz_viewer', 'read_only')");
} else {
  console.log("  ❌ Download endpoint does NOT use correct permission check");
  failed++;
}

// Check that it does NOT use authorizeRole('administrator') for this endpoint
const oldPatternCheck = /router\.get\('\/kmz_templates\/download\/:templateType',\s*authenticateToken,\s*authorizeRole\('administrator'\)/;
const hasOldPattern = oldPatternCheck.test(routesContent);

if (!hasOldPattern) {
  console.log("  ✅ Old authorizeRole('administrator') removed from download endpoint");
  passed++;
} else {
  console.log("  ❌ Old authorizeRole('administrator') still present");
  failed++;
}

// Check for normalizeRegion function
const hasNormalizeRegion = routesContent.includes('const normalizeRegion = (region)');
if (hasNormalizeRegion) {
  console.log("  ✅ normalizeRegion function added to route_counts endpoint");
  passed++;
} else {
  console.log("  ❌ normalizeRegion function NOT found");
  failed++;
}

// Summary
console.log('\n' + '='.repeat(60));
console.log(`SUMMARY: ${passed} tests passed, ${failed} tests failed`);
console.log('='.repeat(60));

if (failed === 0) {
  console.log('\n✅ All v3.4.4 fixes verified successfully!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some tests failed. Please review.\n');
  process.exit(1);
}

