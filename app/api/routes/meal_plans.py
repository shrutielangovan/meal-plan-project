from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.meal_plan import MealPlan, MealPlanSlot, LoggedMeal
from app.models.grocery import GroceryList, GroceryItem
from app.schemas.meal_plan import (
    MealPlanCreate, MealPlanResponse,
    MealPlanSlotUpdate, MealPlanSlotResponse,
    LoggedMealCreate, LoggedMealResponse,
    BackdateMealLogCreate, MealLogResponse,
    GenerateMealPlanRequest, EstimateMacrosRequest, MacroEstimateResponse,
    PlanMealCreate, 
)
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime, timezone
from app.models.recipe import Recipe
from app.models.chat import ChatSession
from app.models.user import User, PantryItem

from app.services.meal_plan_gemini_service import generate_meal_plan, estimate_macros
from app.services.meal_suggestion_service import get_meal_suggestions

router = APIRouter()

# ── Helper: auto-convert planned → logged when date arrives ───────────────────

def auto_convert_planned_meals(user_id: str, db: Session) -> None:
    """
    Called on every /log/history request.
    Flips status="planned" → "logged" for any meal whose logged_at date
    is today or in the past, and deducts pantry ingredients.
    """
    now_date = datetime.now(timezone.utc).date()

    due_meals = db.query(LoggedMeal).filter(
        LoggedMeal.user_id == user_id,
        LoggedMeal.status == "planned",
        LoggedMeal.logged_at <= datetime.now(timezone.utc),
    ).all()

    if not due_meals:
        return

    pantry_items = db.query(PantryItem).filter_by(user_id=user_id).all()
    pantry_map = {p.ingredient_name.lower(): p for p in pantry_items}

    for meal in due_meals:
        meal.status = "logged"

        # Deduct pantry if meal matches a recipe
        matching_recipe = (
            db.query(Recipe)
            .filter(Recipe.title.ilike(meal.description))
            .first()
        )
        if matching_recipe and hasattr(matching_recipe, "ingredients"):
            for ingredient in matching_recipe.ingredients:
                pantry_item = pantry_map.get(ingredient.ingredient_name.lower())
                if pantry_item and ingredient.quantity is not None:
                    pantry_item.quantity = max(
                        0, (pantry_item.quantity or 0) - ingredient.quantity
                    )

    db.commit()

# ── Static routes FIRST (before any /{user_id} routes) ───────────────────────

@router.post("/generate-meal-plan")
async def generate_meal_plan_endpoint(
    payload: GenerateMealPlanRequest,
    db: Session = Depends(get_db),
):
    """
    Rule-based suggestion engine with AI fallback.
    Respects locked_recipe_ids — already-logged recipes are preserved.
    Always returns 3 suggestions per slot.
    """
    # Add user_id to preferences so the service can fetch pantry
    prefs_with_user = {
        **payload.preferences,
        "user_id": payload.user_id,  # see schema note below
    }

    result = await get_meal_suggestions(
        db=db,
        preferences=prefs_with_user,
        meal_slots=payload.meal_slots,
        locked_recipe_ids=payload.locked_recipe_ids,  # see schema note below
    )

    return {"suggestions": result}

@router.post("/estimate-macros", response_model=MacroEstimateResponse)
async def estimate_macros_endpoint(
    payload: EstimateMacrosRequest,
    db: Session = Depends(get_db),
):
    if not payload.description.strip():
        raise HTTPException(status_code=400, detail="Meal description cannot be empty")

    desc_words = set(payload.description.lower().split())
    all_recipes = db.query(Recipe).all()

    def relevance_score(recipe: Recipe) -> int:
        return len(desc_words & set(recipe.title.lower().split()))

    sorted_recipes = sorted(all_recipes, key=relevance_score, reverse=True)
    reference_recipes = [
        {
            "title": r.title,
            "calories": r.calories,
            "protein_g": r.protein_g,
            "carbs_g": r.carbs_g,
            "fat_g": r.fat_g,
        }
        for r in sorted_recipes[:8]
    ]
    try:
        result = await estimate_macros(
            description=payload.description,
            meal_slot=payload.meal_slot,
            similar_recipes=reference_recipes,
        )
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Macro estimation failed: {str(e)}")

# ── /{user_id}/log/* routes (must come before /{user_id}/{plan_id}) ───────────

