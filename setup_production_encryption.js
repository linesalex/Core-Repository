/**
 * Production Encryption Setup Script
 * Generates and tests encryption key for production deployment
 * 
 * Usage: node setup_production_encryption.js
 * 
 * This script resolves the "Failed to encrypt password" error
 * in live latency API configurations by generating the required
 * ENCRYPTION_KEY environment variable for production.
 */

const { generateNewKey, testEncryption } = require('./backend/encryption');

console.log('🔐 Production Encryption Setup');
console.log('===============================\n');

try {
  // Generate a new secure encryption key
  const newKey = generateNewKey();

  console.log('✅ Generated new encryption key for production');
  console.log(`📋 ENCRYPTION_KEY=${newKey}\n`);

  // Set the key in environment for testing
  process.env.ENCRYPTION_KEY = newKey;

  // Test the encryption
  console.log('🧪 Testing encryption functionality...');
  const isWorking = testEncryption();

  if (isWorking) {
    console.log('\n🎉 Encryption setup successful!');
    console.log('\n📋 **PRODUCTION SETUP INSTRUCTIONS:**');
    console.log('=====================================');
    console.log('1. Copy the following environment variable to your production system:');
    console.log(`   ENCRYPTION_KEY=${newKey}`);
    console.log('\n2. Add it to your production environment variables:');
    console.log('   💾 For PM2: Add to ecosystem.config.js env_production section');
    console.log('   🐳 For Docker: Add to docker-compose.yml environment section');
    console.log('   🖥️  For Windows Service: Use setx command or system settings');
    console.log('\n3. Restart your production application');
    console.log('\n⚠️  **SECURITY WARNING:**');
    console.log('   - Keep this encryption key secure and private');
    console.log('   - Do not commit it to version control');
    console.log('   - Backup this key safely - lost keys cannot decrypt existing data');
    console.log('\n4. Test live latency configuration after deployment');
    console.log('\n✅ You can now remove this script after successful deployment');
  } else {
    console.log('\n❌ Encryption test failed! Please check your system configuration.');
    process.exit(1);
  }
} catch (error) {
  console.error('\n❌ Error during encryption setup:', error.message);
  console.log('\n💡 This may indicate a system-level crypto issue.');
  console.log('Please ensure Node.js crypto module is properly installed.');
  process.exit(1);
}
