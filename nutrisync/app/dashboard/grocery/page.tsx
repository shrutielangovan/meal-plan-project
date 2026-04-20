"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type GroceryItem = {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  is_checked: boolean;
  in_pantry: boolean;
};

type GroceryList = {
  id: string;
  meal_plan_id: string | null;
  created_at: string;
  items: GroceryItem[];
};

export default function GroceryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [lists, setLists] = useState<GroceryList[]>([]);
  const [activeList, setActiveList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "needed" | "pantry" | "checked">("needed");

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    fetchData(id);
  }, []);

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      // Fetch meal plans to get plan_id
      const planRes = await fetch(`http://localhost:8000/api/meal-plans/${uid}`);
      const plans = await planRes.json();
      if (plans && plans.length > 0) setPlanId(plans[0].id);

      // Fetch grocery lists
      const groceryRes = await fetch(`http://localhost:8000/api/grocery/${uid}`);
      const groceryData = await groceryRes.json();
      setLists(groceryData || []);
      if (groceryData && groceryData.length > 0) setActiveList(groceryData[0]);
    } catch (err) {
      setError("Failed to load grocery lists");
    } finally {
      setLoading(false);
    }
  };

  const generateList = async () => {
    if (!userId || !planId) {
      setError("No meal plan found. Please create a meal plan first.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/api/grocery/${userId}/generate/${planId}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to generate list");
      const newList = await res.json();
      setLists((prev) => [newList, ...prev]);
      setActiveList(newList);
    } catch (err) {
      setError("Failed to generate grocery list");
    } finally {
      setGenerating(false);
    }
  };

  const toggleItem = async (item: GroceryItem) => {
    if (!userId || !activeList) return;
    try {
      const res = await fetch(
        `http://localhost:8000/api/grocery/${userId}/${activeList.id}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_checked: !item.is_checked }),
        }
      );
      if (!res.ok) throw new Error("Failed to update item");

      // Update locally
      const updatedItems = activeList.items.map((i) =>
        i.id === item.id ? { ...i, is_checked: !i.is_checked } : i
      );
      const updatedList = { ...activeList, items: updatedItems };
      setActiveList(updatedList);
      setLists((prev) => prev.map((l) => l.id === activeList.id ? updatedList : l));
    } catch (err) {
      console.error("Failed to toggle item");
    }
  };

  const deleteList = async (listId: string) => {
    if (!userId) return;
    try {
      await fetch(`http://localhost:8000/api/grocery/${userId}/${listId}`, {
        method: "DELETE",
      });
      const updated = lists.filter((l) => l.id !== listId);
      setLists(updated);
      setActiveList(updated.length > 0 ? updated[0] : null);
    } catch (err) {
      console.error("Failed to delete list");
    }
  };

  const getFilteredItems = () => {
    if (!activeList) return [];
    switch (filter) {
      case "needed": return activeList.items.filter((i) => !i.in_pantry && !i.is_checked);
      case "pantry": return activeList.items.filter((i) => i.in_pantry);
      case "checked": return activeList.items.filter((i) => i.is_checked);
      default: return activeList.items;
    }
  };

  const groupByCategory = (items: GroceryItem[]) => {
    return items.reduce((acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, GroceryItem[]>);
  };

  const checkedCount = activeList?.items.filter((i) => i.is_checked).length || 0;
  const totalCount = activeList?.items.length || 0;
  const pantryCount = activeList?.items.filter((i) => i.in_pantry).length || 0;
  const neededCount = activeList?.items.filter((i) => !i.in_pantry && !i.is_checked).length || 0;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  const filteredItems = getFilteredItems();
  const grouped = groupByCategory(filteredItems);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Grocery <span className="text-green-600">List</span>
            </h1>
            <p className="text-gray-500 mt-1">
              Based on your meal plan and pantry inventory.
            </p>
          </div>
          <button
            onClick={generateList}
            disabled={generating || !planId}
            className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {generating ? "Generating..." : "🛒 Generate from Meal Plan"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-6">{error}</div>
        )}

        {!planId && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl mb-6">
            ⚠️ You need a meal plan first before generating a grocery list.{" "}
            <a href="/dashboard/meal-plan" className="underline font-medium">Create one here →</a>
          </div>
        )}

        {lists.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">🛒</p>
            <p className="text-lg font-medium text-gray-600">No grocery lists yet</p>
            <p className="text-sm mt-1">Generate one from your meal plan to get started!</p>
          </div>
        ) : (
          <div className="flex gap-6">

            {/* Sidebar — list history */}
            {lists.length > 1 && (
              <div className="w-52 flex-shrink-0">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Previous Lists
                </p>
                <div className="flex flex-col gap-2">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      onClick={() => setActiveList(list)}
                      className={`p-3 rounded-xl cursor-pointer transition text-sm ${
                        activeList?.id === list.id
                          ? "bg-green-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <p className="font-medium">
                        {new Date(list.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric",
                        })}
                      </p>
                      <p className={`text-xs mt-0.5 ${activeList?.id === list.id ? "text-green-100" : "text-gray-400"}`}>
                        {list.items.length} items
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main content */}
            <div className="flex-1">

              {/* Progress bar */}
              {activeList && (
                <div className="bg-white rounded-2xl p-5 shadow-sm mb-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-800">
                      Shopping Progress
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {checkedCount}/{totalCount} items
                      </span>
                      <button
                        onClick={() => deleteList(activeList.id)}
                        className="text-xs text-red-400 hover:text-red-600 ml-2"
                      >
                        Delete list
                      </button>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "To Buy", value: neededCount, color: "text-orange-500", bg: "bg-orange-50" },
                      { label: "In Pantry", value: pantryCount, color: "text-blue-500", bg: "bg-blue-50" },
                      { label: "Checked Off", value: checkedCount, color: "text-green-500", bg: "bg-green-50" },
                    ].map((stat) => (
                      <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                        <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex gap-2 mb-5 bg-white rounded-xl p-1 shadow-sm w-fit">
                {(["needed", "pantry", "checked", "all"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition capitalize ${
                      filter === f ? "bg-green-600 text-white" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {f === "needed" ? "🛒 To Buy" : f === "pantry" ? "🏠 In Pantry" : f === "checked" ? "✓ Got It" : "All"}
                  </button>
                ))}
              </div>

              {/* Items grouped by category */}
              {filteredItems.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                  <p className="text-3xl mb-2">
                    {filter === "needed" ? "🎉" : filter === "checked" ? "📋" : "🏠"}
                  </p>
                  <p className="text-sm">
                    {filter === "needed" ? "Nothing left to buy!" :
                     filter === "checked" ? "Nothing checked off yet" :
                     "No pantry items in this list"}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="bg-white rounded-2xl p-5 shadow-sm">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        {category}
                      </h3>
                      <div className="flex flex-col gap-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => toggleItem(item)}
                            className={`flex items-center gap-3 py-2 px-3 rounded-xl cursor-pointer transition ${
                              item.is_checked
                                ? "opacity-50 bg-gray-50"
                                : item.in_pantry
                                ? "bg-blue-50"
                                : "hover:bg-gray-50"
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                              item.is_checked
                                ? "bg-green-500 border-green-500"
                                : "border-gray-300"
                            }`}>
                              {item.is_checked && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>

                            {/* Item info */}
                            <div className="flex-1">
                              <span className={`text-sm font-medium capitalize ${item.is_checked ? "line-through text-gray-400" : "text-gray-800"}`}>
                                {item.ingredient_name}
                              </span>
                              {item.quantity && (
                                <span className="text-xs text-gray-400 ml-2">
                                  {item.quantity} {item.unit || ""}
                                </span>
                              )}
                            </div>

                            {/* Badges */}
                            {item.in_pantry && !item.is_checked && (
                              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                                In pantry
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}