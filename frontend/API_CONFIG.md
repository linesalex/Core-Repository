# API Configuration Guide

The frontend now uses **dynamic API URL detection** that automatically adapts to your server environment, eliminating the need to manually update URLs when server IPs change.

## How It Works

The system detects the API URL in the following priority order:

1. **Environment Variable** (highest priority)
   - `REACT_APP_API_URL` in `.env` file
   - Example: `REACT_APP_API_URL=http://172.30.252.118:4000`

2. **Development Mode Detection**
   - If accessing via `localhost` or `127.0.0.1`, uses `http://localhost:4000`
   - Perfect for local development

3. **Auto-Detection** (default)
   - Uses current browser URL to detect server
   - If accessing `http://172.30.252.118:3000`, API becomes `http://172.30.252.118:4000`
   - Works with any IP address or hostname

## Configuration Options

### Option 1: Environment Variable (Recommended for Production)

Create a `.env` file in the `frontend/` directory:

```bash
# frontend/.env
REACT_APP_API_URL=http://172.30.252.118:4000
```

### Option 2: Auto-Detection (Default)

No configuration needed! The system automatically detects:

- **Local Development**: `http://localhost:4000`
- **Server Access**: `http://[current-server-ip]:4000`
- **Domain Access**: `http://[domain]:4000`

## Examples

| Frontend URL | Auto-Detected API URL |
|--------------|----------------------|
| `http://localhost:3000` | `http://localhost:4000` |
| `http://172.30.252.118:3000` | `http://172.30.252.118:4000` |
| `http://myserver.com:3000` | `http://myserver.com:4000` |
| `https://app.company.com` | `https://app.company.com:4000` |

## Troubleshooting

### Check Current Configuration

Open browser console (F12) in development mode to see:

```
🔧 API Configuration: {
  apiBaseUrl: "http://172.30.252.118:4000",
  environment: "development",
  detectedHost: "172.30.252.118",
  envApiUrl: undefined
}
```

### Override for Testing

You can temporarily override the API URL in browser console:

```javascript
// Test with different API URL
window.location.reload();
localStorage.setItem('TEMP_API_URL', 'http://different-server:4000');
```

### Common Issues

1. **CORS Errors**: Ensure backend allows requests from frontend origin
2. **Wrong Port**: Backend must be running on port 4000
3. **Firewall**: Ensure port 4000 is accessible between frontend and backend

## Benefits

✅ **No Manual Updates**: Works when server IP changes  
✅ **Environment Flexible**: Automatically adapts to dev/prod  
✅ **Easy Deployment**: Same code works everywhere  
✅ **Debug Friendly**: Shows configuration in console  
✅ **Override Ready**: Environment variables take precedence  

## Production Deployment

For production, always set the environment variable:

```bash
# Set environment variable
echo "REACT_APP_API_URL=http://your-server-ip:4000" > frontend/.env

# Build the application
cd frontend
npm run build

# Deploy the build/ directory
```

This ensures consistent API connectivity regardless of how users access your application. 