import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY;
const USDA_API_KEY = process.env.USDA_API_KEY;
const BACKEND_URL = "http://localhost:8000";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

// Fetch recipes — DB first, Spoonacular fallback
async function searchRecipes(ingredients: string) {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/recipes/?query=${encodeURIComponent(ingredients)}`
    );
    const data = await res.json();
    if (data && data.length > 0) {
      console.log("Recipes found in DB ✅");
      return data.slice(0, 3).map((r: any) => ({
        title: r.title,
        usedIngredients: r.ingredients?.map((i: any) => i.ingredient_name).join(", ") || ingredients,
        missedIngredients: "",
        calories: r.calories,
        protein: r.protein_g,
        carbs: r.carbs_g,
        fat: r.fat_g,
        prepTime: r.prep_time_mins,
      }));
    }
  } catch (err) {
    console.log("DB fetch failed, falling back to Spoonacular");
  }

  // Fallback to Spoonacular
  console.log("Fetching from Spoonacular 🌐");
  const res = await fetch(
    `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(ingredients)}&number=3&apiKey=${SPOONACULAR_API_KEY}`
  );
  const data = await res.json();
  return data.map((r: any) => ({
    title: r.title,
    usedIngredients: r.usedIngredients.map((i: any) => i.name).join(", "),
    missedIngredients: r.missedIngredients.map((i: any) => i.name).join(", "),
  }));
}

// Fetch nutrition from USDA
async function searchNutrition(food: string) {
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(food)}&pageSize=1&api_key=${USDA_API_KEY}`
  );
  const data = await res.json();
  const item = data.foods?.[0];
  if (!item) return null;
  const nutrients = item.foodNutrients?.slice(0, 5).map((n: any) => ({
    name: n.nutrientName,
    amount: `${n.value} ${n.unitName}`,
  }));
  return { name: item.description, nutrients };
}

// Detect intent from user message
function detectIntent(message: string) {
  const lower = message.toLowerCase();
  if (["recipe", "cook", "make", "ingredients", "meal", "dish", "food with", "using"].some((k) => lower.includes(k))) return "recipe";
  if (["nutrition", "calories", "macros", "protein", "carbs", "fat", "nutrients"].some((k) => lower.includes(k))) return "nutrition";
  return "general";
}

// Create a new chat session in backend
async function createSession(userId: string, title: string) {
  const res = await fetch(`${BACKEND_URL}/api/chat/${userId}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = await res.json();
  return data.id;
}

// Save a message to backend
async function saveMessage(userId: string, sessionId: string, role: string, content: string, intent: string) {
  await fetch(`${BACKEND_URL}/api/chat/${userId}/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, content, intent }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userId, sessionId: existingSessionId } = await req.json();
    const lastMessage = messages[messages.length - 1].content;
    const intent = detectIntent(lastMessage);

    // Fetch context data based on intent
    let contextData = "";
    if (intent === "recipe") {
      const recipes = await searchRecipes(lastMessage);
      if (recipes.length > 0) {
        contextData = `Real recipes from our database:\n${recipes
          .map((r: any) =>
            `- ${r.title} (uses: ${r.usedIngredients}${r.missedIngredients ? `, missing: ${r.missedIngredients}` : ""}${r.calories ? `, ~${r.calories} cal` : ""}${r.prepTime ? `, ${r.prepTime} mins` : ""})`
          )
          .join("\n")}`;
      }
    } else if (intent === "nutrition") {
      const nutrition = await searchNutrition(lastMessage);
      if (nutrition) {
        contextData = `Nutrition data for ${nutrition.name}:\n${nutrition.nutrients
          .map((n: any) => `- ${n.name}: ${n.amount}`)
          .join("\n")}`;
      }
    }

    // Create session if logged in and no session exists yet
    let sessionId = existingSessionId;
    if (userId && !sessionId) {
      sessionId = await createSession(userId, "NutriSync Chat");
    }

    // Save user message to backend
    if (userId && sessionId) {
      await saveMessage(userId, sessionId, "user", lastMessage, intent);
    }

    // Build Gemini messages
    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Call Gemini
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: `You are NutriSync's AI nutrition assistant. Help users with meal planning, recipes, nutrition tracking, grocery lists and ingredient substitutions. Keep responses concise and friendly.
            ${contextData ? `Use this real data to answer:\n${contextData}` : ""}`
          }]
        },
        contents: geminiMessages,
      }),
    });

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry I couldn't respond, please try again.";

    // Save assistant reply to backend
    if (userId && sessionId) {
      await saveMessage(userId, sessionId, "assistant", reply, intent);
    }

    return NextResponse.json({ reply, sessionId });

  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ reply: "Sorry, something went wrong." }, { status: 500 });
  }
}