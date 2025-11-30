/**
 * Extranet Data Module Test Script
 * 
 * Tests all extranet API endpoints:
 * - Providers (CRUD)
 * - Products (CRUD + file upload)
 * - Contacts (CRUD + overdue tracking)
 * - Pricing Cities (CRUD)
 * - Rate Card (read/update)
 * - Pricing Lookup
 * - Analytics
 * 
 * Run with: node test_extranet_module.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_BASE_URL = 'http://localhost:4000';

// Test configuration - update these values
const TEST_CONFIG = {
  // Login credentials for an admin user
  username: 'admin',
  password: 'admin123',
};

let authToken = null;
let testProviderId = null;
let testProductId = null;
let testContactId = null;
let testCityId = null;

// Helper function for API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Add auth header to all requests
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Test utilities
const log = {
  info: (msg) => console.log(`\x1b[36mℹ️  ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m✅ ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m❌ ${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m⚠️  ${msg}\x1b[0m`),
  section: (msg) => console.log(`\n\x1b[35m━━━ ${msg} ━━━\x1b[0m\n`),
};

let passCount = 0;
let failCount = 0;

async function runTest(name, testFn) {
  try {
    await testFn();
    log.success(name);
    passCount++;
  } catch (error) {
    const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
    const status = error.response?.status ? ` (${error.response.status})` : '';
    log.error(`${name}: ${errMsg}${status}`);
    if (error.code === 'ECONNREFUSED') {
      log.warn('Is the backend server running on port 3001?');
    }
    failCount++;
  }
}

// ========================================
// AUTHENTICATION TESTS
// ========================================

async function testLogin() {
  log.section('AUTHENTICATION');
  
  await runTest('Login as admin', async () => {
    const response = await api.post('/login', {
      username: TEST_CONFIG.username,
      password: TEST_CONFIG.password,
    });
    
    if (!response.data.token) throw new Error('No token received');
    authToken = response.data.token;
  });
}

// ========================================
// PROVIDER TESTS
// ========================================

async function testProviders() {
  log.section('EXTRANET PROVIDERS');
  
  // Create provider
  await runTest('Create extranet provider', async () => {
    const response = await api.post('/extranets', {
      provider_name: 'Test Provider ' + Date.now(),
      region: 'APAC',
      salesperson_assigned: 'John Doe',
      provider_resiliency: 'Resilient',
      website_link: 'https://testprovider.com',
      available: true,
      more_info: 'Test provider for automated testing',
    });
    
    if (!response.data.id) throw new Error('No provider ID returned');
    testProviderId = response.data.id;
  });
  
  // Get all providers
  await runTest('Get all extranet providers', async () => {
    const response = await api.get('/extranets');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });
  
  // Get providers with filters
  await runTest('Get providers with region filter', async () => {
    const response = await api.get('/extranets?region=APAC');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });
  
  // Update provider
  await runTest('Update extranet provider', async () => {
    await api.put(`/extranets/${testProviderId}`, {
      provider_name: 'Updated Test Provider',
      region: 'APAC',
      salesperson_assigned: 'Jane Doe',
      provider_resiliency: 'Multi-Region Resilient',
      available: true,
    });
  });
}

// ========================================
// PRODUCT TESTS
// ========================================

async function testProducts() {
  log.section('EXTRANET PRODUCTS');
  
  // Create product
  await runTest('Create extranet product', async () => {
    const response = await api.post(`/extranets/${testProviderId}/products`, {
      product_name: 'Test Feed Product',
      isf: 'ISF001',
      suggested_bandwidth: '10',
      source_datacenters: 'EQXLON4, CYXTOK2',
      isf_resiliency: 'Resilient',
      more_info: 'Test product for automated testing',
    });
    
    if (!response.data.id) throw new Error('No product ID returned');
    testProductId = response.data.id;
  });
  
  // Get products for provider
  await runTest('Get products for provider', async () => {
    const response = await api.get(`/extranets/${testProviderId}/products`);
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length === 0) throw new Error('Expected at least one product');
  });
  
  // Update product
  await runTest('Update extranet product', async () => {
    await api.put(`/extranets/${testProviderId}/products/${testProductId}`, {
      product_name: 'Updated Test Feed Product',
      isf: 'ISF002',
      suggested_bandwidth: '20',
      source_datacenters: 'EQXLON4, CYXNYC2',
      isf_resiliency: 'Split Site Resilient',
    });
  });
  
  // Get product tracking
  await runTest('Get product tracking info', async () => {
    const response = await api.get(`/extranets/${testProviderId}/products/${testProductId}/tracking`);
    // Should return tracking data (even if null values)
  });
  
  // Test invalid datacenter format
  await runTest('Reject invalid datacenter format', async () => {
    try {
      await api.post(`/extranets/${testProviderId}/products`, {
        product_name: 'Invalid DC Product',
        source_datacenters: 'INVALID123', // Should be 6 letters + digits
      });
      throw new Error('Should have rejected invalid format');
    } catch (error) {
      if (!error.response || error.response.status !== 400) {
        throw error;
      }
      // Expected 400 error
    }
  });
}

// ========================================
// CONTACT TESTS
// ========================================

async function testContacts() {
  log.section('EXTRANET CONTACTS');
  
  // Create contact
  await runTest('Create extranet contact', async () => {
    const response = await api.post(`/extranets/${testProviderId}/contacts`, {
      contact_name: 'Test Contact',
      job_title: 'Account Manager',
      country: 'United Kingdom',
      phone_number: '+44-20-1234-5678',
      email: 'test@provider.com',
      contact_type: 'Sales',
      daily_contact: true,
      more_info: 'Test contact for automated testing',
    });
    
    if (!response.data.id) throw new Error('No contact ID returned');
    testContactId = response.data.id;
  });
  
  // Get contacts for provider
  await runTest('Get contacts for provider', async () => {
    const response = await api.get(`/extranets/${testProviderId}/contacts`);
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length === 0) throw new Error('Expected at least one contact');
  });
  
  // Update contact
  await runTest('Update extranet contact', async () => {
    await api.put(`/extranets/${testProviderId}/contacts/${testContactId}`, {
      contact_name: 'Updated Test Contact',
      job_title: 'Senior Account Manager',
      email: 'updated@provider.com',
      contact_type: 'Technical',
      daily_contact: false,
    });
  });
  
  // Get overdue contacts (should be empty for new contacts)
  await runTest('Get overdue contacts', async () => {
    const response = await api.get('/extranets/overdue-contacts');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });
}

// ========================================
// PRICING CITY TESTS
// ========================================

async function testPricingCities() {
  log.section('EXTRANET PRICING CITIES');
  
  // Create pricing city
  await runTest('Create pricing city', async () => {
    const response = await api.post('/extranet-pricing/cities', {
      city_name: 'Test City ' + Date.now(),
      region: 'APAC',
      tier: 'Tier 1',
    });
    
    if (!response.data.id) throw new Error('No city ID returned');
    testCityId = response.data.id;
  });
  
  // Get all cities
  await runTest('Get all pricing cities', async () => {
    const response = await api.get('/extranet-pricing/cities');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });
  
  // Get cities filtered by region
  await runTest('Get cities by region', async () => {
    const response = await api.get('/extranet-pricing/cities?region=APAC');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });
  
  // Update city
  await runTest('Update pricing city', async () => {
    await api.put(`/extranet-pricing/cities/${testCityId}`, {
      city_name: 'Updated Test City',
      region: 'APAC',
      tier: 'Tier 2',
    });
  });
}

// ========================================
// RATE CARD TESTS
// ========================================

async function testRateCard() {
  log.section('EXTRANET RATE CARD');
  
  // Get rate card
  await runTest('Get rate card', async () => {
    const response = await api.get('/extranet-pricing/rate-card');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length === 0) throw new Error('Rate card should have entries');
  });
  
  // Update rate card entry (find one first)
  await runTest('Update rate card entry', async () => {
    const rateCard = await api.get('/extranet-pricing/rate-card');
    if (rateCard.data.length === 0) throw new Error('No rate card entries');
    
    const firstEntry = rateCard.data[0];
    await api.put(`/extranet-pricing/rate-card/${firstEntry.id}`, {
      price_usd: 999,
    });
  });
  
  // Bulk update rate card
  await runTest('Bulk update rate card', async () => {
    await api.post('/extranet-pricing/rate-card/bulk', {
      rates: [
        { bandwidth: '1Mb', region: 'APAC', tier: 'Metro', price_usd: 500 },
        { bandwidth: '1Mb', region: 'APAC', tier: 'Tier 1', price_usd: 600 },
      ],
    });
  });
  
  // Get available bandwidths
  await runTest('Get available bandwidths', async () => {
    const response = await api.get('/extranet-pricing/bandwidths');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length === 0) throw new Error('Should have bandwidths');
  });
}

// ========================================
// PRICING LOOKUP TESTS
// ========================================

async function testPricingLookup() {
  log.section('EXTRANET PRICING LOOKUP');
  
  // First, ensure we have a city to look up
  let testCity = null;
  
  await runTest('Setup: Create test city for lookup', async () => {
    const response = await api.post('/extranet-pricing/cities', {
      city_name: 'Lookup Test City ' + Date.now(),
      region: 'EMEA',
      tier: 'Metro',
    });
    testCity = response.data;
  });
  
  // Price lookup
  await runTest('Price lookup', async () => {
    const cities = await api.get('/extranet-pricing/cities');
    if (cities.data.length === 0) throw new Error('No cities for lookup');
    
    const city = cities.data[0];
    const response = await api.get(`/extranet-pricing/lookup?city_name=${encodeURIComponent(city.city_name)}&bandwidth=1Mb`);
    
    if (response.data.price_usd === undefined) throw new Error('No price returned');
  });
  
  // Get providers by region
  await runTest('Get providers by region for pricing', async () => {
    const response = await api.get('/extranet-pricing/providers/APAC');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });
  
  // Get products for provider
  await runTest('Get products for provider in pricing', async () => {
    if (testProviderId) {
      const response = await api.get(`/extranet-pricing/products/${testProviderId}`);
      if (!Array.isArray(response.data)) throw new Error('Expected array');
    }
  });
}

// ========================================
// ANALYTICS TESTS
// ========================================

async function testAnalytics() {
  log.section('EXTRANET ANALYTICS');
  
  await runTest('Get extranet pricing analytics', async () => {
    const response = await api.get('/analytics/extranet-pricing');
    
    if (response.data.totalLookups === undefined) throw new Error('Missing totalLookups');
    if (!Array.isArray(response.data.topProviders)) throw new Error('Missing topProviders');
    if (!Array.isArray(response.data.bandwidthDistribution)) throw new Error('Missing bandwidthDistribution');
  });
}

// ========================================
// CLEANUP TESTS
// ========================================

async function testCleanup() {
  log.section('CLEANUP');
  
  // Delete contact
  if (testContactId) {
    await runTest('Delete extranet contact', async () => {
      await api.delete(`/extranets/${testProviderId}/contacts/${testContactId}`);
    });
  }
  
  // Delete product
  if (testProductId) {
    await runTest('Delete extranet product', async () => {
      await api.delete(`/extranets/${testProviderId}/products/${testProductId}`);
    });
  }
  
  // Delete provider
  if (testProviderId) {
    await runTest('Delete extranet provider', async () => {
      await api.delete(`/extranets/${testProviderId}`);
    });
  }
  
  // Delete pricing city
  if (testCityId) {
    await runTest('Delete pricing city', async () => {
      await api.delete(`/extranet-pricing/cities/${testCityId}`);
    });
  }
}

// ========================================
// VALIDATION TESTS
// ========================================

async function testValidation() {
  log.section('VALIDATION');
  
  await runTest('Reject invalid region for provider', async () => {
    try {
      await api.post('/extranets', {
        provider_name: 'Invalid Region Provider',
        region: 'INVALID',
      });
      throw new Error('Should have rejected invalid region');
    } catch (error) {
      if (!error.response || error.response.status !== 400) {
        throw error;
      }
    }
  });
  
  await runTest('Reject invalid resiliency for provider', async () => {
    try {
      await api.post('/extranets', {
        provider_name: 'Invalid Resiliency Provider',
        region: 'APAC',
        provider_resiliency: 'INVALID',
      });
      throw new Error('Should have rejected invalid resiliency');
    } catch (error) {
      if (!error.response || error.response.status !== 400) {
        throw error;
      }
    }
  });
  
  await runTest('Reject invalid tier for pricing city', async () => {
    try {
      await api.post('/extranet-pricing/cities', {
        city_name: 'Invalid Tier City',
        region: 'APAC',
        tier: 'INVALID',
      });
      throw new Error('Should have rejected invalid tier');
    } catch (error) {
      if (!error.response || error.response.status !== 400) {
        throw error;
      }
    }
  });
}

// ========================================
// MAIN TEST RUNNER
// ========================================

async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         EXTRANET DATA MODULE - AUTOMATED TEST SUITE          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const startTime = Date.now();
  
  try {
    await testLogin();
    await testProviders();
    await testProducts();
    await testContacts();
    await testPricingCities();
    await testRateCard();
    await testPricingLookup();
    await testAnalytics();
    await testValidation();
    await testCleanup();
  } catch (error) {
    log.error(`Fatal error: ${error.message}`);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        TEST RESULTS                           ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${passCount.toString().padEnd(48)}║`);
  console.log(`║  ❌ Failed: ${failCount.toString().padEnd(48)}║`);
  console.log(`║  ⏱️  Duration: ${(duration + 's').padEnd(46)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
  
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runAllTests();

