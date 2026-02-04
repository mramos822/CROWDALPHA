import httpx
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.config import settings
import google.genai as genai
from app.services.form4_service import InsiderService
from app.services.form13f_service import InstitutionalService

class SignalsService:
    """Service for fetching financial news and generating trading signals using AI"""
    
    FINLIGHT_BASE_URL = "https://api.finlight.me/v2"
    
    @staticmethod
    async def fetch_news_for_stock(ticker: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Fetch recent financial news for a stock from Finlight API"""
        try:
            headers = {
                "X-API-KEY": settings.finlight_api_key,
                "Content-Type": "application/json"
            }
            
            # Finlight API endpoint for articles
            url = f"{SignalsService.FINLIGHT_BASE_URL}/articles"
            
            # Request body with tickers filter
            body = {
                "tickers": [ticker],
                "pageSize": limit,
                "orderBy": "publishDate",
                "order": "DESC"
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=body)
                response.raise_for_status()
                
            news_data = response.json()
            
            # Extract relevant fields
            articles = []
            if "articles" in news_data:
                for article in news_data["articles"]:
                    # Handle missing/empty summaries
                    summary = article.get("summary", "")
                    if not summary or not summary.strip():
                        # Use title as fallback if summary is empty
                        summary = article.get("title", "")
                    
                    articles.append({
                        "title": article.get("title"),
                        "summary": summary.strip(),
                        "source": article.get("source"),
                        "published_at": article.get("publishDate"),
                        "url": article.get("link"),
                        "sentiment": article.get("sentiment")
                    })
            
            return articles
        
        except httpx.HTTPError as e:
            raise ValueError(f"Failed to fetch news from Finlight: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error processing Finlight response: {str(e)}")
    
    # Delete once AI API is ready, or keep strictly for testing purposes
    @staticmethod
    async def generate_signal_with_ai_mock(
        ticker: str,
        articles: List[Dict[str, Any]],
        current_price: Optional[float] = None,
        user_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Mock AI signal generation for testing
        Analyzes articles sentiment and returns a signal
        """
        # Simple sentiment-based mock logic
        positive_keywords = ["growth", "beat", "record", "surge", "rally", "gain", "strong", "bullish", "optimistic", "up", "rise", "higher"]
        negative_keywords = ["decline", "miss", "loss", "fall", "risk", "concern", "bearish", "weak", "pessimistic", "down", "drop", "lower"]
        
        positive_count = 0
        negative_count = 0
        
        # Analyze article titles and summaries
        for article in articles:
            text = (article.get("title", "") + " " + article.get("summary", "")).lower()
            positive_count += sum(1 for keyword in positive_keywords if keyword in text)
            negative_count += sum(1 for keyword in negative_keywords if keyword in text)
        
        # Determine signal based on sentiment
        total_sentiment = positive_count - negative_count
        total_articles = len(articles)
        
        if total_sentiment > (total_articles * 0.5):
            signal = "BUY"
            confidence = min(0.95, 0.6 + (total_sentiment / (total_articles * 2)))
            reasoning = f"Predominantly positive sentiment with {positive_count} positive indicators vs {negative_count} negative."
            risk_level = "LOW" if confidence > 0.8 else "MEDIUM"
        elif total_sentiment < -(total_articles * 0.3):
            signal = "SELL"
            confidence = min(0.95, 0.6 + (abs(total_sentiment) / (total_articles * 2)))
            reasoning = f"Predominantly negative sentiment with {negative_count} negative indicators vs {positive_count} positive."
            risk_level = "MEDIUM" if confidence > 0.75 else "HIGH"
        else:
            signal = "HOLD"
            confidence = 0.5 + (min(positive_count, negative_count) / (total_articles * 2))
            reasoning = "Mixed sentiment. Market conditions unclear. Recommend waiting for more clarity."
            risk_level = "MEDIUM"
        
        return {
            "ticker": ticker,
            "signal": signal,
            "confidence": round(confidence, 2),
            "reasoning": reasoning,
            "key_points": [
                f"{positive_count} positive news indicators",
                f"{negative_count} negative news indicators",
                f"Based on {total_articles} recent articles"
            ],
            "risk_level": risk_level,
            "sentiment_analysis": f"Net sentiment: {total_sentiment:+d} ({positive_count} positive, {negative_count} negative)",
            "generated_at": datetime.utcnow().isoformat(),
            "articles_analyzed": total_articles
        }
    
    @staticmethod
    async def generate_signal_with_ai(
        ticker: str,
        articles: List[Dict[str, Any]],
        current_price: Optional[float] = None,
        user_context: Optional[str] = None,
        insider_data: Optional[Dict[str, Any]] = None,
        institutional_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate trading signal using Google Gemini AI with ALL data sources
        
        Args:
            ticker: Stock ticker symbol
            articles: List of news articles from Finlight
            current_price: Current stock price (optional)
            user_context: Additional user context (optional)
            insider_data: Form 4 insider trading data (optional)
            institutional_data: Form 13F institutional holdings data (optional)
        
        Returns:
            Signal with recommendation, confidence, reasoning
        """
        try:
            # Format news articles
            articles_text = "\n\n".join([
                f"Title: {a['title']}\n"
                f"Source: {a['source']}\n"
                f"Published: {a['published_at']}\n"
                f"Summary: {a['summary']}"
                for a in articles
            ])
            
            # Format insider data (Form 4)
            insider_section = ""
            if insider_data and insider_data.get("transactions"):
                insider_sentiment = insider_data.get("sentiment", {})
                transactions = insider_data.get("transactions", [])
                
                insider_section = f"""
                    INSIDER TRADING DATA (Form 4):
                    - Sentiment: {insider_sentiment.get('sentiment', 'N/A')} (Confidence: {insider_sentiment.get('confidence', 0)})
                    - Summary: {insider_sentiment.get('summary', 'No recent transactions')}
                    - Recent Transactions: {len(transactions)} filings
                    """
                for trans in transactions[:5]:  # Show top 5
                    insider_section += f"\n  • {trans.get('insider_name')} ({trans.get('insider_title')}): {trans.get('transaction_type').upper()} {trans.get('shares')} shares @ ${trans.get('price'):.2f}"
            else:
                insider_section = "\nINSIDER TRADING DATA (Form 4): No recent insider transactions"
            
            # Format institutional data (Form 13F)
            institutional_section = ""
            if institutional_data and institutional_data.get("holdings"):
                inst_sentiment = institutional_data.get("sentiment", {})
                holdings = institutional_data.get("holdings", [])
                
                institutional_section = f"""
                    INSTITUTIONAL HOLDINGS DATA (Form 13F):
                    - Sentiment: {inst_sentiment.get('sentiment', 'N/A')} (Confidence: {inst_sentiment.get('confidence', 0)})
                    - Summary: {inst_sentiment.get('summary', 'No institutional data')}
                    - Total Institutional Value: ${inst_sentiment.get('total_value_held', 0):,.0f}
                    - Number of Funds: {inst_sentiment.get('major_funds_count', 0)}
                    - Concentration: {inst_sentiment.get('concentration', 0):.1f}%
                    """
                for holding in holdings[:3]:  # Show top 3
                    institutional_section += f"\n  • {holding.get('shares'):,} shares worth ${holding.get('value'):,}"
            else:
                institutional_section = "\nINSTITUTIONAL HOLDINGS DATA (Form 13F): No institutional data available"
            
            prompt = f"""You are a professional financial analyst specializing in equity research. 
                Analyze ALL the following data sources about {ticker} and provide a comprehensive trading signal.

                STOCK INFORMATION:
                - Ticker: {ticker}
                {f'- Current Price: ${current_price}' if current_price else ''}
                {f'- User Context: {user_context}' if user_context else ''}

                NEWS SENTIMENT DATA (Latest Articles):
                {articles_text}

                {insider_section}

                {institutional_section}

                Based on ALL available data sources (news, insider trading, and institutional holdings), provide your analysis in the following JSON format ONLY:
                {{
                    "signal": "BUY" | "SELL" | "HOLD",
                    "confidence": 0.0 to 1.0,
                    "reasoning": "comprehensive explanation considering all data sources",
                    "key_points": ["point1", "point2", "point3", "point4"],
                    "risk_level": "LOW" | "MEDIUM" | "HIGH",
                    "sentiment_analysis": "summary of combined sentiment from news, insiders, and institutions"
                }}

                Analysis Guidelines:
                1. Evaluate news sentiment for market perception
                2. Consider insider transactions as indicators of executive confidence (weight heavily)
                    - HEAVY insider selling (5+ transactions) = strong bearish signal
                    - Light insider selling (1-2 transactions) = minor concern
                    - CEO/CFO selling = more significant than junior executives
                3. Factor in institutional holdings as validation of long-term value
                4. Identify conflicts between data sources (e.g., positive news but insider selling)
                5. Weight insider transactions MORE heavily - they indicate company knowledge
                    - Single $1M insider sale = minimal impact
                    - $10M+ insider selling spree = significant concern
                6. Consider institutional backing as endorsement, but note if conflicting with insiders
                7. Provide confidence based on alignment of all data sources
                8. If insiders are selling heavily while news is positive, note this conflict and reduce confidence

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
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if not json_match:
                raise ValueError(f"Could not extract JSON from Gemini response: {response_text}")
            
            signal_data = json.loads(json_match.group())
            
            return {
                "ticker": ticker,
                "signal": signal_data.get("signal"),
                "confidence": signal_data.get("confidence"),
                "reasoning": signal_data.get("reasoning"),
                "key_points": signal_data.get("key_points", []),
                "risk_level": signal_data.get("risk_level"),
                "sentiment_analysis": signal_data.get("sentiment_analysis"),
                "generated_at": datetime.utcnow().isoformat(),
                "articles_analyzed": len(articles)
            }
        
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Gemini response as JSON: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to generate signal with Gemini: {str(e)}")
    
    @staticmethod
    async def generate_signal_for_stock(
        ticker: str,
        current_price: Optional[float] = None,
        user_context: Optional[str] = None,
        news_limit: int = 10
    ) -> Dict[str, Any]:
        """
        Complete pipeline: fetch news, insider data, institutional data, 
        then generate AI signal using ALL data sources
        
        Args:
            ticker: Stock ticker symbol
            current_price: Current stock price (optional)
            user_context: Additional user context (optional)
            news_limit: Number of news articles to fetch
        
        Returns:
            Trading signal with full analysis and all source data
        """
        try:
            # Step 1: Fetch ALL three data sources in parallel
            articles = await SignalsService.fetch_news_for_stock(ticker, limit=news_limit)
            
            insider_summary = None
            institutional_summary = None
            
            # Fetch insider data (Form 4) - limit to 7 days (1 week) and top 10 to avoid rate limits
            try:
                insider_summary = await InsiderService.get_insider_summary(ticker, days_back=7)
            except Exception as e:
                print(f"Warning: Could not fetch insider data: {str(e)}")
            
            # Fetch institutional data (Form 13F) - limit to top 10 most recent to avoid rate limits
            try:
                institutional_summary = await InstitutionalService.get_institutional_summary(ticker, quarters_back=1)
            except Exception as e:
                print(f"Warning: Could not fetch institutional data: {str(e)}")
            
            # Step 2: Validate we have minimum data
            if not articles:
                return {
                    "ticker": ticker,
                    "signal": "HOLD",
                    "confidence": 0.0,
                    "reasoning": "Insufficient news data to generate signal",
                    "key_points": [],
                    "risk_level": "UNKNOWN",
                    "sentiment_analysis": "No articles available",
                    "generated_at": datetime.utcnow().isoformat(),
                    "articles_analyzed": 0,
                    "insider_data": insider_summary,
                    "institutional_data": institutional_summary
                }
            
            # Step 3: Generate AI signal with ALL data sources
            signal = await SignalsService.generate_signal_with_ai(
                ticker=ticker,
                articles=articles,
                current_price=current_price,
                user_context=user_context,
                insider_data=insider_summary,
                institutional_data=institutional_summary
            )
            
            # Step 4: Add article links and data to response
            signal["articles"] = [
                {
                    "title": article.get("title"),
                    "source": article.get("source"),
                    "url": article.get("url"),
                    "published_at": article.get("published_at"),
                    "summary": article.get("summary")
                }
                for article in articles
            ]
            
            # Step 5: Add Form 4 insider data summary
            if insider_summary:
                insider_sentiment = insider_summary.get("sentiment", {})
                signal["insider_summary"] = {
                    "sentiment": insider_sentiment.get("sentiment"),
                    "confidence": insider_sentiment.get("confidence"),
                    "summary": insider_sentiment.get("summary"),
                    "buys": insider_sentiment.get("buys", 0),
                    "sells": insider_sentiment.get("sells", 0),
                    "transactions": insider_summary.get("transactions", [])[:5]  # Top 5 transactions
                }
            
            # Step 6: Add Form 13F institutional data summary
            if institutional_summary:
                inst_sentiment = institutional_summary.get("sentiment", {})
                signal["institutional_summary"] = {
                    "sentiment": inst_sentiment.get("sentiment"),
                    "confidence": inst_sentiment.get("confidence"),
                    "summary": inst_sentiment.get("summary"),
                    "total_value_held": inst_sentiment.get("total_value_held"),
                    "major_funds_count": inst_sentiment.get("major_funds_count"),
                    "concentration": inst_sentiment.get("concentration"),
                    "holdings": institutional_summary.get("holdings", [])[:3]  # Top 3 holdings
                }
            
            # Step 7: Add full raw data for reference
            signal["insider_data"] = insider_summary
            signal["institutional_data"] = institutional_summary
            
            return signal
        
        except Exception as e:
            raise ValueError(f"Failed to generate signal: {str(e)}")