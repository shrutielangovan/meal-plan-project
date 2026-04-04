"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type PantryItem = {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  expires_at: string | null;
  added_at: string;
};

export default function PantryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PantryItem | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    ingredient_name: "",
    quantity: "",
    unit: "",
    expires_at: "",
  });

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) {
      router.push("/login");
      return;
    }
    setUserId(id);
    fetchPantry(id);
  }, []);

  const fetchPantry = async (uid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/pantry/${uid}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      setError("Failed to load pantry");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    if (!form.ingredient_name.trim()) {
      setError("Ingredient name is required");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/api/pantry/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient_name: form.ingredient_name,
          quantity: form.quantity ? Number(form.quantity) : null,
          unit: form.unit || null,
          expires_at: form.expires_at || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to add item");
      setForm({ ingredient_name: "", quantity: "", unit: "", expires_at: "" });
      setShowForm(false);
      fetchPantry(userId!);
    } catch (err) {
      setError("Failed to add item");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdate = async () => {
    if (!editItem) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(
        `http://localhost:8000/api/pantry/${userId}/${editItem.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: form.quantity ? Number(form.quantity) : null,
            unit: form.unit || null,
            expires_at: form.expires_at || null,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to update item");
      setEditItem(null);
      setForm({ ingredient_name: "", quantity: "", unit: "", expires_at: "" });
      setShowForm(false);
      fetchPantry(userId!);
    } catch (err) {
      setError("Failed to update item");
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (item: PantryItem) => {
    setEditItem(item);
    setForm({
      ingredient_name: item.ingredient_name,
      quantity: item.quantity?.toString() || "",
      unit: item.unit || "",
      expires_at: item.expires_at?.split("T")[0] || "",
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditItem(null);
    setForm({ ingredient_name: "", quantity: "", unit: "", expires_at: "" });
    setError("");
  };

  const isExpiringSoon = (expires_at: string | null) => {
    if (!expires_at) return false;
    const diff = new Date(expires_at).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // within 3 days
  };

  const isExpired = (expires_at: string | null) => {
    if (!expires_at) return false;
    return new Date(expires_at).getTime() < Date.now();
  };

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Your <span className="text-amber-600">Pantry</span>
            </h1>
            <p className="text-gray-500 mt-1">Track what ingredients you have at home.</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setEditItem(null); }}
            className="bg-amber-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600 transition"
          >
            + Add Item
          </button>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-8 border border-amber-100">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {editItem ? `Edit — ${editItem.ingredient_name}` : "Add New Item"}
            </h2>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                name="ingredient_name"
                placeholder="Ingredient name *"
                value={form.ingredient_name}
                onChange={handleChange}
                disabled={!!editItem}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-amber-400 disabled:opacity-50"
              />
              <input
                name="quantity"
                type="number"
                placeholder="Quantity (e.g. 2)"
                value={form.quantity}
                onChange={handleChange}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-amber-400"
              />
              <input
                name="unit"
                placeholder="Unit (e.g. kg, cups, pieces)"
                value={form.unit}
                onChange={handleChange}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-amber-400"
              />
              <input
                name="expires_at"
                type="date"
                value={form.expires_at}
                onChange={handleChange}
                className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={editItem ? handleUpdate : handleAdd}
                disabled={adding}
                className="bg-amber-500 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition disabled:opacity-50"
              >
                {adding ? "Saving..." : editItem ? "Update Item" : "Add Item"}
              </button>
              <button
                onClick={closeForm}
                className="border border-gray-200 text-gray-600 px-6 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pantry Items */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🏠</p>
            <p className="text-lg font-medium">Your pantry is empty</p>
            <p className="text-sm">Add some ingredients to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-5 shadow-sm border-2 transition ${
                  isExpired(item.expires_at)
                    ? "border-red-200"
                    : isExpiringSoon(item.expires_at)
                    ? "border-yellow-200"
                    : "border-transparent"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-800 capitalize">
                    {item.ingredient_name}
                  </h3>
                  <button
                    onClick={() => openEdit(item)}
                    className="text-xs text-amber-500 hover:text-amber-700 font-medium"
                  >
                    Edit
                  </button>
                </div>

                {item.quantity && (
                  <p className="text-sm text-gray-500">
                    {item.quantity} {item.unit || ""}
                  </p>
                )}

                {item.expires_at && (
                  <p className={`text-xs mt-2 font-medium ${
                    isExpired(item.expires_at)
                      ? "text-red-500"
                      : isExpiringSoon(item.expires_at)
                      ? "text-yellow-500"
                      : "text-gray-400"
                  }`}>
                    {isExpired(item.expires_at)
                      ? "⚠️ Expired"
                      : isExpiringSoon(item.expires_at)
                      ? "⏰ Expiring soon"
                      : `Expires: ${new Date(item.expires_at).toLocaleDateString()}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}