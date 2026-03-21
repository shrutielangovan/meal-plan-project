from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.meal_plan import MealPlan, MealPlanSlot, LoggedMeal
from app.schemas.meal_plan import (
    MealPlanCreate, MealPlanResponse,
    MealPlanSlotUpdate, MealPlanSlotResponse,
    LoggedMealCreate, LoggedMealResponse
)
from typing import List, Optional
from uuid import UUID
from datetime import date
from app.models.recipe import Recipe
from app.models.chat import ChatSession

router = APIRouter()


@router.post("/{user_id}", response_model=MealPlanResponse)
def create_meal_plan(user_id: UUID, plan_in: MealPlanCreate, db: Session = Depends(get_db)):
    
    week_start = plan_in.week_start
    if plan_in.plan_type == "on_demand":
        week_start = date.today()

    existing = db.query(MealPlan).filter_by(
        user_id=user_id,
        week_start=week_start
    ).first()
    if existing and plan_in.plan_type != "on_demand":
        raise HTTPException(status_code=400, detail="Meal plan already exists for this week")

    plan = MealPlan(
        user_id=user_id,
        week_start=week_start,
        plan_type=plan_in.plan_type,
        status="active"
    )
    db.add(plan)
    db.flush()

    for slot_in in (plan_in.slots or []):
        slot = MealPlanSlot(
            meal_plan_id=plan.id,
            recipe_id=slot_in.recipe_id,
            day_of_week=slot_in.day_of_week,
            meal_slot=slot_in.meal_slot,
            servings_override=slot_in.servings_override,
        )
        db.add(slot)

    db.commit()
    db.refresh(plan)
    return plan


@router.get("/{user_id}", response_model=List[MealPlanResponse])
def get_meal_plans(
    user_id: UUID,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(MealPlan).options(
        joinedload(MealPlan.slots)
    ).filter_by(user_id=user_id)

    if status:
        q = q.filter(MealPlan.status == status)

    return q.order_by(MealPlan.week_start.desc()).all()


@router.get("/{user_id}/{plan_id}", response_model=MealPlanResponse)
def get_meal_plan(user_id: UUID, plan_id: UUID, db: Session = Depends(get_db)):
    plan = db.query(MealPlan).options(
        joinedload(MealPlan.slots)
    ).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return plan



@router.patch("/{user_id}/{plan_id}/slots/{slot_id}", response_model=MealPlanSlotResponse)
def update_slot(
    user_id: UUID,
    plan_id: UUID,
    slot_id: UUID,
    slot_in: MealPlanSlotUpdate,
    db: Session = Depends(get_db)
):
    plan = db.query(MealPlan).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")

    slot = db.query(MealPlanSlot).filter_by(id=slot_id, meal_plan_id=plan_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    if slot_in.recipe_id:
        recipe = db.query(Recipe).filter_by(id=slot_in.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found — use a valid recipe_id from /api/recipes")

    for field, value in slot_in.model_dump(exclude_none=True).items():
        setattr(slot, field, value)

    db.commit()
    db.refresh(slot)
    return slot


@router.patch("/{user_id}/{plan_id}/archive")
def archive_meal_plan(user_id: UUID, plan_id: UUID, db: Session = Depends(get_db)):
    plan = db.query(MealPlan).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    plan.status = "archived"
    db.commit()
    return {"message": "Meal plan archived"}


@router.post("/{user_id}/log", response_model=LoggedMealResponse)
def log_meal(user_id: UUID, meal_in: LoggedMealCreate, db: Session = Depends(get_db)):
    if meal_in.session_id:
        session = db.query(ChatSession).filter_by(id=meal_in.session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found — use a valid session_id or pass null")
    
    meal = LoggedMeal(user_id=user_id, **meal_in.model_dump())
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return meal


@router.get("/{user_id}/log/history", response_model=List[LoggedMealResponse])
def get_logged_meals(
    user_id: UUID,
    limit: int = Query(20, le=100),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    return db.query(LoggedMeal).filter_by(
        user_id=user_id
    ).order_by(
        LoggedMeal.logged_at.desc()
    ).offset(offset).limit(limit).all()