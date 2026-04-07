"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import RecipePanel from "./RecipePanel";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_SLOTS_OPTIONS = ["breakfast", "lunch", "dinner", "snack"];

const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "halal", "kosher", "nut-free"];
const HEALTH_GOALS_OPTIONS = ["weight loss", "muscle gain", "maintain weight", "heart health", "high protein", "low carb", "high fiber"];
const DISLIKES_OPTIONS = ["mushrooms", "onions", "garlic", "seafood", "spicy food", "cilantro", "olives", "tofu"];

type Recipe = {
  id: string;
  title: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  prep_time_mins: number | null;
  servings: number;
  instructions: string | null;
  image_url: string | null;
  meal_type: string;
  tags: string[];
  ingredients: { ingredient_name: string; quantity: number | null; unit: string | null }[];
};

type Preferences = {
  dietary_restrictions: string[];
  health_goals: string[];
  ingredient_dislikes: string[];
  meal_slots: string[];
};

type LoggedMeal = {
  id: string;
  description: string;
  meal_slot: string | null;
  logged_at: string;
  calories: number | null;
};

// Guest demo data
const GUEST_PLANS = {
  vegan: {
    label: "🌱 Vegan Plan",
    breakfast: [
      { id: "g1", title: "Overnight Oats with Berries", calories: 320, protein_g: 12, carbs_g: 58, fat_g: 6, prep_time_mins: 10 },
      { id: "g2", title: "Avocado Toast with Seeds", calories: 280, protein_g: 8, carbs_g: 32, fat_g: 14, prep_time_mins: 10 },
      { id: "g3", title: "Smoothie Bowl", calories: 290, protein_g: 9, carbs_g: 52, fat_g: 5, prep_time_mins: 10 },
    ],
    lunch: [
      { id: "g4", title: "Chickpea Buddha Bowl", calories: 420, protein_g: 18, carbs_g: 62, fat_g: 12, prep_time_mins: 20 },
      { id: "g5", title: "Lentil Soup with Bread", calories: 380, protein_g: 20, carbs_g: 55, fat_g: 8, prep_time_mins: 30 },
      { id: "g6", title: "Quinoa Veggie Wrap", calories: 360, protein_g: 14, carbs_g: 48, fat_g: 10, prep_time_mins: 15 },
    ],
    dinner: [
      { id: "g7", title: "Tofu Stir Fry with Rice", calories: 450, protein_g: 22, carbs_g: 58, fat_g: 14, prep_time_mins: 25 },
      { id: "g8", title: "Black Bean Tacos", calories: 410, protein_g: 18, carbs_g: 52, fat_g: 12, prep_time_mins: 20 },
      { id: "g9", title: "Mushroom Pasta", calories: 480, protein_g: 16, carbs_g: 72, fat_g: 10, prep_time_mins: 30 },
    ],
  },
  nonveg: {
    label: "🍗 Non-Veg Plan",
    breakfast: [
      { id: "n1", title: "Scrambled Eggs with Toast", calories: 380, protein_g: 22, carbs_g: 28, fat_g: 18, prep_time_mins: 10 },
      { id: "n2", title: "Greek Yogurt Parfait", calories: 310, protein_g: 18, carbs_g: 42, fat_g: 8, prep_time_mins: 5 },
      { id: "n3", title: "Omelette with Veggies", calories: 340, protein_g: 24, carbs_g: 12, fat_g: 20, prep_time_mins: 15 },
    ],
    lunch: [
      { id: "n4", title: "Grilled Chicken Salad", calories: 430, protein_g: 38, carbs_g: 22, fat_g: 18, prep_time_mins: 20 },
      { id: "n5", title: "Tuna Wrap", calories: 390, protein_g: 32, carbs_g: 38, fat_g: 12, prep_time_mins: 10 },
      { id: "n6", title: "Turkey Sandwich", calories: 420, protein_g: 28, carbs_g: 44, fat_g: 14, prep_time_mins: 10 },
    ],
    dinner: [
      { id: "n7", title: "Baked Salmon with Veggies", calories: 520, protein_g: 42, carbs_g: 28, fat_g: 22, prep_time_mins: 30 },
      { id: "n8", title: "Chicken Stir Fry", calories: 480, protein_g: 38, carbs_g: 42, fat_g: 16, prep_time_mins: 25 },
      { id: "n9", title: "Beef & Rice Bowl", calories: 550, protein_g: 36, carbs_g: 58, fat_g: 18, prep_time_mins: 30 },
    ],
  },
};

