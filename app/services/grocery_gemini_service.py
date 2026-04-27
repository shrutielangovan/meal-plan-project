import httpx
import json
from app.core.config import settings

GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent?key={settings.gemini_api_key}"
)

async def _call_gemini(prompt: str) -> str:
    """Low-level Gemini call — returns raw text response."""
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            GEMINI_URL,
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        res.raise_for_status()
        data = res.json()

    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    if not text:
        raise ValueError("Empty response from Gemini")
    return text


def _parse_json(text: str) -> list:
    """Strip markdown fences and parse JSON array."""
    clean = text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)

async def generate_grocery_suggestions(
    household_size: int,
    budget: float | None,
    dietary_restrictions: list[str],
    health_goals: list[str],
    current_pantry: str,
    recent_purchases: str,
    missing_recipe_ingredients: list[dict],  # [{ name, qty, unit }]
) -> list[dict]:
    """
    Generates AI grocery suggestions based on:
    - Missing recipe ingredients (primary — these MUST be included)
    - Household staples
    - Dietary restrictions and health goals
    - Pantry exclusions

    Returns list of:
    {
        ingredient_name, category, reason,
        suggested_qty, suggested_unit
    }
    """
    # Format missing ingredients for the prompt
    missing_list = "\n".join(
        f"- {i['name']}: {i.get('qty', '?')} {i.get('unit', '')}"
        for i in missing_recipe_ingredients
    ) or "none"

    prompt = f"""You are a smart grocery shopping assistant.

Household info:
- Family size: {household_size} people
- Weekly budget: ${budget or "flexible"}
- Dietary restrictions: {", ".join(dietary_restrictions) or "none"}
- Health goals: {", ".join(health_goals) or "none"}

Currently in pantry (DO NOT suggest these):
{current_pantry or "nothing"}

Recently purchased (avoid repeating unless needed):
{recent_purchases or "nothing"}

Ingredients MISSING from pantry that are needed for planned recipes (MUST include all of these):
{missing_list}

Rules:
1. ALWAYS include ALL the missing recipe ingredients listed above
2. DO NOT include items already in pantry
3. Add weekly staples a family of {household_size} would need
4. Respect dietary restrictions strictly
5. Keep within budget where possible
6. Give a short reason why each item is needed
7. Scale quantities for {household_size} people
8. NEVER include water or plain drinking water in the list
9. ALWAYS assign a category to EVERY item — never leave category null or empty

Categories you MUST choose from (use EXACTLY these strings):
- Produce
- Dairy & Eggs
- Meat & Seafood
- Pantry Staples
- Grains & Bread
- Frozen
- Beverages
- Snacks
- Other

Return ONLY a valid JSON array, no markdown, no explanation:
[
    {{"ingredient_name": "eggs", "category": "Dairy & Eggs", "reason": "needed for breakfast recipes", "suggested_qty": 12, "suggested_unit": "pieces"}},
    {{"ingredient_name": "olive oil", "category": "Pantry Staples", "reason": "cooking staple", "suggested_qty": 1, "suggested_unit": "bottle"}},
    {{"ingredient_name": "spinach", "category": "Produce", "reason": "needed for dinner recipe", "suggested_qty": 2, "suggested_unit": "bags"}}
]

Every single item MUST have a category field matching exactly one of the categories listed above."""

    text = await _call_gemini(prompt)
    result = _parse_json(text)
    return result if isinstance(result, list) else []
