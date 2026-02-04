from fastapi import Header, HTTPException
from typing import Dict, Any
import jwt
import time

async def get_current_user(authorization: str = Header(...)) -> Dict[str, Any]:
    """Get current authenticated user from JWT token"""
    try:
        # Verify JWT token
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        token = authorization.split("Bearer ")[1]
        
        # Decode JWT token
        try:
            decoded_token = jwt.decode(token, "demo-secret-key", algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        firebase_uid = decoded_token["user_id"]
        email = decoded_token.get("email", "")
        
        # Try to fetch real user profile from Firestore
        try:
            from app.services.firestore import FirestoreService
            user_profile = FirestoreService.get_user_profile(firebase_uid)
            
            if user_profile:
                # Firestore returns data with ISO string dates (from get_user_profile conversion)
                # Pydantic will automatically parse ISO strings to datetime objects for validation
                # FastAPI will then serialize datetime objects back to ISO strings in JSON response
                print(f"DEBUG: ✅ Fetched real user profile for {firebase_uid}: {user_profile.get('username', 'N/A')}")
                print(f"DEBUG: Profile data keys: {list(user_profile.keys())}")
                print(f"DEBUG: joined_at type: {type(user_profile.get('joined_at'))}, value: {user_profile.get('joined_at')}")
                return user_profile
        except ValueError as e:
            # Firestore not initialized or user not found - fall back to basic profile
            print(f"DEBUG: ⚠️ Firestore not available ({e}), using basic profile from token")
        except Exception as e:
            # Any other error - log but fall back to basic profile
            print(f"DEBUG: ⚠️ Error fetching user profile: {e}, using basic profile from token")
        
        # Fallback: Create basic user profile from token data
        user_profile = {
            "firebase_uid": firebase_uid,
            "email": email,
            "first_name": "Demo",
            "last_name": "User",
            "username": "demouser",
            "plan_tier": "free",
            "is_active": True,
            "joined_at": "2024-01-01T00:00:00Z",
            "last_login": "2024-01-01T00:00:00Z"
        }
        
        return user_profile
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")