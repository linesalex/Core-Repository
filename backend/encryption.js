const crypto = require('crypto');

// Encryption configuration
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-cbc',
  keyLength: 32,
  ivLength: 16
};

// Cache for development key
let devEncryptionKey = null;

// Get encryption key from environment or generate one for development
const getEncryptionKey = () => {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // Use provided key, ensure it's the right length
    const key = Buffer.from(envKey, 'hex');
    if (key.length !== ENCRYPTION_CONFIG.keyLength) {
      throw new Error(`Encryption key must be ${ENCRYPTION_CONFIG.keyLength} bytes (${ENCRYPTION_CONFIG.keyLength * 2} hex characters)`);
    }
    return key;
  }
  
  // Generate a key for development (not recommended for production)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ENCRYPTION_KEY environment variable must be set in production');
  }
  
  // Use cached development key to ensure consistency
  // Store in a persistent way for development to survive server restarts
  if (!devEncryptionKey) {
    // Try to use a deterministic key for development to avoid decryption issues
    const deterministicSeed = 'development-encryption-key-seed-2025';
    const crypto = require('crypto');
    devEncryptionKey = crypto.createHash('sha256').update(deterministicSeed).digest().slice(0, ENCRYPTION_CONFIG.keyLength);
    console.warn('⚠️  Using deterministic encryption key for development. Set ENCRYPTION_KEY environment variable for production.');
  }
  
  return devEncryptionKey;
};

/**
 * Encrypt sensitive text data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted data in format: iv:encrypted (hex encoded)
 */
function encrypt(text) {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('Text to encrypt must be a non-empty string');
    }
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);
    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return format: iv:encrypted (hex encoded)
    return `${iv.toString('hex')}:${encrypted}`;
    
  } catch (error) {
    console.error('Encryption failed:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt encrypted text data
 * @param {string} encryptedData - Encrypted data in format: iv:encrypted
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedData) {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Encrypted data must be a non-empty string');
    }
    
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const [ivHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_CONFIG.algorithm, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
    
  } catch (error) {
    console.error('Decryption failed:', error.message);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Generate a new encryption key for setup
 * @returns {string} - Hex encoded encryption key
 */
function generateNewKey() {
  const key = crypto.randomBytes(ENCRYPTION_CONFIG.keyLength);
  return key.toString('hex');
}

/**
 * Test encryption/decryption functionality
 * @returns {boolean} - True if encryption is working correctly
 */
function testEncryption() {
  try {
    const testData = 'test-password-123';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);
    
    const isWorking = decrypted === testData;
    
    if (isWorking) {
      console.log('✅ Encryption test passed');
    } else {
      console.error('❌ Encryption test failed: decrypted data does not match original');
    }
    
    return isWorking;
    
  } catch (error) {
    console.error('❌ Encryption test failed:', error.message);
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  generateNewKey,
  testEncryption
};
