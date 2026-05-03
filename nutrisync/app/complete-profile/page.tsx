"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    household_size:    "",
    budget_weekly:     "",
    cooking_time_mins: "",
  });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const userId       = localStorage.getItem("user_id");
    const isGoogleUser = localStorage.getItem("is_google_user");
    if (!userId)       { router.push("/login");     return; }
    if (!isGoogleUser) { router.push("/dashboard"); return; }
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!form.household_size || !form.budget_weekly || !form.cooking_time_mins) {
      setError("Please fill in all fields");
      return;
    }

    setLoading(true);
    setError("");

    const userId = localStorage.getItem("user_id");
    if (!userId) { router.push("/login"); return; }

    try {
      const res = await fetch(`http://localhost:8000/api/users/${userId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          household_size:    Number(form.household_size),
          budget_weekly:     Number(form.budget_weekly),
          cooking_time_mins: Number(form.cooking_time_mins),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to save profile");
        return;
      }

      localStorage.removeItem("is_google_user");
      router.push("/dashboard");
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F2EB] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md">

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span className="font-medium text-purple-600">Step 2 of 3</span>
            <span>Almost there!</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-purple-600 h-1.5 rounded-full" style={{ width: "66%" }} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Complete your <span className="text-purple-700">profile</span>
        </h1>
        <p className="text-gray-400 text-sm mb-6">
          Help us personalise your meal plans
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Household size</label>
            <input
              name="household_size"
              type="number"
              min="1"
              placeholder="e.g. 2 people"
              onChange={handleChange}
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Weekly grocery budget</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                name="budget_weekly"
                type="number"
                min="0"
                placeholder="e.g. 150"
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg pl-7 pr-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Max cooking time per meal</label>
            <div className="relative">
              <input
                name="cooking_time_mins"
                type="number"
                min="1"
                placeholder="e.g. 30"
                onChange={handleChange}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">mins</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-purple-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-800 transition disabled:opacity-50 mt-2"
          >
            {loading ? "Saving..." : "Save & Go to Dashboard →"}
          </button>
        </div>
      </div>
    </main>
  );
}