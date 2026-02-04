import httpx
import json
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from app.config import settings
import google.genai as genai

class IpoService:
    """Service for fetching IPO calendar data from Finnhub API"""
    
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    
    @staticmethod
    async def fetch_upcoming_ipos(days_ahead: int = 90) -> List[Dict[str, Any]]:
        """
        Fetch upcoming IPOs from Finnhub API
        
        Args:
            days_ahead: Number of days ahead to fetch IPOs for (default: 90)
        
        Returns:
            List of IPO dictionaries with company info, dates, pricing, etc.
        """
        # Check if API key is configured
        if not settings.finnhub_api_key or settings.finnhub_api_key == "your_finnhub_api_key_here":
            print("⚠️ Finnhub API key not configured. Returning mock data.")
            return IpoService._get_mock_ipos()
        
        try:
            # Finnhub IPO Calendar endpoint
            url = f"{IpoService.FINNHUB_BASE_URL}/calendar/ipo"
            
            # Calculate date range
            from_date = datetime.now().strftime("%Y-%m-%d")
            to_date = (datetime.now() + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            
            params = {
                "from": from_date,
                "to": to_date,
                "token": settings.finnhub_api_key
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(url, params=params)
                
                # Check for invalid API key before raising
                if response.status_code == 401:
                    error_data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {}
                    if "Invalid API key" in str(error_data) or "Invalid API key" in response.text:
                        print("⚠️ Invalid Finnhub API key. Returning mock data.")
                        print("💡 Please check your FINNHUB_API_KEY in config.env")
                        return IpoService._get_mock_ipos()
                
                response.raise_for_status()
                
            data = response.json()
            
            # Transform Finnhub data to our format
            ipos = []
            if "ipoCalendar" in data:
                from app.services.firestore import FirestoreService
                
                # First, try to get cached IPOs from Firestore in batch
                ipo_ids = [f"{ipo.get('symbol', '')}-{ipo.get('date', '')}" for ipo in data["ipoCalendar"]]
                cached_ipos = {}
                
                # Check Firestore for each IPO
                for ipo_id in ipo_ids:
                    try:
                        cached = FirestoreService.get_ipo(ipo_id)
                        if cached and cached.get("riskExplanation"):
                            cached_ipos[ipo_id] = cached
                            print(f"📦 Found cached IPO {ipo_id} in Firestore")
                    except Exception as e:
                        # Firestore might not be available, continue without cache
                        print(f"⚠️ Could not check Firestore cache for {ipo_id}: {str(e)}")
                        pass
                
                # Process each IPO
                for ipo in data["ipoCalendar"]:
                    ipo_id = f"{ipo.get('symbol', '')}-{ipo.get('date', '')}"
                    
                    # Check if we have cached data
                    if ipo_id in cached_ipos:
                        ipos.append(cached_ipos[ipo_id])
                        continue
                    
                    # IPO not in cache - process it with AI evaluation
                    print(f"🔄 Processing new IPO {ipo.get('symbol', 'IPO')} - evaluating with AI...")
                    
                    # Calculate basic risk score as fallback
                    basic_risk_score = IpoService._calculate_risk_score(ipo)
                    
                    # Get AI-powered risk evaluation (falls back to basic if Gemini fails)
                    risk_evaluation = await IpoService._evaluate_risk_with_ai(ipo, basic_risk_score)
                    
                    transformed_ipo = {
                        "id": ipo_id,
                        "company": ipo.get("name") or IpoService._infer_company_name(ipo) or "IPO Company",
                        "ticker": ipo.get("symbol", ""),
                        "expectedDate": ipo.get("date", ""),
                        "exchange": ipo.get("exchange", ""),
                        "priceRange": IpoService._format_price_range(ipo),
                        "size": IpoService._format_size(ipo),
                        "riskScore": risk_evaluation.get("riskScore", basic_risk_score),
                        "riskExplanation": risk_evaluation.get("explanation", ""),
                        "riskFactors": risk_evaluation.get("riskFactors", []),
                        "investmentConsiderations": risk_evaluation.get("investmentConsiderations", []),
                        "sector": IpoService._infer_sector(ipo) or "General",
                        "industry": ipo.get("industry") or IpoService._infer_industry(ipo) or "Diversified",
                        "description": f"{ipo.get('name', 'Company')} IPO on {ipo.get('exchange', 'exchange')}",
                        "status": IpoService._determine_status(ipo.get("date", "")),
                        "rawData": ipo  # Keep raw data for reference
                    }
                    
                    # Store in Firestore for future use (shared across all users)
                    try:
                        FirestoreService.store_ipo(ipo_id, transformed_ipo)
                        print(f"💾 Cached IPO {ipo.get('symbol', 'IPO')} with AI evaluation in Firestore")
                    except Exception as e:
                        print(f"⚠️ Failed to cache IPO {ipo.get('symbol', 'IPO')}: {str(e)}")
                        # Continue even if caching fails - IPO will still be returned
                    
                    ipos.append(transformed_ipo)
            
            return ipos
            
        except httpx.HTTPStatusError as e:
            print(f"❌ Finnhub API error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 429:
                raise ValueError("Finnhub API rate limit exceeded. Please try again later.")
            # Fallback to mock data on other HTTP errors
            print("⚠️ Returning mock data as fallback.")
            return IpoService._get_mock_ipos()
        except Exception as e:
            print(f"❌ Error fetching IPOs: {str(e)}")
            print("⚠️ Returning mock data as fallback.")
            return IpoService._get_mock_ipos()
    
    @staticmethod
    def _get_mock_ipos() -> List[Dict[str, Any]]:
        """Return mock IPO data when API is not available"""
        return [
            {
                "id": "tflo-2024-12-15",
                "company": "TechFlow AI",
                "ticker": "TFLO",
                "expectedDate": "2024-12-15",
                "exchange": "NASDAQ",
                "priceRange": "$45-$52",
                "size": "$2.1B",
                "riskScore": 2,
                "sector": "Technology",
                "industry": "Software",
                "description": "Leading AI-powered workflow automation platform serving Fortune 500 companies.",
                "status": "upcoming"
            },
            {
                "id": "ges-2024-12-20",
                "company": "GreenEnergy Solutions",
                "ticker": "GES",
                "expectedDate": "2024-12-20",
                "exchange": "NYSE",
                "priceRange": "$28-$35",
                "size": "$1.8B",
                "riskScore": 1,
                "sector": "Clean Energy",
                "industry": "Renewable Energy",
                "description": "Renewable energy infrastructure company specializing in solar and wind projects.",
                "status": "upcoming"
            },
            {
                "id": "hti-2025-01-09",
                "company": "HealthTech Innovations",
                "ticker": "HTI",
                "expectedDate": "2025-01-09",
                "exchange": "NASDAQ",
                "priceRange": "$65-$75",
                "size": "$3.2B",
                "riskScore": 3,
                "sector": "Healthcare",
                "industry": "Medical Technology",
                "description": "AI-driven diagnostic platform for early disease detection using advanced imaging.",
                "status": "upcoming"
            }
        ]
    
    @staticmethod
    def _infer_company_name(ipo: Dict[str, Any]) -> Optional[str]:
        """
        Infer or clean up company name if missing or unclear
        """
        name = ipo.get("name", "").strip()
        if name and name.upper() not in ["UNKNOWN", "UNKNOWN COMPANY", "N/A", ""]:
            return name
        
        # If we have a ticker, we could potentially format it better
        ticker = ipo.get("symbol", "")
        if ticker:
            # For SPACs, we might have a pattern like "ABC Acquisition Corp"
            return f"{ticker} Corp"
        
        return None
    
    @staticmethod
    def _infer_sector(ipo: Dict[str, Any]) -> Optional[str]:
        """
        Infer sector from company name, ticker, or industry if not provided
        """
        # First, check if sector is already provided and valid
        sector = ipo.get("sector", "").strip()
        if sector and sector.upper() not in ["UNKNOWN", "N/A", ""]:
            return sector
        
        # Try to infer from industry
        industry = ipo.get("industry", "").upper()
        industry_to_sector = {
            "TECHNOLOGY": "Technology",
            "SOFTWARE": "Technology",
            "HARDWARE": "Technology",
            "SEMICONDUCTOR": "Technology",
            "FINANCIAL": "Financial Services",
            "BANKING": "Financial Services",
            "INSURANCE": "Financial Services",
            "HEALTHCARE": "Healthcare",
            "BIOTECHNOLOGY": "Healthcare",
            "PHARMACEUTICAL": "Healthcare",
            "ENERGY": "Energy",
            "OIL": "Energy",
            "RENEWABLE": "Energy",
            "UTILITIES": "Utilities",
            "CONSUMER": "Consumer Discretionary",
            "RETAIL": "Consumer Discretionary",
            "INDUSTRIAL": "Industrials",
            "REAL ESTATE": "Real Estate",
        }
        
        for key, sector_name in industry_to_sector.items():
            if key in industry:
                return sector_name
        
        # Try to infer from company name
        company_name = ipo.get("name", "").upper()
        name_keywords = {
            "TECH": "Technology",
            "TECHNOLOGY": "Technology",
            "SOFTWARE": "Technology",
            "DIGITAL": "Technology",
            "FINANCIAL": "Financial Services",
            "BANK": "Financial Services",
            "FINANCE": "Financial Services",
            "HEALTH": "Healthcare",
            "MEDICAL": "Healthcare",
            "BIO": "Healthcare",
            "ENERGY": "Energy",
            "POWER": "Energy",
            "ACQUISITION": "Financial Services",  # SPACs are often in financial services
        }
        
        for keyword, sector_name in name_keywords.items():
            if keyword in company_name:
                return sector_name
        
        return None  # Will fall back to "General"
    
    @staticmethod
    def _infer_industry(ipo: Dict[str, Any]) -> Optional[str]:
        """
        Infer industry from company name or ticker if not provided
        """
        industry = ipo.get("industry", "").strip()
        if industry and industry.upper() not in ["UNKNOWN", "N/A", ""]:
            return industry
        
        # Try to infer from company name
        company_name = ipo.get("name", "").upper()
        
        # Check for common industry keywords
        if "ACQUISITION" in company_name:
            return "Special Purpose Acquisition Company"
        elif "BITCOIN" in company_name or "CRYPTO" in company_name:
            return "Cryptocurrency"
        
        return None  # Will fall back to "Diversified"
    
    @staticmethod
    def _calculate_risk_score(ipo: Dict[str, Any]) -> int:
        """
        Calculate basic risk score (1=Low, 2=Medium, 3=High) based on IPO data
        This is a fallback method used when AI evaluation is not available.
        """
        # Default to medium risk
        risk_score = 2
        
        # Adjust based on exchange (NYSE/NASDAQ = lower risk)
        exchange = ipo.get("exchange", "").upper()
        if exchange in ["NYSE", "NASDAQ"]:
            risk_score = 1  # Lower risk for major exchanges
        elif exchange in ["OTC", "OTCBB", "PINK"]:
            risk_score = 3  # Higher risk for OTC markets
        
        # Adjust based on sector (some sectors are riskier)
        sector = ipo.get("sector", "").upper()
        if sector in ["TECHNOLOGY", "HEALTHCARE", "BIOTECH"]:
            risk_score = max(risk_score, 2)  # At least medium risk
        elif sector in ["FINANCIAL", "ENERGY", "UTILITIES"]:
            risk_score = min(risk_score, 2)  # At most medium risk
        
        return risk_score
    
    @staticmethod
    async def _evaluate_risk_with_ai(ipo: Dict[str, Any], fallback_risk_score: int) -> Dict[str, Any]:
        """
        Evaluate IPO risk using Gemini AI with detailed analysis
        
        Returns a dictionary with:
        - riskScore: 1-3 (Low, Medium, High)
        - explanation: Detailed explanation of the risk assessment
        - riskFactors: List of key risk factors
        - investmentConsiderations: List of considerations for investors
        """
        # Check if Gemini API key is available
        if not settings.gemini_api_key or settings.gemini_api_key == "your_gemini_api_key_here":
            print(f"⚠️ Gemini API key not configured. Using basic risk calculation for {ipo.get('symbol', 'IPO')}")
            return {
                "riskScore": fallback_risk_score,
                "explanation": "AI risk evaluation unavailable. Risk calculated using basic criteria (exchange and sector).",
                "riskFactors": [],
                "investmentConsiderations": []
            }
        
        try:
            # Prepare IPO data for analysis (use inferred values if missing)
            company_name = ipo.get("name") or IpoService._infer_company_name(ipo) or "IPO Company"
            ticker = ipo.get("symbol", "")
            exchange = ipo.get("exchange", "")
            sector = IpoService._infer_sector(ipo) or ipo.get("sector") or "General"
            industry = IpoService._infer_industry(ipo) or ipo.get("industry") or "Diversified"
            price_low = ipo.get("priceLow")
            price_high = ipo.get("priceHigh")
            shares = ipo.get("shares")
            ipo_date = ipo.get("date", "")
            
            # Calculate IPO size
            size = "TBD"
            if shares and (price_low or price_high):
                avg_price = (price_low + price_high) / 2 if price_low and price_high else (price_low or price_high)
                size_value = shares * avg_price
                if size_value >= 1_000_000_000:
                    size = f"${size_value / 1_000_000_000:.1f}B"
                elif size_value >= 1_000_000:
                    size = f"${size_value / 1_000_000:.1f}M"
            
            # Create prompt for Gemini
            prompt = f"""Analyze the IPO risk for the following company and provide a comprehensive risk assessment.

IPO Details:
- Company: {company_name}
- Ticker: {ticker}
- Exchange: {exchange}
- Sector: {sector}
- Industry: {industry}
- Price Range: ${price_low if price_low else 'TBD'} - ${price_high if price_high else 'TBD'}
- IPO Size: {size}
- Expected Date: {ipo_date}

Please provide a JSON response with the following structure:
{{
    "riskScore": 1-3 (1=Low Risk, 2=Medium Risk, 3=High Risk),
    "explanation": "A concise 2-3 sentence explanation of the overall risk level and why",
    "riskFactors": ["List", "of", "key", "risk", "factors", "affecting", "this", "IPO"],
    "investmentConsiderations": ["List", "of", "important", "factors", "investors", "should", "consider"]
}}

Risk Evaluation Guidelines:
1. Exchange Quality: NYSE/NASDAQ = lower risk, OTC markets = higher risk
2. Sector Volatility: Tech, Biotech, Healthcare = typically higher risk; Utilities, Financials = typically lower risk
3. IPO Size: Larger IPOs ($1B+) often have more stability, smaller IPOs can be more volatile
4. Market Conditions: Consider current IPO market sentiment
5. Company Stage: Established companies = lower risk, startups = higher risk
6. Industry Trends: Consider industry growth potential and regulatory environment

Provide ONLY valid JSON in your response, no markdown formatting, no extra text."""
            
            # Call Gemini API
            client = genai.Client(api_key=settings.gemini_api_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            
            # Parse the response
            response_text = response.text
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                print(f"⚠️ Could not extract JSON from Gemini response for {ticker}. Using basic risk calculation.")
                return {
                    "riskScore": fallback_risk_score,
                    "explanation": "AI risk evaluation failed to parse response. Using basic risk calculation.",
                    "riskFactors": [],
                    "investmentConsiderations": []
                }
            
            risk_data = json.loads(json_match.group())
            
            # Validate risk score
            ai_risk_score = risk_data.get("riskScore", fallback_risk_score)
            if not isinstance(ai_risk_score, int) or ai_risk_score < 1 or ai_risk_score > 3:
                ai_risk_score = fallback_risk_score
            
            return {
                "riskScore": ai_risk_score,
                "explanation": risk_data.get("explanation", ""),
                "riskFactors": risk_data.get("riskFactors", []),
                "investmentConsiderations": risk_data.get("investmentConsiderations", [])
            }
        
        except json.JSONDecodeError as e:
            print(f"⚠️ Failed to parse Gemini risk evaluation JSON for {ipo.get('symbol', 'IPO')}: {str(e)}. Using basic risk calculation.")
            return {
                "riskScore": fallback_risk_score,
                "explanation": "AI risk evaluation failed to parse response. Using basic risk calculation.",
                "riskFactors": [],
                "investmentConsiderations": []
            }
        except Exception as e:
            print(f"⚠️ Error in AI risk evaluation for {ipo.get('symbol', 'IPO')}: {str(e)}. Using basic risk calculation.")
            return {
                "riskScore": fallback_risk_score,
                "explanation": f"AI risk evaluation unavailable ({str(e)[:50]}...). Using basic risk calculation.",
                "riskFactors": [],
                "investmentConsiderations": []
            }
    
    @staticmethod
    def _format_price_range(ipo: Dict[str, Any]) -> str:
        """Format price range from IPO data"""
        price_low = ipo.get("priceLow")
        price_high = ipo.get("priceHigh")
        
        if price_low and price_high:
            return f"${price_low:.2f}-${price_high:.2f}"
        elif price_low:
            return f"${price_low:.2f}+"
        else:
            return "TBD"
    
    @staticmethod
    def _format_size(ipo: Dict[str, Any]) -> str:
        """Format IPO size (market cap or offering size)"""
        shares = ipo.get("shares")
        price = ipo.get("priceLow") or ipo.get("priceHigh") or 0
        
        if shares and price:
            size = shares * price
            if size >= 1_000_000_000:
                return f"${size / 1_000_000_000:.1f}B"
            elif size >= 1_000_000:
                return f"${size / 1_000_000:.1f}M"
            else:
                return f"${size:,.0f}"
        
        return "TBD"
    
    @staticmethod
    def _determine_status(date_str: str) -> str:
        """Determine IPO status based on date"""
        if not date_str:
            return "upcoming"
        
        try:
            ipo_date = datetime.strptime(date_str, "%Y-%m-%d")
            today = datetime.now().date()
            
            if ipo_date.date() < today:
                return "completed"
            elif ipo_date.date() == today:
                return "trading"
            elif (ipo_date.date() - today).days <= 7:
                return "pricing"
            else:
                return "upcoming"
        except:
            return "upcoming"

