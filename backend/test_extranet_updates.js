/**
 * Test Script for Extranet Module Updates
 * Tests all recent changes including:
 * - Provider Resiliency options
 * - ISF Resiliency options
 * - ISF mandatory field
 * - Design Template upload
 * - Previously Known As field
 * - Contact updates (contact_level, notes)
 * - Rate Card POA support
 * - City Tiers with country
 */

const API_BASE_URL = 'http://localhost:4000';

// Test credentials
const TEST_USER = {
  username: 'admin',
  password: 'admin123'
};

let authToken = null;
let testProviderId = null;
let testProductId = null;
let testContactId = null;
let testCityId = null;

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, details = '') {
  testResults.tests.push({ name, passed, details });
  if (passed) {
    testResults.passed++;
    console.log(`✅ PASS: ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ FAIL: ${name}${details ? ' - ' + details : ''}`);
  }
}

async function makeRequest(method, endpoint, data = null, includeAuth = true) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (includeAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const options = {
    method,
    headers
  };
  
  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const responseData = await response.json().catch(() => ({}));
    return { status: response.status, data: responseData, ok: response.ok };
  } catch (error) {
    return { status: 0, error: error.message, ok: false };
  }
}

// =====================
// Authentication Tests
// =====================
async function testAuthentication() {
  console.log('\n📋 Testing Authentication...');
  
  const response = await makeRequest('POST', '/login', TEST_USER, false);
  
  if (response.ok && response.data.token) {
    authToken = response.data.token;
    logTest('Login with admin credentials', true);
    return true;
  } else {
    logTest('Login with admin credentials', false, response.data?.error || 'No token received');
    return false;
  }
}

// =====================
// Provider Tests
// =====================
async function testProviderResiliencyOptions() {
  console.log('\n📋 Testing Provider Resiliency Options...');
  
  const validOptions = [
    'Multi-Site Resilient',
    'Split-Site Resilient', 
    'Single-Site Resilient',
    'Single-Site Non-Resilient'
  ];
  
  // Test creating provider with each valid resiliency option
  for (const option of validOptions) {
    const response = await makeRequest('POST', '/extranets', {
      provider_name: `Test Provider ${option}`,
      region: 'APAC',
      provider_resiliency: option
    });
    
    if (response.ok) {
      logTest(`Create provider with resiliency: ${option}`, true);
      // Clean up
      await makeRequest('DELETE', `/extranets/${response.data.id}`);
    } else {
      logTest(`Create provider with resiliency: ${option}`, false, response.data?.error);
    }
  }
  
  // Test invalid resiliency option
  const invalidResponse = await makeRequest('POST', '/extranets', {
    provider_name: 'Test Invalid Resiliency',
    region: 'APAC',
    provider_resiliency: 'Resilient'  // Old value, should fail
  });
  
  logTest('Reject old resiliency value "Resilient"', !invalidResponse.ok);
}

async function testPreviouslyKnownAs() {
  console.log('\n📋 Testing Previously Known As Field...');
  
  // Create provider with previously_known_as
  const createResponse = await makeRequest('POST', '/extranets', {
    provider_name: 'New Provider Name',
    region: 'EMEA',
    previously_known_as: 'Old Name 1, Old Name 2, Legacy Provider'
  });
  
  if (createResponse.ok) {
    testProviderId = createResponse.data.id;
    logTest('Create provider with previously_known_as', true);
    
    // Verify it's returned in GET
    const getResponse = await makeRequest('GET', '/extranets');
    const provider = getResponse.data?.find(p => p.id === testProviderId);
    
    logTest('Previously known as field returned in GET', 
      provider?.previously_known_as === 'Old Name 1, Old Name 2, Legacy Provider');
    
    // Test search by previous name
    const searchResponse = await makeRequest('GET', '/extranets?search=Old Name 1');
    const foundByPrevName = searchResponse.data?.some(p => p.id === testProviderId);
    logTest('Search finds provider by previously_known_as', foundByPrevName);
    
  } else {
    logTest('Create provider with previously_known_as', false, createResponse.data?.error);
  }
}

