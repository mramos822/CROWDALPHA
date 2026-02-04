import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from app.config import settings

class InsiderService:
    """Service for fetching insider trading data (Form 4) from SEC API"""
    
    SEC_API_BASE_URL = "https://api.sec-api.io"
    
    @staticmethod
    async def fetch_insider_transactions(
        ticker: str,
        days_back: int = 7,
        transaction_type: str = "all"  # "buy", "sell", or "all"
    ) -> List[Dict[str, Any]]:
        """
        Fetch recent insider transactions (Form 4) for a ticker
        
        Args:
            ticker: Stock ticker symbol
            days_back: Look back period in days (default: 7)
            transaction_type: Filter by transaction type ("buy", "sell", "all")
        
        Returns:
            List of insider transactions with details
        """
        try:
            headers = {
                "Authorization": settings.sec_api_key,  # No "Bearer" prefix
                "Content-Type": "application/json"
            }
            
            # Calculate date range
            end_date = datetime.utcnow().date()
            start_date = end_date - timedelta(days=days_back)
            
            # Build Lucene query based on transaction type
            if transaction_type == "buy":
                # Code "P" = Open market or private purchase
                query = f'issuer.tradingSymbol:{ticker} AND (nonDerivativeTable.transactions.coding.code:P OR nonDerivativeTable.transactions.coding.code:A)'
            elif transaction_type == "sell":
                # Code "S" = Open market or private sale
                query = f'issuer.tradingSymbol:{ticker} AND nonDerivativeTable.transactions.coding.code:S'
            else:
                # Get all transactions
                query = f'issuer.tradingSymbol:{ticker}'
            
            # Add date range filter
            query += f' AND periodOfReport:[{start_date.isoformat()} TO {end_date.isoformat()}]'
            
            # SEC API endpoint for insider trading
            url = f"{InsiderService.SEC_API_BASE_URL}/insider-trading"
            
            body = {
                "query": query,
                "from": 0,
                "size": 10,  # Limit to top 10 most recent to avoid rate limits
                "sort": [{"filedAt": {"order": "desc"}}]
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=body)
                response.raise_for_status()
            
            data = response.json()
            
            # Extract and normalize transactions
            transactions = []
            if "transactions" in data:
                for filing in data["transactions"]:
                    # Extract reporting owner info
                    owner = filing.get("reportingOwner", {})
                    relationship = owner.get("relationship", {})
                    
                    insider_title = relationship.get("officerTitle", "")
                    if relationship.get("isDirector"):
                        insider_title = "Director" if not insider_title else f"{insider_title}, Director"
                    
                    # Process non-derivative transactions (actual stock trades)
                    non_deriv = filing.get("nonDerivativeTable", {})
                    for trans in non_deriv.get("transactions", []):
                        coding = trans.get("coding", {})
                        code = coding.get("code", "")
                        
                        # Determine transaction type from code
                        if code in ["P", "A"]:  # Purchase or Acquisition
                            trans_type = "buy"
                        elif code == "S":  # Sale
                            trans_type = "sell"
                        else:
                            continue  # Skip other transaction types
                        
                        amounts = trans.get("amounts", {})
                        
                        transaction = {
                            "insider_name": owner.get("name", "Unknown"),
                            "insider_title": insider_title,
                            "transaction_type": trans_type,
                            "shares": int(amounts.get("shares", 0)),
                            "price": float(amounts.get("pricePerShare", 0)),
                            "value": float(amounts.get("shares", 0)) * float(amounts.get("pricePerShare", 0)),
                            "transaction_date": trans.get("transactionDate"),
                            "filing_date": filing.get("filedAt"),
                            "form_type": filing.get("documentType", "4")
                        }
                        transactions.append(transaction)
            
            return transactions
        
        except httpx.HTTPError as e:
            raise ValueError(f"Failed to fetch insider transactions: {str(e)}")
        except Exception as e:
            raise ValueError(f"Error processing SEC API response: {str(e)}")
    
    @staticmethod
    def analyze_insider_sentiment(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze insider transactions to generate sentiment signal
        
        Returns:
            - sentiment: "bullish", "bearish", or "neutral"
            - confidence: 0.0-1.0
            - score: net score (positive = bullish, negative = bearish)
            - summary: text description
        """
        if not transactions:
            return {
                "sentiment": "neutral",
                "confidence": 0.0,
                "score": 0,
                "summary": "No recent insider transactions",
                "buys": 0,
                "sells": 0
            }
        
        buy_count = 0
        sell_count = 0
        buy_volume = 0
        sell_volume = 0
        
        # Score by transaction importance (C-suite gets higher weight)
        executive_titles = ["CEO", "CFO", "COO", "CTO", "President", "Chairman"]
        
        for transaction in transactions:
            shares = transaction.get("shares", 0)
            is_executive = any(title in transaction.get("insider_title", "").upper() for title in executive_titles)
            
            # Weight executive transactions higher
            weight = 1.5 if is_executive else 1.0
            
            if transaction.get("transaction_type") == "buy":
                buy_count += 1
                buy_volume += shares * weight
            elif transaction.get("transaction_type") == "sell":
                sell_count += 1
                sell_volume += shares * weight
        
        # Calculate net score
        net_score = buy_volume - sell_volume
        total_volume = buy_volume + sell_volume
        
        # Determine sentiment
        if net_score > (total_volume * 0.3):
            sentiment = "bullish"
            confidence = min(0.9, 0.5 + (net_score / (total_volume * 2))) if total_volume > 0 else 0.5
        elif net_score < -(total_volume * 0.3):
            sentiment = "bearish"
            confidence = min(0.9, 0.5 + (abs(net_score) / (total_volume * 2))) if total_volume > 0 else 0.5
        else:
            sentiment = "neutral"
            confidence = 0.5
        
        summary = f"Insiders: {buy_count} buys, {sell_count} sells"
        if buy_count > sell_count:
            summary += " - Net buying pressure"
        elif sell_count > buy_count:
            summary += " - Net selling pressure"
        
        return {
            "sentiment": sentiment,
            "confidence": round(confidence, 2),
            "score": round(net_score, 0),
            "summary": summary,
            "buys": buy_count,
            "sells": sell_count
        }
    
    @staticmethod
    async def get_insider_summary(ticker: str, days_back: int = 7) -> Dict[str, Any]:
        """
        Complete pipeline: fetch insider data and generate summary
        Limited to top 10 most recent transactions from the past week to avoid rate limits
        """
        """
        Complete pipeline: fetch insider data and generate summary
        """
        try:
            transactions = await InsiderService.fetch_insider_transactions(
                ticker=ticker,
                days_back=days_back
            )
            
            sentiment = InsiderService.analyze_insider_sentiment(transactions)
            
            return {
                "ticker": ticker,
                "transactions": transactions,
                "sentiment": sentiment,
                "fetched_at": datetime.utcnow().isoformat()
            }
        
        except Exception as e:
            raise ValueError(f"Failed to get insider summary: {str(e)}")