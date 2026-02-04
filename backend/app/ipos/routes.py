from fastapi import APIRouter, HTTPException, Depends, Query
from app.auth.middleware import get_current_user
from app.services.ipo_service import IpoService
from app.config import settings
from typing import Dict, Any, List, Optional

router = APIRouter(prefix="/api/ipos", tags=["ipos"])

@router.get("/calendar")
async def get_ipo_calendar(
    days_ahead: int = Query(90, ge=1, le=365, description="Number of days ahead to fetch IPOs"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get upcoming IPO calendar
    
    - **days_ahead**: Number of days ahead to fetch IPOs for (default: 90, max: 365)
    
    Note: If Finnhub API key is not configured or invalid, returns mock data.
    """
    try:
        print(f"📅 Fetching IPO calendar for next {days_ahead} days...")
        ipos = await IpoService.fetch_upcoming_ipos(days_ahead=days_ahead)
        print(f"✅ Found {len(ipos)} upcoming IPOs")
        
        return {
            "ipos": ipos,
            "total_count": len(ipos),
            "days_ahead": days_ahead,
            "source": "finnhub" if settings.finnhub_api_key and settings.finnhub_api_key != "your_finnhub_api_key_here" else "mock"
        }
    except ValueError as e:
        # Only raise error for rate limits, not for missing/invalid API keys (those return mock data)
        if "rate limit" in str(e).lower():
            raise HTTPException(status_code=429, detail=str(e))
        # For other ValueErrors, return mock data
        print(f"⚠️ Error: {str(e)}. Returning mock data.")
        ipos = IpoService._get_mock_ipos()
        return {
            "ipos": ipos,
            "total_count": len(ipos),
            "days_ahead": days_ahead,
            "source": "mock"
        }
    except Exception as e:
        print(f"❌ Error fetching IPO calendar: {str(e)}")
        # Return mock data as fallback instead of error
        print("⚠️ Returning mock data as fallback.")
        ipos = IpoService._get_mock_ipos()
        return {
            "ipos": ipos,
            "total_count": len(ipos),
            "days_ahead": days_ahead,
            "source": "mock"
        }

@router.get("/{ticker}")
async def get_ipo_by_ticker(
    ticker: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get IPO information for a specific ticker
    """
    try:
        print(f"🔍 Fetching IPO info for {ticker.upper()}...")
        # Fetch IPOs and filter by ticker
        ipos = await IpoService.fetch_upcoming_ipos(days_ahead=365)
        matching_ipo = next((ipo for ipo in ipos if ipo.get("ticker", "").upper() == ticker.upper()), None)
        
        if not matching_ipo:
            raise HTTPException(status_code=404, detail=f"No IPO found for ticker {ticker}")
        
        return matching_ipo
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching IPO for {ticker}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching IPO: {str(e)}")