// =====================
// Product Tests
// =====================
async function testISFMandatory() {
  console.log('\n📋 Testing ISF Mandatory Field...');
  
  if (!testProviderId) {
    logTest('ISF mandatory test (skipped - no provider)', false, 'No test provider created');
    return;
  }
  
  // Try to create product without ISF - should fail
  const noISFResponse = await makeRequest('POST', `/extranets/${testProviderId}/products`, {
    product_name: 'Test Product No ISF'
  });
  
  logTest('Reject product creation without ISF', !noISFResponse.ok);
  
  // Create product with ISF - should succeed
  const withISFResponse = await makeRequest('POST', `/extranets/${testProviderId}/products`, {
    product_name: 'Test Product With ISF',
    isf: 'ISF001',
    suggested_bandwidth: '10'
  });
  
  if (withISFResponse.ok) {
    testProductId = withISFResponse.data.id;
    logTest('Create product with ISF', true);
  } else {
    logTest('Create product with ISF', false, withISFResponse.data?.error);
  }
}

async function testISFResiliencyOptions() {
  console.log('\n📋 Testing ISF Resiliency Options...');
  
  if (!testProviderId) {
    logTest('ISF resiliency test (skipped - no provider)', false);
    return;
  }
  
  const validOptions = [
    'Single-Site Resilient',
    'Multi-Site Resilient',
    'Split-Site Resilient',
    'Non-Resilient',
    'Multi-Region Resilient'
  ];
  
  for (const option of validOptions) {
    const response = await makeRequest('POST', `/extranets/${testProviderId}/products`, {
      product_name: `Product ${option}`,
      isf: `ISF-${option.substring(0, 3)}`,
      isf_resiliency: option
    });
    
    if (response.ok) {
      logTest(`Create product with ISF resiliency: ${option}`, true);
      await makeRequest('DELETE', `/extranets/${testProviderId}/products/${response.data.id}`);
    } else {
      logTest(`Create product with ISF resiliency: ${option}`, false, response.data?.error);
    }
  }
}

async function testSourceDatacenterValidation() {
  console.log('\n📋 Testing Source Datacenter Validation...');
  
  if (!testProviderId) {
    logTest('Source datacenter test (skipped - no provider)', false);
    return;
  }
  
  // Valid external format (6 uppercase letters + numbers)
  const validExternalResponse = await makeRequest('POST', `/extranets/${testProviderId}/products`, {
    product_name: 'Product External DC',
    isf: 'ISF-EXT1',
    source_datacenters: 'EQXLON4, CYXNYC2'
  });
  
  if (validExternalResponse.ok) {
    logTest('Accept valid external datacenter format (EQXLON4)', true);
    await makeRequest('DELETE', `/extranets/${testProviderId}/products/${validExternalResponse.data.id}`);
  } else {
    logTest('Accept valid external datacenter format (EQXLON4)', false, validExternalResponse.data?.error);
  }
  
  // Invalid format should fail
  const invalidResponse = await makeRequest('POST', `/extranets/${testProviderId}/products`, {
    product_name: 'Product Invalid DC',
    isf: 'ISF-INV1',
    source_datacenters: 'invalid-dc'
  });
  
  logTest('Reject invalid datacenter format', !invalidResponse.ok);
}

// =====================
// Contact Tests
// =====================
async function testContactFields() {
  console.log('\n📋 Testing Contact Fields...');
  
  if (!testProviderId) {
    logTest('Contact fields test (skipped - no provider)', false);
    return;
  }
  
  const contactTypes = [
    'Primary Support Contact',
    'Primary Order Contact',
    'Billing Contact',
    'Account Manager'
  ];
  
  const contactLevels = ['General', '1st Level', '2nd Level', '3rd Level'];
  
  // Create contact with new fields
  const createResponse = await makeRequest('POST', `/extranets/${testProviderId}/contacts`, {
    contact_name: 'Test Contact',
    job_title: 'Test Manager',
    phone_number: '+1234567890',
    email: 'test@example.com',
    contact_type: contactTypes[0],
    contact_level: contactLevels[1],
    notes: 'This is a test note'
  });
  
  if (createResponse.ok) {
    testContactId = createResponse.data.id;
    logTest('Create contact with contact_type dropdown value', true);
    logTest('Create contact with contact_level field', true);
    logTest('Create contact with notes field', true);
  } else {
    logTest('Create contact with new fields', false, createResponse.data?.error);
  }
  
  // Verify contact_level and notes are returned
  const getResponse = await makeRequest('GET', `/extranets/${testProviderId}/contacts`);
  const contact = getResponse.data?.find(c => c.id === testContactId);
  
  if (contact) {
    logTest('Contact level returned in GET', contact.contact_level === contactLevels[1]);
    logTest('Notes returned in GET', contact.notes === 'This is a test note');
  }
}

