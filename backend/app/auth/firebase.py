import firebase_admin
from firebase_admin import credentials, auth
from app.config import settings
import os
from pathlib import Path

# Resolve the Firebase credentials path to an absolute path
firebase_cred_path = None
if settings.firebase_credentials_path:
    # Convert relative path to absolute path relative to backend directory
    backend_dir = Path(__file__).parent.parent.parent  # Go up from app/auth/firebase.py to backend/
    cred_path = Path(backend_dir) / settings.firebase_credentials_path.replace("./", "")
    
    if cred_path.exists():
        firebase_cred_path = str(cred_path.absolute())
    else:
        # Try the path as-is (might already be absolute)
        if Path(settings.firebase_credentials_path).exists():
            firebase_cred_path = settings.firebase_credentials_path

# Initialize Firebase Admin SDK only if credentials are provided and file exists
if firebase_cred_path:
    try:
        print(f"DEBUG: Initializing Firebase with credentials from: {firebase_cred_path}")
        cred = credentials.Certificate(firebase_cred_path)
        firebase_admin.initialize_app(cred)
        print("DEBUG: ✅ Firebase Admin SDK initialized successfully")
    except Exception as e:
        print(f"DEBUG: ❌ Firebase initialization failed: {e}")
        import traceback
        traceback.print_exc()
        firebase_admin = None
else:
    print("DEBUG: ⚠️ Firebase credentials file not found. Firebase features disabled.")
    print(f"DEBUG: Looking for credentials at: {settings.firebase_credentials_path}")
    firebase_admin = None

def verify_firebase_token(id_token: str):
    """Verify Firebase ID token and return decoded token"""
    if not firebase_admin:
        raise ValueError("Firebase not initialized. Please configure Firebase credentials.")
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        raise ValueError(f"Invalid token: {str(e)}")

def create_firebase_user(email: str, password: str):
    """Create a new Firebase user"""
    if not firebase_admin:
        raise ValueError("Firebase not initialized. Please configure Firebase credentials.")
    try:
        user = auth.create_user(
            email=email,
            password=password
        )
        return {"uid": user.uid, "email": user.email}
    except Exception as e:
        raise ValueError(f"Error creating user: {str(e)}")