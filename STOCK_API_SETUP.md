# Stock Data API Setup

## Getting Real Stock Data

To show real stock values instead of mock data, you need to set up a stock data API.

### Option 1: Alpha Vantage (Recommended)

1. **Get API Key**: Visit [Alpha Vantage](https://www.alphavantage.co/support/#api-key)
2. **Create Account**: Sign up for free
3. **Get API Key**: Copy your API key
4. **Add to Environment**: Create `.env.local` file in frontend folder:
   ```
   VITE_ALPHA_VANTAGE_API_KEY=your_api_key_here
   ```

**Alpha Vantage Limits:**
- Free tier: 5 calls/minute, 500 calls/day
- Real-time quotes
- Historical data
- Company information

### Option 2: Yahoo Finance (No API Key)

The service automatically falls back to Yahoo Finance if Alpha Vantage fails.

**Yahoo Finance Benefits:**
- No API key required
- No rate limits
- Real-time data
- Company details

### Option 3: Other APIs

You can also integrate with:
- **IEX Cloud**: 50,000 calls/month free
- **Polygon.io**: 5 calls/minute free
- **Twelve Data**: 800 calls/day free

## How to Use

1. **Search Stocks**: Type any stock symbol (AAPL, MSFT, etc.)
2. **Real Data**: See current prices, changes, volume
3. **Company Info**: Get sector, market cap, P/E ratio
4. **Historical Charts**: View price history

## API Integration

The stock data service (`/services/stockData.ts`) handles:
- Real-time quotes
- Stock search
- Company overviews
- Historical data for charts

## Troubleshooting

**If you see "demo" data:**
- Check your API key is correct
- Verify the `.env.local` file exists
- Restart your development server

**Rate limit errors:**
- Alpha Vantage free tier has limits
- Yahoo Finance fallback will activate
- Consider upgrading to paid tier for higher limits





