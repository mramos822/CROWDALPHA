## Environment Setup

1. Get your Firebase private key
```
1. Go to the Firebase project: https://console.firebase.google.com/
2. Go to Project Settings → Service Accounts → Generate new private key
3. Download the JSON file 
4. Store the JSON file in backend/firebase-credentials.json
```

2. Make sure you have Python 3.11+, pip, and venv installed
```bash
sudo apt install python3 python3-pip python3-venv -y
```

3. Change working directory to the backend directory
```bash
cd CROWDALPHA/backend
```

4. Activate virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```

5. Install the project dependencies
```bash
pip install -r requirements.txt
```

6. Start the server
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
7. You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

8. Test the API endpoints via Postman or from the Frontend
```
ex. http://localhost:8000/api/auth/signup
```

## File Structure
```
backend/
├── app/
│   ├── main.py                     # FastAPI app setup, CORS config, route registration
│   ├── config.py                   # Environment variables and settings (Pydantic)
│   │
│   ├── auth/
│   │   ├── firebase.py             # Firebase Admin SDK initialization, user creation, token verification
│   │   ├── middleware.py           # Authentication middleware, get_current_user dependency
│   │   └── routes.py               # Auth endpoints (signup, login, link-token, connect-brokerage)
│   │
│   ├── schemas/
│   │   ├── users.py                # Pydantic schemas (UserCreate, UserLogin, UserResponse, UserUpdate)
│   │   └── signals.py              # Signal schemas
│   │
│   │── services/
│   │   ├── firestore.py            # FirestoreService - Firestore CRUD operations for user profiles
│   │   ├── plaid_service.py        # PlaidService - Plaid API calls (token exchange, holdings, accounts)
│   │   └── signals_service.py      # SignalsService - News fetching and signal generation logic
│   │
│   └── signals/                    # News and signal API endpoints 
│       └── routes.py               
│
├── firebase-credentials.json       # Firebase service account key (in .gitignore)
├── .env                            # Environment variables (API keys, credentials, etc.)
├── .gitignore                      # Git ignore rules
├── requirements.txt                # Python dependencies
└── venv/                           # Python virtual environment (in .gitignore)
```
