# How to Test SEC/INSIDER APIs

## Option 1: Using Postman (Recommended)

1. **Set the full URL:**
   ```
   GET http://localhost:8000/api/signals/test-sec-apis?ticker=NVDA
   ```

2. **Add Authorization Header:**
   - Go to the "Authorization" tab in Postman
   - Select "Bearer Token" type
   - Get your token from:
     - Open browser console on your frontend
     - Type: `localStorage.getItem('authToken')` or check the Network tab when you're logged in
   - Paste the token in the Token field

3. **Send the request**
   - This will make 2 API calls (1 INSIDER + 1 SEC)
   - Wait time: ~15 seconds total (5s + 10s delays)
   - Returns actual data structure from APIs

## Option 2: Using Browser Console

1. Open your frontend app and log in
2. Open browser console (F12)
3. Get your auth token:
   ```javascript
   const token = localStorage.getItem('authToken') || localStorage.getItem('firebase_token');
   console.log('Token:', token);
   ```
4. Make the request:
   ```javascript
   fetch('http://localhost:8000/api/signals/test-sec-apis?ticker=NVDA', {
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     }
   })
   .then(r => r.json())
   .then(data => console.log('API Test Results:', data))
   .catch(err => console.error('Error:', err));
   ```

## Option 3: Using curl

```bash
# First, get your auth token from browser localStorage or API response
TOKEN="your_auth_token_here"

curl -X GET "http://localhost:8000/api/signals/test-sec-apis?ticker=NVDA" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

## What to Expect

The response will show:
- **insider**: Transaction data from SEC Form 4 filings
- **institutional**: Holdings data from SEC Form 13F filings
- **errors**: Any API errors (like 429 rate limits)

If you get 429 errors, wait 1 hour for the rate limit to reset, or upgrade your SEC API plan.


