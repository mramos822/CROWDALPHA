from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from app.auth.middleware import get_current_user
from app.services.signals_service import SignalsService
from app.services.form4_service import InsiderService
from app.services.form13f_service import InstitutionalService
from app.services.firestore import FirestoreService
from app.schemas.signals import (
    SignalRequest,
    SignalResponse,
    SignalHistoryResponse,
    SignalHistoryEntry,
    NewsResponse,
    NewsArticle
)
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import uuid
import asyncio

router = APIRouter(prefix="/api/signals", tags=["signals"])

# Top tickers to generate signals for
DEFAULT_TICKERS = ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC']

@router.post("/generate", response_model=SignalResponse)
async def generate_signal(
    request: SignalRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate an AI-backed trading signal for a stock based on recent financial news and data.
    Checks for existing signals first to avoid duplicate API calls (saves budget).
    """
    try:
        ticker = request.ticker.upper()
        
        # Step 1: Check if a complete signal already exists (within last 24 hours)
        # This saves API calls by reusing existing signals
        print(f"🔍 Checking for existing signal for {ticker}...")
        # Import datetime locally to avoid scoping issues
        from datetime import datetime as dt_module
        cutoff_time = dt_module.utcnow() - timedelta(hours=24)
        cutoff_date = cutoff_time.strftime("%Y-%m-%d")
        
        try:
            existing_signal = FirestoreService.get_latest_signal_for_ticker(
                ticker=ticker,
                from_date=cutoff_date
            )
            
            if existing_signal:
                # Check if signal is complete and recent
                signal_timestamp = existing_signal.get("created_timestamp") or existing_signal.get("generated_at")
                if signal_timestamp:
                    try:
                        if hasattr(signal_timestamp, 'to_datetime'):
                            signal_dt = signal_timestamp.to_datetime()
                        elif isinstance(signal_timestamp, str):
                            signal_dt = dt_module.fromisoformat(signal_timestamp.replace('Z', '+00:00'))
                        else:
                            signal_dt = signal_timestamp
                        
                        # Check if signal is within 24 hours AND is complete
                        if signal_dt and signal_dt >= cutoff_time:
                            has_reasoning = existing_signal.get("reasoning") and len(str(existing_signal.get("reasoning", ""))) > 50
                            has_key_points = existing_signal.get("key_points") and len(existing_signal.get("key_points", [])) > 0
                            
                            if has_reasoning and has_key_points:
                                print(f"✅ Found existing complete signal for {ticker} (created: {signal_dt}). Reusing to save API calls.")
                                # Convert to dict and return existing signal
                                signal_dict = {}
                                for key, value in existing_signal.items():
                                    if hasattr(value, 'isoformat'):
                                        signal_dict[key] = value.isoformat()
                                    elif hasattr(value, 'timestamp'):
                                        signal_dict[key] = value.to_datetime().isoformat()
                                    else:
                                        signal_dict[key] = value
                                
                                # Ensure signal_type is set
                                if not signal_dict.get("signal_type"):
                                    signal_dict["signal_type"] = "NEWS"  # Default for AI-generated signals
                                
                                return SignalResponse(**signal_dict)
                    except Exception as e:
                        print(f"⚠️ Error checking signal timestamp: {e}. Proceeding with new generation.")
        except Exception as e:
            print(f"⚠️ Could not check for existing signal: {e}. Proceeding with new generation.")
        
        # Step 2: No existing signal found - generate new one
        print(f"🔄 No recent signal found for {ticker}. Generating new signal...")
        signal = await SignalsService.generate_signal_for_stock(
            ticker=ticker,
            user_context=request.user_context,
            news_limit=request.news_limit
        )
        
        # Debug: Log what we received
        print(f"📦 Signal received for {request.ticker.upper()}:")
        print(f"   - All keys: {list(signal.keys())}")
        print(f"   - Has reasoning: {bool(signal.get('reasoning'))} (length: {len(signal.get('reasoning', ''))})")
        print(f"   - Reasoning preview: {signal.get('reasoning', '')[:100] if signal.get('reasoning') else 'EMPTY'}")
        print(f"   - Has key_points: {bool(signal.get('key_points'))} (count: {len(signal.get('key_points', []))})")
        print(f"   - Key points: {signal.get('key_points', [])}")
        print(f"   - Has insider_data: {bool(signal.get('insider_data'))}")
        print(f"   - Has institutional_data: {bool(signal.get('institutional_data'))}")
        print(f"   - Articles analyzed: {signal.get('articles_analyzed', 0)}")
        
        # Validate signal has required fields before saving
        if not signal.get("reasoning") or not signal.get("key_points"):
            print(f"⚠️ WARNING: Signal for {request.ticker.upper()} is missing critical fields!")
            print(f"   - Full signal keys: {list(signal.keys())}")
            print(f"   - Signal type: {type(signal)}")
            # Try to convert to dict if it's a Pydantic model
            if hasattr(signal, 'model_dump'):
                signal_dict = signal.model_dump()
                print(f"   - After model_dump, has reasoning: {bool(signal_dict.get('reasoning'))}")
                print(f"   - After model_dump, has key_points: {bool(signal_dict.get('key_points'))}")
                signal = signal_dict
        
        # Ensure signal is a dict
        if not isinstance(signal, dict):
            if hasattr(signal, 'model_dump'):
                signal = signal.model_dump()
            elif hasattr(signal, 'dict'):
                signal = signal.dict()
            else:
                signal = dict(signal)
        
        # Ensure signal is a dict (not Pydantic model) before saving
        if not isinstance(signal, dict):
            if hasattr(signal, 'model_dump'):
                signal = signal.model_dump()
            elif hasattr(signal, 'dict'):
                signal = signal.dict()
            else:
                signal = dict(signal)
        
        # Ensure signal_type is set for individual requests (NEWS = AI-generated)
        if not signal.get("signal_type"):
            signal["signal_type"] = "NEWS"
            print(f"   - Set signal_type to NEWS for individual request")
        
        # Save signal to user's history (save the dict, not Pydantic model)
        signal_id = str(uuid.uuid4())
        print(f"💾 Saving signal {signal_id} to Firestore...")
        print(f"   - Signal type before save: {type(signal)}")
        print(f"   - Has reasoning before save: {bool(signal.get('reasoning'))} (value: {signal.get('reasoning', '')[:50] if signal.get('reasoning') else 'EMPTY'})")
        print(f"   - Has key_points before save: {bool(signal.get('key_points'))} (count: {len(signal.get('key_points', []))})")
        print(f"   - Key points values: {signal.get('key_points', [])}")
        print(f"   - Signal type: {signal.get('signal_type', 'NOT SET')}")
        
        # Save the raw dict to Firestore
        FirestoreService.save_signal_to_history(
            firebase_uid=current_user["firebase_uid"],
            signal_id=signal_id,
            signal_data=signal  # This is a dict with all fields
        )
        print(f"✅ Signal {signal_id} saved successfully")
        
        # Return Pydantic model for API response (this might strip extra fields, but we already saved)
        # Convert generated_at from ISO string to datetime if needed
        if isinstance(signal.get('generated_at'), str):
            from datetime import datetime
            try:
                signal['generated_at'] = datetime.fromisoformat(signal['generated_at'].replace('Z', '+00:00'))
            except:
                signal['generated_at'] = datetime.utcnow()
        
        return SignalResponse(**signal)
    
    except ValueError as e:
        print(f"❌ ValueError generating signal: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Exception generating signal: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating signal: {str(e)}")

@router.post("/news/{ticker}", response_model=NewsResponse)
async def get_stock_news(
    ticker: str, 
    limit: int = Query(5, ge=1, le=20, description="Number of articles to fetch"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Fetch recent financial news for a stock without generating a signal
    
    - **ticker**: Stock ticker symbol
    - **limit**: Number of articles to fetch (default: 10, max: 50)
    """
    try:
        articles_data = await SignalsService.fetch_news_for_stock(
            ticker=ticker.upper(),
            limit=limit
        )
        
        articles = [NewsArticle(**article) for article in articles_data]
        
        return NewsResponse(
            ticker=ticker.upper(),
            articles=articles,
            fetched_at=datetime.utcnow()
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching news: {str(e)}")

@router.get("/history")  # Removed response_model to return full signal data
async def get_signal_history(
    limit: int = Query(20, ge=1, le=100, description="Number of signals to retrieve"),
    include_all: bool = Query(True, description="Include signals from all users (default: True)"),
    from_date: Optional[str] = Query(None, description="Only return signals from this date forward (YYYY-MM-DD)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get signal generation history
    
    - **limit**: Number of signals to retrieve (default: 20, max: 100)
    - **include_all**: If True, returns signals from all users. If False, only returns user's own signals.
    - **from_date**: Only return signals from this date forward (YYYY-MM-DD format)
    """
    try:
        signals = FirestoreService.get_signal_history(
            firebase_uid=current_user["firebase_uid"],
            limit=limit,
            include_all=include_all,
            from_date=from_date
        )
        
        print(f"🔍 Received {len(signals)} signals from FirestoreService")
        
        # Enrich signals with company names for institutional holdings (lookup CIK -> name)
        # This fixes "Unknown Fund" names in existing signals
        async def enrich_institutional_names(signal: Dict[str, Any]) -> Dict[str, Any]:
            """Enrich institutional holdings with company names from CIK lookup"""
            if signal.get("institutional_data") and signal["institutional_data"].get("holdings"):
                holdings = signal["institutional_data"]["holdings"]
                enriched_holdings = []
                
                # Debug: Log what we received from Firestore
                ticker = signal.get("ticker", "UNKNOWN")
                if len(holdings) > 0:
                    first_holding = holdings[0]
                    print(f"🔍 [ENRICH] Signal {ticker}: First holding keys: {list(first_holding.keys())}")
                    print(f"🔍 [ENRICH] Signal {ticker}: First holding fund_name: '{first_holding.get('fund_name')}', fund_cik: '{first_holding.get('fund_cik')}'")
                
                for holding in holdings:
                    fund_name = holding.get("fund_name", "")
                    fund_cik = holding.get("fund_cik", "")
                    
                    # sec-api.io should already provide fund names, so we don't need to lookup
                    # Just ensure we have a display name (use CIK if name is missing)
                    # IMPORTANT: Only format if name is truly missing - don't overwrite valid names
                    if not fund_name or fund_name.strip() == "" or fund_name == "Unknown Fund":
                        if fund_cik and fund_cik.strip():
                            cik_display = str(fund_cik).strip().lstrip('0') or str(fund_cik).strip()
                            fund_name = f"Fund CIK-{cik_display}"
                            holding["fund_name"] = fund_name
                            print(f"✅ [ENRICH] Using CIK format for {fund_cik} -> {fund_name}")
                        else:
                            # If we have a name but it's "Unknown Fund", keep it
                            if not fund_name or fund_name.strip() == "":
                                holding["fund_name"] = "Unknown Fund"
                    else:
                        # Fund name exists and is valid - log it for debugging
                        if fund_name and fund_name != "Unknown Fund" and not fund_name.startswith("Fund CIK-"):
                            print(f"✅ [ENRICH] Keeping existing fund name: '{fund_name}' (CIK: {fund_cik})")
                    
                    enriched_holdings.append(holding)
                
                signal["institutional_data"]["holdings"] = enriched_holdings
            
            return signal
        
        # Enrich all signals with institutional names
        enriched_signals = []
        for signal in signals:
            enriched_signal = await enrich_institutional_names(signal)
            enriched_signals.append(enriched_signal)
        
        # Convert signals to dict format (don't use SignalHistoryEntry as it's too limited)
        # Return full signal data so frontend can display reasoning, key_points, etc.
        signal_dicts = []
        skipped_count = 0
        for signal in enriched_signals:
            # Default to "NEWS" for old signals that don't have signal_type
            # This ensures backward compatibility with signals created before signal_type was added
            signal_type = signal.get("signal_type")
            if not signal_type or signal_type not in ["SEC", "INSIDER", "NEWS"]:
                # Old signals without signal_type should default to "NEWS"
                signal_type = "NEWS"
                signal["signal_type"] = "NEWS"  # Set it so it's included in the response
                print(f"   ℹ️ Setting signal_type='NEWS' for old signal {signal.get('ticker')} (missing signal_type field)")
            
            # Convert datetime objects to ISO strings for JSON serialization
            signal_dict = {}
            for key, value in signal.items():
                if hasattr(value, 'isoformat'):
                    signal_dict[key] = value.isoformat()
                elif hasattr(value, 'timestamp'):  # Firestore Timestamp
                    signal_dict[key] = value.to_datetime().isoformat()
                else:
                    signal_dict[key] = value
            signal_dicts.append(signal_dict)
        
        # Debug: Log what we're returning
        print(f"📤 API returning {len(signal_dicts)} signals to frontend (skipped {skipped_count} signals without signal_type)")
        if len(signal_dicts) > 0:
            first_signal = signal_dicts[0]
            print(f"   First signal fields: {list(first_signal.keys())}")
            print(f"   First signal has signal_type: {bool(first_signal.get('signal_type'))} (value: {first_signal.get('signal_type')})")
            print(f"   First signal has reasoning: {bool(first_signal.get('reasoning'))} (length: {len(str(first_signal.get('reasoning', '')))})")
            print(f"   First signal has key_points: {bool(first_signal.get('key_points'))} (count: {len(first_signal.get('key_points', []))})")
            print(f"   First signal has institutional_data: {bool(first_signal.get('institutional_data'))}")
            print(f"   First signal ticker: {first_signal.get('ticker')}")
            # Log ALL signals to see if any are missing signal_type
            signals_without_type = [s for s in signal_dicts if not s.get('signal_type')]
            if signals_without_type:
                print(f"   ⚠️ WARNING: {len(signals_without_type)} signals are missing signal_type!")
                for s in signals_without_type[:3]:
                    print(f"      - Signal {s.get('ticker')} (created: {s.get('created_timestamp')}) has fields: {list(s.keys())}")
        
        return {
            "user_id": current_user["firebase_uid"],
            "signals": signal_dicts,
            "total_count": len(signal_dicts)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching history: {str(e)}")

@router.get("/history/{ticker}")
async def get_signal_history_for_ticker(
    ticker: str,  
    limit: int = Query(10, ge=1, le=50, description="Number of signals to retrieve"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get signal history for a specific ticker
    
    - **ticker**: Stock ticker symbol
    - **limit**: Number of signals to retrieve
    """
    try:
        signals = FirestoreService.get_signal_history_for_ticker(
            firebase_uid=current_user["firebase_uid"],
            ticker=ticker.upper(),
            limit=limit
        )
        
        return {
            "ticker": ticker.upper(),
            "user_id": current_user["firebase_uid"],
            "signals": signals,
            "total_count": len(signals)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching ticker history: {str(e)}")

@router.get("/check/{ticker}")
async def check_signal_exists(
    ticker: str,
    hours_ago: int = Query(24, ge=1, le=168, description="Check if signal exists within last N hours"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Check if a signal already exists for a ticker (within last N hours)
    Returns the signal if it exists, otherwise None
    
    - **ticker**: Stock ticker symbol
    - **hours_ago**: Check for signals within last N hours (default: 24)
    """
    try:
        from datetime import timedelta
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_ago)
        cutoff_date = cutoff_time.strftime("%Y-%m-%d")
        
        # Get latest signal for this ticker from global collection (all users)
        try:
            latest_signal = FirestoreService.get_latest_signal_for_ticker(
                ticker=ticker.upper(),
                from_date=cutoff_date
            )
        except ValueError as e:
            # Firestore not initialized or error - return no signal exists
            print(f"⚠️ Could not check Firestore for {ticker}: {e}")
            return {
                "exists": False,
                "signal": None
            }
        
        if latest_signal:
            # Check if signal is within the time window
            signal_timestamp = latest_signal.get("created_timestamp") or latest_signal.get("generated_at")
            if signal_timestamp:
                try:
                    if hasattr(signal_timestamp, 'to_datetime'):
                        signal_dt = signal_timestamp.to_datetime()
                    elif hasattr(signal_timestamp, 'isoformat'):
                        signal_dt = signal_timestamp
                    else:
                        signal_dt = datetime.fromisoformat(str(signal_timestamp).replace('Z', '+00:00'))
                    
                    if signal_dt and signal_dt >= cutoff_time:
                        return {
                            "exists": True,
                            "signal": latest_signal,
                            "age_hours": (datetime.utcnow() - signal_dt).total_seconds() / 3600
                        }
                except Exception as e:
                    print(f"⚠️ Error parsing timestamp for {ticker}: {e}")
        
        return {
            "exists": False,
            "signal": None
        }
    
    except Exception as e:
        print(f"❌ Error checking signal for {ticker}: {e}")
        import traceback
        traceback.print_exc()
        # Return no signal exists on error (don't block regeneration)
        return {
            "exists": False,
            "signal": None
        }

# Form 4 (Insider Trades)
@router.get("/insider/{ticker}")
async def get_insider_data(
    ticker: str,
    days_back: int = Query(7, ge=1, le=30, description="Look back period in days (default: 7 for past week)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get insider trading data (Form 4) for a stock
    Limited to top 10 most recent transactions from the past week to avoid rate limits
    
    - **ticker**: Stock ticker symbol
    - **days_back**: Number of days to look back (default: 7, max: 30)
    """
    try:
        insider_summary = await InsiderService.get_insider_summary(
            ticker=ticker.upper(),
            days_back=min(days_back, 7)  # Cap at 7 days to avoid rate limits
        )
        
        return {
            "ticker": ticker.upper(),
            "transactions": insider_summary["transactions"],
            "sentiment": insider_summary["sentiment"],
            "fetched_at": insider_summary["fetched_at"],
            "transaction_count": len(insider_summary["transactions"])
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching insider data: {str(e)}")

# Form 13F (Institutional Holdings)
@router.get("/institutional/{ticker}")
async def get_institutional_data(
    ticker: str,
    quarters_back: int = Query(1, ge=1, le=2, description="Number of recent quarters to look back (default: 1)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get institutional holdings data (Form 13F) for a stock
    Limited to top 10 most recent holdings to avoid rate limits
    
    - **ticker**: Stock ticker symbol
    - **quarters_back**: Number of recent quarters to look back (default: 1, max: 2)
    """
    try:
        institutional_summary = await InstitutionalService.get_institutional_summary(
            ticker=ticker.upper(),
            quarters_back=min(quarters_back, 1)  # Cap at 1 quarter to avoid rate limits
        )
        
        return {
            "ticker": ticker.upper(),
            "holdings": institutional_summary["holdings"],
            "sentiment": institutional_summary["sentiment"],
            "fetched_at": institutional_summary["fetched_at"],
            "holdings_count": len(institutional_summary["holdings"])
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching institutional data: {str(e)}")

@router.post("/generate-insider/{ticker}")
async def generate_insider_signal(
    ticker: str,
    days_back: int = Query(7, ge=1, le=30, description="Look back period in days (default: 7 for past week)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate an INSIDER signal directly from Form 4 data (no AI required)
    Limited to top 10 most recent transactions from the past week to avoid rate limits
    
    - **ticker**: Stock ticker symbol
    - **days_back**: Number of days to look back (default: 7, max: 30)
    """
    try:
        print(f"🔄 Generating INSIDER signal for {ticker.upper()}...")
        
        # Fetch insider data - limit to 7 days (1 week) and top 10 to avoid rate limits
        insider_summary = await InsiderService.get_insider_summary(
            ticker=ticker.upper(),
            days_back=min(days_back, 7)  # Cap at 7 days to avoid rate limits
        )
        
        # Check if we have transactions
        transactions = insider_summary.get("transactions", [])
        if not transactions or len(transactions) == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"No insider transactions found for {ticker.upper()} in the last {days_back} days"
            )
        
        # Build signal from insider data
        sentiment = insider_summary.get("sentiment", {})
        buys = sentiment.get("buys", 0)
        sells = sentiment.get("sells", 0)
        sentiment_type = sentiment.get("sentiment", "neutral")
        confidence = sentiment.get("confidence", 0.5)
        
        # Determine signal based on insider sentiment
        if sentiment_type == "bullish":
            signal = "BUY"
        elif sentiment_type == "bearish":
            signal = "SELL"
        else:
            signal = "HOLD"
        
        # Build reasoning from insider data
        reasoning = f"Recent insider activity: {buys} buy(s), {sells} sell(s). "
        reasoning += f"Sentiment: {sentiment_type}. "
        reasoning += sentiment.get("summary", "No detailed summary available.")
        
        # Build key points
        key_points = [
            f"{buys} insider buy transaction(s) in the last {days_back} days",
            f"{sells} insider sell transaction(s) in the last {days_back} days",
            f"Net sentiment: {sentiment_type}",
            f"Confidence: {confidence:.0%}"
        ]
        
        # Create signal dict
        signal_dict = {
            "ticker": ticker.upper(),
            "signal": signal,
            "confidence": confidence,
            "reasoning": reasoning,
            "key_points": key_points,
            "risk_level": "MEDIUM",
            "sentiment_analysis": f"Insider trading sentiment: {sentiment_type}",
            "generated_at": datetime.utcnow().isoformat(),
            "articles_analyzed": 0,
            "insider_data": insider_summary,
            "institutional_data": None
        }
        
        # Save to Firestore
        signal_id = str(uuid.uuid4())
        print(f"💾 Saving INSIDER signal {signal_id} to Firestore...")
        FirestoreService.save_signal_to_history(
            firebase_uid=current_user["firebase_uid"],
            signal_id=signal_id,
            signal_data=signal_dict
        )
        print(f"✅ INSIDER signal {signal_id} saved successfully")
        
        return SignalResponse(**signal_dict)
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error generating insider signal: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating insider signal: {str(e)}")

@router.post("/generate-sec/{ticker}")
async def generate_sec_signal(
    ticker: str,
    quarters_back: int = Query(1, ge=1, le=2, description="Number of recent quarters to look back (default: 1)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate a SEC signal directly from Form 13F data (no AI required)
    Limited to top 10 most recent holdings to avoid rate limits
    
    - **ticker**: Stock ticker symbol
    - **quarters_back**: Number of recent quarters to look back (default: 1, max: 2)
    """
    try:
        print(f"🔄 Generating SEC signal for {ticker.upper()}...")
        
        # Fetch institutional data - limit to 1 quarter and top 10 to avoid rate limits
        institutional_summary = await InstitutionalService.get_institutional_summary(
            ticker=ticker.upper(),
            quarters_back=min(quarters_back, 1)  # Cap at 1 quarter to avoid rate limits
        )
        
        # Check if we have holdings
        holdings = institutional_summary.get("holdings", [])
        if not holdings or len(holdings) == 0:
            raise HTTPException(
                status_code=404,
                detail=f"No institutional holdings found for {ticker.upper()} in the last {quarters_back} quarter(s)"
            )
        
        # Build signal from institutional data
        sentiment = institutional_summary.get("sentiment", {})
        major_funds_count = sentiment.get("major_funds_count", 0)
        total_value_held = sentiment.get("total_value_held", 0)
        sentiment_type = sentiment.get("sentiment", "neutral")
        confidence = sentiment.get("confidence", 0.5)
        concentration = sentiment.get("concentration", 0)
        
        # Determine signal based on institutional sentiment
        if sentiment_type == "bullish":
            signal = "BUY"
        elif sentiment_type == "bearish":
            signal = "SELL"
        else:
            signal = "HOLD"
        
        # Build reasoning from institutional data
        reasoning = f"Institutional holdings: {major_funds_count} fund(s) holding this stock "
        reasoning += f"with total value of ${(total_value_held / 1_000_000):.1f}M. "
        reasoning += f"Sentiment: {sentiment_type}. "
        reasoning += sentiment.get("summary", "No detailed summary available.")
        
        # Build key points
        key_points = [
            f"{major_funds_count} institutional fund(s) holding {ticker.upper()}",
            f"Total value held: ${(total_value_held / 1_000_000):.1f}M",
            f"Top 5 funds concentration: {concentration:.0f}%",
            f"Sentiment: {sentiment_type}"
        ]
        
        # Create signal dict
        signal_dict = {
            "ticker": ticker.upper(),
            "signal": signal,
            "confidence": confidence,
            "reasoning": reasoning,
            "key_points": key_points,
            "risk_level": "MEDIUM",
            "sentiment_analysis": f"Institutional holdings sentiment: {sentiment_type}",
            "generated_at": datetime.utcnow().isoformat(),
            "articles_analyzed": 0,
            "insider_data": None,
            "institutional_data": institutional_summary,
            "signal_type": "SEC"  # CRITICAL: Set signal_type to SEC so it appears in SEC tab
        }
        
        # Save to Firestore
        signal_id = str(uuid.uuid4())
        print(f"💾 Saving SEC signal {signal_id} to Firestore...")
        
        # Debug: Log what we're about to save
        if signal_dict.get("institutional_data") and signal_dict["institutional_data"].get("holdings"):
            holdings = signal_dict["institutional_data"]["holdings"]
            print(f"🔍 [SAVE] About to save {len(holdings)} holdings for {ticker}")
            for i, holding in enumerate(holdings[:3]):  # Log first 3
                print(f"🔍 [SAVE] Holding {i+1}: fund_name='{holding.get('fund_name')}', fund_cik='{holding.get('fund_cik')}'")
        
        FirestoreService.save_signal_to_history(
            firebase_uid=current_user["firebase_uid"],
            signal_id=signal_id,
            signal_data=signal_dict
        )
        print(f"✅ SEC signal {signal_id} saved successfully")
        
        return SignalResponse(**signal_dict)
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Error generating SEC signal: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating SEC signal: {str(e)}")

@router.get("/test-sec-apis")
async def test_sec_apis(
    ticker: str = Query("NVDA", description="Ticker to test"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Test endpoint to verify SEC and Insider APIs work and see what data they return.
    Makes only 2 API calls (1 SEC + 1 INSIDER) with proper delays.
    """
    try:
        print(f"🧪 Testing SEC APIs for {ticker}...")
        
        results = {
            "ticker": ticker,
            "insider": None,
            "institutional": None,
            "errors": []
        }
        
        # Test INSIDER API (wait a bit first to avoid rate limit if we just hit it)
        print(f"⏳ Waiting 5 seconds before testing INSIDER API...")
        await asyncio.sleep(5)
        
        try:
            print(f"📊 Testing INSIDER API for {ticker}...")
            insider_summary = await InsiderService.get_insider_summary(ticker, days_back=7)
            results["insider"] = {
                "success": True,
                "transaction_count": len(insider_summary.get("transactions", [])),
                "transactions": insider_summary.get("transactions", [])[:3],  # First 3 only
                "sentiment": insider_summary.get("sentiment", {})
            }
            print(f"✅ INSIDER API returned {results['insider']['transaction_count']} transactions")
        except Exception as e:
            error_msg = str(e)
            results["errors"].append(f"INSIDER API: {error_msg}")
            print(f"❌ INSIDER API error: {error_msg}")
            if "429" in error_msg:
                results["insider"] = {"success": False, "error": "Rate limited (429). Wait 1 hour and try again."}
        
        # Wait before testing SEC API
        print(f"⏳ Waiting 10 seconds before testing SEC API...")
        await asyncio.sleep(10)
        
        # Test SEC API
        try:
            print(f"📊 Testing SEC API for {ticker}...")
            institutional_summary = await InstitutionalService.get_institutional_summary(ticker, quarters_back=1)
            results["institutional"] = {
                "success": True,
                "holdings_count": len(institutional_summary.get("holdings", [])),
                "holdings": institutional_summary.get("holdings", [])[:3],  # First 3 only
                "sentiment": institutional_summary.get("sentiment", {})
            }
            print(f"✅ SEC API returned {results['institutional']['holdings_count']} holdings")
        except Exception as e:
            error_msg = str(e)
            results["errors"].append(f"SEC API: {error_msg}")
            print(f"❌ SEC API error: {error_msg}")
            if "429" in error_msg:
                results["institutional"] = {"success": False, "error": "Rate limited (429). Wait 1 hour and try again."}
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error testing APIs: {str(e)}")

@router.post("/generate-weekly-top-signals")
async def generate_weekly_top_signals(
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generate and store top 10 NEWS, top 10 SEC, and top 10 INSIDER signals for the week.
    These signals are stored globally so all users can see them.
    
    This endpoint triggers background generation of:
    - Top 10 NEWS signals (with Gemini AI analysis)
    - Top 10 SEC signals (from Form 13F institutional holdings)
    - Top 10 INSIDER signals (from Form 4 insider trading)
    """
    try:
        print(f"🚀 Starting weekly top signals generation for all users...")
        
        # Run in background to avoid timeout
        background_tasks.add_task(
            _generate_weekly_signals_task,
            firebase_uid=current_user["firebase_uid"]
        )
        
        return {
            "message": "Weekly top signals generation started in background",
            "status": "processing",
            "expected_signals": {
                "NEWS": 3,
                "SEC": 4,
                "INSIDER": 3,
                "total": 10
            }
        }
    
    except Exception as e:
        print(f"❌ Error starting weekly signals generation: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error starting signal generation: {str(e)}")

async def _generate_weekly_signals_task(firebase_uid: str):
    """Background task to generate weekly top signals"""
    try:
        print(f"🔄 Background task: Generating weekly top signals...")
        
        # Calculate date 7 days ago
        week_ago = datetime.utcnow() - timedelta(days=7)
        week_ago_str = week_ago.strftime("%Y-%m-%d")
        
        # Generate top 3 NEWS signals (with AI) - LIMITED TO 10 TOTAL REQUESTS
        news_signals = []
        print(f"📰 Generating top 3 NEWS signals (limited to test API)...")
        for ticker in DEFAULT_TICKERS[:3]:
            try:
                print(f"   Generating NEWS signal for {ticker}...")
                signal_dict = await SignalsService.generate_signal_for_stock(
                    ticker=ticker,
                    news_limit=10
                )
                
                # Only save if it has reasoning and key_points (complete signal)
                if signal_dict.get("reasoning") and signal_dict.get("key_points"):
                    signal_id = str(uuid.uuid4())
                    # Mark as NEWS type
                    signal_dict["signal_type"] = "NEWS"
                    FirestoreService.save_signal_to_history(
                        firebase_uid=firebase_uid,
                        signal_id=signal_id,
                        signal_data=signal_dict
                    )
                    news_signals.append(ticker)
                    print(f"   ✅ Saved NEWS signal for {ticker}")
                else:
                    print(f"   ⚠️ Skipping incomplete NEWS signal for {ticker}")
                
                # Rate limiting: 6 seconds between requests (10 requests/minute)
                await asyncio.sleep(6)
            except Exception as e:
                print(f"   ❌ Error generating NEWS signal for {ticker}: {e}")
                # If rate limited, wait longer
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"   ⏳ Rate limit hit, waiting 35 seconds...")
                    await asyncio.sleep(35)
        
        print(f"✅ Generated {len(news_signals)} NEWS signals")
        
        # Generate top 3 INSIDER signals - LIMITED TO 10 TOTAL REQUESTS
        insider_signals = []
        print(f"👔 Generating top 3 INSIDER signals (limited to test API)...")
        for ticker in DEFAULT_TICKERS[:3]:
            try:
                print(f"   Generating INSIDER signal for {ticker}...")
                insider_summary = await InsiderService.get_insider_summary(ticker, days_back=7)
                
                # Debug: Log what we got from the API
                print(f"   📊 INSIDER API Response for {ticker}:")
                print(f"      - Has transactions: {bool(insider_summary.get('transactions'))}")
                print(f"      - Transaction count: {len(insider_summary.get('transactions', []))}")
                if insider_summary.get("transactions"):
                    print(f"      - First transaction: {insider_summary['transactions'][0]}")
                print(f"      - Has sentiment: {bool(insider_summary.get('sentiment'))}")
                if insider_summary.get("sentiment"):
                    print(f"      - Sentiment: {insider_summary['sentiment']}")
                
                if insider_summary.get("transactions") and len(insider_summary["transactions"]) > 0:
                    # Build signal from insider data
                    sentiment = insider_summary.get("sentiment", {})
                    buys = sentiment.get("buys", 0)
                    sells = sentiment.get("sells", 0)
                    sentiment_type = sentiment.get("sentiment", "neutral")
                    confidence = sentiment.get("confidence", 0.5)
                    
                    signal = "BUY" if sentiment_type == "bullish" else "SELL" if sentiment_type == "bearish" else "HOLD"
                    reasoning = f"Recent insider activity: {buys} buy(s), {sells} sell(s). Sentiment: {sentiment_type}. {sentiment.get('summary', '')}"
                    key_points = [
                        f"{buys} insider buy transaction(s) in the last 7 days",
                        f"{sells} insider sell transaction(s) in the last 7 days",
                        f"Net sentiment: {sentiment_type}",
                        f"Confidence: {confidence:.0%}"
                    ]
                    
                    signal_dict = {
                        "ticker": ticker,
                        "signal": signal,
                        "confidence": confidence,
                        "reasoning": reasoning,
                        "key_points": key_points,
                        "risk_level": "MEDIUM",
                        "sentiment_analysis": f"Insider trading sentiment: {sentiment_type}",
                        "generated_at": datetime.utcnow().isoformat(),
                        "articles_analyzed": 0,
                        "insider_data": insider_summary,
                        "institutional_data": None,
                        "signal_type": "INSIDER"
                    }
                    
                    signal_id = str(uuid.uuid4())
                    FirestoreService.save_signal_to_history(
                        firebase_uid=firebase_uid,
                        signal_id=signal_id,
                        signal_data=signal_dict
                    )
                    insider_signals.append(ticker)
                    print(f"   ✅ Saved INSIDER signal for {ticker}")
                else:
                    print(f"   ℹ️ No insider transactions found for {ticker}")
                
                # Longer delay to avoid rate limits (SEC API is strict)
                await asyncio.sleep(5)
            except Exception as e:
                print(f"   ❌ Error generating INSIDER signal for {ticker}: {e}")
                if "429" in str(e):
                    print(f"   ⏳ SEC API rate limited, waiting 30 seconds...")
                    await asyncio.sleep(30)
        
        print(f"✅ Generated {len(insider_signals)} INSIDER signals")
        
        # Generate top 4 SEC signals - LIMITED TO 10 TOTAL REQUESTS
        sec_signals = []
        print(f"🏛️ Generating top 4 SEC signals (limited to test API)...")
        for ticker in DEFAULT_TICKERS[:4]:
            try:
                print(f"   Generating SEC signal for {ticker}...")
                institutional_summary = await InstitutionalService.get_institutional_summary(ticker, quarters_back=1)
                
                # Debug: Log what we got from the API
                print(f"   📊 SEC API Response for {ticker}:")
                print(f"      - Has holdings: {bool(institutional_summary.get('holdings'))}")
                print(f"      - Holdings count: {len(institutional_summary.get('holdings', []))}")
                if institutional_summary.get("holdings"):
                    print(f"      - First holding: {institutional_summary['holdings'][0]}")
                print(f"      - Has sentiment: {bool(institutional_summary.get('sentiment'))}")
                if institutional_summary.get("sentiment"):
                    print(f"      - Sentiment: {institutional_summary['sentiment']}")
                
                if institutional_summary.get("holdings") and len(institutional_summary["holdings"]) > 0:
                    # Build signal from institutional data
                    sentiment = institutional_summary.get("sentiment", {})
                    major_funds_count = sentiment.get("major_funds_count", 0)
                    total_value_held = sentiment.get("total_value_held", 0)
                    sentiment_type = sentiment.get("sentiment", "neutral")
                    confidence = sentiment.get("confidence", 0.5)
                    
                    signal = "BUY" if sentiment_type == "bullish" else "SELL" if sentiment_type == "bearish" else "HOLD"
                    reasoning = f"Institutional holdings: {major_funds_count} fund(s) holding this stock with total value of ${(total_value_held / 1_000_000):.1f}M. Sentiment: {sentiment_type}. {sentiment.get('summary', '')}"
                    key_points = [
                        f"{major_funds_count} institutional fund(s) holding {ticker}",
                        f"Total value held: ${(total_value_held / 1_000_000):.1f}M",
                        f"Top 5 funds concentration: {sentiment.get('concentration', 0):.0f}%",
                        f"Sentiment: {sentiment_type}"
                    ]
                    
                    signal_dict = {
                        "ticker": ticker,
                        "signal": signal,
                        "confidence": confidence,
                        "reasoning": reasoning,
                        "key_points": key_points,
                        "risk_level": "MEDIUM",
                        "sentiment_analysis": f"Institutional holdings sentiment: {sentiment_type}",
                        "generated_at": datetime.utcnow().isoformat(),
                        "articles_analyzed": 0,
                        "insider_data": None,
                        "institutional_data": institutional_summary,
                        "signal_type": "SEC"
                    }
                    
                    signal_id = str(uuid.uuid4())
                    FirestoreService.save_signal_to_history(
                        firebase_uid=firebase_uid,
                        signal_id=signal_id,
                        signal_data=signal_dict
                    )
                    sec_signals.append(ticker)
                    print(f"   ✅ Saved SEC signal for {ticker}")
                else:
                    print(f"   ℹ️ No institutional holdings found for {ticker}")
                
                # Longer delay to avoid rate limits (SEC API is strict)
                await asyncio.sleep(5)
            except Exception as e:
                print(f"   ❌ Error generating SEC signal for {ticker}: {e}")
                if "429" in str(e):
                    print(f"   ⏳ SEC API rate limited, waiting 30 seconds...")
                    await asyncio.sleep(30)
        
        print(f"✅ Generated {len(sec_signals)} SEC signals")
        
        print(f"🎉 Weekly top signals generation complete!")
        print(f"   - NEWS: {len(news_signals)} signals")
        print(f"   - INSIDER: {len(insider_signals)} signals")
        print(f"   - SEC: {len(sec_signals)} signals")
        
    except Exception as e:
        print(f"❌ Error in background task: {e}")
        import traceback
        traceback.print_exc()