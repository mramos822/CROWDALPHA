from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class SignalType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"

class SignalRequest(BaseModel):
    """Request to generate a trading signal for a stock"""
    ticker: str = Field(..., description="Stock ticker symbol (e.g., AAPL)")
    current_price: Optional[float] = Field(None, description="Current stock price")
    user_context: Optional[str] = Field(None, description="Additional context for analysis")
    news_limit: int = Field(10, ge=1, le=50, description="Number of news articles to fetch")

class SignalResponse(BaseModel):
    """Trading signal response"""
    ticker: str
    signal: SignalType
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence level 0.0-1.0")
    reasoning: str
    key_points: List[str]
    risk_level: RiskLevel
    sentiment_analysis: str
    generated_at: datetime
    articles_analyzed: int
    insider_data: Optional[Dict[str, Any]] = None
    institutional_data: Optional[Dict[str, Any]] = None

class SignalHistoryEntry(BaseModel):
    """Entry in user's signal history"""
    signal_id: str
    ticker: str
    signal: SignalType
    confidence: float
    generated_at: datetime
    risk_level: RiskLevel

class SignalHistoryResponse(BaseModel):
    """User's signal history"""
    user_id: str
    signals: List[Dict[str, Any]]  # Changed from SignalHistoryEntry to Dict to include all fields
    total_count: int

class NewsArticle(BaseModel):
    """Financial news article"""
    title: str
    summary: str
    source: str
    published_at: str
    url: Optional[str] = None
    sentiment: Optional[str] = None

class NewsResponse(BaseModel):
    """Response with news articles"""
    ticker: str
    articles: List[NewsArticle]
    fetched_at: datetime

class ArticleData(BaseModel):
    """Article data for frontend display"""
    title: str
    source: str
    url: Optional[str] = None
    published_at: Optional[str] = None
    summary: Optional[str] = None

class SignalResponse(BaseModel):
    """Trading signal response"""
    ticker: str
    signal: SignalType
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence level 0.0-1.0")
    reasoning: str
    key_points: List[str]
    risk_level: RiskLevel
    sentiment_analysis: str
    generated_at: datetime
    articles_analyzed: int
    
    # ADD THESE FIELDS:
    articles: Optional[List[ArticleData]] = None
    insider_data: Optional[Dict[str, Any]] = None
    insider_summary: Optional[Dict[str, Any]] = None
    institutional_data: Optional[Dict[str, Any]] = None
    institutional_summary: Optional[Dict[str, Any]] = None