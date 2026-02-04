import httpx
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from app.config import settings

# Cache for CIK to company name lookups (avoid repeated API calls)
_cik_name_cache: Dict[str, str] = {}
_cache_hits = 0  # Track cache hits to avoid redundant lookups

# Rate limiting for SEC EDGAR API (max 10 requests per second per SEC guidelines)
_last_request_time = 0.0
_min_request_interval = 0.1  # 100ms = 10 requests per second max

class InstitutionalService:
    """Service for fetching institutional holdings data (Form 13F) from SEC API"""
    
    SEC_API_BASE_URL = "https://api.sec-api.io"
    SEC_EDGAR_BASE_URL = "https://data.sec.gov"
    
    @staticmethod
    async def _rate_limit_sec_request():
        """Rate limit SEC EDGAR requests to max 10 per second (per SEC guidelines)"""
        global _last_request_time
        current_time = asyncio.get_event_loop().time()
        time_since_last = current_time - _last_request_time
        if time_since_last < _min_request_interval:
            await asyncio.sleep(_min_request_interval - time_since_last)
        _last_request_time = asyncio.get_event_loop().time()
    
    @staticmethod
    async def lookup_company_name_from_cik(cik: str) -> str:
        """
        Look up company name from CIK using SEC EDGAR public API
        
        Args:
            cik: CIK number (can be with or without leading zeros)
        
        Returns:
            Company name or "Fund CIK-{number}" if not found
        """
        if not cik:
            return "Fund CIK-Unknown"
        
        # Normalize CIK for display
        cik_display = str(cik).strip().lstrip('0') or str(cik).strip()
        
        # Check cache first - return early if we've already looked this up
        if cik in _cik_name_cache:
            global _cache_hits
            _cache_hits += 1
            cached_result = _cik_name_cache[cik]
            # If it was previously "Unknown Fund", return CIK format
            if cached_result == "Unknown Fund":
                return f"Fund CIK-{cik_display}"
            return cached_result
        
        try:
            # Normalize CIK - try multiple formats
            cik_str = str(cik).strip()
            
            # Try different normalization approaches
            cik_variants = []
            
            # Original format (with leading zeros)
            if len(cik_str) <= 10:
                cik_variants.append(cik_str.zfill(10))
            
            # Without leading zeros
            cik_no_zeros = cik_str.lstrip('0')
            if cik_no_zeros:
                cik_variants.append(cik_no_zeros.zfill(10))
            
            # Remove duplicates
            cik_variants = list(dict.fromkeys(cik_variants))
            
            print(f"🔍 [CIK LOOKUP] Looking up CIK {cik} (variants: {cik_variants})")
            
            # Use a simple request - SEC EDGAR doesn't require auth for company lookups
            # SEC requires: User-Agent with contact info, max 10 requests/second
            # Per SEC guidelines: https://www.sec.gov/about/webmaster-frequently-asked-questions#developers
            await InstitutionalService._rate_limit_sec_request()
            async with httpx.AsyncClient(
                timeout=15.0, 
                headers={"User-Agent": "CrowdAlpha/1.0 contact@crowdalpha.com"}
            ) as client:
                # Try submissions API FIRST (most reliable for institutional investors/funds)
                # This is what SEC.gov uses and works for funds that don't have tickers
                for cik_variant in cik_variants:
                    try:
                        cik_for_submissions = cik_variant.lstrip('0')
                        if not cik_for_submissions:
                            continue
                        await InstitutionalService._rate_limit_sec_request()
                        submissions_url = f"{InstitutionalService.SEC_EDGAR_BASE_URL}/submissions/CIK{cik_for_submissions}.json"
                        submissions_response = await client.get(submissions_url)
                        if submissions_response.status_code == 200:
                            submissions_data = submissions_response.json()
                            # Try multiple possible field names for the entity name
                            entity_name = (
                                submissions_data.get("name") or
                                submissions_data.get("entityName") or
                                submissions_data.get("companyName") or
                                (submissions_data.get("filings", {}).get("recent", {}).get("companyName", [None])[0] if submissions_data.get("filings") else None)
                            )
                            if entity_name:
                                _cik_name_cache[cik] = entity_name
                                print(f"✅ [CIK LOOKUP] Found name for CIK {cik} via submissions: {entity_name}")
                                return entity_name
                            else:
                                print(f"⚠️ [CIK LOOKUP] Submissions API returned 200 but no name field found for CIK {cik_for_submissions}")
                                print(f"⚠️ [CIK LOOKUP] Response keys: {list(submissions_data.keys())[:10]}")
                        elif submissions_response.status_code == 404:
                            print(f"⚠️ [CIK LOOKUP] Submissions API returned 404 for CIK {cik_for_submissions}")
                        else:
                            print(f"⚠️ [CIK LOOKUP] Submissions API returned {submissions_response.status_code} for CIK {cik_for_submissions}")
                    except httpx.TimeoutException:
                        print(f"⚠️ [CIK LOOKUP] Timeout with submissions API for CIK {cik_variant}")
                        continue
                    except Exception as e:
                        print(f"⚠️ [CIK LOOKUP] Error with submissions for CIK {cik_variant}: {str(e)}")
                        continue
                
                # Fallback 1: try companyfacts API
                for cik_variant in cik_variants:
                    try:
                        cik_for_facts = cik_variant.lstrip('0')
                        if not cik_for_facts:
                            continue
                        await InstitutionalService._rate_limit_sec_request()
                        facts_url = f"{InstitutionalService.SEC_EDGAR_BASE_URL}/api/xbrl/companyfacts/CIK{cik_for_facts}.json"
                        facts_response = await client.get(facts_url)
                        if facts_response.status_code == 200:
                            facts_data = facts_response.json()
                            entity_name = facts_data.get("entityName")
                            if entity_name:
                                _cik_name_cache[cik] = entity_name
                                print(f"✅ [CIK LOOKUP] Found name for CIK {cik} via companyfacts: {entity_name}")
                                return entity_name
                    except Exception as e:
                        print(f"⚠️ [CIK LOOKUP] Error with companyfacts for CIK {cik_variant}: {str(e)}")
                        continue
                
                # Fallback 2: use company ticker lookup API (may not have all institutional funds)
                try:
                    await InstitutionalService._rate_limit_sec_request()
                    company_url = f"{InstitutionalService.SEC_EDGAR_BASE_URL}/files/company-tickers.json"
                    company_response = await client.get(company_url)
                    if company_response.status_code == 200:
                        company_data = company_response.json()
                        if "data" in company_data:
                            # Build a lookup map for faster searching
                            cik_to_name = {}
                            for entry in company_data["data"]:
                                entry_cik = str(entry[0]).zfill(10)  # CIK is first element
                                entry_name = entry[1]  # Company name is second element
                                cik_to_name[entry_cik] = entry_name
                            
                            # Try each CIK variant
                            for cik_variant in cik_variants:
                                if cik_variant in cik_to_name:
                                    company_name = cik_to_name[cik_variant]
                                    _cik_name_cache[cik] = company_name
                                    print(f"✅ [CIK LOOKUP] Found name for CIK {cik} ({cik_variant}): {company_name}")
                                    return company_name
                except Exception as e:
                    print(f"⚠️ [CIK LOOKUP] Error with company-tickers.json: {str(e)}")
        
        except Exception as e:
            print(f"⚠️ [CIK LOOKUP] Failed to lookup CIK {cik}: {str(e)}")
        
        # Cache the CIK number format to avoid repeated failed lookups
        cik_display = str(cik).strip().lstrip('0') or str(cik).strip()
        fund_name = f"Fund CIK-{cik_display}"
        _cik_name_cache[cik] = "Unknown Fund"  # Keep internal marker for stats
        print(f"❌ [CIK LOOKUP] Could not find name for CIK {cik} after trying all methods, returning CIK number")
        return fund_name
    
    @staticmethod
    def get_cache_stats() -> Dict[str, int]:
        """Get cache statistics"""
        unknown_count = sum(1 for v in _cik_name_cache.values() if v == "Unknown Fund")
        known_count = len(_cik_name_cache) - unknown_count
        return {
            "total_cached": len(_cik_name_cache),
            "known_names": known_count,
            "unknown_funds": unknown_count,
            "cache_hits": _cache_hits
        }
    
    @staticmethod
    def clear_cik_cache():
        """Clear the CIK name cache - useful for retrying failed lookups"""
        global _cik_name_cache, _cache_hits
        _cik_name_cache.clear()
        _cache_hits = 0
        print("🧹 [CIK LOOKUP] Cache cleared")
    
    @staticmethod
    async def fetch_institutional_holdings(
        ticker: str,
        quarters_back: int = 1
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent institutional holdings (Form 13F) for a ticker using sec-api.io
        
        Args:
            ticker: Stock ticker symbol
            quarters_back: Number of recent quarters to look back (default: 1)
        
        Returns:
            List of institutional holdings with fund details
        """
        try:
            headers = {
                "Authorization": settings.sec_api_key,
                "Content-Type": "application/json"
            }
            
            # Build Lucene query to find all funds holding this ticker
            query = f'holdings.ticker:{ticker}'
            
            # SEC API endpoint for Form 13F holdings
            url = f"{InstitutionalService.SEC_API_BASE_URL}/form-13f/holdings"
            
            body = {
                "query": query,
                "from": 0,
                "size": 50,  # Request many filings to ensure we get diverse dates across multiple quarters
                "sort": [{"filedAt": {"order": "desc"}}]
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=body)
                response.raise_for_status()
            
            data = response.json()
            
            # Debug: Log first filing structure to see what fields are available from sec-api.io
            if "data" in data and len(data["data"]) > 0:
                first_filing = data["data"][0]
                print(f"🔍 [SEC API] First filing keys: {list(first_filing.keys())}")
                if "filingManager" in first_filing:
                    filing_manager = first_filing['filingManager']
                    print(f"🔍 [SEC API] filingManager keys: {list(filing_manager.keys())}")
                    print(f"🔍 [SEC API] filingManager full data: {filing_manager}")
                    # Check all possible name fields
                    for key in filing_manager.keys():
                        if 'name' in key.lower() or 'company' in key.lower():
                            print(f"🔍 [SEC API] Potential name field '{key}': {filing_manager.get(key)}")
            
            # Extract and normalize holdings - limit to top 10 with diverse dates
            holdings = []
            max_holdings = 10  # Limit to top 10 to avoid rate limits
            seen_filing_dates = set()  # Track filing dates to ensure diversity
            
            if "data" in data:
                for filing in data["data"]:
                    # Stop once we have enough holdings
                    if len(holdings) >= max_holdings:
                        break
                    
                    # Extract filing manager info from sec-api.io response
                    # According to sec-api.io docs, filingManager object contains name, cik, etc.
                    filing_manager = filing.get("filingManager", {})
                    
                    # Try ALL possible field paths for manager name (sec-api.io format)
                    # Check multiple possible locations in the response
                    manager_name = None
                    
                    # First, try direct fields in filingManager
                    if filing_manager:
                        manager_name = (
                            filing_manager.get("name") or 
                            filing_manager.get("filingManagerName") or
                            filing_manager.get("companyName") or
                            filing_manager.get("filerName") or
                            filing_manager.get("managerName") or
                            None
                        )
                    
                    # If not found, try nested structures
                    if not manager_name and filing_manager:
                        if isinstance(filing_manager.get("manager"), dict):
                            manager_name = filing_manager["manager"].get("name")
                        if isinstance(filing_manager.get("company"), dict):
                            manager_name = manager_name or filing_manager["company"].get("name")
                    
                    # If still not found, try top-level filing fields
                    if not manager_name:
                        manager_name = (
                            filing.get("filingManagerName") or
                            filing.get("managerName") or
                            filing.get("companyName") or
                            filing.get("filerName") or
                            None
                        )
                    
                    # Last resort: check if there's a nested structure we haven't checked
                    if not manager_name and filing_manager:
                        # Try to find any field containing "name" in the filingManager
                        for key, value in filing_manager.items():
                            if 'name' in key.lower() and value:
                                manager_name = str(value)
                                break
                    
                    # Extract CIK - try multiple field paths
                    # The CIK might be in the filing object itself (for the company being held)
                    # or in the filingManager object (for the fund manager)
                    manager_cik = None
                    
                    # Try filingManager first (this is the fund manager's CIK)
                    if filing_manager:
                        manager_cik = (
                            filing_manager.get("cik") or
                            filing_manager.get("filingManagerCik") or
                            filing_manager.get("managerCik") or
                            None
                        )
                    
                    # If not found, try top-level filing (might be the fund manager's CIK)
                    if not manager_cik:
                        manager_cik = (
                            filing.get("cik") or
                            filing.get("filingManagerCik") or
                            None
                        )
                    
                    # If still not found, check entities array (sec-api.io sometimes puts it there)
                    if not manager_cik and filing.get("entities"):
                        for entity in filing.get("entities", []):
                            if entity.get("type") == "filingManager" or "manager" in str(entity.get("type", "")).lower():
                                manager_cik = entity.get("cik")
                                if manager_cik:
                                    break
                    
                    # Convert CIK to string and clean it
                    if manager_cik:
                        manager_cik = str(manager_cik).strip()
                    else:
                        manager_cik = ""  # Set to empty string if not found
                    
                    # If we still don't have a name, log the structure for debugging
                    if not manager_name:
                        print(f"⚠️ [SEC API] No name found for filing. FilingManager keys: {list(filing_manager.keys()) if filing_manager else 'None'}")
                        print(f"⚠️ [SEC API] Filing top-level keys: {list(filing.keys())}")
                        if manager_cik:
                            manager_name = f"Fund CIK-{manager_cik.lstrip('0') or manager_cik}"
                        else:
                            manager_name = "Unknown Fund"
                    
                    # Debug: Log what we extracted
                    if len(holdings) < 3:  # Log first 3 for debugging
                        print(f"🔍 [SEC API] Extracted manager_name: '{manager_name}', CIK: '{manager_cik}'")
                    
                    # Extract dates - try multiple possible field names from sec-api.io
                    # sec-api.io typically returns dates in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
                    filing_date_raw = (
                        filing.get("filedAt") or 
                        filing.get("filingDate") or 
                        filing.get("filedAtDate") or
                        filing.get("dateFiled") or
                        ""
                    )
                    period_of_report_raw = (
                        filing.get("periodOfReport") or 
                        filing.get("reportPeriod") or 
                        filing.get("period") or
                        filing.get("reportDate") or
                        ""
                    )
                    
                    # Normalize dates to ISO format (YYYY-MM-DD) for consistent parsing
                    # sec-api.io might return dates in different formats, so we normalize them
                    filing_date = ""
                    period_of_report = ""
                    
                    if filing_date_raw:
                        try:
                            # Try to parse and normalize the date
                            from datetime import datetime
                            # Handle different date formats from sec-api.io
                            if isinstance(filing_date_raw, str):
                                # Try ISO format first (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
                                if 'T' in filing_date_raw:
                                    dt = datetime.fromisoformat(filing_date_raw.replace('Z', '+00:00'))
                                else:
                                    dt = datetime.strptime(filing_date_raw, '%Y-%m-%d')
                                filing_date = dt.strftime('%Y-%m-%d')
                            else:
                                filing_date = str(filing_date_raw)
                        except Exception as e:
                            # If parsing fails, use the raw value
                            filing_date = str(filing_date_raw)
                            if len(holdings) < 3:
                                print(f"⚠️ [SEC API] Could not parse filing_date '{filing_date_raw}': {e}")
                    
                    if period_of_report_raw:
                        try:
                            from datetime import datetime
                            if isinstance(period_of_report_raw, str):
                                # Try ISO format first
                                if 'T' in period_of_report_raw:
                                    dt = datetime.fromisoformat(period_of_report_raw.replace('Z', '+00:00'))
                                else:
                                    dt = datetime.strptime(period_of_report_raw, '%Y-%m-%d')
                                period_of_report = dt.strftime('%Y-%m-%d')
                            else:
                                period_of_report = str(period_of_report_raw)
                        except Exception as e:
                            period_of_report = str(period_of_report_raw)
                            if len(holdings) < 3:
                                print(f"⚠️ [SEC API] Could not parse period_of_report '{period_of_report_raw}': {e}")
                    
                    # Log date fields for debugging - log for ALL filings to see if dates differ
                    print(f"📅 [SEC API] Filing #{len(holdings) + 1} - Manager: '{manager_name}' (CIK: {manager_cik})")
                    print(f"   📅 Raw dates - filedAt: '{filing.get('filedAt')}', periodOfReport: '{filing.get('periodOfReport')}'")
                    print(f"   📅 Extracted - filing_date: '{filing_date}', period_of_report: '{period_of_report}'")
                    print(f"   📅 Filing keys: {list(filing.keys())[:10]}...")  # Show first 10 keys to debug
                    
                    # Find the specific holding for this ticker
                    # IMPORTANT: Only take ONE holding per filing to ensure we get diverse dates
                    # (Multiple holdings from the same filing will have the same dates)
                    found_holding_in_filing = False
                    for holding in filing.get("holdings", []):
                        if holding.get("ticker", "").upper() == ticker.upper():
                            shares_info = holding.get("shrsOrPrnAmt", {})
                            
                            holding_data = {
                                "fund_name": manager_name,
                                "fund_cik": manager_cik,
                                "ticker": holding.get("ticker"),
                                "company_name": holding.get("nameOfIssuer"),
                                "shares": int(shares_info.get("sshPrnamt", 0)),
                                "value": int(holding.get("value", 0)),
                                "investment_discretion": holding.get("investmentDiscretion"),
                                "period_of_report": period_of_report,
                                "filing_date": filing_date,
                                "voting_authority": holding.get("votingAuthority", {}),
                                "cusip": holding.get("cusip")
                            }
                            # Only add if we haven't seen this exact filing date yet (or if we have fewer than 3 holdings)
                            # This ensures we get diverse dates, but allows some duplicates if needed
                            if filing_date and len(holdings) >= 3:
                                if filing_date in seen_filing_dates:
                                    print(f"   ⏭️ Skipping duplicate filing date: {filing_date} (already have {len(seen_filing_dates)} unique dates)")
                                    found_holding_in_filing = True
                                    break  # Skip this filing, try next one
                            
                            holdings.append(holding_data)
                            if filing_date:
                                seen_filing_dates.add(filing_date)
                            print(f"   ✅ Added holding: {manager_name} - Filed: {filing_date}, Period: {period_of_report}")
                            print(f"   📊 Unique filing dates so far: {len(seen_filing_dates)} ({sorted(seen_filing_dates)[:5]})")
                            found_holding_in_filing = True
                            
                            # Only take ONE holding per filing to get diverse dates
                            break
                    
                    # Stop once we have enough holdings (from different filings)
                    if len(holdings) >= max_holdings:
                        break
                    
                    # Stop processing filings once we have enough holdings
                    if len(holdings) >= max_holdings:
                        break
            
            return holdings
        
        except httpx.HTTPError as e:
            raise ValueError(f"Failed to fetch institutional holdings: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error processing SEC API response: {str(e)}")
    
    @staticmethod
    def analyze_institutional_sentiment(holdings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze institutional holdings to generate sentiment signal
        
        Returns:
            - sentiment: "bullish", "bearish", or "neutral"
            - confidence: 0.0-1.0
            - major_funds: list of top funds holding the stock
            - summary: text description
        """
        if not holdings:
            return {
                "sentiment": "neutral",
                "confidence": 0.0,
                "major_funds_count": 0,
                "total_shares_held": 0,
                "total_value_held": 0,
                "summary": "No recent institutional holdings data",
                "major_funds": []
            }
        
        # Sort holdings by value (largest positions first)
        sorted_holdings = sorted(holdings, key=lambda x: x.get("value", 0), reverse=True)
        
        # Get top institutional holders (funds with significant positions)
        major_funds = sorted_holdings[:5]  # Top 5 funds
        
        total_value = sum(h.get("value", 0) for h in holdings)
        total_shares = sum(h.get("shares", 0) for h in holdings)
        
        # Calculate concentration (what % of holdings are from top funds?)
        top_5_value = sum(h.get("value", 0) for h in major_funds)
        concentration = (top_5_value / total_value * 100) if total_value > 0 else 0
        
        # Extract major fund names
        major_fund_names = [f["fund_name"] for f in major_funds]
        
        # Determine sentiment based on institutional interest
        # High concentration + major funds = bullish
        # Many small holders = mixed
        # Decreasing holdings over time = bearish (would need historical data)
        
        if concentration > 70:
            sentiment = "bullish"  # Major funds strongly committed
            confidence = 0.8
            summary = f"Strong institutional backing: Top 5 funds hold {concentration:.0f}% of institutional shares"
        elif concentration > 40:
            sentiment = "bullish"
            confidence = 0.7
            summary = f"Solid institutional support: Top 5 funds hold {concentration:.0f}% of institutional shares"
        else:
            sentiment = "neutral"
            confidence = 0.6
            summary = f"Diversified institutional ownership: Top 5 funds hold {concentration:.0f}% of shares"
        
        return {
            "sentiment": sentiment,
            "confidence": round(confidence, 2),
            "major_funds_count": len(holdings),
            "total_shares_held": total_shares,
            "total_value_held": total_value,
            "concentration": round(concentration, 2),
            "summary": summary,
            "major_funds": major_fund_names
        }
    
    @staticmethod
    async def get_institutional_summary(ticker: str, quarters_back: int = 1) -> Dict[str, Any]:
        """
        Complete pipeline: fetch institutional data and generate summary
        Limited to top 10 most recent holdings to avoid rate limits
        """
        """
        Complete pipeline: fetch institutional data and generate summary
        """
        try:
            holdings = await InstitutionalService.fetch_institutional_holdings(
                ticker=ticker,
                quarters_back=quarters_back
            )
            
            sentiment = InstitutionalService.analyze_institutional_sentiment(holdings)
            
            return {
                "ticker": ticker,
                "holdings": holdings,
                "sentiment": sentiment,
                "fetched_at": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            raise ValueError(f"Failed to get institutional summary: {str(e)}")