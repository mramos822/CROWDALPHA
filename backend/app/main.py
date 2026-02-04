from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth.routes import router as auth_router
from app.groups.routes import router as groups_router
from app.signals.routes import router as signals_router
from app.ipos.routes import router as ipos_router
from app.stocks.routes import router as stocks_router

app = FastAPI(
    title="CrowdAlpha API",
    description="Backend API for CrowdAlpha",
    version="1.0.0"
)

# Initialize Polygon WebSocket connection on startup
@app.on_event("startup")
async def startup_event():
    try:
        from app.stocks.websocket import connect_polygon_websocket
        await connect_polygon_websocket()
        print("✅ Polygon WebSocket connection initiated")
    except Exception as e:
        print(f"⚠️ Failed to initialize Polygon WebSocket: {e}")
        print("💡 Real-time updates will use polling fallback")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)  # Firebase authentication
app.include_router(groups_router)  # Groups functionality
app.include_router(signals_router)  # AI signals and news evaluation
app.include_router(ipos_router)  # IPO calendar
app.include_router(stocks_router)  # Stock data from Yahoo Finance

@app.get("/")
async def root():
    return {
        "message": "CrowdAlpha API",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}