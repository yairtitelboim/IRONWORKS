# ERCOT API Key Setup Guide

## Status: ⚠️ API Key Required

**Current Status:** No ERCOT API key configured  
**Action Required:** Register for ERCOT Public API access

---

## How to Obtain ERCOT API Key

### Step 1: Visit ERCOT API Explorer
- URL: https://apiexplorer.ercot.com
- Click "Sign In/Sign Up" button
- Create account or sign in

### Step 2: Register for API Access
- Navigate to API catalog
- Find interconnection queue endpoint (or relevant data endpoint)
- Request API key/access
- Review terms of service

### Step 3: Configure Environment Variable

Add to your `.env` file:

```bash
# ERCOT Public API (Phase 2 - Scanner)
ERCOT_API_KEY=your_ercot_api_key_here
ERCOT_API_BASE_URL=https://api.ercot.com
```

Or add to `env.example` for team reference:

```bash
ERCOT_API_KEY=your_ercot_api_key_here
```

---

## Alternative: MIS CSV Method (No API Key Needed)

If ERCOT Public API doesn't have interconnection queue data, you can use the MIS CSV download method which **doesn't require an API key**:

- Access: https://www.ercot.com/misapp/GetReports.do
- Find interconnection queue reportTypeId
- Download CSV files directly
- No authentication required (in browser)

**Note:** This method requires HTML parsing to find report links, but doesn't need API credentials.

---

## Current Configuration

**Environment Files Checked:**
- ✅ `env.example` - Updated with ERCOT_API_KEY placeholder
- ⚠️ `.env` - Not found (likely gitignored, create locally)

**Code References:**
- ERCOT adapter will read: `process.env.ERCOT_API_KEY`
- Base URL: `process.env.ERCOT_API_BASE_URL || 'https://api.ercot.com'`

---

## Next Steps

1. **Register for ERCOT API** (if using API method)
   - Visit https://apiexplorer.ercot.com
   - Sign up and obtain API key
   - Add to `.env` file

2. **Or Use MIS CSV Method** (if API doesn't have queue data)
   - No API key needed
   - Find reportTypeId
   - Implement CSV download adapter

---

## Testing API Key

Once you have an API key, test it:

```bash
# Test ERCOT API access
curl -H "Authorization: Bearer $ERCOT_API_KEY" \
     https://api.ercot.com/v1/[endpoint]
```

Replace `[endpoint]` with actual interconnection queue endpoint once identified.

---

## Security Notes

- ⚠️ **Never commit API keys to git**
- ✅ Add `.env` to `.gitignore`
- ✅ Use `env.example` for documentation only
- ✅ Store production keys securely (environment variables, secrets manager)

---

## Resources

- ERCOT API Explorer: https://apiexplorer.ercot.com
- ERCOT Terms of Use: (check API Explorer for link)
- API Documentation: (available after registration)

