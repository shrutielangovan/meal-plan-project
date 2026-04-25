from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime, timezone
from app.models import LoggedMeal, User

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
    status: str = "logged" 

    class Config:
        from_attributes = True
        
class BackdateMealLogCreate(BaseModel):
    description: str
    meal_slot: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    logged_at: datetime  # ISO string from frontend e.g. "2025-04-20T00:00:00.000Z"

    @field_validator("logged_at")
    @classmethod
    def must_not_be_future(cls, v: datetime) -> datetime:
        if v > datetime.now(timezone.utc):
            raise ValueError("Cannot log meals for future dates.")
        return v

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Meal description cannot be empty.")
        return v.strip()

class MealLogResponse(BaseModel):
    id: str
    description: str
    meal_slot: Optional[str]
    logged_at: datetime
    calories: Optional[float]
    protein_g: Optional[float]
    carbs_g: Optional[float]
    fat_g: Optional[float]
    source: Optional[str]

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_safe(cls, obj: LoggedMeal) -> "MealLogResponse":
        """Handles UUID → str serialisation cleanly."""
        return cls(
            id=str(obj.id),
            description=obj.description,
            meal_slot=obj.meal_slot,
            logged_at=obj.logged_at,
            calories=obj.calories,
            protein_g=obj.protein_g,
            carbs_g=obj.carbs_g,
            fat_g=obj.fat_g,
            source=obj.source,
        )

class GenerateMealPlanRequest(BaseModel):
    preferences: dict
    pantry_items: str = ""
    meal_slots: list[str] = ["breakfast", "lunch", "dinner"]
    user_id: Optional[str] = None           # ← ADD: so service can fetch pantry
    locked_recipe_ids: dict = {} 
    # recipes are fetched from DB server-side — no need to send them from client

class EstimateMacrosRequest(BaseModel):
    description: str
    meal_slot: Optional[str] = None

class MacroEstimateResponse(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    estimated: bool = True

class PlanMealCreate(BaseModel):
    description: str
    meal_slot: Optional[str] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    logged_at: datetime  # must be today or up to 7 days in future

    @field_validator("description")
    @classmethod
    def description_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Meal description cannot be empty.")
        return v.strip()