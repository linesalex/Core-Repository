# 📘 Live Latency API Admin - User Guide

**Version**: 3.3.1 | **Last Updated**: January 2025

---

## Overview

The Live Latency API Admin module manages the connection to external latency monitoring systems. It controls how real-time latency data is fetched and displayed in the Network Routes module.

**Administrator access only.**

**What you can do:**
- Configure API endpoint
- Set refresh intervals
- Test API connection
- View API logs
- Monitor system health

---

## Access & Permissions

**Administrators only** - This module is not visible to other roles.

---

## Quick Start

### Accessing the Module
1. Login as Administrator
2. Left sidebar → **"Admin"**
3. Click **"Live Latency API"**

### Interface Sections
1. **API Configuration**: Endpoint and settings
2. **Connection Status**: Current API health
3. **Refresh Settings**: How often data updates
4. **API Logs**: Recent API activity
5. **Test Connection**: Manual API test

---

## API Configuration

### API Endpoint
- **URL**: Full URL to latency monitoring API
- **Format**: `https://api.example.com/latency`
- Must be HTTPS for security
- Must return JSON format

### Authentication
- **API Key** (if required): Secure token for API access
- Stored encrypted in database
- Never displayed in logs or UI

### Setting Configuration
1. Enter API endpoint URL
2. Add API key if required
3. Click **"Save Configuration"**
4. Test connection to verify

⚠️ **Important:** Invalid API endpoint will cause latency monitoring to fail

---

## Refresh Intervals

### Auto-Refresh Settings
- **Refresh Interval**: How often to fetch new data
- **Options**: 5, 10, 15, 30, 60 minutes
- **Default**: 15 minutes
- **Recommended**: 15-30 minutes for production

### Stale Data Threshold
- **Threshold**: How long before data considered stale
- **Options**: 1, 2, 4, 6, 12, 24 hours
- **Default**: 2 hours
- **Triggers**: Red error banner in Network Routes when exceeded

**Example:**
- Refresh interval: 15 minutes
- Stale threshold: 2 hours
- System fetches data every 15 minutes
- If no update for 2 hours, shows error banner

---

## Connection Status

Shows real-time API health:
- **Connected** (Green): API responding normally
- **Disconnected** (Red): API not responding
- **Last Successful Update**: When data was last fetched
- **Last Error**: Most recent error message

### Status Indicators
✅ **Healthy:**
- Last update within refresh interval
- No errors
- Data flowing normally

❌ **Unhealthy:**
- Last update exceeds stale threshold
- API errors
- Connection failures

---

## API Logs

### What's Logged
- API request attempts
- Successful data fetches
- Connection errors
- Data processing results
- Timestamp for each event

### Log Levels
- **Info**: Normal operations
- **Warning**: Non-critical issues
- **Error**: Failed requests or processing

### Viewing Logs
- Recent logs displayed in table
- Newest entries at top
- Filter by date range
- Export for troubleshooting

---

## Testing Connection

### Manual Test
1. Click **"Test Connection"** button
2. System attempts to connect to API
3. Results show:
   - ✅ Success: API reachable and responding
   - ❌ Failure: Error message explains issue

### Common Test Results
- **Success**: API URL correct, responding properly
- **Connection Timeout**: API not reachable
- **Authentication Failed**: API key invalid
- **Invalid Response**: API not returning expected data
- **SSL Error**: Certificate issues

---

## Key Rules & Tips

✅ **Do:**
- Test connection after any configuration change
- Monitor logs regularly
- Set appropriate refresh intervals (not too frequent)
- Keep API credentials secure
- Document API endpoint for disaster recovery

❌ **Don't:**
- Set refresh interval too low (causes unnecessary load)
- Share API credentials
- Change settings without testing
- Ignore error logs

### Best Practices

**Refresh Intervals:**
- Production: 15-30 minutes
- Testing: 5-10 minutes
- Don't go below 5 minutes (API rate limits)

**Stale Thresholds:**
- Production: 2-4 hours
- Critical systems: 1 hour
- Non-critical: 6-12 hours

**Monitoring:**
- Check logs weekly
- Review connection status daily
- Set up external monitoring if critical

---

## Troubleshooting

**Red banner in Network Routes:**
- Check Connection Status in this module
- Review API Logs for errors
- Test connection manually
- Verify API endpoint still valid

**No latency data showing:**
- Verify API configuration saved
- Test connection
- Check API is actually running
- Review logs for errors

**"Stale data" warnings:**
- Check API is responding
- Verify refresh interval not too long
- Check network connectivity
- Review API service status

**Connection test fails:**
- Verify API URL is correct (check for typos)
- Ensure API is running
- Check network/firewall allows connection
- Verify API key if required
- Check SSL certificate validity

---

## Quick Reference

| Task | Steps |
|------|-------|
| Configure API | Enter endpoint → Add key → Save |
| Test Connection | Test Connection button → Review results |
| View Logs | Scroll to logs section |
| Change Refresh | Select interval → Save |
| Check Status | View Connection Status section |

### Recommended Settings

| Environment | Refresh | Threshold |
|-------------|---------|-----------|
| Production | 15-30 min | 2-4 hours |
| Testing | 5-10 min | 1-2 hours |
| Development | 5 min | 1 hour |

---

**Questions?** Contact your system administrator or API provider