export default function MealPlanPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [step, setStep] = useState<"loading" | "preferences" | "plan">("loading");
  const [preferences, setPreferences] = useState<Preferences>({
    dietary_restrictions: [],
    health_goals: [],
    ingredient_dislikes: [],
    meal_slots: ["breakfast", "lunch", "dinner"],
  });
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});
  const [selectedMeals, setSelectedMeals] = useState<Record<string, string>>({});
  const [loggedMeals, setLoggedMeals] = useState<LoggedMeal[]>([]);
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showPrefsPanel, setShowPrefsPanel] = useState(false);
  const [guestTab, setGuestTab] = useState<"vegan" | "nonveg">("vegan");
  const [activeGuestRecipe, setActiveGuestRecipe] = useState<any | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  // Calendar state
  const today = new Date();
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  useEffect(() => {
    // Build last 7 days for calendar
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    setCalendarDays(days);

    const id = localStorage.getItem("user_id");
    setIsLoggedIn(!!id);
    setUserId(id);

    // Restore selected meals for today
    const savedSelections = localStorage.getItem("selected_meals");
    if (savedSelections) {
      const parsed = JSON.parse(savedSelections);
      if (parsed.date === new Date().toDateString() && parsed.userId === id) {
        setSelectedMeals(parsed.meals);
      }
    }

    if (id) {
      initialize(id);
    } else {
      setStep("plan"); // guests go straight to demo plan
    }
  }, []);

  const initialize = async (uid: string) => {
    try {
      const prefRes = await fetch(`http://localhost:8000/api/users/${uid}/preferences`);
      const prefData = await prefRes.json();

      const hasPrefs =
        prefData.dietary_restrictions?.length > 0 ||
        prefData.health_goals?.length > 0;

      if (hasPrefs) {
        setPreferences({
          dietary_restrictions: prefData.dietary_restrictions || [],
          health_goals: prefData.health_goals || [],
          ingredient_dislikes: prefData.ingredient_dislikes || [],
          meal_slots: ["breakfast", "lunch", "dinner"],
        });
      }

      // Fetch logged meals
      const logRes = await fetch(`http://localhost:8000/api/meal-plans/${uid}/log/history`);
      const logData = await logRes.json();
      setLoggedMeals(logData || []);

      // Fetch existing plans
      const planRes = await fetch(`http://localhost:8000/api/meal-plans/${uid}`);
      const plans = await planRes.json();

      if (plans && plans.length > 0) {
        setCurrentPlanId(plans[0].id);
        await fetchRecipesAndGenerate(uid, hasPrefs ? prefData : preferences, plans[0]);
      } else if (!hasPrefs) {
        setStep("preferences");
      } else {
        await fetchRecipesAndGenerate(uid, prefData, null);
      }
    } catch (err) {
      setError("Failed to load data");
      setStep("preferences");
    }
  };

  const fetchRecipesAndGenerate = async (uid: string, prefs: any, existingPlan: any) => {
    try {
      const recipeRes = await fetch(`http://localhost:8000/api/recipes/`);
      const allRecipes: Recipe[] = await recipeRes.json();
      setRecipes(allRecipes);
  
      // Check localStorage for today's suggestions
      const cached = localStorage.getItem("meal_suggestions");
      if (cached) {
        const parsed = JSON.parse(cached);
        const isToday = parsed.generatedAt === new Date().toDateString();
        const isSameUser = parsed.userId === uid;
  
        if (isToday && isSameUser && Object.keys(parsed.suggestions).length > 0) {
          console.log("Using cached suggestions ✅");
          setSuggestions(parsed.suggestions);
          setStep("plan");
          return;
        }
      }
  
      // No cache or stale — generate fresh
      await generateSuggestions(uid, prefs, allRecipes);
  
    } catch (err) {
      setError("Failed to load recipes");
      setStep("plan");
    }
  };

  const generateSuggestions = async (uid: string, prefs: any, allRecipes: Recipe[]) => {
    setGenerating(true);
    try {
      const pantryRes = await fetch(`http://localhost:8000/api/pantry/${uid}`);
      const pantry = await pantryRes.json();
      const pantryItems = pantry.map((p: any) => p.ingredient_name).join(", ");

      const res = await fetch("/api/generate-meal-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: prefs,
          pantryItems,
          recipes: allRecipes.map((r) => ({
            id: r.id,
            title: r.title,
            meal_type: r.meal_type,
            calories: r.calories,
          })),
          mealSlots: prefs.meal_slots || ["breakfast", "lunch", "dinner"],
        }),
      });

      const data = await res.json();
      setSuggestions(data.suggestions || {});

      // Save to localStorage with timestamp
      localStorage.setItem("meal_suggestions", JSON.stringify({
        suggestions: data.suggestions || {},
        generatedAt: new Date().toDateString(), // store today's date
        userId: uid,
      }));

      setStep("plan");
    } catch (err) {
      setError("Failed to generate suggestions");
      setStep("plan");
    } finally {
      setGenerating(false);
    }
  };

  const savePreferences = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await fetch(`http://localhost:8000/api/users/${userId}/preferences`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dietary_restrictions: preferences.dietary_restrictions,
          health_goals: preferences.health_goals,
          ingredient_dislikes: preferences.ingredient_dislikes,
        }),
      });
      setShowPrefsPanel(false);
      await generateSuggestions(userId, preferences, recipes);
    } catch (err) {
      setError("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const togglePref = (field: keyof Preferences, item: string) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: (prev[field] as string[]).includes(item)
        ? (prev[field] as string[]).filter((i) => i !== item)
        : [...(prev[field] as string[]), item],
    }));
  };

  const toggleMealSlot = (slot: string) => {
    setPreferences((prev) => ({
      ...prev,
      meal_slots: prev.meal_slots.includes(slot)
        ? prev.meal_slots.filter((s) => s !== slot)
        : [...prev.meal_slots, slot],
    }));
  };

  const selectMeal = async (slot: string, recipeId: string) => {
    setSelectedMeals((prev) => ({ ...prev, [slot]: recipeId }));

    const updatedSelections = { ...selectedMeals, [slot]: recipeId };
    setSelectedMeals(updatedSelections);
    localStorage.setItem("selected_meals", JSON.stringify({
      meals: updatedSelections,
      date: new Date().toDateString(),
      userId,
    }));

    // Log the meal
    if (userId) {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe || !userId) return;
      try {
        await fetch(`http://localhost:8000/api/meal-plans/${userId}/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: recipe.title,
            meal_slot: slot,
            calories: recipe.calories,
            protein_g: recipe.protein_g,
            carbs_g: recipe.carbs_g,
            fat_g: recipe.fat_g,
            source: "meal_plan",
          }),
        });

        // Fetch current pantry
        const pantryRes = await fetch(`http://localhost:8000/api/pantry/${userId}`);
        const pantryItems = await pantryRes.json();

        // Deduct ingredients from pantry
        for (const ingredient of recipe.ingredients || []) {
          const pantryItem = pantryItems.find(
            (p: any) =>
              p.ingredient_name.toLowerCase() === ingredient.ingredient_name.toLowerCase()
          );

          if (pantryItem && pantryItem.quantity !== null && ingredient.quantity !== null) {
            const newQty = Math.max(0, pantryItem.quantity - (ingredient.quantity || 0));
            await fetch(`http://localhost:8000/api/pantry/${userId}/${pantryItem.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantity: newQty }),
            });
          }
        }


        // Refresh logged meals
        const logRes = await fetch(`http://localhost:8000/api/meal-plans/${userId}/log/history`);
        const logData = await logRes.json();
        setLoggedMeals(logData || []);
      } catch (err) {
        console.error("Failed to log meal");
      }
    }
    setActiveRecipe(null);
  };

  const getRecipeById = (id: string) =>
    recipes.find((r) => r.id === id) || null;

  const getSlotEmoji = (slot: string) => {
    if (slot === "breakfast") return "🌅";
    if (slot === "lunch") return "☀️";
    if (slot === "dinner") return "🌙";
    return "🍎";
  };

  const getMealsLoggedOnDay = (date: Date) => {
    return loggedMeals.filter((m) => {
      const logDate = new Date(m.logged_at);
      return logDate.toDateString() === date.toDateString();
    });
  };

  const isToday = (date: Date) => date.toDateString() === today.toDateString();

  // ── LOADING ──
  if (step === "loading") {
    return (
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
      </main>
    );
  }

  // ── PREFERENCES SETUP (first time) ──
  if (step === "preferences") {
    return (
      <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Set up your <span className="text-purple-700">Meal Plan</span>
            </h1>
            <p className="text-gray-500">Tell us about your diet so we can personalise your daily plan.</p>
          </div>

          {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-6">{error}</div>}

          {/* Meal Slots */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">🍽️ How many meals do you eat per day?</h2>
            <p className="text-gray-400 text-sm mb-4">Select all that apply</p>
            <div className="flex flex-wrap gap-2">
              {MEAL_SLOTS_OPTIONS.map((slot) => (
                <button
                  key={slot}
                  onClick={() => toggleMealSlot(slot)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition capitalize ${
                    preferences.meal_slots.includes(slot)
                      ? "bg-purple-700 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {getSlotEmoji(slot)} {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Dietary Restrictions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🥗 Dietary Restrictions</h2>
            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => togglePref("dietary_restrictions", item)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    preferences.dietary_restrictions.includes(item)
                      ? "bg-purple-700 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Health Goals */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🎯 Health Goals</h2>
            <div className="flex flex-wrap gap-2">
              {HEALTH_GOALS_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => togglePref("health_goals", item)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    preferences.health_goals.includes(item)
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* Dislikes */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">🚫 Ingredients I Dislike</h2>
            <div className="flex flex-wrap gap-2">
              {DISLIKES_OPTIONS.map((item) => (
                <button
                  key={item}
                  onClick={() => togglePref("ingredient_dislikes", item)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    preferences.ingredient_dislikes.includes(item)
                      ? "bg-red-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={savePreferences}
            disabled={saving || generating || preferences.meal_slots.length === 0}
            className="w-full bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 transition disabled:opacity-50"
          >
            {generating ? "Generating your meal plan..." : saving ? "Saving..." : "Generate My Meal Plan →"}
          </button>
        </div>
      </main>
    );
  }

  // ── GUEST PLAN ──
  if (!isLoggedIn) {
    const plan = GUEST_PLANS[guestTab];
    return (
      <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Sample <span className="text-purple-700">Meal Plans</span>
            </h1>
            <p className="text-gray-500">Sign up to get a personalized plan based on your preferences and pantry.</p>
          </div>

          {/* Plan tabs */}
          <div className="flex gap-3 mb-8">
            {(["vegan", "nonveg"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setGuestTab(tab)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                  guestTab === tab
                    ? "bg-purple-700 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {GUEST_PLANS[tab].label}
              </button>
            ))}
          </div>

          {/* Guest meal slots */}
          {["breakfast", "lunch", "dinner"].map((slot) => (
            <div key={slot} className="mb-8">
              <h2 className="text-lg font-semibold text-gray-700 mb-3 capitalize flex items-center gap-2">
                {getSlotEmoji(slot)} {slot}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(plan as any)[slot].map((recipe: any) => (
                  <div
                    key={recipe.id}
                    onClick={() => setActiveGuestRecipe(recipe)}
                    className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition border-2 border-transparent hover:border-purple-200"
                  >
                    <p className="font-semibold text-gray-800 text-sm mb-2">{recipe.title}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      {recipe.calories && <span>🔥 {recipe.calories} cal</span>}
                      {recipe.protein_g && <span>💪 {recipe.protein_g}g</span>}
                      {recipe.prep_time_mins && <span>⏱ {recipe.prep_time_mins}m</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Guest recipe mini modal */}
          {activeGuestRecipe && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-bold text-gray-900">{activeGuestRecipe.title}</h2>
                  <button onClick={() => setActiveGuestRecipe(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: "Cal", value: activeGuestRecipe.calories, icon: "🔥" },
                    { label: "Protein", value: `${activeGuestRecipe.protein_g}g`, icon: "💪" },
                    { label: "Carbs", value: `${activeGuestRecipe.carbs_g}g`, icon: "🌾" },
                    { label: "Fat", value: `${activeGuestRecipe.fat_g}g`, icon: "🥑" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-base mb-0.5">{s.icon}</p>
                      <p className="text-xs font-semibold text-gray-800">{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mb-4">⏱ {activeGuestRecipe.prep_time_mins} mins prep time</p>
                
                <a href="/signup"
                  className="block w-full bg-purple-700 text-white text-center py-2 rounded-xl text-sm font-semibold hover:bg-purple-800 transition"
                >
                  {"Sign up for your personalized plan →"}
                </a>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── LOGGED IN PLAN VIEW ──
  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Today's <span className="text-purple-700">Meals</span>
            </h1>
            <p className="text-gray-500 mt-1">
              {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrefsPanel(true)}
              className="border border-purple-200 text-purple-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-50 transition"
            >
              ⚙️ Preferences
            </button>
            <button
              onClick={() => generateSuggestions(userId!, preferences, recipes)}
              disabled={generating}
              className="bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-purple-800 transition disabled:opacity-50"
            >
              {generating ? "..." : "🔄 Refresh"}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-6">{error}</div>}

        {/* Calendar strip */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-8">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Last 7 Days</p>
          <div className="flex gap-2">
            {calendarDays.map((date, i) => {
              const mealsOnDay = getMealsLoggedOnDay(date);
              const hasLog = mealsOnDay.length > 0;
              return (
                <div
                  key={i}
                  className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl transition ${
                    isToday(date)
                      ? "bg-purple-700 text-white"
                      : hasLog
                      ? "bg-purple-50 text-purple-700"
                      : "bg-gray-50 text-gray-400"
                  }`}
                >
                  <p className="text-xs font-medium mb-1">{DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1]}</p>
                  <p className="text-sm font-bold">{date.getDate()}</p>
                  {hasLog && (
                    <div className="flex gap-0.5 mt-1">
                      {mealsOnDay.slice(0, 3).map((_, idx) => (
                        <div key={idx} className={`w-1 h-1 rounded-full ${isToday(date) ? "bg-white" : "bg-purple-400"}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Meal slots */}
        {generating ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin" />
            <p className="text-gray-500">Finding the best meals for you...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {preferences.meal_slots.map((slot) => {
              const slotRecipeIds = suggestions[slot] || [];
              return (
                <div key={slot}>
                  <h2 className="text-lg font-semibold text-gray-700 mb-3 capitalize flex items-center gap-2">
                    {getSlotEmoji(slot)} {slot}
                    {selectedMeals[slot] && (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
                        ✓ Logged
                      </span>
                    )}
                  </h2>

                  {slotRecipeIds.length === 0 ? (
                    <div className="bg-white rounded-2xl p-6 text-center text-gray-400 text-sm">
                      No suggestions yet — click Refresh to generate
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {slotRecipeIds.map((recipeId) => {
                        const recipe = getRecipeById(recipeId);
                        if (!recipe) return null;
                        const isSelected = selectedMeals[slot] === recipeId;
                        return (
                          <div
                            key={recipeId}
                            onClick={() => setActiveRecipe(recipe)}
                            className={`bg-white rounded-2xl p-4 shadow-sm cursor-pointer hover:shadow-md transition border-2 ${
                              isSelected
                                ? "border-green-400"
                                : "border-transparent hover:border-purple-200"
                            }`}
                          >
                            {recipe.image_url && (
                              <img
                                src={recipe.image_url}
                                alt={recipe.title}
                                className="w-full h-28 object-cover rounded-xl mb-3"
                              />
                            )}
                            <p className="font-semibold text-gray-800 text-sm mb-2 leading-tight">{recipe.title}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                              {recipe.calories && <span>🔥 {recipe.calories} cal</span>}
                              {recipe.protein_g && <span>💪 {recipe.protein_g}g</span>}
                              {recipe.prep_time_mins && <span>⏱ {recipe.prep_time_mins}m</span>}
                            </div>
                            {isSelected && (
                              <p className="text-xs text-green-500 font-medium mt-2">✓ Selected</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preferences slide panel */}
      <>
        <div
          className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${showPrefsPanel ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setShowPrefsPanel(false)}
        />
        <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${showPrefsPanel ? "translate-x-0" : "translate-x-full"}`}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-900 text-lg">⚙️ Your Preferences</h2>
            <button onClick={() => setShowPrefsPanel(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">

            {/* Meal slots */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">🍽️ Meal Slots</h3>
              <div className="flex flex-wrap gap-2">
                {MEAL_SLOTS_OPTIONS.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => toggleMealSlot(slot)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition capitalize ${
                      preferences.meal_slots.includes(slot)
                        ? "bg-purple-700 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {getSlotEmoji(slot)} {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Dietary */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">🥗 Dietary Restrictions</h3>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => togglePref("dietary_restrictions", item)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      preferences.dietary_restrictions.includes(item)
                        ? "bg-purple-700 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Goals */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">🎯 Health Goals</h3>
              <div className="flex flex-wrap gap-2">
                {HEALTH_GOALS_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => togglePref("health_goals", item)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      preferences.health_goals.includes(item)
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Dislikes */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">🚫 Ingredient Dislikes</h3>
              <div className="flex flex-wrap gap-2">
                {DISLIKES_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => togglePref("ingredient_dislikes", item)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                      preferences.ingredient_dislikes.includes(item)
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-100">
            <button
              onClick={savePreferences}
              disabled={saving || generating}
              className="w-full bg-purple-700 text-white py-3 rounded-xl font-semibold hover:bg-purple-800 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : generating ? "Generating..." : "Save & Regenerate Plan"}
            </button>
          </div>
        </div>
      </>

      {/* Recipe slide panel */}
      <RecipePanel
        recipe={activeRecipe}
        onClose={() => setActiveRecipe(null)}
        onSelect={(recipe) => selectMeal(
          preferences.meal_slots.find((s) => suggestions[s]?.includes(recipe.id)) || "lunch",
          recipe.id
        )}
        isSelected={Object.values(selectedMeals).includes(activeRecipe?.id || "")}
      />
    </main>
  );
}