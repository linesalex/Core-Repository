# 🔐 Production Encryption Setup Guide
## Resolving "Failed to encrypt password" Error

**Issue**: Live latency API configurations fail to save with "Failed to encrypt password" error in production.

**Root Cause**: Missing `ENCRYPTION_KEY` environment variable in production environment.

---

## 🚨 **Immediate Solution**

### Step 1: Generate Encryption Key
```bash
# Run this command in your project root
node setup_production_encryption.js
```

This will:
- Generate a secure 32-byte encryption key
- Test the encryption functionality
- Provide setup instructions

### Step 2: Set Environment Variable
Copy the generated `ENCRYPTION_KEY` and set it in your production environment:

#### For PM2 Deployment:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'network-inventory-backend',
    script: 'index.js',
    env_production: {
      NODE_ENV: 'production',
      ENCRYPTION_KEY: 'your-generated-key-here'
    }
  }]
};
```

#### For Windows Service:
```bash
# Set system environment variable
setx ENCRYPTION_KEY "your-generated-key-here" /M
```

#### For Docker:
```yaml
# docker-compose.yml
environment:
  - NODE_ENV=production
  - ENCRYPTION_KEY=your-generated-key-here
```

### Step 3: Restart Application
Restart your production application to load the new environment variable.

### Step 4: Test Configuration
Try saving a live latency API configuration to verify the fix.

---

## 🔍 **Diagnostic Tools**

If issues persist, run the diagnostic script:
```bash
node diagnose_encryption_issue.js
```

This will check:
- Environment variable status
- Key format validation
- Crypto module functionality
- Encryption test results

---

## ⚠️ **Security Requirements**

1. **Keep the encryption key secure and private**
2. **Do not commit the key to version control**
3. **Backup the key safely** - lost keys cannot decrypt existing passwords
4. **Use different keys** for different environments (dev/staging/prod)

---

## 🛠️ **Technical Details**

The encryption system uses:
- **Algorithm**: AES-256-CBC
- **Key Length**: 32 bytes (64 hex characters)
- **IV**: 16 random bytes per encryption
- **Format**: `iv:encrypted_data` (hex encoded)

The system automatically:
- ✅ Uses deterministic keys in development
- ❌ Requires explicit keys in production
- 🔒 Encrypts API passwords before database storage
- 🔓 Decrypts passwords when loading configurations

---

## 📋 **Cleanup After Setup**

Once encryption is working in production, you can remove:
- `setup_production_encryption.js`
- `diagnose_encryption_issue.js`
- This setup guide

But keep them if you plan to deploy to additional environments.
