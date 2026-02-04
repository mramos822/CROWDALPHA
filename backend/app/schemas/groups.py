from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class GroupCreate(BaseModel):
    name: str
    description: str
    symbol: Optional[str] = None
    is_private: bool = False
    max_members: int = 10
    invite_usernames: List[str] = []

class GroupResponse(BaseModel):
    id: str
    name: str
    description: str
    symbol: str
    creator_uid: str
    is_private: bool
    max_members: int
    member_count: int
    members: List[str]
    created_at: str
    last_activity: str

class MemberResponse(BaseModel):
    firebase_uid: str
    username: str
    first_name: str
    last_name: str
    email: str
    avatar: str

class InvitationRequest(BaseModel):
    username: str

class UserSearchResponse(BaseModel):
    firebase_uid: str
    username: str
    first_name: str
    last_name: str
    email: str
    avatar: Optional[str] = None

