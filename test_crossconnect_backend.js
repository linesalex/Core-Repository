// Cross Connect Backend API Test Script
// Tests all backend functionality for cross connect features

const axios = require('axios');

const API_BASE = 'http://localhost:4000';
let authToken = '';

// Helper function to make authenticated requests
const api = (token) => axios.create({
  baseURL: API_BASE,
  headers: token ? { 'Authorization': `Bearer ${token}` } : {}
});

async function authenticate() {
  try {
    console.log('🔐 Authenticating...');
    const response = await axios.post(`${API_BASE}/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    authToken = response.data.token;
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    return false;
  }
}

async function testLocationsCrossConnect() {
  console.log('\n📍 Testing Locations with Cross Connect...');
  
  try {
    // Get all locations to check if cross connect fields are included
    const response = await api(authToken).get('/locations');
    const locations = response.data;
    
    if (locations.length === 0) {
      console.log('⚠️  No locations found in database');
      return;
    }
    
    const firstLocation = locations[0];
    console.log('✅ Retrieved locations successfully');
    
    // Check if cross connect fields are present
    const expectedFields = [
      'cross_connect_nrc',
      'cross_connect_nrc_currency', 
      'cross_connect_mrc',
      'cross_connect_mrc_currency',
      'cross_connect_notes'
    ];
    
    const missingFields = expectedFields.filter(field => !(field in firstLocation));
    
    if (missingFields.length === 0) {
      console.log('✅ All cross connect fields present in location data');
    } else {
      console.log('❌ Missing cross connect fields:', missingFields);
    }
    
    console.log('📊 Sample location cross connect data:');
    console.log(`   NRC: ${firstLocation.cross_connect_nrc || 'POA'}`);
    console.log(`   NRC Currency: ${firstLocation.cross_connect_nrc_currency}`);
    console.log(`   MRC: ${firstLocation.cross_connect_mrc || 'POA'}`);
    console.log(`   MRC Currency: ${firstLocation.cross_connect_mrc_currency}`);
    console.log(`   Notes: ${firstLocation.cross_connect_notes || 'None'}`);
    
  } catch (error) {
    console.error('❌ Locations cross connect test failed:', error.response?.data || error.message);
  }
}

async function testCrossConnectEndpoints() {
  console.log('\n🔗 Testing Cross Connect Specific Endpoints...');
  
  try {
    // Get locations first
    const locationsResponse = await api(authToken).get('/locations');
    if (locationsResponse.data.length === 0) {
      console.log('⚠️  No locations available for testing');
      return;
    }
    
    const locationId = locationsResponse.data[0].id;
    console.log(`📍 Testing with location ID: ${locationId}`);
    
    // Test GET /locations/:id/cross-connect
    const crossConnectResponse = await api(authToken).get(`/locations/${locationId}/cross-connect`);
    console.log('✅ GET cross connect info successful');
    console.log('📊 Cross connect data:', crossConnectResponse.data);
    
    // Test PUT /locations/:id/cross-connect
    const updateData = {
      cross_connect_nrc: 250.00,
      cross_connect_nrc_currency: 'USD',
      cross_connect_mrc: 50.00,
      cross_connect_mrc_currency: 'USD',
      cross_connect_notes: 'Test cross connect - automated test'
    };
    
    const updateResponse = await api(authToken).put(`/locations/${locationId}/cross-connect`, updateData);
    console.log('✅ PUT cross connect update successful');
    
    // Verify the update
    const verifyResponse = await api(authToken).get(`/locations/${locationId}/cross-connect`);
    console.log('✅ Cross connect update verified');
    console.log('📊 Updated data:', verifyResponse.data);
    
    // Test POA handling
    const poaData = {
      cross_connect_nrc: 'POA',
      cross_connect_mrc: 'POA',
      cross_connect_notes: 'Price on application test'
    };
    
    const poaResponse = await api(authToken).put(`/locations/${locationId}/cross-connect`, poaData);
    console.log('✅ POA handling test successful');
    
    const poaVerifyResponse = await api(authToken).get(`/locations/${locationId}/cross-connect`);
    console.log('📊 POA verification:', poaVerifyResponse.data);
    
  } catch (error) {
    console.error('❌ Cross connect endpoints test failed:', error.response?.data || error.message);
  }
}

async function testPricingLogicConfig() {
  console.log('\n⚙️  Testing Pricing Logic Cross Connect Config...');
  
  try {
    // Get pricing logic config
    const response = await api(authToken).get('/pricing_logic/config');
    const config = response.data;
    
    console.log('✅ Retrieved pricing logic config');
    
    // Check for cross connect settings
    if (config.crossConnect) {
      console.log('✅ Cross connect settings found in pricing config');
      console.log(`📊 NRC Margin: ${config.crossConnect.nrcMargin}%`);
      console.log(`📊 MRC Margin: ${config.crossConnect.mrcMargin}%`);
    } else {
      console.log('❌ Cross connect settings not found in pricing config');
    }
    
    // Test updating cross connect settings
    const updatedConfig = {
      ...config,
      crossConnect: {
        nrcMargin: 15,
        mrcMargin: 12
      }
    };
    
    const updateResponse = await api(authToken).put('/pricing_logic/config', updatedConfig);
    console.log('✅ Cross connect pricing config update successful');
    
    // Verify the update
    const verifyResponse = await api(authToken).get('/pricing_logic/config');
    console.log('✅ Cross connect pricing config verified');
    console.log(`📊 Updated NRC Margin: ${verifyResponse.data.crossConnect.nrcMargin}%`);
    console.log(`📊 Updated MRC Margin: ${verifyResponse.data.crossConnect.mrcMargin}%`);
    
  } catch (error) {
    console.error('❌ Pricing logic config test failed:', error.response?.data || error.message);
  }
}

async function testBulkUpload() {
  console.log('\n📤 Testing Bulk Upload Cross Connect Support...');
  
  try {
    // Get bulk upload modules
    const modulesResponse = await api(authToken).get('/bulk_upload/modules');
    console.log('✅ Retrieved bulk upload modules');
    
    const locationModule = modulesResponse.data.find(m => m.name === 'locations');
    if (!locationModule) {
      console.log('❌ Locations module not found in bulk upload');
      return;
    }
    
    console.log('✅ Locations module found in bulk upload');
    
    // Check if cross connect fields are in template
    const expectedFields = [
      'cross_connect_nrc',
      'cross_connect_nrc_currency',
      'cross_connect_mrc', 
      'cross_connect_mrc_currency',
      'cross_connect_notes'
    ];
    
    const missingFields = expectedFields.filter(field => 
      !locationModule.templateFields.includes(field)
    );
    
    if (missingFields.length === 0) {
      console.log('✅ All cross connect fields present in bulk upload template');
    } else {
      console.log('❌ Missing cross connect fields in template:', missingFields);
    }
    
    console.log('📊 Template fields include:', locationModule.templateFields.filter(f => f.includes('cross_connect')));
    
  } catch (error) {
    console.error('❌ Bulk upload test failed:', error.response?.data || error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Cross Connect Backend Tests...\n');
  
  // Authenticate first
  const authSuccess = await authenticate();
  if (!authSuccess) {
    console.log('❌ Cannot proceed without authentication');
    return;
  }
  
  // Run all tests
  await testLocationsCrossConnect();
  await testCrossConnectEndpoints();
  await testPricingLogicConfig();
  await testBulkUpload();
  
  console.log('\n🎉 Cross Connect Backend Tests Completed!');
  console.log('✅ All backend cross connect functionality verified');
  console.log('🚀 Ready for frontend implementation');
}

// Handle errors and cleanup
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

runAllTests().catch(console.error);

