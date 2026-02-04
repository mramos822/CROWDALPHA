from fastapi import APIRouter, HTTPException, Depends, Header
from app.auth.firebase import create_firebase_user, verify_firebase_token
from app.schemas.users import UserCreate, UserResponse, UserLogin, UserUpdate
from app.services.firestore import FirestoreService
from app.auth.middleware import get_current_user
from typing import Dict, Any

# Conditional Plaid imports
try:
    from plaid.model.link_token_create_request import LinkTokenCreateRequest
    from plaid.model.country_code import CountryCode
    from plaid.model.products import Products
    from app.services.plaid_service import PlaidService
    PLAID_AVAILABLE = True
except ImportError:
    print("Warning: Plaid not available. Plaid features disabled.")
    PLAID_AVAILABLE = False

# Simple file-based storage for Plaid tokens (since Firebase isn't configured)
import json
import os

PLAID_TOKENS_FILE = "/Users/carlos/CROWDALPHA/backend/plaid_tokens.json"

def load_plaid_tokens():
    """Load Plaid tokens from file"""
    print(f"DEBUG: Loading tokens from {PLAID_TOKENS_FILE}")
    if os.path.exists(PLAID_TOKENS_FILE):
        try:
            with open(PLAID_TOKENS_FILE, 'r') as f:
                tokens = json.load(f)
                print(f"DEBUG: Loaded {len(tokens)} tokens from file")
                return tokens
        except Exception as e:
            print(f"DEBUG: Failed to load tokens from file: {e}")
            return {}
    else:
        print(f"DEBUG: Token file does not exist: {PLAID_TOKENS_FILE}")
    return {}

def save_plaid_tokens(tokens):
    """Save Plaid tokens to file"""
    print(f"DEBUG: Saving {len(tokens)} tokens to {PLAID_TOKENS_FILE}")
    try:
        with open(PLAID_TOKENS_FILE, 'w') as f:
            json.dump(tokens, f)
        print(f"DEBUG: Successfully saved tokens to file")
    except Exception as e:
        print(f"DEBUG: Failed to save tokens to file: {e}")

plaid_tokens = load_plaid_tokens()
from datetime import datetime

