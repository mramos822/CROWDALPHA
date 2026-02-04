from fastapi import APIRouter, HTTPException, WebSocket
from typing import Dict, Any, Optional
import httpx
import time
import asyncio
from datetime import datetime, timedelta
from collections import defaultdict
from app.config import settings

router = APIRouter(prefix="/api/stocks", tags=["stocks"])

# Import WebSocket handler
try:
    from app.stocks.websocket import handle_stock_websocket, connect_polygon_websocket
    WEBSOCKET_AVAILABLE = True
except ImportError:
    WEBSOCKET_AVAILABLE = False

# Simple in-memory cache to avoid hitting APIs too frequently
_quote_cache: Dict[str, Dict[str, Any]] = {}
_cache_timestamps: Dict[str, float] = {}
_chart_cache: Dict[str, Dict[str, Any]] = {}
_chart_cache_timestamps: Dict[str, float] = {}
CACHE_DURATION = 300  # Cache for 5 minutes
CHART_CACHE_DURATION = 600  # Cache charts for 10 minutes
RATE_LIMIT_DELAY = 12.0  # Polygon free tier: 5 requests/min = 12 seconds between requests
_last_request_time: float = 0

@router.get("/quote-summary/{symbol}")
async def get_quote_summary(symbol: str):
    """
    Fetch detailed stock information from Polygon/Massive API.
    This endpoint bypasses CORS by fetching server-side.
    Includes caching and rate limiting to avoid 429 errors.
    """
    try:
        symbol_upper = symbol.upper()
        
        # Check cache first
        if symbol_upper in _quote_cache:
            cache_age = time.time() - _cache_timestamps.get(symbol_upper, 0)
            if cache_age < CACHE_DURATION:
                print(f"📦 [STOCKS] Returning cached data for {symbol_upper} (age: {cache_age:.1f}s)")
                return _quote_cache[symbol_upper]
            else:
                # Cache expired, remove it
                _quote_cache.pop(symbol_upper, None)
                _cache_timestamps.pop(symbol_upper, None)
        
        if not settings.polygon_api_key:
            raise HTTPException(
                status_code=500,
                detail="Polygon API key not configured"
            )
        
        # Rate limiting: ensure minimum delay between requests (Polygon free tier: 5 req/min)
        global _last_request_time
        time_since_last = time.time() - _last_request_time
        if time_since_last < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - time_since_last)
        _last_request_time = time.time()
        
        # Use Polygon API for company details
        url = f"https://api.polygon.io/v3/reference/tickers/{symbol_upper}"
        params = {"apiKey": settings.polygon_api_key}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 429:
                # Rate limited - return cached data if available, even if expired
                if symbol_upper in _quote_cache:
                    print(f"⚠️ [STOCKS] Rate limited, returning stale cache for {symbol_upper}")
                    return _quote_cache[symbol_upper]
                raise HTTPException(
                    status_code=429,
                    detail="Polygon API rate limit exceeded. Please try again in a few moments."
                )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Polygon API returned {response.status_code}"
                )
            
            data = response.json()
            
            if data.get("status") != "OK" or not data.get("results"):
                raise HTTPException(
                    status_code=404,
                    detail=f"No data found for symbol {symbol_upper}"
                )
            
            ticker_data = data["results"]
            
            # Extract market cap
            market_cap = ticker_data.get("market_cap")
            market_cap_formatted = "N/A"
            market_cap_value = None
            if market_cap:
                market_cap_value = float(market_cap) if isinstance(market_cap, (int, float)) else None
                if market_cap_value and market_cap_value > 0:
                    if market_cap_value >= 1e12:
                        market_cap_formatted = f"{(market_cap_value / 1e12):.1f}T"
                    elif market_cap_value >= 1e9:
                        market_cap_formatted = f"{(market_cap_value / 1e9):.1f}B"
                    elif market_cap_value >= 1e6:
                        market_cap_formatted = f"{(market_cap_value / 1e6):.1f}M"
                    else:
                        market_cap_formatted = f"{market_cap_value:.0f}"
            
            # Build response from Polygon data
            address = ticker_data.get("address", {})
            headquarters = None
            if address:
                parts = []
                if address.get("city"):
                    parts.append(address["city"])
                if address.get("state"):
                    parts.append(address["state"])
                if address.get("postal_code"):
                    parts.append(address["postal_code"])
                if parts:
                    headquarters = ", ".join(parts)
            
            # Polygon doesn't provide P/E ratio directly in ticker endpoint
            # We'll leave it as None and let frontend use Yahoo Finance P/E
            pe_ratio = None
            
            # Extract industry from Polygon data
            # Polygon provides: sic_code, sic_description, type, market
            sic_description = ticker_data.get("sic_description")
            sic_code = ticker_data.get("sic_code")
            
            # Use sic_description as industry if available (more specific)
            industry = None
            if sic_description:
                industry = sic_description
            elif sic_code:
                # If only sic_code, use it as industry
                industry = f"SIC {sic_code}"
            else:
                # Fallback to type or market
                industry = ticker_data.get("type") or ticker_data.get("market") or "N/A"
            
            # Extract sector - Polygon doesn't directly provide sector
            # We can infer from sic_code or use sic_description
            # Extract sector from sic_description
            # Try to categorize based on keywords, otherwise use sic_description directly
            sector = None
            if sic_description:
                sic_lower = sic_description.lower()
                # Try to match common sector keywords
                if "semiconductor" in sic_lower or "computer" in sic_lower or "software" in sic_lower or "technology" in sic_lower:
                    sector = "Technology"
                elif "financial" in sic_lower or "bank" in sic_lower or "credit" in sic_lower:
                    sector = "Financial Services"
                elif "healthcare" in sic_lower or "pharmaceutical" in sic_lower or "medical" in sic_lower or "biotechnology" in sic_lower:
                    sector = "Healthcare"
                elif "retail" in sic_lower or "consumer" in sic_lower or "merchandise" in sic_lower:
                    sector = "Consumer"
                elif "energy" in sic_lower or "oil" in sic_lower or "gas" in sic_lower or "petroleum" in sic_lower:
                    sector = "Energy"
                elif "industrial" in sic_lower or "machinery" in sic_lower:
                    sector = "Industrials"
                elif "communication" in sic_lower or "telecom" in sic_lower or "broadcasting" in sic_lower:
                    sector = "Communication Services"
                elif "real estate" in sic_lower or "property" in sic_lower:
                    sector = "Real Estate"
                elif "utilities" in sic_lower or "electric" in sic_lower:
                    sector = "Utilities"
                elif "materials" in sic_lower or "chemical" in sic_lower or "mining" in sic_lower:
                    sector = "Materials"
                else:
                    # Use sic_description directly (it's better than "N/A")
                    # Take first part before comma if it exists
                    sector = sic_description.split(",")[0].strip() if "," in sic_description else sic_description
            else:
                sector = "N/A"
            
            # Ensure we have valid values
            if not industry or industry == "N/A":
                industry = ticker_data.get("primary_exchange") or "N/A"
            if not sector or sector == "N/A":
                sector = "N/A"
            
            result = {
                "symbol": symbol_upper,
                "name": ticker_data.get("name"),
                "sector": sector or "N/A",
                "industry": industry or "N/A",
                "marketCap": market_cap_formatted,
                "marketCapRaw": market_cap_value,
                "peRatio": pe_ratio,  # Polygon doesn't provide this directly
                "employees": ticker_data.get("total_employees"),
                "headquarters": headquarters,
                "website": ticker_data.get("homepage_url"),
                "description": ticker_data.get("description"),
                "city": address.get("city") if address else None,
                "state": address.get("state") if address else None,
                "country": address.get("country") if address else None
            }
            
            # Cache the result
            _quote_cache[symbol_upper] = result
            _cache_timestamps[symbol_upper] = time.time()
            print(f"✅ [STOCKS] Cached data for {symbol_upper}")
            print(f"📊 [STOCKS] Market Cap: {market_cap_formatted} (raw: {market_cap_value})")
            print(f"📊 [STOCKS] Sector: {sector}, Industry: {industry}")
            print(f"📊 [STOCKS] P/E: {pe_ratio}, Employees: {ticker_data.get('total_employees')}")
            
            return result
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Yahoo Finance timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error connecting to Yahoo Finance: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/chart/{symbol}")
async def get_chart_data(
    symbol: str,
    from_date: str,
    to_date: str,
    timespan: str = "day",
    multiplier: int = 1
):
    """
    Fetch historical chart data from Polygon/Massive API.
    """
    try:
        symbol_upper = symbol.upper()
        
        if not settings.polygon_api_key:
            raise HTTPException(
                status_code=500,
                detail="Polygon API key not configured"
            )
        
        # Rate limiting
        global _last_request_time
        time_since_last = time.time() - _last_request_time
        if time_since_last < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - time_since_last)
        _last_request_time = time.time()
        
        # Check cache first
        cache_key = f"{symbol_upper}_{from_date}_{to_date}_{timespan}_{multiplier}"
        if cache_key in _chart_cache:
            cache_age = time.time() - _chart_cache_timestamps.get(cache_key, 0)
            if cache_age < CHART_CACHE_DURATION:
                print(f"📦 [CHART] Returning cached chart data for {symbol_upper} (age: {cache_age:.1f}s)")
                return _chart_cache[cache_key]
        
        # Polygon aggregates endpoint uses YYYY-MM-DD date format
        # Validate and use dates as-is (Polygon expects YYYY-MM-DD format)
        try:
            # Validate date format
            if '-' not in from_date:
                raise ValueError("Invalid from_date format")
            if '-' not in to_date:
                raise ValueError("Invalid to_date format")
            
            # Parse to validate format
            from_dt = datetime.strptime(from_date, "%Y-%m-%d")
            to_dt = datetime.strptime(to_date, "%Y-%m-%d")
            
            # Use dates as YYYY-MM-DD strings for Polygon API
            from_date_str = from_date
            to_date_str = to_date
        except Exception as e:
            # Fallback to current date range
            print(f"⚠️ [CHART] Date parsing error: {e}, using default range")
            to_dt = datetime.now()
            from_dt = to_dt - timedelta(days=7)
            from_date_str = from_dt.strftime("%Y-%m-%d")
            to_date_str = to_dt.strftime("%Y-%m-%d")
        
        # Massive/Polygon aggregates endpoint (accepts YYYY-MM-DD dates OR millisecond timestamps)
        # Documentation: https://massive.com/docs/rest/stocks/aggregates/custom-bars
        # Using api.polygon.io (same as api.massive.com, Polygon acquired Massive)
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol_upper}/range/{multiplier}/{timespan}/{from_date_str}/{to_date_str}"
        params = {
            "apiKey": settings.polygon_api_key,
            "adjusted": "true",  # Adjusted for splits by default
            "sort": "asc",  # Ascending order (oldest first)
            "limit": 50000  # Max limit per docs
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 429:
                # Rate limited - return cached data if available, even if expired
                if cache_key in _chart_cache:
                    print(f"⚠️ [CHART] Rate limited, returning stale cache for {symbol_upper}")
                    return _chart_cache[cache_key]
                raise HTTPException(
                    status_code=429,
                    detail="Polygon API rate limit exceeded. Please try again in a few moments."
                )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Polygon API returned {response.status_code}"
                )
            
            data = response.json()
            
            # If no results, return empty array instead of 404 (historical data may not be available)
            if data.get("status") != "OK" or not data.get("results"):
                print(f"⚠️ [CHART] No data from Polygon for {symbol_upper}, returning empty results")
                result = {
                    "symbol": symbol_upper,
                    "results": [],
                    "resultsCount": 0
                }
                # Cache empty result to avoid repeated API calls
                _chart_cache[cache_key] = result
                _chart_cache_timestamps[cache_key] = time.time()
                return result
            
            # Format data for frontend according to Massive API response format
            # Response structure: { status, ticker, adjusted, queryCount, resultsCount, results: [{ t, o, h, l, c, v, vw, n }] }
            chart_data = []
            for bar in data["results"]:
                # t = Unix millisecond timestamp, convert to seconds for frontend
                timestamp_seconds = bar["t"] / 1000
                chart_data.append({
                    "date": time.strftime("%Y-%m-%d", time.localtime(timestamp_seconds)),
                    "timestamp": timestamp_seconds,
                    "value": bar["c"],  # close price
                    "open": bar["o"],   # open price
                    "high": bar["h"],   # high price
                    "low": bar["l"],    # low price
                    "volume": bar["v"], # trading volume
                    # Optional fields available but not always present:
                    # "vw": bar.get("vw"),  # volume weighted average price
                    # "n": bar.get("n"),    # number of transactions
                })
            
            result = {
                "symbol": symbol_upper,
                "results": chart_data,
                "resultsCount": len(chart_data),
                "source": "polygon"  # Mark as coming from Polygon/Massive API
            }
            
            # Cache the result
            _chart_cache[cache_key] = result
            _chart_cache_timestamps[cache_key] = time.time()
            print(f"✅ [POLYGON CHART] Successfully fetched {len(chart_data)} candles for {symbol_upper} from Polygon/Massive API")
            
            return result
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Polygon API timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error connecting to Polygon API: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/quote/{symbol}")
async def get_latest_quote(symbol: str):
    """
    Get the latest real-time quote from Polygon API.
    Used for live price updates in the chart.
    """
    try:
        symbol_upper = symbol.upper()
        
        if not settings.polygon_api_key:
            raise HTTPException(
                status_code=500,
                detail="Polygon API key not configured"
            )
        
        # Rate limiting - Polygon free tier: 5 requests/minute = 12 seconds minimum
        # Use same global counter to coordinate all Polygon requests
        global _last_request_time
        time_since_last = time.time() - _last_request_time
        if time_since_last < RATE_LIMIT_DELAY:
            await asyncio.sleep(RATE_LIMIT_DELAY - time_since_last)
        _last_request_time = time.time()
        
        # Polygon previous close endpoint (works better than aggregates for current price)
        url = f"https://api.polygon.io/v2/aggs/ticker/{symbol_upper}/prev"
        params = {"apiKey": settings.polygon_api_key, "adjusted": "true"}
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Polygon API rate limit exceeded"
                )
            
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Polygon API returned {response.status_code}"
                )
            
            data = response.json()
            
            if data.get("status") != "OK" or not data.get("results") or len(data["results"]) == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"No quote data found for symbol {symbol_upper}"
                )
            
            result = data["results"][0]
            timestamp = result.get("t", int(time.time() * 1000))  # Milliseconds
            
            return {
                "symbol": symbol_upper,
                "price": result.get("c"),  # close/last price
                "open": result.get("o"),
                "high": result.get("h"),
                "low": result.get("l"),
                "volume": result.get("v"),
                "vwap": result.get("vw"),  # volume weighted average price
                "timestamp": timestamp,
                "timestampSeconds": timestamp / 1000
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request to Polygon API timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Error connecting to Polygon API: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# WebSocket endpoint for real-time updates (optional, uses polling if WebSocket unavailable)
@router.websocket("/ws/{symbol}")
async def websocket_endpoint(websocket: WebSocket, symbol: str):
    """WebSocket endpoint for real-time stock price updates from Polygon"""
    if not WEBSOCKET_AVAILABLE:
        await websocket.close(code=1003, reason="WebSocket handler not available")
        return
    
    await handle_stock_websocket(websocket, symbol)

