from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class MessageCreate(BaseModel):
    content: str
    mentions: Optional[List[str]] = []
    stock_symbols: Optional[List[str]] = []

class MessageResponse(BaseModel):
    id: str
    group_id: str
    sender_uid: str
    sender_username: str
    sender_name: str
    sender_avatar: str
    content: str
    mentions: List[str]
    stock_symbols: List[str]
    created_at: str

