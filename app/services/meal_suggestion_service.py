"""
app/services/meal_suggestion_service.py

Rule-based meal suggestion engine with Gemini AI fallback.
Tags are used as the PRIMARY signal for filtering and scoring.
Title keyword matching is a secondary fallback only.
"""

import random
from typing import Optional
from sqlalchemy.orm import Session
from app.models.recipe import Recipe
from app.models.user import PantryItem

SLOT_TO_MEAL_TYPE = {
    "breakfast": ["breakfast"],
    "lunch": ["lunch"],
    "dinner": ["dinner"],
    "snack": ["snack"],
}


def score_recipe(
    recipe: Recipe,
    preferences: dict,
    pantry_names: set[str],
    already_used_ids: set[str],
) -> Optional[float]:
    """
    Returns a score for the recipe, or None if it should be excluded.
    Higher score = better match.
    Tags are the primary signal — title keywords are secondary fallback.
    """
    recipe_id = str(recipe.id)

    if recipe_id in already_used_ids:
        return None

    title_lower = recipe.title.lower()
    # Tags are already a Python list from PostgreSQL ARRAY column
    tags = set(t.lower() for t in (recipe.tags or []))

    dietary = [d.lower() for d in preferences.get("dietary_restrictions", [])]
    dislikes = [d.lower() for d in preferences.get("ingredient_dislikes", [])]
    goals = [g.lower() for g in preferences.get("health_goals", [])]

    # ── Hard excludes — dietary restrictions are MANDATORY ───────────────────
    # Tags are the primary signal. Title keywords are secondary safety net.
    # A recipe MUST have the required tag to pass — no exceptions.

    if "vegetarian" in dietary:
        # Must have vegetarian OR vegan tag
        if "vegetarian" not in tags and "vegan" not in tags:
            return None

    if "vegan" in dietary:
        # Must have vegan tag — vegetarian is not enough
        if "vegetarian" not in tags and "dairy-free" not in tags:
            return None

    if "gluten-free" in dietary:
        # Must have gluten-free tag
        if "gluten-free" not in tags:
            return None

    if "dairy-free" in dietary:
        # Must have dairy-free tag
        if "dairy-free" not in tags:
            return None

    if "keto" in dietary:
        # No keto tag in DB — fall back to title keyword exclusion
        high_carb = ["pasta", "rice", "bread", "potato", "oat",
                    "pancake", "waffle", "muffin", "cake", "noodle"]
        if any(kw in title_lower for kw in high_carb):
            return None

    if "halal" in dietary:
        if "halal" not in tags:
            # Exclude obvious non-halal by title
            pork_keywords = ["pork", "bacon", "ham", "lard", "prosciutto"]
            if any(kw in title_lower for kw in pork_keywords):
                return None

    if "kosher" in dietary:
        if "kosher" not in tags:
            non_kosher = ["pork", "bacon", "ham", "shrimp", "lobster", "crab"]
            if any(kw in title_lower for kw in non_kosher):
                return None

    if "nut-free" in dietary:
        nut_keywords = ["almond", "walnut", "pecan", "cashew", "pistachio",
                        "hazelnut", "peanut", "nut"]
        if any(kw in title_lower for kw in nut_keywords):
            return None
        if any(kw in tags for kw in nut_keywords):
            return None

    # Ingredient dislikes — check both title and tags
    for dislike in dislikes:
        if dislike in title_lower:
            return None
        if dislike in tags:
            return None

    # ── Scoring ───────────────────────────────────────────────────────────────
    score = 1.0

    # ★ Primary: tag matches dietary restrictions (strongest signal)
    for restriction in dietary:
        if restriction in tags:
            score += 3.0  # Strong boost for explicit tag match

    # ★ Primary: tag matches health goals
    if "healthy" in tags:
        if any(g in goals for g in ["weight loss", "heart health", "maintain weight"]):
            score += 2.5
        else:
            score += 1.0  # general bonus

    if "quick" in tags:
        score += 0.8  # convenience bonus

    if "budget" in tags:
        score += 0.3

    # ★ Secondary: macro-based scoring for health goals
    if "high protein" in goals and recipe.protein_g:
        if recipe.protein_g >= 35:
            score += 3.0
        elif recipe.protein_g >= 25:
            score += 2.0
        elif recipe.protein_g >= 15:
            score += 1.0

    if "muscle gain" in goals and recipe.protein_g:
        if recipe.protein_g >= 40:
            score += 3.0
        elif recipe.protein_g >= 30:
            score += 2.0

    if "low carb" in goals and recipe.carbs_g is not None:
        if recipe.carbs_g <= 15:
            score += 3.0
        elif recipe.carbs_g <= 30:
            score += 2.0
        elif recipe.carbs_g <= 45:
            score += 1.0

    if "weight loss" in goals and recipe.calories:
        if recipe.calories <= 350:
            score += 2.5
        elif recipe.calories <= 500:
            score += 1.5
        elif recipe.calories <= 650:
            score += 0.5

    if "high fiber" in goals and recipe.fiber_g:
        if recipe.fiber_g >= 10:
            score += 2.5
        elif recipe.fiber_g >= 6:
            score += 1.5

    if "heart health" in goals:
        if "healthy" in tags:
            score += 2.0
        if recipe.fat_g and recipe.fat_g <= 15:
            score += 1.0

    if "maintain weight" in goals and recipe.calories:
        if 400 <= recipe.calories <= 700:
            score += 1.5

    # ★ Pantry bonus — check title words against pantry ingredient names
    title_words = set(title_lower.split())
    pantry_overlap = title_words & pantry_names
    score += len(pantry_overlap) * 2.0  # strong pantry bonus

    # Small random tiebreaker for variety on refresh
    score += random.uniform(0, 0.5)

    return score


