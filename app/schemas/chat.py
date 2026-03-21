from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime

class ChatSessionCreate(BaseModel):
    title: Optional[str] = None

class ChatSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatMessageCreate(BaseModel):
    role: str
    content: str
    intent: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None

class ChatMessageResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    intent: Optional[str]
    extra_data: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True