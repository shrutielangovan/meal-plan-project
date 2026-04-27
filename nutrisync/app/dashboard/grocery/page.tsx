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
  user_id: string;
  meal_plan_id: string | null;
  created_at: string;
  items: GroceryItem[];
};

const CATEGORY_EMOJI: Record<string, string> = {
  "Produce": "🥦",
  "Dairy & Eggs": "🥛",
  "Meat & Seafood": "🥩",
  "Pantry Staples": "🫙",
  "Grains & Bread": "🍞",
  "Frozen": "🧊",
  "Beverages": "🥤",
  "Snacks": "🍿",
  "Other": "🛒",
};

export default function GroceryPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);

  // Manual add state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Other");
  const [addingItem, setAddingItem] = useState(false);

  // Checking off items
  const [checkingId, setCheckingId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    loadOrGenerateList(id);
  }, []);

  const loadOrGenerateList = async (uid: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/api/grocery/${uid}`);
      const lists: GroceryList[] = await res.json();
  
      // Find most recent standalone list (no meal_plan_id)
      const standalone = lists
        .filter(l => !l.meal_plan_id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  
      if (standalone && standalone.items.length > 0) {
        // List exists with items — use it, don't regenerate
        setGroceryList(standalone);
      } else if (standalone && standalone.items.length === 0) {
        // Empty list exists — delete and regenerate
        await fetch(`http://localhost:8000/api/grocery/${uid}/${standalone.id}`, { method: "DELETE" });
        await generateList(uid);
      } else {
        // No list at all — generate
        await generateList(uid);
      }
    } catch (err) {
      setError("Failed to load grocery list");
    } finally {
      setLoading(false);
    }
  };

  const generateList = async (uid: string) => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/api/grocery/${uid}/generate-from-planned`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Generation failed");
      const list: GroceryList = await res.json();
      setGroceryList(list);
    } catch (err) {
      setError("Failed to generate grocery list");
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async () => {
    if (!userId || !groceryList) return;
    // Delete current list and regenerate
    try {
      await fetch(`http://localhost:8000/api/grocery/${userId}/${groceryList.id}`, {
        method: "DELETE",
      });
      setGroceryList(null);
      await generateList(userId);
    } catch {
      setError("Failed to refresh list");
    }
  };

  const handleCheckItem = async (item: GroceryItem) => {
    if (!userId || !groceryList) return;
    setCheckingId(item.id);
    try {
      const res = await fetch(
        `http://localhost:8000/api/grocery/${userId}/${groceryList.id}/items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_checked: !item.is_checked }),
        }
      );
      if (!res.ok) throw new Error();
      const updated: GroceryItem = await res.json();
      console.log("Updated item:", updated);
      setGroceryList(prev => prev ? {
        ...prev,
        items: prev.items.map(i => i.id === updated.id ? updated : i),
      } : prev);
    } catch {
      setError("Failed to update item");
    } finally {
      setCheckingId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!userId || !groceryList) return;
    try {
      await fetch(
        `http://localhost:8000/api/grocery/${userId}/${groceryList.id}/items/${itemId}`,
        { method: "DELETE" }
      );
      setGroceryList(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
      } : prev);
    } catch {
      setError("Failed to remove item");
    }
  };

  const handleDoneShopping = async () => {
    if (!userId || !groceryList) return;
    try {
      const checkedItems = groceryList.items.filter(i => i.is_checked);
      await Promise.all(
        checkedItems.map(item =>
          fetch(`http://localhost:8000/api/grocery/${userId}/${groceryList.id}/items/${item.id}`, {
            method: "DELETE",
          })
        )
      );
      setGroceryList(prev => prev ? {
        ...prev,
        items: prev.items.filter(i => !i.is_checked),
      } : prev);
    } catch {
      setError("Failed to update list");
    }
  };

  const handleAddItem = async () => {
    if (!userId || !groceryList || !newItemName.trim()) return;
    setAddingItem(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/grocery/${userId}/${groceryList.id}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredient_name: newItemName.trim(),
            quantity: newItemQty ? parseFloat(newItemQty) : null,
            unit: newItemUnit || null,
            category: newItemCategory,
          }),
        }
      );
      if (!res.ok) throw new Error();
      const newItem: GroceryItem = await res.json();
      setGroceryList(prev => prev ? {
        ...prev,
        items: [...prev.items, newItem],
      } : prev);
      setNewItemName(""); setNewItemQty(""); setNewItemUnit("");
      setNewItemCategory("Other"); setShowAddItem(false);
    } catch {
      setError("Failed to add item — it may already be in the list");
    } finally {
      setAddingItem(false);
    }
  };

  // Group items by category
  const groupByCategory = (items: GroceryItem[]) => {
    return items.reduce((acc, item) => {
      const cat = item.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, GroceryItem[]>);
  };

  const shoppingItems = (groceryList?.items || []).filter(i => !i.in_pantry);
  const checkedCount = shoppingItems.filter(i => i.is_checked).length;
  const totalCount = shoppingItems.length;
  const grouped = groupByCategory(
    (groceryList?.items || []).filter(i => !i.in_pantry)
  );
  
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading your grocery list...</p>
        </div>
      </main>
    );
  }

  if (generating) {
    return (
      <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Building your grocery list from planned meals...</p>
        </div>
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
            <p className="text-gray-500 mt-1 text-sm">
              Based on your planned meals and pantry
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard/pantry"
              className="border border-amber-400 text-amber-600 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-50 transition">
              🏠 View Pantry
            </a>
            <button onClick={handleRefresh}
              className="border border-green-300 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-50 transition">
              🔄 Refresh List
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-6">{error}</div>}

        {!groceryList || groceryList.items.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <p className="text-5xl mb-4">🛒</p>
            <p className="text-lg font-semibold text-gray-700 mb-2">No items yet</p>
            <p className="text-gray-400 text-sm mb-6">
              Plan some meals for the upcoming days and your grocery list will appear here automatically.
            </p>
            <a href="/dashboard/meal-plan"
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition">
              Go to Meal Plan →
            </a>
          </div>
        ) : (
          <>
            {/* ← ADD THIS RIGHT HERE */}
            {totalCount > 0 && (
              <div className="sticky top-4 z-10 flex justify-end mb-4">
                <button
                  onClick={handleDoneShopping}
                  className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg hover:bg-green-700 transition flex items-center gap-2">
                  ✓ Done Shopping ({checkedCount} item{checkedCount > 1 ? "s" : ""})
                </button>
              </div>
            )}

            {/* Progress bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-700">
                  {checkedCount} of {totalCount} items collected
                </p>
                <p className="text-xs text-gray-400">
                  {totalCount - checkedCount} remaining
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Items grouped by category */}
            <div className="flex flex-col gap-4 mb-6">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <span>{CATEGORY_EMOJI[category] || "🛒"}</span>
                    <span>{category}</span>
                  </h3>
                  <div className="flex flex-col gap-1">
                    {items.map((item) => (
                      <div key={item.id}
                        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl transition group ${
                          item.is_checked ? "bg-green-50" : "hover:bg-gray-50"
                        }`}>
                        {/* Checkbox */}
                        <button
                          onClick={() => handleCheckItem(item)}
                          disabled={checkingId === item.id}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                            item.is_checked ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"
                          }`}>
                          {item.is_checked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Name */}
                        <p className={`flex-1 text-sm capitalize transition ${
                          item.is_checked ? "line-through text-gray-400" : "text-gray-800 font-medium"
                        }`}>
                          {item.ingredient_name}
                        </p>

                        {/* Quantity */}
                        {item.quantity && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {item.quantity} {item.unit || ""}
                          </span>
                        )}

                        {/* In pantry badge */}
                        {item.in_pantry && !item.is_checked && (
                          <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full flex-shrink-0">
                            in pantry
                          </span>
                        )}

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition text-sm flex-shrink-0"
                          title="Remove item">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Add manual item */}
            <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
              {!showAddItem ? (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-green-600 font-semibold hover:bg-green-50 rounded-xl transition border-2 border-dashed border-green-200 hover:border-green-400">
                  <span>+</span>
                  <span>Add an item</span>
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Add item</p>
                  <input
                    type="text"
                    placeholder="Item name (e.g. Sparkling water)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                    autoFocus
                    className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-300"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number" min="0" placeholder="Qty"
                      value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <input
                      type="text" placeholder="Unit (e.g. cans)"
                      value={newItemUnit} onChange={(e) => setNewItemUnit(e.target.value)}
                      className="w-32 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                    />
                    <select
                      value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
                      {Object.keys(CATEGORY_EMOJI).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddItem}
                      disabled={addingItem || !newItemName.trim()}
                      className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
                      {addingItem ? "Adding..." : "Add to List"}
                    </button>
                    <button
                      onClick={() => { setShowAddItem(false); setNewItemName(""); setNewItemQty(""); setNewItemUnit(""); }}
                      className="px-4 py-2.5 rounded-xl text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
