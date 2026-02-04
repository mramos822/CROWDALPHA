#!/usr/bin/env python3
"""
Test script to test SEC and Insider API endpoints via HTTP requests
"""
import requests
import json
import sys

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_insider_endpoint(ticker: str = "NVDA"):
    """Test the Insider endpoint"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing INSIDER endpoint for {ticker}")
    print(f"{'='*60}\n")
    
    # Note: This requires authentication, so we'll just show the endpoint structure
    url = f"{BASE_URL}/api/signals/generate-insider/{ticker}?days_back=7"
    
    print(f"📍 Endpoint: POST {url}")
    print(f"\n⚠️  Note: This endpoint requires authentication.")
    print(f"   To test it, you need to:")
    print(f"   1. Get an auth token from /api/auth/login")
    print(f"   2. Use it in the Authorization header")
    print(f"\n   Or test it directly from the frontend/Postman with your token.")
    
    return url

def test_sec_endpoint(ticker: str = "NVDA"):
    """Test the SEC endpoint"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing SEC (Institutional) endpoint for {ticker}")
    print(f"{'='*60}\n")
    
    url = f"{BASE_URL}/api/signals/generate-sec/{ticker}?quarters_back=1"
    
    print(f"📍 Endpoint: POST {url}")
    print(f"\n⚠️  Note: This endpoint requires authentication.")
    print(f"   To test it, you need to:")
    print(f"   1. Get an auth token from /api/auth/login")
    print(f"   2. Use it in the Authorization header")
    print(f"\n   Or test it directly from the frontend/Postman with your token.")
    
    return url

def show_api_structure():
    """Show what the API responses should look like"""
    print(f"\n{'='*60}")
    print("📋 Expected API Response Structure")
    print(f"{'='*60}\n")
    
    print("INSIDER Signal Response:")
    print(json.dumps({
        "ticker": "NVDA",
        "signal": "BUY",
        "confidence": 0.75,
        "reasoning": "Recent insider activity: 2 buy(s), 0 sell(s). Sentiment: bullish...",
        "key_points": [
            "2 insider buy transaction(s) in the last 7 days",
            "0 insider sell transaction(s) in the last 7 days",
            "Net sentiment: bullish",
            "Confidence: 75%"
        ],
        "risk_level": "MEDIUM",
        "sentiment_analysis": "Insider trading sentiment: bullish",
        "generated_at": "2025-11-30T21:00:00",
        "articles_analyzed": 0,
        "insider_data": {
            "transactions": [
                {
                    "insider_name": "John Doe",
                    "insider_title": "CEO",
                    "transaction_type": "buy",
                    "shares": 1000,
                    "price_per_share": 150.50,
                    "total_value": 150500,
                    "transaction_date": "2025-11-25"
                }
            ],
            "sentiment": {
                "sentiment": "bullish",
                "confidence": 0.75,
                "buys": 2,
                "sells": 0,
                "summary": "Recent insider activity shows bullish sentiment..."
            }
        },
        "signal_type": "INSIDER"
    }, indent=2))
    
    print("\n\nSEC Signal Response:")
    print(json.dumps({
        "ticker": "NVDA",
        "signal": "BUY",
        "confidence": 0.80,
        "reasoning": "Institutional holdings: 5 fund(s) holding this stock...",
        "key_points": [
            "Total funds: 5",
            "Total value held: $5000000.0M",
            "Net sentiment: bullish",
            "Confidence: 80%"
        ],
        "risk_level": "MEDIUM",
        "sentiment_analysis": "Institutional holdings sentiment: bullish",
        "generated_at": "2025-11-30T21:00:00",
        "articles_analyzed": 0,
        "institutional_data": {
            "holdings": [
                {
                    "fund_name": "Vanguard Group Inc",
                    "fund_cik": "0000102909",
                    "ticker": "NVDA",
                    "company_name": "NVIDIA CORP",
                    "shares": 5000000,
                    "value": 750000000,
                    "investment_discretion": "SOLE",
                    "period_of_report": "2025-09-30",
                    "filing_date": "2025-11-15"
                }
            ],
            "sentiment": {
                "sentiment": "bullish",
                "confidence": 0.80,
                "major_funds_count": 5,
                "total_value_held": 5000000000,
                "summary": "Major institutional funds are holding significant positions..."
            }
        },
        "signal_type": "SEC"
    }, indent=2))

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 SEC API Endpoint Test Script")
    print("="*60)
    
    ticker = "NVDA"
    
    # Show endpoint info
    test_insider_endpoint(ticker)
    test_sec_endpoint(ticker)
    
    # Show expected response structure
    show_api_structure()
    
    print(f"\n{'='*60}")
    print("💡 To actually test these endpoints:")
    print("   1. Make sure your backend server is running (uvicorn)")
    print("   2. Get an auth token from your frontend or /api/auth/login")
    print("   3. Use curl or Postman to POST to the endpoints with:")
    print("      - Authorization: Bearer <your_token>")
    print("   4. Or use the 'Regenerate Signals' button in the frontend")
    print(f"{'='*60}\n")


