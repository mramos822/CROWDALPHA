from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Firebase settings
    firebase_credentials_path: Optional[str] = "./firebase-service-account.json"
    environment: str = "development"

    # Plaid settings
    plaid_client_id: Optional[str] = None
    plaid_secret: Optional[str] = None
    plaid_env: str = "sandbox"

    # Finlight API
    finlight_api_key: str

    # SEC API (legacy - sec-api.io)
    sec_api_key: Optional[str] = None
    
    # Financial Modeling Prep API
    fmp_api_key: Optional[str] = "upLdyirBLG4cbIqqaVEqarxK2PAo9lX5"

    # Gemini API
    gemini_api_key: str

    # Finnhub API (for IPO calendar)
    finnhub_api_key: Optional[str] = None

    # Polygon/Massive API (for stock data and charts)
    polygon_api_key: Optional[str] = None

    class Config:
        env_file = "config.env"

settings = Settings()