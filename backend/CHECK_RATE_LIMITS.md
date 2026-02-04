# SEC API Rate Limit Investigation

## The Problem
- Dashboard shows: **0/100 credits used** ✅
- But getting: **429 Too Many Requests** ❌

## Why This Happens

The SEC API free trial has **TWO separate limits**:

1. **Monthly Credits**: 100/month (what you see on dashboard)
2. **Rate Limits**: Requests per minute/hour (NOT shown on dashboard)

### Common Free Trial Rate Limits:
- **10 requests per minute**
- **100 requests per hour**
- **1000 requests per day**

## What Happens When You Regenerate Signals

Each "Regenerate Signals" click makes:
- 3 INSIDER API calls (Form 4)
- 4 SEC API calls (Form 13F)
- **Total: 7 SEC API calls**

If you clicked "Regenerate Signals" **2-3 times** in a short period:
- That's **14-21 requests** in a few minutes
- Could easily exceed **10 requests/minute** limit
- Even though you've only used **0/100 monthly credits**

## How to Check Your Actual Rate Limits

1. Go to: https://sec-api.io/docs
2. Look for "Rate Limits" or "API Limits" section
3. Check your account dashboard for any "Requests per minute" info
4. Contact SEC API support to ask about free trial rate limits

## Solutions

### Option 1: Wait for Rate Limit Reset
- Rate limits typically reset every **hour** or **minute**
- Wait 1 hour, then try again
- Make sure to only click "Regenerate Signals" **once**

### Option 2: Reduce Requests
- Instead of 3 INSIDER + 4 SEC = 7 calls
- Try just **1 INSIDER + 1 SEC = 2 calls** for testing
- This won't hit the rate limit as easily

### Option 3: Upgrade
- Paid plans have much higher rate limits
- Click "Upgrade License" on your dashboard
- Usually removes or significantly increases rate limits

## Test with Minimal Requests

To test if it's a rate limit issue, try making just **1 request**:

```bash
# In browser console, test just 1 ticker:
const token = localStorage.getItem('auth_token');
fetch('http://localhost:8000/api/signals/test-sec-apis?ticker=NVDA', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log('Result:', data))
```

If this **1 request** also gives 429, then:
- You're definitely rate limited
- Wait 1 hour for reset
- Or upgrade your plan


