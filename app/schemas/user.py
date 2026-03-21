from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    household_size: int = 1
    budget_weekly: Optional[int] = None
    cooking_time_mins: Optional[int] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

class UserUpdate(BaseModel):
    name: Optional[str] = None
    household_size: Optional[int] = None
    budget_weekly: Optional[int] = None
    cooking_time_mins: Optional[int] = None

class UserPreferencesUpdate(BaseModel):
    dietary_restrictions: Optional[List[str]] = None
    health_goals: Optional[List[str]] = None
    ingredient_dislikes: Optional[List[str]] = None

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: Optional[str]
    household_size: int
    budget_weekly: Optional[int]
    cooking_time_mins: Optional[int]
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True

class UserPreferencesResponse(BaseModel):
    id: UUID
    dietary_restrictions: List[str]
    health_goals: List[str]
    ingredient_dislikes: List[str]

    class Config:
        from_attributes = True