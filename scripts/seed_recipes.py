import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx
import time
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.recipe import Recipe, RecipeIngredient
from app.core.config import settings

MEAL_TYPES = {
    "dinner": 50,
    "lunch": 25,
}

BASE_URL = "https://api.spoonacular.com"


def fetch_recipes_by_meal_type(meal_type: str, number: int, offset:int = 150) -> list:
    params = {
        "apiKey": settings.SPOONACULAR_API_KEY,
        "type": meal_type,
        "number": number,
        "offset": offset,
        "addRecipeInformation": False,
    }
    response = httpx.get(f"{BASE_URL}/recipes/complexSearch", params=params)
    response.raise_for_status()
    results = response.json().get("results", [])
    print(f"  Found {len(results)} {meal_type} recipes")
    return [r["id"] for r in results]


def fetch_recipe_detail(spoonacular_id: int) -> dict | None:
    params = {
        "apiKey": settings.SPOONACULAR_API_KEY,
        "includeNutrition": True,
    }
    try:
        response = httpx.get(
            f"{BASE_URL}/recipes/{spoonacular_id}/information",
            params=params
        )
        response.raise_for_status()
        return response.json()
    except httpx.HTTPStatusError as e:
        print(f"  Error fetching recipe {spoonacular_id}: {e}")
        return None


def extract_nutrition(nutrition_data: dict) -> dict:
    nutrients = {n["name"]: n["amount"] for n in nutrition_data.get("nutrients", [])}
    return {
        "calories": nutrients.get("Calories"),
        "protein_g": nutrients.get("Protein"),
        "carbs_g": nutrients.get("Carbohydrates"),
        "fat_g": nutrients.get("Fat"),
        "fiber_g": nutrients.get("Fiber"),
    }


def normalize_unit(unit: str) -> str:
    unit = unit.lower().strip()
    unit_map = {
        "ounce": "oz",
        "ounces": "oz",
        "pound": "lb",
        "pounds": "lb",
        "tablespoon": "tbsp",
        "tablespoons": "tbsp",
        "teaspoon": "tsp",
        "teaspoons": "tsp",
        "milliliter": "ml",
        "milliliters": "ml",
        "liter": "l",
        "liters": "l",
        "gram": "g",
        "grams": "g",
        "kilogram": "kg",
        "kilograms": "kg",
        "cup": "cup",
        "cups": "cup",
        "piece": "piece",
        "pieces": "piece",
        "slice": "slice",
        "slices": "slice",
    }
    return unit_map.get(unit, unit)


def extract_instructions(data: dict) -> str | None:
    analyzed = data.get("analyzedInstructions", [])
    if analyzed:
        steps = analyzed[0].get("steps", [])
        return " ".join(
            f"Step {s['number']}: {s['step']}" for s in steps
        )
    return data.get("instructions") or None


def seed_recipe(db: Session, data: dict, meal_type: str) -> bool:
    spoonacular_id = data.get("id")
    if not spoonacular_id:
        return False

    existing = db.query(Recipe).filter_by(spoonacular_id=spoonacular_id).first()
    if existing:
        print(f"  Skipping duplicate: {data.get('title')}")
        return False

    nutrition = extract_nutrition(data.get("nutrition", {}))
    tags = []
    if data.get("vegetarian"):
        tags.append("vegetarian")
    if data.get("vegan"):
        tags.append("vegan")
    if data.get("glutenFree"):
        tags.append("gluten-free")
    if data.get("dairyFree"):
        tags.append("dairy-free")
    if data.get("veryHealthy"):
        tags.append("healthy")
    if data.get("cheap"):
        tags.append("budget")
    if data.get("readyInMinutes", 60) <= 30:
        tags.append("quick")

    recipe = Recipe(
        spoonacular_id=spoonacular_id,
        title=data.get("title", "Untitled"),
        meal_type=meal_type,
        prep_time_mins=data.get("readyInMinutes"),
        servings=data.get("servings", 1),
        instructions=extract_instructions(data),
        image_url=data.get("image"),
        tags=tags,
        **nutrition,
    )
    db.add(recipe)
    db.flush()

    for ing in data.get("extendedIngredients", []):
        ingredient = RecipeIngredient(
            recipe_id=recipe.id,
            ingredient_name=ing.get("nameClean") or ing.get("name", "").lower().strip(),
            quantity=ing.get("amount"),
            unit=normalize_unit(ing.get("unit", "")),
        )
        db.add(ingredient)

    return True


def run():
    db: Session = SessionLocal()
    total_inserted = 0

    try:
        for meal_type, count in MEAL_TYPES.items():
            print(f"\nSeeding {meal_type} recipes...")
            ids = fetch_recipes_by_meal_type(meal_type, count)

            for i, spoonacular_id in enumerate(ids):
                print(f"  [{i+1}/{len(ids)}] Fetching recipe {spoonacular_id}...")
                data = fetch_recipe_detail(spoonacular_id)

                if data:
                    inserted = seed_recipe(db, data, meal_type)
                    if inserted:
                        total_inserted += 1
                        db.commit()

                time.sleep(0.5)

        print(f"\nDone! {total_inserted} recipes seeded successfully.")

    except Exception as e:
        db.rollback()
        print(f"\nError: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()