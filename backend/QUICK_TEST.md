# Quick Test: SEC/INSIDER APIs

## Method 1: Browser Console (Easiest)

1. Open your frontend app: `http://localhost:5173` (or whatever port)
2. Make sure you're **logged in**
3. Press **F12** to open DevTools
4. Go to **Console** tab
5. Paste this code:

```javascript
// Get your auth token
const token = localStorage.getItem('auth_token');
console.log('🔑 Token:', token);

// Test the API
fetch('http://localhost:8000/api/signals/test-sec-apis?ticker=NVDA', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('✅ API Response:', data);
  console.log('📊 INSIDER transactions:', data.insider?.transaction_count || 0);
  console.log('📊 SEC holdings:', data.institutional?.holdings_count || 0);
  if (data.errors && data.errors.length > 0) {
    console.warn('⚠️ Errors:', data.errors);
  }
})
.catch(err => console.error('❌ Error:', err));
```

6. Press Enter
7. Wait ~15 seconds (the API has delays to avoid rate limits)
8. Check the console output!

## Method 2: Postman

1. **Get Token:**
   - Open browser console on your frontend
   - Run: `localStorage.getItem('auth_token')`
   - Copy the token

2. **In Postman:**
   - URL: `http://localhost:8000/api/signals/test-sec-apis?ticker=NVDA`
   - Go to **Authorization** tab
   - Type: **Bearer Token**
   - Token: Paste your token
   - Click **Send**

## What You'll See

The response will show:
- `insider`: Transaction data from SEC Form 4
- `institutional`: Holdings data from SEC Form 13F  
- `errors`: Any API errors (like 429 rate limits)

If you get 429 errors, wait 1 hour or upgrade your SEC API plan.