@router.post("/{user_id}/log/plan")
async def plan_future_meal(
    user_id: UUID,
    payload: PlanMealCreate,
    db: Session = Depends(get_db),
):
    """
    Saves a future meal as status="planned".
    Checks recipe ingredients against pantry:
    - Present → noted as covered
    - Missing → added to a standalone grocery list
    Returns the saved meal + grocery list summary.
    """
    # Validate user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce future-only (allow today too)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if payload.logged_at < today_start:
        raise HTTPException(status_code=400, detail="Use /log or /log/backdate for past dates")

    max_future = today_start.replace(hour=0, minute=0, second=0, microsecond=0)
    from datetime import timedelta
    max_future = today_start + timedelta(days=7)
    if payload.logged_at > max_future:
        raise HTTPException(status_code=400, detail="Cannot plan meals more than 7 days in advance")

    # Save as planned meal
    meal = LoggedMeal(
        user_id=user_id,
        description=payload.description,
        meal_slot=payload.meal_slot,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        logged_at=payload.logged_at,
        source="planned",
        status="planned",
    )
    db.add(meal)
    db.flush()

    # Check pantry vs recipe ingredients
    missing_items = []
    covered_items = []

    matching_recipe = (
        db.query(Recipe)
        .filter(Recipe.title.ilike(payload.description))
        .first()
    )

    if matching_recipe and hasattr(matching_recipe, "ingredients"):
        pantry_items = db.query(PantryItem).filter_by(user_id=user_id).all()
        pantry_map = {p.ingredient_name.lower(): p for p in pantry_items}

        for ingredient in matching_recipe.ingredients:
            key = ingredient.ingredient_name.lower()
            pantry_item = pantry_map.get(key)

            if pantry_item and (pantry_item.quantity or 0) >= (ingredient.quantity or 0):
                covered_items.append(ingredient.ingredient_name)
            else:
                missing_items.append({
                    "ingredient_name": key,
                    "quantity": ingredient.quantity,
                    "unit": ingredient.unit,
                    "in_pantry": False,
                    "is_checked": False,
                    "category": None,
                })

    # Add missing items to grocery list
    grocery_list_id = None
    if missing_items:
        # Find or create a standalone grocery list for this user
        grocery_list = (
            db.query(GroceryList)
            .filter(
                GroceryList.user_id == user_id,
                GroceryList.meal_plan_id == None,
            )
            .order_by(GroceryList.created_at.desc())
            .first()
        )
        if not grocery_list:
            grocery_list = GroceryList(user_id=user_id, meal_plan_id=None)
            db.add(grocery_list)
            db.flush()

        # Avoid duplicate items
        existing_items = {i.ingredient_name.lower() for i in grocery_list.items}
        for item_data in missing_items:
            if item_data["ingredient_name"] not in existing_items:
                db.add(GroceryItem(grocery_list_id=grocery_list.id, **item_data))

        grocery_list_id = str(grocery_list.id)

    if not matching_recipe:
        from app.services.meal_image_service import get_or_generate_meal_image
        image_url = await get_or_generate_meal_image(meal.description, db)
        if image_url:
            meal.image_url = image_url
        
    db.commit()
    db.refresh(meal)
    
    return {
        "meal": {
            "id": str(meal.id),
            "description": meal.description,
            "meal_slot": meal.meal_slot,
            "logged_at": meal.logged_at.isoformat(),
            "status": meal.status,
            "calories": meal.calories,
            "protein_g": meal.protein_g,
            "carbs_g": meal.carbs_g,
            "fat_g": meal.fat_g,
        },
        "pantry_covered": covered_items,
        "missing_added_to_grocery": [i["ingredient_name"] for i in missing_items],
        "grocery_list_id": grocery_list_id,
    }

@router.post("/{user_id}/log", response_model=LoggedMealResponse)
async def log_meal(user_id: UUID, meal_in: LoggedMealCreate, db: Session = Depends(get_db)):
    meal = LoggedMeal(user_id=user_id, **meal_in.model_dump())
    db.add(meal)
    db.flush()

    # Deduct pantry for meal plan recipes
    if meal_in.source == "meal_plan":
        matching_recipe = (
            db.query(Recipe)
            .filter(Recipe.title.ilike(meal_in.description))
            .first()
        )
        if matching_recipe and hasattr(matching_recipe, "ingredients"):
            pantry_items = db.query(PantryItem).filter_by(user_id=user_id).all()
            pantry_map = {p.ingredient_name.lower(): p for p in pantry_items}
            for ingredient in matching_recipe.ingredients:
                pantry_item = pantry_map.get(ingredient.ingredient_name.lower())
                if pantry_item and ingredient.quantity is not None:
                    pantry_item.quantity = max(
                        0, (pantry_item.quantity or 0) - ingredient.quantity
                    )

    # ✅ Generate image for manual meals not in DB
    if meal_in.source == "manual":
        matching_recipe = (
            db.query(Recipe)
            .filter(Recipe.title.ilike(meal_in.description))
            .first()
        )
        if not matching_recipe:
            from app.services.meal_image_service import get_or_generate_meal_image
            image_url = await get_or_generate_meal_image(meal_in.description, db)
            if image_url:
                meal.image_url = image_url

    db.commit()
    db.refresh(meal)
    return meal

