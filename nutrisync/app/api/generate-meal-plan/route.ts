import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const { preferences, pantryItems, recipes, mealSlots } = await req.json();

    const prompt = `You are a meal planning assistant. For each meal slot, suggest 3 different recipe options.

User preferences:
- Dietary restrictions: ${preferences.dietary_restrictions?.join(", ") || "none"}
- Health goals: ${preferences.health_goals?.join(", ") || "none"}
- Ingredient dislikes: ${preferences.ingredient_dislikes?.join(", ") || "none"}
- Available pantry items: ${pantryItems || "unknown"}
- Meal slots they eat: ${mealSlots.join(", ")}

Available recipes (use ONLY these recipe IDs):
${recipes.map((r: any) => `- id: "${r.id}", title: "${r.title}", calories: ${r.calories || "unknown"}`).join("\n")}

For each meal slot assign 3 different recipes. Do NOT worry about meal type matching.
Just pick recipes that suit the time of day generally and match user preferences.
Prioritize recipes that use pantry items.
Avoid recipes with disliked ingredients.
Make sure EVERY slot gets exactly 3 different recipe IDs.

Return ONLY a JSON object, no markdown:
{
  "breakfast": ["recipe-id-1", "recipe-id-2", "recipe-id-3"],
  "lunch": ["recipe-id-1", "recipe-id-2", "recipe-id-3"],
  "dinner": ["recipe-id-1", "recipe-id-2", "recipe-id-3"]
}

Only include slots from: ${mealSlots.join(", ")}
Only use recipe IDs from the list above.
Use different recipes for each slot — do not repeat the same recipe across slots.`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const clean = text.replace(/```json|```/g, "").trim();
    const suggestions = JSON.parse(clean);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Meal plan generation error:", err);
    return NextResponse.json({ suggestions: {} }, { status: 500 });
  }
}