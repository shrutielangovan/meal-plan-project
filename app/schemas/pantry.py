from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class PantryItemCreate(BaseModel):
    ingredient_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    expires_at: Optional[datetime] = None

class PantryItemUpdate(BaseModel):
    quantity: Optional[float] = None
    unit: Optional[str] = None
    expires_at: Optional[datetime] = None

class PantryItemResponse(BaseModel):
    id: UUID
    ingredient_name: str
    quantity: Optional[float]
    unit: Optional[str]
    expires_at: Optional[datetime]
    added_at: datetime

    class Config:
        from_attributes = True