@router.post("/{user_id}/log/backdate", response_model=MealLogResponse)
async def backdate_meal_log(
    user_id: str,
    payload: BackdateMealLogCreate,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    meal_log = LoggedMeal(
        user_id=user_id,
        description=payload.description,
        meal_slot=payload.meal_slot,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        logged_at=payload.logged_at,
        source="backdate",
        status="logged",
    )
    db.add(meal_log)
    db.commit()
    db.refresh(meal_log)
    return MealLogResponse.from_orm_safe(meal_log)

@router.get("/{user_id}/log/history", response_model=List[LoggedMealResponse])
def get_logged_meals(
    user_id: UUID,
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    status: Optional[str] = Query(None, description="Filter by status: 'logged' or 'planned'. Omit for all."),
    db: Session = Depends(get_db),
):
    """
    Returns meal logs. 
    - Pass ?status=logged to exclude planned meals (used by nutrition page)
    - Pass ?status=planned to see only future planned meals
    - Omit status to get everything (used by calendar)
    Auto-converts due planned meals to logged on every call.
    """
    # Auto-convert any planned meals whose date has arrived
    auto_convert_planned_meals(str(user_id), db)

    query = db.query(LoggedMeal).filter_by(user_id=user_id)

    if status:
        query = query.filter(LoggedMeal.status == status)
    if from_date:
        query = query.filter(LoggedMeal.logged_at >= from_date)
    if to_date:
        query = query.filter(LoggedMeal.logged_at <= to_date)

    return query.order_by(LoggedMeal.logged_at.desc()).offset(offset).limit(limit).all()

@router.delete("/{user_id}/log/{meal_id}")
def delete_logged_meal(
    user_id: UUID,
    meal_id: UUID,
    db: Session = Depends(get_db),
):
    """
    Hard-deletes a logged or planned meal.
    - Logged meals: restores pantry if description matches a recipe
    - Planned meals: removes any grocery items that were added for this meal
    """
    meal = db.query(LoggedMeal).filter_by(id=meal_id, user_id=user_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Logged meal not found")

    restored_pantry = False

    if meal.status == "logged":
        # Restore pantry ingredients if recipe match found
        matching_recipe = (
            db.query(Recipe)
            .filter(Recipe.title.ilike(meal.description))
            .first()
        )
        if matching_recipe and hasattr(matching_recipe, "ingredients"):
            pantry_items = db.query(PantryItem).filter_by(user_id=user_id).all()
            pantry_map = {p.ingredient_name.lower(): p for p in pantry_items}
            for ingredient in matching_recipe.ingredients:
                pantry_item = pantry_map.get(ingredient.ingredient_name.lower())
                if pantry_item and ingredient.quantity is not None:
                    pantry_item.quantity = (pantry_item.quantity or 0) + ingredient.quantity
            db.flush()
            restored_pantry = True

    elif meal.status == "planned":
        # Remove grocery items that were added for this planned meal
        # Find standalone grocery list and remove matching ingredient
        matching_recipe = (
            db.query(Recipe)
            .filter(Recipe.title.ilike(meal.description))
            .first()
        )
        if matching_recipe and hasattr(matching_recipe, "ingredients"):
            ingredient_names = {i.ingredient_name.lower() for i in matching_recipe.ingredients}
            grocery_list = (
                db.query(GroceryList)
                .filter(
                    GroceryList.user_id == user_id,
                    GroceryList.meal_plan_id == None,
                )
                .first()
            )
            if grocery_list:
                items_to_remove = [
                    item for item in grocery_list.items
                    if item.ingredient_name.lower() in ingredient_names
                    and not item.is_checked  # don't remove already-purchased items
                ]
                for item in items_to_remove:
                    db.delete(item)

    db.delete(meal)
    db.commit()

    return {
        "message": "Meal removed",
        "restored_pantry": restored_pantry,
        "was_planned": meal.status == "planned",
    }

# ── MealPlan CRUD routes ──────────────────────────────────────────────────────

@router.post("/{user_id}", response_model=MealPlanResponse)
def create_meal_plan(user_id: UUID, plan_in: MealPlanCreate, db: Session = Depends(get_db)):
    week_start = plan_in.week_start
    if plan_in.plan_type == "on_demand":
        week_start = date.today()

    existing = db.query(MealPlan).filter_by(user_id=user_id, week_start=week_start).first()
    if existing and plan_in.plan_type != "on_demand":
        raise HTTPException(status_code=400, detail="Meal plan already exists for this week")

    plan = MealPlan(user_id=user_id, week_start=week_start, plan_type=plan_in.plan_type, status="active")
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
def get_meal_plans(user_id: UUID, status: Optional[str] = Query(None), db: Session = Depends(get_db)):
    q = db.query(MealPlan).options(joinedload(MealPlan.slots)).filter_by(user_id=user_id)
    if status:
        q = q.filter(MealPlan.status == status)
    return q.order_by(MealPlan.week_start.desc()).all()

@router.get("/{user_id}/{plan_id}", response_model=MealPlanResponse)
def get_meal_plan(user_id: UUID, plan_id: UUID, db: Session = Depends(get_db)):
    plan = db.query(MealPlan).options(joinedload(MealPlan.slots)).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    return plan

@router.patch("/{user_id}/{plan_id}/slots/{slot_id}", response_model=MealPlanSlotResponse)
def update_slot(user_id: UUID, plan_id: UUID, slot_id: UUID, slot_in: MealPlanSlotUpdate, db: Session = Depends(get_db)):
    plan = db.query(MealPlan).filter_by(id=plan_id, user_id=user_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    slot = db.query(MealPlanSlot).filter_by(id=slot_id, meal_plan_id=plan_id).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot_in.recipe_id:
        recipe = db.query(Recipe).filter_by(id=slot_in.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
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