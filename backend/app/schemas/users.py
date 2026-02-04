from pydantic import BaseModel, EmailStr, field_validator
from datetime import datetime
from typing import Optional
from enum import Enum

class PlanTier(str, Enum):
    FREE = "free"
    PREMIUM = "premium"

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str  # Make required
    last_name: str   # Make required
    username: str    # Make required
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    plan_tier: Optional[PlanTier] = None

class UserResponse(BaseModel):
    firebase_uid: str
    email: str
    username: str
    first_name: str
    last_name: str
    plan_tier: str
    joined_at: datetime
    last_login: datetime
    plaid_access_token: Optional[str] = None  
    plaid_item_id: Optional[str] = None        