import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const {
      householdSize,
      budget,
      dietaryRestrictions,
      healthGoals,
      currentPantry,
      recentPurchases,
      recipeIngredients,
    } = await req.json();

    const prompt = `You are a smart grocery shopping assistant.

    Household info:
    - Family size: ${householdSize} people
    - Weekly budget: $${budget || "flexible"}
    - Dietary restrictions: ${dietaryRestrictions?.join(", ") || "none"}
    - Health goals: ${healthGoals?.join(", ") || "none"}

    Currently in pantry (DO NOT suggest these):
    ${currentPantry || "nothing"}

    Recently purchased (avoid repeating unless needed):
    ${recentPurchases || "nothing"}

    Ingredients needed for meal plan recipes:
    ${recipeIngredients || "no meal plan"}

    Suggest a practical grocery list. Rules:
    1. DO NOT include items already in pantry
    2. Include ingredients needed for recipes that are missing from pantry
    3. Add staples that a family of ${householdSize} would need weekly
    4. Consider dietary restrictions and health goals
    5. Keep within budget where possible
    6. Suggest practical quantities scaled for ${householdSize} people
    7. Give a short reason why each item is needed

    Return ONLY a JSON array, no markdown:
    [
      {"ingredient_name": "eggs", "category": "Dairy & Eggs", "reason": "needed for breakfast recipes", "suggested_qty": 12, "suggested_unit": "pieces"},
      {"ingredient_name": "olive oil", "category": "Pantry Staples", "reason": "cooking staple", "suggested_qty": 1, "suggested_unit": "bottle"},
      {"ingredient_name": "spinach", "category": "Produce", "reason": "used in multiple recipes", "suggested_qty": 200, "suggested_unit": "g"}
    ]

    Categories to use: Produce, Dairy & Eggs, Meat & Seafood, Pantry Staples, Grains & Bread, Frozen, Beverages, Snacks`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const clean = text.replace(/```json|```/g, "").trim();
    const items = JSON.parse(clean);

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Generate grocery error:", err);
    return NextResponse.json({ items: [] }, { status: 500 });
  }
}