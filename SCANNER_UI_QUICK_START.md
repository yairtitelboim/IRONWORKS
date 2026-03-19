# Scanner Signals UI - Quick Start Guide

## 🚀 How to Run the Scanner Signals Panel

You need to run **two servers** to see the Scanner Signals UI:

---

## Step 1: Start the Backend Server

**Terminal 1** - Start the Express API server:

```bash
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/3MI
node server.js
```

**Expected output:**
```
Proxy server running on http://localhost:3001
Claude API Key exists: true/false
```

**Keep this terminal open** - the server must stay running.

---

## Step 2: Start the React App

**Terminal 2** (new terminal window) - Start the React development server:

```bash
cd /Users/yairtitelboim/Documents/Kernel/ALLAPPS/3MI
npm start
```

**Expected output:**
```
Compiled successfully!

You can now view remote in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

The browser should automatically open at `http://localhost:3000`

---

## Step 3: Find the Scanner Signals Panel

Once the map loads:

1. **Look for the panel** in the **top-right corner** of the map
2. You should see:
   - **Title**: "Scanner Signals"
   - **Three buttons**: All | News | ERCOT
   - **Signal cards** below (if you have signals in the database)

---

## What You'll See

### If You Have Signals:
- List of signal cards with:
  - Headline
  - Lane badge (CONSTRAINT/COMMITMENT/CONTEXT)
  - Toggle switch (to mark as Reviewed)
  - Source type, confidence, event type
  - Summary, URL, tags

### If No Signals:
- "No signals found" message
- You'll need to ingest signals first (see below)

---

## Testing the Toggle Feature

1. **Find a signal card** in the panel
2. **Click the toggle switch** on the right side of the card
3. **Signal should dim** (50% opacity) when marked as Reviewed
4. **Click again** to unmark and restore full opacity

---

## Ingesting Signals (If You Don't Have Any)

### Option 1: Ingest News Signals (Tavily)
```bash
cd scanner/phase1
TAVILY_API_KEY=your_key node scanner-cli.js ingest "data center Texas"
```

### Option 2: Ingest ERCOT Signals
```bash
cd scanner/phase1
node scanner-cli.js ercot
```

Then refresh the browser to see the signals in the UI.

---

## Troubleshooting

### ❌ "No signals found"
- **Solution**: Ingest signals first (see above)
- **Check**: Database exists at `scanner/scanner.db`

### ❌ "Error: Failed to fetch signals"
- **Solution**: Make sure backend server is running (Terminal 1)
- **Check**: Server is on `http://localhost:3001`

### ❌ "Connection refused" or API errors
- **Solution**: Both servers must be running simultaneously
- **Check**: 
  - Terminal 1: `node server.js` running
  - Terminal 2: `npm start` running

### ❌ Panel not visible
- **Solution**: Check browser console for errors
- **Check**: React app compiled successfully
- **Try**: Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)

---

## Quick Command Reference

```bash
# Terminal 1: Backend Server
node server.js

# Terminal 2: React App
npm start

# Terminal 3: Ingest Signals (optional)
cd scanner/phase1
node scanner-cli.js ercot
```

---

## Ports Used

- **Backend Server**: `http://localhost:3001`
- **React App**: `http://localhost:3000`
- **Database**: `scanner/scanner.db` (SQLite file)

---

## Next Steps

Once you see the panel:
1. ✅ Test the **All/News/ERCOT** filter buttons
2. ✅ Test the **Reviewed toggle** on signals
3. ✅ Verify signals **dim when reviewed**
4. ✅ Check signals **persist after refresh**

---

**Status**: ✅ Ready to use  
**Requirements**: Both servers running + signals in database

