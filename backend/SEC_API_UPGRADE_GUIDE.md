# SEC API Upgrade Guide

## Current Issue
You're getting **429 Too Many Requests** errors from the SEC API, which means you've hit your rate limit.

## Where to Upgrade

1. **Visit**: https://sec-api.io
2. **Sign in** to your account
3. **Go to**: Dashboard → Billing/Plans
4. **Check your current plan** and usage limits
5. **Upgrade** to a higher tier if needed

## Common Plans

- **Free Tier**: Very limited requests (likely what you're on)
- **Starter**: ~$50/month - Good for development/testing
- **Professional**: ~$200/month - Production use
- **Enterprise**: Custom pricing - High volume

## Alternative: Wait for Rate Limit Reset

If you don't want to upgrade right now:
- **Wait 1 hour** for the rate limit to reset
- The SEC API typically resets rate limits hourly
- Then try regenerating signals again

## Check Your Current Usage

You can check your API usage at:
- https://sec-api.io/dashboard (after logging in)
- Look for "API Usage" or "Rate Limits" section

## After Upgrading

1. Your new API key will be the same (or you'll get a new one)
2. Update `backend/config.env` if you get a new key:
   ```
   SEC_API_KEY=your_new_key_here
   ```
3. Restart your backend server
4. Try regenerating signals again

## Temporary Workaround

While waiting for the rate limit to reset or upgrade:
- The cleanup script will remove incomplete signals
- You can still generate NEWS signals (they use Gemini AI, not SEC API)
- SEC and INSIDER signals will work once the rate limit resets


