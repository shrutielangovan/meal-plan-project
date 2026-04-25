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
        tags: r.tags,
      }));
    }
  } catch (err) {
    console.log("DB fetch failed, falling back to Spoonacular");
  }

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
  if (["recipe", "cook", "make", "ingredients", "meal", "dish", "food with", "using", "what should i eat", "suggest"].some((k) => lower.includes(k))) return "recipe";
  if (["nutrition", "calories", "macros", "protein", "carbs", "fat", "nutrients", "how much"].some((k) => lower.includes(k))) return "nutrition";
  if (["pantry", "have at home", "what do i have", "ingredients i have"].some((k) => lower.includes(k))) return "pantry";
  if (["grocery", "shopping", "buy", "purchase"].some((k) => lower.includes(k))) return "grocery";
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

    // Fetch recipe/nutrition context based on intent
    let contextData = "";
    if (intent === "recipe") {
      const recipes = await searchRecipes(lastMessage);
      if (recipes.length > 0) {
        contextData = `Real recipes from our database:\n${recipes
          .map((r: any) =>
            `- ${r.title} (uses: ${r.usedIngredients}${r.missedIngredients ? `, missing: ${r.missedIngredients}` : ""}${r.calories ? `, ~${r.calories} cal` : ""}${r.prepTime ? `, ${r.prepTime} mins` : ""}${r.tags?.length ? `, tags: ${r.tags.join(", ")}` : ""})`
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

    // Fetch ALL user context if logged in
    let userContext = "";
    if (userId) {
      try {
        // Fetch everything in parallel
        const [
          userRes,
          prefRes,
          pantryRes,
          logRes,
          planRes,
        ] = await Promise.all([
          fetch(`${BACKEND_URL}/api/users/${userId}`),
          fetch(`${BACKEND_URL}/api/users/${userId}/preferences`),
          fetch(`${BACKEND_URL}/api/pantry/${userId}`),
          fetch(`${BACKEND_URL}/api/meal-plans/${userId}/log/history`),
          fetch(`${BACKEND_URL}/api/meal-plans/${userId}`),
        ]);

        const [user, prefs, pantry, logs, plans] = await Promise.all([
          userRes.json(),
          prefRes.json(),
          pantryRes.json(),
          logRes.json(),
          planRes.json(),
        ]);

        // Today's nutrition totals
        const today = new Date().toDateString();
        const todayLogs = Array.isArray(logs)
          ? logs.filter((m: any) => new Date(m.logged_at).toDateString() === today)
          : [];

        const totals = {
          calories: todayLogs.reduce((s: number, m: any) => s + (m.calories || 0), 0),
          protein: todayLogs.reduce((s: number, m: any) => s + (m.protein_g || 0), 0),
          carbs: todayLogs.reduce((s: number, m: any) => s + (m.carbs_g || 0), 0),
          fat: todayLogs.reduce((s: number, m: any) => s + (m.fat_g || 0), 0),
        };

        // Pantry items
        const pantryList = Array.isArray(pantry)
          ? pantry.map((p: any) => `${p.ingredient_name}${p.quantity ? ` (${p.quantity} ${p.unit || ""})` : ""}`).join(", ")
          : "empty";

        // Expiring soon
        const expiringSoon = Array.isArray(pantry)
          ? pantry.filter((p: any) => {
              if (!p.expires_at) return false;
              const diff = new Date(p.expires_at).getTime() - Date.now();
              return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
            }).map((p: any) => p.ingredient_name)
          : [];

        // Active meal plan slots
        const activePlan = Array.isArray(plans) && plans.length > 0 ? plans[0] : null;
        const plannedMeals = activePlan?.slots
          ?.filter((s: any) => s.recipe_id)
          .map((s: any) => `${s.meal_slot} (day ${s.day_of_week})`)
          .join(", ") || "no active plan";

        userContext = `
        USER PROFILE:
        - Name: ${user.name || "User"}
        - Household size: ${user.household_size || 1} people
        - Weekly budget: $${user.budget_weekly || "flexible"}
        - Max cooking time: ${user.cooking_time_mins || "flexible"} mins

        DIETARY PREFERENCES:
        - Restrictions: ${prefs.dietary_restrictions?.join(", ") || "none"}
        - Health goals: ${prefs.health_goals?.join(", ") || "none"}
        - Dislikes: ${prefs.ingredient_dislikes?.join(", ") || "none"}

        PANTRY (what they have at home):
        ${pantryList || "empty pantry"}
        ${expiringSoon.length > 0 ? `⚠️ Expiring soon: ${expiringSoon.join(", ")}` : ""}

        TODAY'S NUTRITION (${today}):
        - Calories: ${Math.round(totals.calories)}/2000 kcal (${Math.round(2000 - totals.calories)} kcal remaining)
        - Protein: ${Math.round(totals.protein)}/150g (${Math.round(150 - totals.protein)}g remaining)
        - Carbs: ${Math.round(totals.carbs)}/250g
        - Fat: ${Math.round(totals.fat)}/65g
        - Meals logged: ${todayLogs.map((m: any) => m.description).join(", ") || "none yet"}

        MEAL PLAN:
        - Planned slots: ${plannedMeals}`;

      } catch (e) {
        console.log("Could not fetch user context:", e);
      }
    }

    // Create session if needed
    let sessionId = existingSessionId;
    if (userId && !sessionId) {
      sessionId = await createSession(userId, "NutriSync Chat");
    }

    // Save user message
    if (userId && sessionId) {
      await saveMessage(userId, sessionId, "user", lastMessage, intent);
    }

    // Build Gemini messages
    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Call Gemini with full context
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: `You are NutriSync's personal AI nutrition assistant. You have full access to the user's data and can give highly personalized advice.

            Your capabilities:
            - Suggest recipes based on what's in their pantry
            - Warn about ingredients expiring soon
            - Track daily nutrition progress and suggest meals to hit goals
            - Recommend grocery items based on their meal plan
            - Give advice based on their dietary restrictions and health goals
            - Help with meal planning within their budget and cooking time

            Always be personal, use their name when appropriate, and reference their actual data.
            Keep responses concise, friendly and actionable.

            ${userContext ? `\n${userContext}` : ""}
            ${contextData ? `\nRELEVANT RECIPE/NUTRITION DATA:\n${contextData}` : ""}`
                      }]
                    },
                    contents: geminiMessages,
                  }),
                });

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry I couldn't respond, please try again.";

    // Save assistant reply
    if (userId && sessionId) {
      await saveMessage(userId, sessionId, "assistant", reply, intent);
    }

    return NextResponse.json({ reply, sessionId });

  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json({ reply: "Sorry, something went wrong." }, { status: 500 });
  }
}