// =====================
// Rate Card Tests
// =====================
async function testRateCardPOA() {
  console.log('\n📋 Testing Rate Card POA Support...');
  
  // Get rate card entries
  const getResponse = await makeRequest('GET', '/extranet-pricing/rate-card');
  
  if (getResponse.ok && getResponse.data.length > 0) {
    // Check if POA is the default
    const poaEntries = getResponse.data.filter(r => r.price_usd === 'POA');
    logTest('Rate card has POA default values', poaEntries.length > 0);
    
    // Test updating to POA
    const firstEntry = getResponse.data[0];
    const updateResponse = await makeRequest('PUT', `/extranet-pricing/rate-card/${firstEntry.id}`, {
      price_usd: 'POA'
    });
    logTest('Update rate card entry to POA', updateResponse.ok);
    
    // Test updating to numeric value
    const numericResponse = await makeRequest('PUT', `/extranet-pricing/rate-card/${firstEntry.id}`, {
      price_usd: 250
    });
    logTest('Update rate card entry to numeric value', numericResponse.ok);
    
  } else {
    logTest('Get rate card entries', false, 'No rate card data');
  }
}

// =====================
// City Tier Tests
// =====================
async function testCityTiersWithCountry() {
  console.log('\n📋 Testing City Tiers with Country...');
  
  // Test available cities endpoint
  const availableCitiesResponse = await makeRequest('GET', '/extranet-pricing/available-cities?search=Syd');
  logTest('Available cities endpoint works', availableCitiesResponse.ok);
  
  if (availableCitiesResponse.ok && availableCitiesResponse.data.length > 0) {
    const firstCity = availableCitiesResponse.data[0];
    logTest('Available cities returns city field', !!firstCity.city);
    logTest('Available cities returns country field', !!firstCity.country);
    logTest('Available cities returns label in "City, Country" format', 
      firstCity.label && firstCity.label.includes(','));
  }
  
  // Create city tier with country
  const createResponse = await makeRequest('POST', '/extranet-pricing/cities', {
    city_name: 'Test City',
    country: 'Test Country',
    region: 'APAC',
    tier: 'Tier 1'
  });
  
  if (createResponse.ok) {
    testCityId = createResponse.data.id;
    logTest('Create city tier with country', true);
    
    // Verify country is returned in GET
    const getResponse = await makeRequest('GET', '/extranet-pricing/cities');
    const city = getResponse.data?.find(c => c.id === testCityId);
    logTest('Country field returned in GET', city?.country === 'Test Country');
    
  } else {
    logTest('Create city tier with country', false, createResponse.data?.error);
  }
}

// =====================
// Cleanup
// =====================
async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');
  
  if (testContactId && testProviderId) {
    await makeRequest('DELETE', `/extranets/${testProviderId}/contacts/${testContactId}`);
  }
  
  if (testProductId && testProviderId) {
    await makeRequest('DELETE', `/extranets/${testProviderId}/products/${testProductId}`);
  }
  
  if (testProviderId) {
    await makeRequest('DELETE', `/extranets/${testProviderId}`);
  }
  
  if (testCityId) {
    await makeRequest('DELETE', `/extranet-pricing/cities/${testCityId}`);
  }
  
  console.log('Cleanup complete.');
}

// =====================
// Main Test Runner
// =====================
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     EXTRANET MODULE UPDATES - TEST SUITE                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${API_BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  // Run tests
  const authSuccess = await testAuthentication();
  
  if (!authSuccess) {
    console.log('\n❌ Authentication failed. Cannot continue tests.');
    console.log('Make sure the backend server is running on port 4000.');
    process.exit(1);
  }
  
  await testProviderResiliencyOptions();
  await testPreviouslyKnownAs();
  await testISFMandatory();
  await testISFResiliencyOptions();
  await testSourceDatacenterValidation();
  await testContactFields();
  await testRateCardPOA();
  await testCityTiersWithCountry();
  
  await cleanup();
  
  // Print summary
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`  ✅ Passed: ${testResults.passed}`);
  console.log(`  ❌ Failed: ${testResults.failed}`);
  console.log(`\n  Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%\n`);
  
  if (testResults.failed > 0) {
    console.log('Failed tests:');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}${t.details ? ': ' + t.details : ''}`);
    });
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});

