"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type SuggestedItem = {
  ingredient_name: string;
  category: string;
  reason: string;
  suggested_qty: number | null;
  suggested_unit: string | null;
};

type PurchasedItem = {
  ingredient_name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
};

type HistoryEntry = {
  id: string;
  date: string;
  items: PurchasedItem[];
};

export default function GroceryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  // Suggested items from Gemini
  const [suggestions, setSuggestions] = useState<SuggestedItem[]>([]);

  // Which items user has checked
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  // Quantities user fills in
  const [quantities, setQuantities] = useState<Record<string, { qty: string; unit: string }>>({});

  // Purchase history (from localStorage)
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryEntry | null>(null);

  // User + plan data
  const [userData, setUserData] = useState<any>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [pantryItems, setPantryItems] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>(null);

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    loadData(id);

    // Load history from localStorage
    const saved = localStorage.getItem(`grocery_history_${id}`);
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const loadData = async (uid: string) => {
    setLoading(true);
    try {
      const [userRes, planRes, pantryRes, prefRes] = await Promise.all([
        fetch(`http://localhost:8000/api/users/${uid}`),
        fetch(`http://localhost:8000/api/meal-plans/${uid}`),
        fetch(`http://localhost:8000/api/pantry/${uid}`),
        fetch(`http://localhost:8000/api/users/${uid}/preferences`),
      ]);

      const [user, plans, pantry, prefs] = await Promise.all([
        userRes.json(),
        planRes.json(),
        pantryRes.json(),
        prefRes.json(),
      ]);

      setUserData(user);
      setPantryItems(pantry || []);
      setPreferences(prefs);
      if (plans && plans.length > 0) setPlanId(plans[0].id);
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    if (!userId) return;
    setGenerating(true);
    setError("");
    setSuggestions([]);
    setCheckedItems(new Set());
    setQuantities({});

    try {
      // Get recent purchase history for context
      const recentHistory = history.slice(0, 3).flatMap((h) =>
        h.items.map((i) => i.ingredient_name)
      );

      const pantryList = pantryItems.map((p) => p.ingredient_name).join(", ");

      // Get meal plan recipes if available
      let recipeIngredients = "";
      if (planId) {
        try {
          const planRes = await fetch(`http://localhost:8000/api/meal-plans/${userId}/${planId}`);
          const plan = await planRes.json();
          const recipeIds = [...new Set(
            plan.slots?.filter((s: any) => s.recipe_id).map((s: any) => s.recipe_id) || []
          )];
          const recipes = await Promise.all(
            recipeIds.slice(0, 5).map((id) =>
              fetch(`http://localhost:8000/api/recipes/${id}`).then((r) => r.json())
            )
          );
          recipeIngredients = recipes
            .map((r: any) => r.ingredients?.map((i: any) => i.ingredient_name).join(", "))
            .filter(Boolean)
            .join(", ");
        } catch (e) {
          console.log("No meal plan recipes found");
        }
      }

      const res = await fetch("/api/generate-grocery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          planId,
          householdSize: userData?.household_size || 1,
          budget: userData?.budget_weekly,
          dietaryRestrictions: preferences?.dietary_restrictions || [],
          healthGoals: preferences?.health_goals || [],
          currentPantry: pantryList,
          recentPurchases: recentHistory.join(", "),
          recipeIngredients,
        }),
      });

      const data = await res.json();
      setSuggestions(data.items || []);
    } catch (err) {
      setError("Failed to generate suggestions");
    } finally {
      setGenerating(false);
    }
  };

  const toggleCheck = (name: string) => {
    const suggestion = suggestions.find((s) => s.ingredient_name === name);
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        // Pre-fill suggested quantity if available and not already set
        if (suggestion?.suggested_qty && !quantities[name]?.qty) {
          setQuantities((prev) => ({
            ...prev,
            [name]: {
              qty: suggestion.suggested_qty?.toString() || "",
              unit: suggestion.suggested_unit || "",
            },
          }));
        }
      }
      return next;
    });
  };

  const updateQuantity = (name: string, field: "qty" | "unit", value: string) => {
    setQuantities((prev) => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  const confirmPurchases = async () => {
    if (!userId || checkedItems.size === 0) return;
    setConfirming(true);
    setError("");
  
    try {
      const purchased: PurchasedItem[] = [];
  
      for (const name of checkedItems) {
        const suggestion = suggestions.find((s) => s.ingredient_name === name);
        const qty = quantities[name];
  
        const item: PurchasedItem = {
          ingredient_name: name,
          category: suggestion?.category || "Other",
          quantity: qty?.qty ? Number(qty.qty) : null,
          unit: qty?.unit || null,
        };
  
        purchased.push(item);
  
        // Add to pantry
        await fetch(`http://localhost:8000/api/pantry/${userId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredient_name: name,
            quantity: item.quantity,
            unit: item.unit,
            expires_at: null,
          }),
        });
      }
  
      // Save to backend grocery list if plan exists
      if (planId) {
        try {
          await fetch(
            `http://localhost:8000/api/grocery/${userId}/generate/${planId}`,
            { method: "POST" }
          );
        } catch (e) {
          console.log("Could not save to backend grocery");
        }
      }
  
      // Save to localStorage history
      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: purchased,
      };
  
      const updatedHistory = [newEntry, ...history].slice(0, 10);
      setHistory(updatedHistory);
      localStorage.setItem(`grocery_history_${userId}`, JSON.stringify(updatedHistory));
  
      // Refresh pantry
      const pantryRes = await fetch(`http://localhost:8000/api/pantry/${userId}`);
      setPantryItems(await pantryRes.json());
  
      // Clear for fresh generation
      setSuggestions([]);
      setCheckedItems(new Set());
      setQuantities({});
  
    } catch (err) {
      setError("Failed to confirm purchases");
    } finally {
      setConfirming(false);
    }
  };

  const groupByCategory = (items: SuggestedItem[]) => {
    return items.reduce((acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, SuggestedItem[]>);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </main>
    );
  }

  const grouped = groupByCategory(suggestions);

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Grocery <span className="text-green-600">List</span>
            </h1>
            <p className="text-gray-500 mt-1">
              AI-powered shopping suggestions based on your meal plan and pantry.
            </p>
          </div>
          <div className="flex items-center gap-3">
            
            <a
              href="/dashboard/pantry"
              className="border border-amber-400 text-amber-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-50 transition"
            >
              🏠 View Pantry
            </a>
            <button
              onClick={generateSuggestions}
              disabled={generating}
              className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {generating ? "✨ Thinking..." : "✨ Generate List"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-6">{error}</div>
        )}

        <div className="flex gap-6">

          {/* Main area */}
          <div className="flex-1">
            {suggestions.length === 0 && !generating ? (
              /* Empty state */
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-5xl mb-4">🛒</p>
                <p className="text-lg font-semibold text-gray-700 mb-2">Ready to shop?</p>
                <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                  Click "Generate List" and AI will suggest what to buy based on your meal plan, pantry, and household size.
                </p>
                <button
                  onClick={generateSuggestions}
                  disabled={generating}
                  className="bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
                >
                  ✨ Generate List
                </button>
              </div>
            ) : generating ? (
              /* Loading state */
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-500 text-sm">Analyzing your meal plan, pantry and preferences...</p>
              </div>
            ) : (
              /* Suggestions list */
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold text-gray-800">{suggestions.length}</span> items suggested —{" "}
                    <span className="font-semibold text-green-600">{checkedItems.size}</span> selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCheckedItems(new Set(suggestions.map((s) => s.ingredient_name)))}
                      className="text-xs text-green-600 hover:text-green-800 font-medium px-3 py-1 border border-green-200 rounded-lg"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setCheckedItems(new Set())}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium px-3 py-1 border border-gray-200 rounded-lg"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 mb-6">
                  {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="bg-white rounded-2xl p-5 shadow-sm">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        {category}
                      </h3>
                      <div className="flex flex-col gap-3">
                        {items.map((item) => {
                          const isChecked = checkedItems.has(item.ingredient_name);
                          const qty = quantities[item.ingredient_name];

                          return (
                            <div key={item.ingredient_name}>
                              <div
                                onClick={() => toggleCheck(item.ingredient_name)}
                                className={`flex items-start gap-3 py-2 px-3 rounded-xl cursor-pointer transition ${
                                  isChecked ? "bg-green-50" : "hover:bg-gray-50"
                                }`}
                              >
                                {/* Checkbox */}
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition ${
                                  isChecked ? "bg-green-500 border-green-500" : "border-gray-300"
                                }`}>
                                  {isChecked && (
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>

                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-800 capitalize">
                                    {item.ingredient_name}
                                  </p>
                                  {item.reason && (
                                    <p className="text-xs text-gray-400 mt-0.5">{item.reason}</p>
                                  )}
                                </div>
                              </div>

                              {/* Quantity input — only show when checked */}
                              {isChecked && (
                              <div className="flex gap-2 ml-8 mt-1 mb-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="number"
                                  placeholder={item.suggested_qty?.toString() || "Qty"}
                                  value={qty?.qty || ""}
                                  onChange={(e) => updateQuantity(item.ingredient_name, "qty", e.target.value)}
                                  className="w-20 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-green-400"
                                />
                                <input
                                  type="text"
                                  placeholder={item.suggested_unit || "Unit"}
                                  value={qty?.unit || ""}
                                  onChange={(e) => updateQuantity(item.ingredient_name, "unit", e.target.value)}
                                  className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-green-400"
                                />
                                {/* Show suggestion hint */}
                                {item.suggested_qty && !qty?.qty && (
                                  <button
                                    onClick={() => updateQuantity(item.ingredient_name, "qty", item.suggested_qty?.toString() || "")}
                                    className="text-xs text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                                  >
                                    Use {item.suggested_qty} {item.suggested_unit}
                                  </button>
                                )}
                              </div>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confirm button */}
                {checkedItems.size > 0 && (
                  <div className="sticky bottom-6">
                    <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {checkedItems.size} item{checkedItems.size > 1 ? "s" : ""} purchased
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Will be added to your pantry and saved to history.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCheckedItems(new Set())}
                          className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmPurchases}
                          disabled={confirming}
                          className="px-5 py-2 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {confirming ? "Saving..." : "✓ Confirm Purchases"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* History sidebar */}
          <div className="w-56 flex-shrink-0">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              Purchase History
            </p>

            {history.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 text-center text-gray-400 text-xs">
                No purchases yet
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => setSelectedHistory(selectedHistory?.id === entry.id ? null : entry)}
                    className={`p-3 rounded-xl cursor-pointer transition text-sm ${
                      selectedHistory?.id === entry.id
                        ? "bg-green-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <p className="font-medium">
                      {new Date(entry.date).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </p>
                    <p className={`text-xs mt-0.5 ${selectedHistory?.id === entry.id ? "text-green-100" : "text-gray-400"}`}>
                      {entry.items.length} items bought
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* History detail modal */}
        {selectedHistory && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-gray-900">
                    {new Date(selectedHistory.date).toLocaleDateString("en-US", {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedHistory.items.length} items purchased</p>
                </div>
                <button onClick={() => setSelectedHistory(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>

              <div className="flex flex-col gap-2">
                {selectedHistory.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm font-medium text-gray-800 capitalize">{item.ingredient_name}</span>
                    <span className="text-xs text-gray-400">
                      {item.quantity ? `${item.quantity} ${item.unit || ""}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}