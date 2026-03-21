from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime

class MealPlanSlotCreate(BaseModel):
    recipe_id: Optional[UUID] = None
    day_of_week: Optional[int] = 0
    meal_slot: str
    servings_override: Optional[int] = None

    @field_validator("meal_slot")
    @classmethod
    def validate_meal_slot(cls, v):
        allowed = ["breakfast", "lunch", "dinner", "snack"]
        if v not in allowed:
            raise ValueError(f"meal_slot must be one of {allowed}")
        return v

    @field_validator("day_of_week")
    @classmethod
    def validate_day_of_week(cls, v):
        if v is not None and (v < 0 or v > 6):
            raise ValueError("day_of_week must be between 0 (Monday) and 6 (Sunday)")
        return v

class MealPlanSlotUpdate(BaseModel):
    recipe_id: Optional[UUID] = None
    servings_override: Optional[int] = None

class MealPlanSlotResponse(BaseModel):
    id: UUID
    recipe_id: Optional[UUID]
    day_of_week: int
    meal_slot: str
    servings_override: Optional[int]

    class Config:
        from_attributes = True

class MealPlanCreate(BaseModel):
    week_start: Optional[date] = None
    plan_type: str
    slots: Optional[List[MealPlanSlotCreate]] = []

    @field_validator("plan_type")
    @classmethod
    def validate_plan_type(cls, v):
        allowed = ["weekly", "daily", "on_demand"]
        if v not in allowed:
            raise ValueError(f"plan_type must be one of {allowed}")
        return v

    @model_validator(mode="after")
    def validate_by_plan_type(self):
        if self.plan_type == "on_demand":
            if self.slots and len(self.slots) > 1:
                raise ValueError("on_demand plans can only have one slot")

        if self.plan_type in ["weekly", "daily"]:
            if not self.week_start:
                raise ValueError(f"{self.plan_type} plans require a week_start date")

        return self


class MealPlanResponse(BaseModel):
    id: UUID
    user_id: UUID
    week_start: date
    plan_type: str
    status: str
    created_at: datetime
    slots: List[MealPlanSlotResponse] = []

    class Config:
        from_attributes = True

class LoggedMealCreate(BaseModel):
    description: str
    meal_slot: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    source: str = "estimated"
    session_id: Optional[UUID] = None

class LoggedMealResponse(BaseModel):
    id: UUID
    user_id: UUID
    description: str
    meal_slot: Optional[str]
    logged_at: datetime
    calories: Optional[float]
    protein_g: Optional[float]
    carbs_g: Optional[float]
    fat_g: Optional[float]
    source: str

    class Config:
        from_attributes = True