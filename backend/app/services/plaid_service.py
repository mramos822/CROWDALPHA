from plaid import ApiClient, Configuration
from plaid.api import plaid_api
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from app.config import settings
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class PlaidService:
    def __init__(self):
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize Plaid client with configuration"""
        try:
            if not settings.plaid_client_id or not settings.plaid_secret:
                logger.warning("Plaid credentials not configured")
                return
            
            # Map environment to correct host URL
            if settings.plaid_env.lower() == "sandbox":
                host = "https://sandbox.plaid.com"
            elif settings.plaid_env.lower() == "development":
                host = "https://development.plaid.com"
            else:
                host = "https://production.plaid.com"
            
            configuration = Configuration(
                host=host,
                api_key={
                    'clientId': settings.plaid_client_id,
                    'secret': settings.plaid_secret,
                }
            )
            
            api_client = ApiClient(configuration)
            self.client = plaid_api.PlaidApi(api_client)
            logger.info("Plaid client initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize Plaid client: {e}")
            self.client = None
    
    def create_link_token(self, user_id: str) -> str:
        """Create a Plaid Link token for user"""
        if not self.client:
            raise ValueError("Plaid client not initialized. Please configure Plaid credentials.")
        
        # Only request products that are enabled for the current environment
        # In production, only 'investments' is available; sandbox has both
        products = [Products('investments')]
        if settings.plaid_env.lower() == "sandbox":
            # Sandbox allows 'auth' product, but production doesn't
            products.append(Products('auth'))
        
        request = LinkTokenCreateRequest(
            user={"client_user_id": user_id},
            client_name="CrowdAlpha",
            products=products,
            country_codes=[CountryCode('US')],
            language='en',
            # Focus on investment/brokerage institutions
            webhook="https://your-webhook-url.com/webhook"  # Optional: for real-time updates
        )
        
        response = self.client.link_token_create(request)
        return response['link_token']
    
    def exchange_public_token(self, public_token: str) -> Dict[str, Any]:
        """Exchange public token for access token"""
        if not self.client:
            raise ValueError("Plaid client not initialized. Please configure Plaid credentials.")
        
        from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
        
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = self.client.item_public_token_exchange(request)
        
        return {
            "access_token": response['access_token'],
            "item_id": response['item_id']
        }
    
    def get_accounts(self, access_token: str) -> list:
        """Get accounts for the given access token"""
        if not self.client:
            raise ValueError("Plaid client not initialized. Please configure Plaid credentials.")
        
        from plaid.model.accounts_get_request import AccountsGetRequest
        
        request = AccountsGetRequest(access_token=access_token)
        response = self.client.accounts_get(request)
        
        return response['accounts']
    
    def get_holdings(self, access_token: str) -> dict:
        """Get investment holdings and securities for the given access token
        
        Returns a dict with 'holdings' and 'securities' keys.
        Securities contains a mapping of security_id to security details including ticker symbol.
        """
        if not self.client:
            raise ValueError("Plaid client not initialized. Please configure Plaid credentials.")
        
        from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
        
        request = InvestmentsHoldingsGetRequest(access_token=access_token)
        response = self.client.investments_holdings_get(request)
        
        # Handle both dict-like and object-like responses
        if isinstance(response, dict):
            holdings = response.get('holdings', [])
            securities = response.get('securities', [])
        else:
            # Response is an object with attributes
            holdings = getattr(response, 'holdings', [])
            securities = getattr(response, 'securities', [])
        
        return {
            'holdings': holdings,
            'securities': securities
        }
    
    def get_investment_transactions(self, access_token: str, start_date: str = None, end_date: str = None) -> dict:
        """Get investment transactions for the given access token
        
        Args:
            access_token: Plaid access token
            start_date: Start date in YYYY-MM-DD format (defaults to 2 years ago)
            end_date: End date in YYYY-MM-DD format (defaults to today)
        
        Returns a dict with 'investment_transactions' and 'accounts' keys.
        """
        if not self.client:
            raise ValueError("Plaid client not initialized. Please configure Plaid credentials.")
        
        from plaid.model.investments_transactions_get_request import InvestmentsTransactionsGetRequest
        from plaid.model.investments_transactions_get_request_options import InvestmentsTransactionsGetRequestOptions
        from datetime import datetime, timedelta
        
        # Default to 2 years ago if not provided
        if not start_date:
            start_date_obj = datetime.now() - timedelta(days=730)
            start_date = start_date_obj.strftime('%Y-%m-%d')
        
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
        
        request = InvestmentsTransactionsGetRequest(
            access_token=access_token,
            start_date=start_date,
            end_date=end_date
        )
        
        response = self.client.investments_transactions_get(request)
        
        # Handle both dict-like and object-like responses
        if isinstance(response, dict):
            transactions = response.get('investment_transactions', [])
            accounts = response.get('accounts', [])
            total_transactions = response.get('total_investment_transactions', 0)
        else:
            transactions = getattr(response, 'investment_transactions', [])
            accounts = getattr(response, 'accounts', [])
            total_transactions = getattr(response, 'total_investment_transactions', 0)
        
        return {
            'investment_transactions': transactions,
            'accounts': accounts,
            'total_investment_transactions': total_transactions
        }

# Global instance
plaid_service = PlaidService()