def get_rule_based_suggestions(
    db: Session,
    preferences: dict,
    meal_slots: list[str],
    locked_recipe_ids: dict[str, list[str]],
    n_per_slot: int = 3,
) -> dict[str, list[str]]:
    """
    Returns { slot: [recipe_id, ...] } using rule-based tag-aware scoring.
    Locked recipes (already logged) are preserved and not replaced.
    """
    all_recipes = db.query(Recipe).all()

    # Fetch pantry for this user
    user_id = preferences.get("user_id")
    pantry_names: set[str] = set()
    if user_id:
        pantry_items = db.query(PantryItem).filter(
            PantryItem.user_id == user_id
        ).all()
        pantry_names = {p.ingredient_name.lower() for p in pantry_items}

    result: dict[str, list[str]] = {}
    used_ids: set[str] = set()

    # Pre-mark all locked IDs as used so they don't appear in other slots
    for slot, locked_ids in locked_recipe_ids.items():
        for lid in locked_ids:
            used_ids.add(lid)

    for slot in meal_slots:
        locked = locked_recipe_ids.get(slot, [])
        needed = n_per_slot - len(locked)

        if needed <= 0:
            result[slot] = locked[:n_per_slot]
            continue

        # Score all eligible recipes for this slot
        scored = []
        allowed_types = SLOT_TO_MEAL_TYPE.get(slot, [slot])
        for recipe in all_recipes:
            rid = str(recipe.id)
            if rid in locked:
                continue
            # Skip if meal_type doesn't match this slot
            if recipe.meal_type and recipe.meal_type.lower() not in allowed_types:
                continue
            s = score_recipe(recipe, preferences, pantry_names, used_ids)
            if s is not None:
                scored.append((s, rid))

        scored.sort(key=lambda x: x[0], reverse=True)

        # Take top N candidates (3x the needed amount) and shuffle for variety
        top_candidates = scored[:needed * 3]
        random.shuffle(top_candidates)
        picked = [rid for _, rid in top_candidates[:needed]]
        for rid in picked:
            used_ids.add(rid)

        result[slot] = locked + picked

    return result


async def fill_with_ai_fallback(
    db: Session,
    partial_result: dict[str, list[str]],
    preferences: dict,
    meal_slots: list[str],
    n_per_slot: int = 3,
) -> dict[str, list[str]]:
    """
    Fills slots that rule-based engine couldn't complete (< n_per_slot recipes).
    Only called when needed — AI is the fallback, not the primary.
    """
    from app.services.meal_plan_gemini_service import generate_meal_plan

    slots_needing_fill = {
        slot: n_per_slot - len(partial_result.get(slot, []))
        for slot in meal_slots
        if len(partial_result.get(slot, [])) < n_per_slot
    }

    if not slots_needing_fill:
        return partial_result

    already_used = {rid for ids in partial_result.values() for rid in ids}
    all_recipes = db.query(Recipe).all()

    recipe_dicts = [
        {
            "id": str(r.id),
            "title": r.title,
            "meal_type": r.meal_type,
            "calories": r.calories,
            "protein_g": r.protein_g,
            "carbs_g": r.carbs_g,
            "fat_g": r.fat_g,
            "prep_time_mins": r.prep_time_mins,
            "tags": r.tags or [],
        }
        for r in all_recipes
        if str(r.id) not in already_used
    ]

    if not recipe_dicts:
        return partial_result

    try:
        ai_suggestions = await generate_meal_plan(
            preferences=preferences,
            pantry_items="",
            recipes=recipe_dicts,
            meal_slots=list(slots_needing_fill.keys()),
        )

        filled_result = dict(partial_result)
        ai_used: set[str] = set()

        for slot, needed_count in slots_needing_fill.items():
            ai_ids = ai_suggestions.get(slot, [])
            current = list(filled_result.get(slot, []))
            current_set = set(current)
            added = 0

            for ai_id in ai_ids:
                if added >= needed_count:
                    break
                if ai_id not in current_set and ai_id not in ai_used and ai_id not in already_used:
                    current.append(ai_id)
                    current_set.add(ai_id)
                    ai_used.add(ai_id)
                    added += 1

            filled_result[slot] = current

        return filled_result

    except Exception as e:
        print(f"AI fallback failed: {e}")
        return partial_result


async def get_meal_suggestions(
    db: Session,
    preferences: dict,
    meal_slots: list[str],
    locked_recipe_ids: dict[str, list[str]],
    n_per_slot: int = 3,
) -> dict[str, list[str]]:
    """
    Main entry point.
    1. Rule-based engine using tags + macros + pantry
    2. AI fallback only if gaps remain
    """
    rule_result = get_rule_based_suggestions(
        db=db,
        preferences=preferences,
        meal_slots=meal_slots,
        locked_recipe_ids=locked_recipe_ids,
        n_per_slot=n_per_slot,
    )

    needs_fallback = any(
        len(rule_result.get(slot, [])) < n_per_slot
        for slot in meal_slots
    )

    if needs_fallback:
        print("Rule-based gaps found — calling AI fallback")
        return await fill_with_ai_fallback(
            db=db,
            partial_result=rule_result,
            preferences=preferences,
            meal_slots=meal_slots,
            n_per_slot=n_per_slot,
        )

    return rule_result