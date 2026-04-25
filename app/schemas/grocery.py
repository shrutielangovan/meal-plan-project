from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class GroceryItemResponse(BaseModel):
    id: UUID
    ingredient_name: str
    quantity: Optional[float]
    unit: Optional[str]
    category: Optional[str]
    is_checked: bool
    in_pantry: bool

    class Config:
        from_attributes = True

class GroceryListResponse(BaseModel):
    id: UUID
    user_id: UUID
    meal_plan_id: Optional[UUID]
    created_at: datetime
    items: List[GroceryItemResponse] = []

    class Config:
        from_attributes = True

class GroceryItemUpdate(BaseModel):
    is_checked: Optional[bool] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    
class GroceryItemCreate(BaseModel):
    ingredient_name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None
    category: Optional[str] = None