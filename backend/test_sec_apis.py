#!/usr/bin/env python3
"""
Test script to fetch sample data from SEC and Insider APIs
"""
import asyncio
import sys
import os
from pathlib import Path

# Add the backend directory to the path
sys.path.insert(0, str(Path(__file__).parent))

from app.services.form4_service import InsiderService
from app.services.form13f_service import InstitutionalService
import json

async def test_insider_api(ticker: str = "NVDA"):
    """Test the Insider API (Form 4)"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing INSIDER API for {ticker}")
    print(f"{'='*60}\n")
    
    try:
        # Test direct API call
        print("1️⃣ Direct API call to fetch_insider_transactions:")
        transactions = await InsiderService.fetch_insider_transactions(
            ticker=ticker,
            days_back=7
        )
        
        print(f"   ✅ Found {len(transactions)} transactions")
        if transactions:
            print(f"\n   📋 Sample transaction (first one):")
            print(json.dumps(transactions[0], indent=2, default=str))
        else:
            print("   ⚠️ No transactions found")
        
        # Test summary service
        print(f"\n2️⃣ Testing get_insider_summary service:")
        summary = await InsiderService.get_insider_summary(ticker, days_back=7)
        
        if summary:
            print(f"   ✅ Summary generated")
            print(f"\n   📊 Summary structure:")
            print(f"   - Has transactions: {bool(summary.get('transactions'))}")
            print(f"   - Transaction count: {len(summary.get('transactions', []))}")
            print(f"   - Has sentiment: {bool(summary.get('sentiment'))}")
            if summary.get('sentiment'):
                sentiment = summary['sentiment']
                print(f"   - Sentiment type: {sentiment.get('sentiment')}")
                print(f"   - Buys: {sentiment.get('buys')}")
                print(f"   - Sells: {sentiment.get('sells')}")
                print(f"   - Confidence: {sentiment.get('confidence')}")
                print(f"   - Summary: {sentiment.get('summary', '')[:200]}...")
            
            print(f"\n   📋 Full summary (first 1000 chars):")
            print(json.dumps(summary, indent=2, default=str)[:1000])
        else:
            print("   ⚠️ No summary generated")
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

async def test_institutional_api(ticker: str = "NVDA"):
    """Test the Institutional API (Form 13F)"""
    print(f"\n{'='*60}")
    print(f"🧪 Testing INSTITUTIONAL (SEC) API for {ticker}")
    print(f"{'='*60}\n")
    
    try:
        # Test direct API call
        print("1️⃣ Direct API call to fetch_institutional_holdings:")
        holdings = await InstitutionalService.fetch_institutional_holdings(
            ticker=ticker,
            quarters_back=1
        )
        
        print(f"   ✅ Found {len(holdings)} holdings")
        if holdings:
            print(f"\n   📋 Sample holding (first one):")
            print(json.dumps(holdings[0], indent=2, default=str))
        else:
            print("   ⚠️ No holdings found")
        
        # Test summary service
        print(f"\n2️⃣ Testing get_institutional_summary service:")
        summary = await InstitutionalService.get_institutional_summary(ticker, quarters_back=1)
        
        if summary:
            print(f"   ✅ Summary generated")
            print(f"\n   📊 Summary structure:")
            print(f"   - Has holdings: {bool(summary.get('holdings'))}")
            print(f"   - Holdings count: {len(summary.get('holdings', []))}")
            print(f"   - Has sentiment: {bool(summary.get('sentiment'))}")
            if summary.get('sentiment'):
                sentiment = summary['sentiment']
                print(f"   - Sentiment type: {sentiment.get('sentiment')}")
                print(f"   - Major funds count: {sentiment.get('major_funds_count')}")
                print(f"   - Total value held: ${sentiment.get('total_value_held', 0):,}")
                print(f"   - Confidence: {sentiment.get('confidence')}")
                print(f"   - Summary: {sentiment.get('summary', '')[:200]}...")
            
            print(f"\n   📋 Full summary (first 1000 chars):")
            print(json.dumps(summary, indent=2, default=str)[:1000])
        else:
            print("   ⚠️ No summary generated")
            
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()

async def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("🚀 SEC API Test Script")
    print("="*60)
    
    # Test with a popular ticker
    ticker = "NVDA"
    
    # Test Insider API
    await test_insider_api(ticker)
    
    # Wait a bit to avoid rate limits
    print("\n⏳ Waiting 5 seconds to avoid rate limits...")
    await asyncio.sleep(5)
    
    # Test Institutional API
    await test_institutional_api(ticker)
    
    print(f"\n{'='*60}")
    print("✅ Testing complete!")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    asyncio.run(main())

