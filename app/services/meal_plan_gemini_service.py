"""
app/services/gemini_service.py

Central service for all Gemini AI calls.
Import and call these functions from your routers — never call Gemini directly in a router.
"""

import os
import json
import httpx
from typing import Optional
from app.core.config import settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-3-flash-preview"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={settings.gemini_api_key}"
)


async def _call_gemini(prompt: str) -> str:
    """
    Low-level helper — sends a prompt to Gemini and returns the raw text response.
    Raises on HTTP errors or empty responses.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            GEMINI_URL,
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        res.raise_for_status()
        data = res.json()

    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    if not text:
        raise ValueError("Empty response from Gemini")
    return text


def _parse_json(text: str) -> dict | list:
    """Strip markdown fences and parse JSON from Gemini response."""
    clean = text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


# ── 1. Meal Plan Generation ────────────────────────────────────────────────────

async def generate_meal_plan(
    preferences: dict,
    pantry_items: str,
    recipes: list[dict],
    meal_slots: list[str],
) -> dict:
    """
    Given user preferences, pantry, and available recipes,
    returns a dict of { slot: [recipe_id, recipe_id, recipe_id] }.
    """
    # Build enriched recipe list with all useful columns
    recipe_lines = []
    for r in recipes:
        tags = ", ".join(r.get("tags") or []) or "none"
        line = (
            f'- id: "{r["id"]}"'
            f' | title: "{r["title"]}"'
            f' | meal_type: {r.get("meal_type") or "any"}'
            f' | calories: {r.get("calories") or "?"}'
            f' | protein_g: {r.get("protein_g") or "?"}'
            f' | carbs_g: {r.get("carbs_g") or "?"}'
            f' | fat_g: {r.get("fat_g") or "?"}'
            f' | prep_mins: {r.get("prep_time_mins") or "?"}'
            f' | tags: [{tags}]'
        )
        recipe_lines.append(line)

    recipe_list = "\n".join(recipe_lines)

    prompt = f"""You are a meal planning assistant. Select 3 recipe options for each meal slot.

User preferences:
- Dietary restrictions: {", ".join(preferences.get("dietary_restrictions", [])) or "none"}
- Health goals: {", ".join(preferences.get("health_goals", [])) or "none"}
- Ingredient dislikes: {", ".join(preferences.get("ingredient_dislikes", [])) or "none"}
- Available pantry items: {pantry_items or "unknown"}
- Meal slots: {", ".join(meal_slots)}

Available recipes:
{recipe_list}

Rules:
- You MUST return exactly 3 recipe IDs per slot.
- Use ONLY recipe IDs from the list above — do not invent IDs.
- Do NOT repeat the same recipe across different slots.
- meal_type is a soft hint only — do not filter strictly by it. A lunch recipe can appear at dinner if it fits.
- Prioritize recipes whose tags match dietary restrictions (e.g. "vegan", "gluten-free").
- Prioritize recipes that use pantry items.
- Avoid recipes with disliked ingredients in the title or tags.
- If health goal is "high protein", prefer recipes with higher protein_g.
- If health goal is "low carb", prefer recipes with lower carbs_g.
- If no perfect match exists, pick the closest available recipe — always return 3 IDs per slot.
- Only include slots from: {", ".join(meal_slots)}

Return ONLY valid JSON, no markdown, no explanation:
{{
    "breakfast": ["id1", "id2", "id3"],
    "lunch": ["id1", "id2", "id3"],
    "dinner": ["id1", "id2", "id3"]
}}"""

    text = await _call_gemini(prompt)
    result = _parse_json(text)
    return result if isinstance(result, dict) else {}


# ── 2. Macro Estimation ────────────────────────────────────────────────────────

async def estimate_macros(
    description: str,
    meal_slot: Optional[str],
    similar_recipes: list[dict],
) -> dict:
    """
    Estimates calories, protein, carbs, and fat for a free-text meal description.

    similar_recipes: list of recipes from your DB that are semantically close
    to the description (pass top 5 by title similarity — or just pass all recipes
    and let Gemini pick the closest ones as reference).

    Returns: { calories, protein_g, carbs_g, fat_g, estimated: True }
    """
    recipe_context = ""
    if similar_recipes:
        recipe_context = "\n\nFor reference, here are similar meals from our database:\n" + "\n".join(
            f'- "{r["title"]}": {r.get("calories") or "?"}kcal, '
            f'protein {r.get("protein_g") or "?"}g, '
            f'carbs {r.get("carbs_g") or "?"}g, '
            f'fat {r.get("fat_g") or "?"}g'
            for r in similar_recipes[:8]
        )

    prompt = f"""You are a nutrition expert. Estimate the macronutrients for this meal.

Meal: "{description}"
Meal slot / time of day: {meal_slot or "unknown"}
{recipe_context}

Instructions:
- Give a realistic estimate for a typical single serving/portion.
- Use the reference meals above to calibrate if they are similar.
- If the meal is vague (e.g. "salad"), assume a common restaurant-style portion.
- Round calories to nearest 5, macros to nearest 0.5g.

Return ONLY a valid JSON object, no markdown, no explanation:
{{
    "calories": 450,
    "protein_g": 32.5,
    "carbs_g": 48.0,
    "fat_g": 12.5
}}"""

    text = await _call_gemini(prompt)
    result = _parse_json(text)

    # Validate all keys are present and numeric
    required = ["calories", "protein_g", "carbs_g", "fat_g"]
    for key in required:
        if key not in result or not isinstance(result[key], (int, float)):
            raise ValueError(f"Missing or invalid key in Gemini response: {key}")

    return {
        "calories": round(float(result["calories"]), 1),
        "protein_g": round(float(result["protein_g"]), 1),
        "carbs_g": round(float(result["carbs_g"]), 1),
        "fat_g": round(float(result["fat_g"]), 1),
        "estimated": True,  # flag so frontend can show "AI estimated" badge
    }