import requests

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/signup")
async def signup(user_data: UserCreate):
    """Create a new user account"""
    try:
        print(f"DEBUG: Starting signup for {user_data.email}")
        
        # Check if email already exists
        try:
            from app.services.firestore import FirestoreService
            if FirestoreService.check_email_exists(user_data.email):
                raise HTTPException(status_code=400, detail="Email already registered")
        except ValueError:
            # Firestore not initialized, continue with mock auth
            print("DEBUG: Firestore not available, using mock authentication")
        except Exception as e:
            print(f"DEBUG: Error checking email existence: {e}")
            # Continue anyway
        
        # Check if username already exists
        try:
            if FirestoreService.check_username_exists(user_data.username):
                raise HTTPException(status_code=400, detail="Username already taken")
        except ValueError:
            pass
        except Exception as e:
            print(f"DEBUG: Error checking username existence: {e}")
        
        # Try to create Firebase user and save to Firestore
        firebase_uid = None
        try:
            from app.auth.firebase import create_firebase_user
            from app.services.firestore import FirestoreService
            
            # Create Firebase user (this also creates the authentication entry)
            firebase_user = create_firebase_user(user_data.email, user_data.password)
            firebase_uid = firebase_user["uid"]
            print(f"DEBUG: Firebase user created with UID: {firebase_uid}")
            
            # Save user profile to Firestore
            try:
                user_profile = FirestoreService.create_user_profile(
                    firebase_uid=firebase_uid,
                    email=user_data.email,
                    first_name=user_data.first_name,
                    last_name=user_data.last_name,
                    username=user_data.username
                )
                print(f"DEBUG: ✅ User profile saved to Firestore successfully")
            except ValueError as firestore_error:
                # Firestore not initialized but Firebase user was created
                print(f"DEBUG: ⚠️ Firestore not available, but Firebase user created: {firestore_error}")
                # Still return success since Firebase user exists
                user_profile = {
                    "firebase_uid": firebase_uid,
                    "email": user_data.email,
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                    "username": user_data.username,
                    "plan_tier": "free",
                    "joined_at": datetime.utcnow().isoformat(),
                    "last_login": datetime.utcnow().isoformat()
                }
            
        except ValueError as e:
            # Firebase not configured, fall back to mock
            print(f"DEBUG: ⚠️ Firebase not available ({e}), using mock user")
            print(f"DEBUG: To enable database storage, configure Firebase credentials in backend/firebase-service-account.json")
            import uuid
            firebase_uid = str(uuid.uuid4())
            user_profile = {
                "firebase_uid": firebase_uid,
                "email": user_data.email,
                "first_name": user_data.first_name,
                "last_name": user_data.last_name,
                "username": user_data.username,
                "plan_tier": "free",
                "joined_at": datetime.utcnow().isoformat(),
                "last_login": datetime.utcnow().isoformat()
            }
        except Exception as e:
            print(f"DEBUG: ❌ Error creating Firebase user: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to create user: {str(e)}")
        
        # Generate JWT token
        import jwt
        import time
        
        payload = {
            "user_id": firebase_uid,
            "email": user_data.email,
            "exp": int(time.time()) + 86400  # 24 hours
        }
        
        # Use a simple secret for demo (in production, use a proper secret)
        token = jwt.encode(payload, "demo-secret-key", algorithm="HS256")
        
        print(f"DEBUG: User created successfully with UID: {firebase_uid}")
        
        return {
            "message": "User created successfully",
            "user": {
                "uid": firebase_uid,
                "email": user_data.email,
                "first_name": user_data.first_name,
                "last_name": user_data.last_name,
                "username": user_data.username
            },
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Signup error - {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Signup failed: {str(e)}")

@router.post("/login")
async def login(credentials: UserLogin):
    """Login with email and password"""
    try:
        print(f"DEBUG: Starting login for {credentials.email}")
        
        # Try to verify password with Firebase Auth
        firebase_uid = None
        try:
            from app.auth.firebase import verify_firebase_token
            # For now, we'll look up the user in Firestore by email
            # In production, you'd verify the password with Firebase Auth
            from app.services.firestore import FirestoreService
            
            # Look up user by email in Firestore
            user_profile = FirestoreService.get_user_by_email(credentials.email)
            
            if user_profile:
                firebase_uid = user_profile.get("firebase_uid")
                print(f"DEBUG: ✅ Found user in Firestore: {firebase_uid}")
                
                # Update last login
                try:
                    FirestoreService.update_last_login(firebase_uid)
                except Exception as e:
                    print(f"DEBUG: ⚠️ Could not update last_login: {e}")
            else:
                # User not found in Firestore
                raise HTTPException(status_code=401, detail="Invalid email or password")
                
        except HTTPException:
            raise
        except ValueError as e:
            # Firestore not initialized
            print(f"DEBUG: ⚠️ Firestore not available ({e}), cannot verify user")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")
        except Exception as e:
            print(f"DEBUG: ⚠️ Error during login: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        if not firebase_uid:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Generate JWT token with real Firebase UID
        import jwt
        import time
        
        payload = {
            "user_id": firebase_uid,
            "email": credentials.email,
            "exp": int(time.time()) + 86400  # 24 hours
        }
        
        # Use a simple secret for demo (in production, use a proper secret)
        token = jwt.encode(payload, "demo-secret-key", algorithm="HS256")
        
        print(f"DEBUG: ✅ Login successful for {credentials.email} with UID: {firebase_uid}")
        
        return {
            "message": "Login successful",
            "user": {
                "uid": firebase_uid,
                "email": credentials.email
            },
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Login error - {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.post("/signin")
async def signin(credentials: UserLogin):
    """Sign in with email and password (alias for login)"""
    return await login(credentials)

@router.post("/google")
async def google_auth(google_data: Dict[str, Any]):
    """Authenticate with Google OAuth using Firebase ID token"""
    try:
        id_token = google_data.get("id_token")
        if not id_token:
            raise HTTPException(status_code=400, detail="ID token is required")
        
        # Verify the Firebase ID token
        try:
            decoded_token = verify_firebase_token(id_token)
            firebase_uid = decoded_token["uid"]
            email = decoded_token.get("email") or google_data.get("email")
            name = decoded_token.get("name") or google_data.get("name", "")
            photo_url = google_data.get("photo_url", "")
        except ValueError as e:
            raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email is required")
        
        # Split name into first and last name
        name_parts = name.split(" ", 1) if name else ["", ""]
        first_name = name_parts[0] if len(name_parts) > 0 else ""
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        # Check if user exists in Firestore
        try:
            user_profile = FirestoreService.get_user_profile(firebase_uid)
            if user_profile:
                # User exists, update last login
                FirestoreService.update_last_login(firebase_uid)
                print(f"DEBUG: ✅ Existing Google user logged in: {email}")
            else:
                # User doesn't exist, create profile
                # Generate username from email (before @)
                username_base = email.split("@")[0].lower().replace(".", "_")
                username = username_base
                counter = 1
                while FirestoreService.check_username_exists(username):
                    username = f"{username_base}{counter}"
                    counter += 1
                
                # Create user profile with individual arguments
                user_profile = FirestoreService.create_user_profile(
                    firebase_uid=firebase_uid,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    username=username
                )
                
                # Update additional fields if needed
                if photo_url:
                    FirestoreService.update_user_profile(firebase_uid, {"photo_url": photo_url})
                
                print(f"DEBUG: ✅ New Google user created: {email} with username: {username}")
        except ValueError as e:
            # Firestore not initialized, create basic profile
            print(f"DEBUG: ⚠️ Firestore not available ({e}), using basic profile")
            user_profile = {
                "firebase_uid": firebase_uid,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "username": email.split("@")[0],
                "plan_tier": "free",
                "joined_at": datetime.utcnow().isoformat(),
                "last_login": datetime.utcnow().isoformat()
            }
        except Exception as e:
            print(f"DEBUG: ❌ Error with Firestore: {e}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Failed to process user: {str(e)}")
        
        # Generate JWT token
        import jwt
        import time
        
        payload = {
            "user_id": firebase_uid,
            "email": email,
            "exp": int(time.time()) + 86400  # 24 hours
        }
        
        token = jwt.encode(payload, "demo-secret-key", algorithm="HS256")
        
        print(f"DEBUG: ✅ Google authentication successful for {email}")
        
        return {
            "message": "Google authentication successful",
            "user": {
                "uid": firebase_uid,
                "email": email,
                "name": name
            },
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"DEBUG: Google auth error - {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Google authentication failed: {str(e)}")

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Get current user's profile"""
    return UserResponse(**current_user)

@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    user_update: UserUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Update current user's profile"""
    try:
        firebase_uid = current_user["firebase_uid"]
        
        if user_update.username and user_update.username != current_user.get("username"):
            if FirestoreService.check_username_exists(user_update.username):
                raise HTTPException(status_code=400, detail="Username already taken")
        
        update_data = user_update.model_dump(exclude_unset=True, exclude_none=True)
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        updated_profile = FirestoreService.update_user_profile(firebase_uid, update_data)
        
        return UserResponse(**updated_profile)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logout")
async def logout(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Logout (client should delete the token)"""
    return {"message": "Logout successful. Please delete the token on the client side."}

# Plaid routes
@router.post("/link-token")
async def create_link_token(authorization: str = Header(None)):
    """Create a Plaid Link token for user"""
    if not PLAID_AVAILABLE:
        raise HTTPException(status_code=503, detail="Plaid service not available. Please configure Plaid credentials.")
    
    try:
        # Try to get current user, but allow for demo without auth
        try:
            if authorization:
                current_user = await get_current_user(authorization)
                user_id = current_user.get('firebase_uid', 'demo_user_123')
            else:
                user_id = 'demo_user_123'
        except:
            user_id = 'demo_user_123'
        
        print(f"DEBUG: Starting link token creation for user {user_id}")
        
        from plaid import ApiClient, Configuration
        from plaid.api import plaid_api
        from plaid.model.link_token_create_request import LinkTokenCreateRequest
        from plaid.model.country_code import CountryCode
        from plaid.model.products import Products
        from app.config import settings
        
        print(f"DEBUG: Plaid env: {settings.plaid_env}")
        
        # Map environment to correct host URL
        if settings.plaid_env.lower() == "sandbox":
            host = "https://sandbox.plaid.com"
        elif settings.plaid_env.lower() == "development":
            host = "https://development.plaid.com"
        else:
            host = "https://production.plaid.com"
        
        print(f"DEBUG: Using host: {host}")
        
        configuration = Configuration(
            host=host,
            api_key={
                'clientId': settings.plaid_client_id,
                'secret': settings.plaid_secret,
            }
        )
        print("DEBUG: Configuration created")
        
        api_client = ApiClient(configuration)
        plaid_client = plaid_api.PlaidApi(api_client)
        print("DEBUG: Plaid client initialized")
        
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
            language='en'
        )
        print("DEBUG: Link token request created")
        
        response = plaid_client.link_token_create(request)
        print(f"DEBUG: Link token created successfully")
        
        return {"link_token": response['link_token']}
    except Exception as e:
        print(f"DEBUG: Exception occurred - {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create link token: {str(e)}")

@router.post("/connect-brokerage")
async def connect_brokerage(
    request_body: dict,
    authorization: str = Header(None)
):
    """Exchange public token for access token and store"""
    if not PLAID_AVAILABLE:
        raise HTTPException(status_code=503, detail="Plaid service not available. Please configure Plaid credentials.")
    
    try:
        # Try to get current user, but allow for demo without auth
        try:
            if authorization:
                current_user = await get_current_user(authorization)
                user_id = current_user.get('firebase_uid', 'demo_user_123')
            else:
                user_id = 'demo_user_123'
        except:
            user_id = 'demo_user_123'
        
        print("DEBUG: Starting brokerage connection")
        public_token = request_body.get("public_token")
        print(f"DEBUG: Public token received: {public_token[:20]}..." if public_token else "DEBUG: No public token")
        
        # Exchange token
        print("DEBUG: Exchanging public token for access token")
        from app.services.plaid_service import plaid_service
        token_data = plaid_service.exchange_public_token(public_token)
        print(f"DEBUG: Token exchanged successfully. Item ID: {token_data.get('item_id')}")
        
        # Get accounts to show user what was connected
        print("DEBUG: Fetching accounts from Plaid")
        accounts = plaid_service.get_accounts(token_data["access_token"])
        print(f"DEBUG: Retrieved {len(accounts)} accounts")
        
        # Convert Plaid enums to strings for serialization
        accounts_serialized = []
        for account in accounts:
            # Handle balance - it might be in different locations
            balance = 0.0
            if hasattr(account, 'balance') and account.balance:
                balance = float(account.balance)
            elif hasattr(account, 'balances') and account.balances:
                balance = float(account.balances.current) if hasattr(account.balances, 'current') else 0.0
            
            # Handle currency - try different possible attributes
            currency = "USD"  # Default
            if hasattr(account, 'iso_currency_code') and account.iso_currency_code:
                currency = account.iso_currency_code
            elif hasattr(account, 'unofficial_currency_code') and account.unofficial_currency_code:
                currency = account.unofficial_currency_code
            elif hasattr(account, 'currency') and account.currency:
                currency = account.currency
            
            accounts_serialized.append({
                "account_id": account.account_id,
                "name": account.name,
                "type": str(account.type),  # Convert enum to string
                "subtype": str(account.subtype),  # Convert enum to string
                "balance": balance,
                "currency": currency
            })
        
        # Store access token in file (since Firebase isn't configured)
        plaid_tokens[user_id] = {
            "access_token": token_data["access_token"],
            "item_id": token_data["item_id"],
            "connected_at": datetime.utcnow().isoformat()
        }
        save_plaid_tokens(plaid_tokens)
        print(f"DEBUG: Stored Plaid token in file for user {user_id}")
        print(f"DEBUG: Token stored: {token_data['access_token'][:20]}...")
        print(f"DEBUG: Total tokens saved: {len(plaid_tokens)}")
        
        # Also try to store in Firestore (if available)
        print("DEBUG: Attempting to store access token in Firestore")
        try:
            from app.services.firestore import FirestoreService
            
            FirestoreService.update_user_profile(
                current_user["firebase_uid"],
                {
                    "plaid_access_token": token_data["access_token"],
                    "plaid_item_id": token_data["item_id"],
                    "plaid_connected_at": datetime.utcnow()
                }
            )
            print("DEBUG: Successfully stored in Firestore")
        except Exception as e:
            print(f"DEBUG: Firestore storage failed (continuing anyway): {e}")
            # Continue without Firestore - we can still return success
        
        # Return accounts to frontend (but don't store them)
        return {
            "message": "Brokerage account connected",
            "accounts": accounts_serialized
        }
    except Exception as e:
        print(f"DEBUG: Exception occurred - {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@router.get("/portfolio-holdings")
async def get_portfolio_holdings(authorization: str = Header(None)):
    """Get user's portfolio holdings from Plaid"""
    if not PLAID_AVAILABLE:
        raise HTTPException(status_code=503, detail="Plaid service not available. Please configure Plaid credentials.")
    
    try:
        # Require authentication - don't fall back to demo user
        if not authorization:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        try:
            current_user = await get_current_user(authorization)
            user_id = current_user.get('firebase_uid')
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid user ID in token")
        except HTTPException:
            raise
        except Exception as e:
            print(f"DEBUG: Auth error - {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        print(f"DEBUG: Looking for Plaid token for user {user_id}")
        
        # Load tokens from file (in case backend restarted)
        current_tokens = load_plaid_tokens()
        print(f"DEBUG: Available tokens in file: {list(current_tokens.keys())}")
        
        access_token = None
        
        # First try to get token from file
        if user_id in current_tokens:
            access_token = current_tokens[user_id]["access_token"]
            print(f"DEBUG: Using file-based Plaid token for user {user_id}")
        else:
            # Fallback to Firestore (if available)
            try:
                from app.services.firestore import FirestoreService
                user_profile = FirestoreService.get_user_profile(user_id)
                
                if user_profile and user_profile.get("plaid_access_token"):
                    access_token = user_profile["plaid_access_token"]
                    print(f"DEBUG: Using Firestore Plaid token for user {user_id}")
                else:
                    print(f"DEBUG: No Plaid token found for user {user_id}")
                    raise HTTPException(status_code=404, detail="No brokerage account connected. Please connect your brokerage account first.")
            except HTTPException:
                # Re-raise HTTP exceptions (like our 404 above)
                raise
            except ValueError:
                # Firestore not initialized or user not found - no token available
                print(f"DEBUG: Firestore not available or user not found for {user_id}")
                raise HTTPException(status_code=404, detail="No brokerage account connected. Please connect your brokerage account first.")
            except Exception as e:
                # Any other exception from Firestore
                print(f"DEBUG: Firestore fallback failed: {e}")
                raise HTTPException(status_code=404, detail="No brokerage account connected. Please connect your brokerage account first.")
        
        # If we still don't have an access token, return 404
        if not access_token:
            raise HTTPException(status_code=404, detail="No brokerage account connected. Please connect your brokerage account first.")
        
        # Fetch holdings and securities
        from app.services.plaid_service import plaid_service
        try:
            holdings_data = plaid_service.get_holdings(access_token)
            holdings = holdings_data.get('holdings', [])
            securities = holdings_data.get('securities', [])
        except Exception as plaid_error:
            print(f"DEBUG: Plaid API error: {plaid_error}")
            # If Plaid call fails, it might be an invalid token or API error
            raise HTTPException(status_code=500, detail=f"Failed to fetch holdings from Plaid: {str(plaid_error)}")
        
        # Create a mapping of security_id to security details (including ticker symbol)
        securities_map = {}
        for security in securities:
            try:
                security_id = getattr(security, 'security_id', None)
                if security_id:
                    # Get ticker symbol - it might be in 'ticker_symbol' or 'name' field
                    ticker = getattr(security, 'ticker_symbol', None) or getattr(security, 'name', None)
                    name = getattr(security, 'name', None) or getattr(security, 'ticker_symbol', None)
                    
                    securities_map[security_id] = {
                        'ticker_symbol': ticker,
                        'name': name,
                        'type': str(getattr(security, 'type', '')),
                        'close_price': float(getattr(security, 'close_price', 0)) if hasattr(security, 'close_price') else None
                    }
            except Exception as e:
                print(f"DEBUG: Error processing security: {e}")
                continue
        
        # Convert Plaid objects to simple dictionaries to avoid serialization issues
        holdings_serialized = []
        for holding in holdings:
            try:
                security_id = getattr(holding, 'security_id', None)
                security_info = securities_map.get(security_id, {}) if security_id else {}
                
                # Use ticker symbol from securities if available, otherwise fall back to security_id
                ticker_symbol = security_info.get('ticker_symbol') or security_id
                security_name = security_info.get('name') or 'Unknown Security'
                
                # Convert holding to dictionary, handling any complex objects
                holding_dict = {
                    "account_id": getattr(holding, 'account_id', None),
                    "security_id": security_id,
                    "ticker_symbol": ticker_symbol,  # Add the actual ticker symbol
                    "security_name": security_name,  # Add the security name
                    "institution_price": float(getattr(holding, 'institution_price', 0)),
                    "institution_price_as_of": str(getattr(holding, 'institution_price_as_of', '')),
                    "institution_value": float(getattr(holding, 'institution_value', 0)),
                    "cost_basis": float(getattr(holding, 'cost_basis', 0)),
                    "quantity": float(getattr(holding, 'quantity', 0)),
                    "iso_currency_code": getattr(holding, 'iso_currency_code', 'USD'),
                    "unofficial_currency_code": getattr(holding, 'unofficial_currency_code', None)
                }
                holdings_serialized.append(holding_dict)
            except Exception as e:
                print(f"DEBUG: Error serializing holding: {e}")
                # Add a basic holding entry if serialization fails
                holdings_serialized.append({
                    "account_id": "unknown",
                    "security_id": "unknown",
                    "ticker_symbol": "UNKNOWN",
                    "security_name": "Unknown Security",
                    "institution_price": 0.0,
                    "institution_value": 0.0,
                    "quantity": 0.0,
                    "iso_currency_code": "USD"
                })
        
        # Also fetch investment transactions to calculate actual starting balance
        try:
            from datetime import datetime, timedelta
            # Get transactions from account start (2 years ago) to now
            start_date = (datetime.now() - timedelta(days=730)).strftime('%Y-%m-%d')
            end_date = datetime.now().strftime('%Y-%m-%d')
            
            transactions_data = plaid_service.get_investment_transactions(
                access_token, 
                start_date=start_date, 
                end_date=end_date
            )
            transactions = transactions_data.get('investment_transactions', [])
            
            # Calculate total CASH deposits and withdrawals (not buy/sell trades)
            # Buy/sell are trades, not cash flows - we want actual money in/out
            total_cash_deposits = 0.0
            total_cash_withdrawals = 0.0
            earliest_deposit = None
            earliest_deposit_amount = 0.0
            
            for transaction in transactions:
                try:
                    # Get transaction type and amount
                    trans_type = getattr(transaction, 'type', None) or getattr(transaction, 'investment_transaction_type', None)
                    amount = float(getattr(transaction, 'amount', 0))
                    date_str = getattr(transaction, 'date', None)
                    
                    # Only count actual CASH deposits/withdrawals, not buy/sell trades
                    # Buy/sell are asset exchanges, not cash flows
                    if trans_type == 'cash' and amount > 0:
                        # Cash deposit
                        total_cash_deposits += amount
                        if date_str:
                            trans_date = datetime.strptime(date_str, '%Y-%m-%d')
                            if earliest_deposit is None or trans_date < earliest_deposit:
                                earliest_deposit = trans_date
                                earliest_deposit_amount = amount
                    elif trans_type == 'cash' and amount < 0:
                        # Cash withdrawal
                        total_cash_withdrawals += abs(amount)
                    elif trans_type in ['dividend', 'interest']:
                        # Dividends and interest add to account (but not initial deposit)
                        if amount > 0:
                            total_cash_deposits += amount
                    elif trans_type == 'fee' and amount < 0:
                        # Fees subtract from account
                        total_cash_withdrawals += abs(amount)
                except Exception as e:
                    print(f"DEBUG: Error processing transaction: {e}")
                    continue
            
            # Calculate starting balance
            # Method 1: Use the earliest cash deposit as starting balance (most accurate)
            # Method 2: Work backwards: Starting = Current - Net cash flows - Investment gains
            current_portfolio_value = sum(h.get('institution_value', 0) for h in holdings_serialized)
            total_cost_basis = sum(h.get('cost_basis', 0) for h in holdings_serialized)
            investment_gains = current_portfolio_value - total_cost_basis
            
            # Net cash flows (money put in minus money taken out)
            net_cash_flows = total_cash_deposits - total_cash_withdrawals
            
            # Starting balance = Current - Net cash flows - Investment gains
            # This gives us what the account was worth at the start
            estimated_starting_balance = current_portfolio_value - net_cash_flows - investment_gains
            
            # If we found an earliest deposit, use that as a sanity check
            # The starting balance should be close to the first deposit
            if earliest_deposit_amount > 0:
                # Use the first deposit if it's reasonable (within 50% of calculated)
                if abs(estimated_starting_balance - earliest_deposit_amount) < earliest_deposit_amount * 0.5:
                    estimated_starting_balance = earliest_deposit_amount
                    print(f"DEBUG: Using first deposit as starting balance: ${earliest_deposit_amount:.2f}")
            
            print(f"DEBUG: Transactions - Cash Deposits: ${total_cash_deposits:.2f}, Cash Withdrawals: ${total_cash_withdrawals:.2f}")
            print(f"DEBUG: Current portfolio value: ${current_portfolio_value:.2f}")
            print(f"DEBUG: Total cost basis: ${total_cost_basis:.2f}")
            print(f"DEBUG: Investment gains/losses: ${investment_gains:.2f}")
            print(f"DEBUG: Net cash flows: ${net_cash_flows:.2f}")
            print(f"DEBUG: Estimated starting balance: ${estimated_starting_balance:.2f}")
            
        except Exception as trans_error:
            print(f"DEBUG: Could not fetch transactions (this is optional): {trans_error}")
            estimated_starting_balance = None
            total_cash_deposits = 0.0
            total_cash_withdrawals = 0.0
        
        return {
            "holdings": holdings_serialized,
            "account_name": current_tokens.get(user_id, {}).get("item_id", "Unknown"),
            "estimated_starting_balance": estimated_starting_balance,
            "total_deposits": total_cash_deposits if 'total_cash_deposits' in locals() else 0.0,
            "total_withdrawals": total_cash_withdrawals if 'total_cash_withdrawals' in locals() else 0.0
        }
    except HTTPException:
        # Re-raise HTTP exceptions (404, 401, etc.) as-is
        raise
    except Exception as e:
        # Only convert unexpected exceptions to 500
        print(f"DEBUG: Unexpected error in portfolio-holdings: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get holdings: {str(e)}")