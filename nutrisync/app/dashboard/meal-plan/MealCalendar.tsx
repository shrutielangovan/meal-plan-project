"use client";
import { useState } from "react";
import AddMealModal from "./AddMealModal";

type LoggedMeal = {
  id: string;
  description: string;
  meal_slot: string | null;
  logged_at: string;
  calories: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  status?: "logged" | "planned";
};

type GroceryPreview = {
  missing_added_to_grocery: string[];
  pantry_covered: string[];
  grocery_list_id: string | null;
};

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SLOT_EMOJI: Record<string, string> = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎" };
const MAX_FUTURE_DAYS = 7;

interface Props {
  loggedMeals: LoggedMeal[];
  userId: string;
  suggestions: Record<string, string[]>;
  recipes: { id: string; title: string; calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; meal_type: string }[];
  onMealsUpdated: () => void;
}

export default function MealCalendar({ loggedMeals, userId, suggestions, recipes, onMealsUpdated }: Props) {
  // ── IMPORTANT: never mutate this object — always create new Date() copies ──
  const todayRef = new Date();
  const todayStr = new Date(todayRef.getFullYear(), todayRef.getMonth(), todayRef.getDate()).toDateString();

  const maxFutureDate = new Date(todayRef.getFullYear(), todayRef.getMonth(), todayRef.getDate() + MAX_FUTURE_DAYS);

  const [currentMonth, setCurrentMonth] = useState(todayRef.getMonth());
  const [currentYear, setCurrentYear] = useState(todayRef.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalDate, setAddModalDate] = useState<Date | null>(null);
  const [groceryPreview, setGroceryPreview] = useState<GroceryPreview | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => new Date(y, m, 1).getDay();

  const getMealsForDate = (date: Date) =>
    loggedMeals.filter((m) => {
      const d = new Date(m.logged_at);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString() === 
             new Date(date.getFullYear(), date.getMonth(), date.getDate()).toDateString();
    });

  // Safe date comparisons — use date-only strings, never mutate todayRef
  const isToday = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).toDateString() === todayStr;

  const isFutureDate = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()) >
    new Date(todayRef.getFullYear(), todayRef.getMonth(), todayRef.getDate());

  const isBeyondPlanning = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()) > maxFutureDate;

  const isPast = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()) <
    new Date(todayRef.getFullYear(), todayRef.getMonth(), todayRef.getDate());

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const handleDayClick = (date: Date) => {
    if (isBeyondPlanning(date)) return;
    setSelectedDate(date);
    setGroceryPreview(null);
    const meals = getMealsForDate(date);
    if (meals.length > 0) setShowViewModal(true);
    else { setAddModalDate(date); setShowAddModal(true); }
  };

  const handleAddFromViewModal = () => {
    setShowViewModal(false);
    setAddModalDate(selectedDate);
    setShowAddModal(true);
  };

  const handleSaveMeals = async (date: Date, meals: Omit<LoggedMeal, "id" | "logged_at">[]) => {
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayOnly = new Date(todayRef.getFullYear(), todayRef.getMonth(), todayRef.getDate());
    const isTodayDate = dateOnly.toDateString() === todayOnly.toDateString();
    const isFuture = dateOnly > todayOnly;

    for (const meal of meals) {
      if (isFuture) {
        const res = await fetch(`http://localhost:8000/api/meal-plans/${userId}/log/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...meal, logged_at: date.toISOString() }),
        });
        if (!res.ok) throw new Error("Plan failed");
        const data = await res.json();
        if (data.missing_added_to_grocery?.length > 0) {
          setGroceryPreview({
            missing_added_to_grocery: data.missing_added_to_grocery,
            pantry_covered: data.pantry_covered,
            grocery_list_id: data.grocery_list_id,
          });
          setShowViewModal(true);
        }
      } else if (isTodayDate) {
        const res = await fetch(`http://localhost:8000/api/meal-plans/${userId}/log`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meal),
        });
        if (!res.ok) throw new Error("Log failed");
      } else {
        const res = await fetch(`http://localhost:8000/api/meal-plans/${userId}/log/backdate`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...meal, logged_at: date.toISOString() }),
        });
        if (!res.ok) throw new Error("Backdate failed");
      }
    }
    onMealsUpdated();
  };

  const handleDeleteMeal = async (mealId: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`http://localhost:8000/api/meal-plans/${userId}/log/${mealId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setConfirmDeleteId(null);
      onMealsUpdated();
      const remaining = selectedDate ? getMealsForDate(selectedDate).filter(m => m.id !== mealId) : [];
      if (remaining.length === 0) setShowViewModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const selectedMeals = selectedDate ? getMealsForDate(selectedDate) : [];
  const selectedDateIsFuture = selectedDate ? isFutureDate(selectedDate) : false;

  // Only sum macros for logged meals — planned excluded from nutrition display
  const loggedOnly = selectedMeals.filter(m => m.status !== "planned");
  const totalCals = loggedOnly.reduce((s, m) => s + (m.calories || 0), 0);
  const totalProtein = loggedOnly.reduce((s, m) => s + (m.protein_g || 0), 0);
  const totalCarbs = loggedOnly.reduce((s, m) => s + (m.carbs_g || 0), 0);
  const totalFat = loggedOnly.reduce((s, m) => s + (m.fat_g || 0), 0);

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">{MONTHS[currentMonth]} {currentYear}</h2>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">‹</button>
            <button onClick={() => { setCurrentMonth(todayRef.getMonth()); setCurrentYear(todayRef.getFullYear()); }}
              className="px-3 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition">Today</button>
            <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((day) => <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">{day}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(currentYear, currentMonth, i + 1);
            const meals = getMealsForDate(date);
            const hasMeals = meals.length > 0;
            const hasPlanned = meals.some(m => m.status === "planned");
            const hasLogged = meals.some(m => m.status !== "planned");
            const todayDate = isToday(date);
            const future = isFutureDate(date);
            const beyondPlan = isBeyondPlanning(date);
            const past = isPast(date);

            return (
              <div
                key={i}
                onClick={() => !beyondPlan && handleDayClick(date)}
                title={
                  beyondPlan ? "Planning up to 7 days ahead only"
                  : future && !hasMeals ? "Click to plan a meal"
                  : hasMeals ? "Click to view meals"
                  : past ? "Click to add a past meal"
                  : "Click to log a meal"
                }
                className={`
                  relative flex flex-col items-center py-1.5 px-1 rounded-xl transition min-h-[44px]
                  ${beyondPlan ? "opacity-20 cursor-default" : "cursor-pointer hover:bg-purple-50"}
                  ${todayDate ? "bg-purple-700 hover:bg-purple-700" : ""}
                  ${hasLogged && !todayDate && !hasPlanned ? "bg-green-50" : ""}
                  ${hasPlanned && !hasLogged && !todayDate ? "bg-blue-50 border-2 border-dashed border-blue-300" : ""}
                  ${hasPlanned && hasLogged && !todayDate ? "bg-green-50 border-2 border-dashed border-blue-300" : ""}
                  ${past && !hasMeals ? "hover:bg-amber-50" : ""}
                  ${future && !beyondPlan && !hasMeals ? "hover:bg-blue-50" : ""}
                `}
              >
                <span className={`text-sm font-medium ${
                  todayDate ? "text-white"
                  : future && !beyondPlan ? "text-blue-500"
                  : "text-gray-700"
                }`}>{i + 1}</span>

                {/* Dots — blue for planned, purple for logged */}
                {hasMeals && (
                  <div className="flex gap-0.5 mt-0.5">
                    {meals.slice(0, 3).map((m, idx) => (
                      <div key={idx} className={`w-1.5 h-1.5 rounded-full ${
                        todayDate ? "bg-white"
                        : m.status === "planned" ? "bg-blue-400"
                        : "bg-purple-400"
                      }`} />
                    ))}
                  </div>
                )}

                {!hasMeals && future && !beyondPlan && <span className="text-blue-300 text-xs mt-0.5">+</span>}
                {!hasMeals && past && <span className="text-gray-300 text-xs mt-0.5">+</span>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-50 text-xs text-gray-400">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-purple-700" /><span>Today</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-green-100 border border-green-200" /><span>Logged</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-100 border-2 border-dashed border-blue-300" /><span>Planned</span></div>
          <span>← Click past/today/next 7 days to log or plan</span>
        </div>
      </div>

      {/* VIEW MODAL */}
      {showViewModal && selectedDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-400">{selectedMeals.length} meals</p>
                  {selectedDateIsFuture && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">📅 Planned</span>
                  )}
                </div>
              </div>
              <button onClick={() => { setShowViewModal(false); setConfirmDeleteId(null); setGroceryPreview(null); }}
                className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Nutrition — only for logged meals, shown for past AND today */}
            {!selectedDateIsFuture && loggedOnly.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: "Calories", value: Math.round(totalCals), icon: "🔥" },
                  { label: "Protein", value: `${Math.round(totalProtein)}g`, icon: "💪" },
                  { label: "Carbs", value: `${Math.round(totalCarbs)}g`, icon: "🌾" },
                  { label: "Fat", value: `${Math.round(totalFat)}g`, icon: "🥑" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-50 rounded-xl p-2 text-center">
                    <p className="text-base mb-0.5">{stat.icon}</p>
                    <p className="text-xs font-semibold text-gray-800">{stat.value}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Future notice */}
            {selectedDateIsFuture && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4 text-xs text-blue-600">
                📅 Nutrition will be tracked once this day arrives
              </div>
            )}

            {/* Grocery preview */}
            {groceryPreview && groceryPreview.missing_added_to_grocery.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-amber-700 mb-1">🛒 Added to your grocery list</p>
                <p className="text-xs text-amber-600">{groceryPreview.missing_added_to_grocery.join(", ")}</p>
                {groceryPreview.pantry_covered.length > 0 && (
                  <p className="text-xs text-green-600 mt-1">✓ In pantry: {groceryPreview.pantry_covered.join(", ")}</p>
                )}
                <a href="/dashboard/grocery" className="text-xs text-amber-700 underline mt-1 block">View grocery list →</a>
              </div>
            )}

            {/* Meal list */}
            <div className="flex flex-col gap-3 mb-5">
              {selectedMeals.map((meal) => (
                <div key={meal.id}>
                  <div className={`flex items-start gap-3 p-3 rounded-xl transition ${
                    confirmDeleteId === meal.id ? "bg-red-50 border border-red-200"
                    : meal.status === "planned" ? "bg-blue-50 border border-blue-100"
                    : "bg-gray-50"
                  }`}>
                    <span className="text-lg flex-shrink-0">{SLOT_EMOJI[meal.meal_slot || ""] || "🍽️"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{meal.description}</p>
                        {meal.status === "planned" && <span className="text-xs text-blue-400 flex-shrink-0">📅</span>}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-400">
                        {meal.calories && <span>🔥 {Math.round(meal.calories)} cal</span>}
                        {meal.protein_g && <span>💪 {Math.round(meal.protein_g)}g</span>}
                        <span className="capitalize">{meal.meal_slot || "meal"}</span>
                      </div>
                    </div>
                    {confirmDeleteId === meal.id ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleDeleteMeal(meal.id)} disabled={deleting}
                          className="px-2.5 py-1 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition disabled:opacity-50">
                          {deleting ? "..." : "Remove"}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-300 transition">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(meal.id)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition"
                        title="Remove meal">🗑</button>
                    )}
                  </div>
                  {confirmDeleteId === meal.id && (
                    <p className="text-xs text-red-500 mt-1 px-1">
                      {meal.status === "planned"
                        ? "Remove this planned meal? Grocery items added for it will also be removed."
                        : "Remove this meal entry? This can't be undone."}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleAddFromViewModal}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-purple-200 text-purple-600 text-sm font-medium hover:bg-purple-50 hover:border-purple-400 transition">
              <span>+</span>
              <span>{selectedDateIsFuture ? "Plan another meal for this day" : "Add or re-use a meal for this day"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ADD / PLAN MODAL */}
      {showAddModal && (
        <AddMealModal
          date={addModalDate}
          loggedMeals={loggedMeals}
          suggestions={suggestions}
          recipes={recipes}
          onClose={() => { setShowAddModal(false); setAddModalDate(null); }}
          onSave={handleSaveMeals}
        />
      )}
    </>
  );
}
