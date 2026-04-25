"use client";
import { useState } from "react";

type LoggedMeal = {
  id: string;
  description: string;
  meal_slot: string | null;
  logged_at: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const GOALS = { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

const SLOT_EMOJI: Record<string, string> = {
  breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎",
};

export default function NutritionCalendar({ logs }: { logs: LoggedMeal[] }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const getDaysInMonth = (month: number, year: number) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (month: number, year: number) =>
    new Date(year, month, 1).getDay();

  const getLogsForDate = (date: Date) =>
    logs.filter((m) => new Date(m.logged_at).toDateString() === date.toDateString());

  const getTotalsForDate = (date: Date) => {
    const dayLogs = getLogsForDate(date);
    return {
      calories: dayLogs.reduce((s, m) => s + (m.calories || 0), 0),
      protein_g: dayLogs.reduce((s, m) => s + (m.protein_g || 0), 0),
      carbs_g: dayLogs.reduce((s, m) => s + (m.carbs_g || 0), 0),
      fat_g: dayLogs.reduce((s, m) => s + (m.fat_g || 0), 0),
      count: dayLogs.length,
    };
  };

  const getCalorieColor = (calories: number) => {
    if (calories === 0) return "";
    const pct = (calories / GOALS.calories) * 100;
    if (pct >= 90) return "bg-green-100 text-green-700";
    if (pct >= 50) return "bg-amber-100 text-amber-700";
    return "bg-red-50 text-red-400";
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const isToday = (date: Date) => date.toDateString() === today.toDateString();
  const isFuture = (date: Date) => date > today;

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const selectedLogs = selectedDate ? getLogsForDate(selectedDate) : [];
  const selectedTotals = selectedDate ? getTotalsForDate(selectedDate) : null;

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <div className="flex gap-2">
            <button onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              ‹
            </button>
            <button
              onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); }}
              className="px-3 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition">
              Today
            </button>
            <button onClick={handleNextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition">
              ›
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">{day}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(currentYear, currentMonth, i + 1);
            const totals = getTotalsForDate(date);
            const hasLogs = totals.count > 0;
            const future = isFuture(date);
            const todayDate = isToday(date);
            const colorClass = getCalorieColor(totals.calories);

            return (
              <div
                key={i}
                onClick={() => !future && hasLogs && setSelectedDate(date)}
                className={`
                  relative flex flex-col items-center py-1.5 px-1 rounded-xl transition min-h-[52px]
                  ${future ? "opacity-30 cursor-default" : hasLogs ? "cursor-pointer hover:scale-105" : "cursor-default"}
                  ${todayDate ? "ring-2 ring-purple-500" : ""}
                  ${hasLogs && !todayDate ? colorClass : ""}
                  ${todayDate && hasLogs ? "bg-purple-100" : ""}
                  ${todayDate && !hasLogs ? "bg-purple-50" : ""}
                `}
              >
                <span className={`text-sm font-medium ${todayDate ? "text-purple-700" : "text-gray-700"}`}>
                  {i + 1}
                </span>
                {hasLogs && (
                  <>
                    <p className="text-xs font-bold mt-0.5" style={{ fontSize: "9px" }}>
                      {Math.round(totals.calories)}
                    </p>
                    <p className="text-gray-400" style={{ fontSize: "8px" }}>kcal</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {Array.from({ length: Math.min(totals.count, 3) }).map((_, idx) => (
                        <div key={idx} className="w-1 h-1 rounded-full bg-current opacity-60" />
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100" />
            <span className="text-xs text-gray-400">Goal met (90%+)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-100" />
            <span className="text-xs text-gray-400">Partial (50-90%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-red-50" />
            <span className="text-xs text-gray-400">Low (under 50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-2 ring-purple-500" />
            <span className="text-xs text-gray-400">Today</span>
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDate && selectedTotals && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[85vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedTotals.count} meals logged</p>
              </div>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            {/* Macro summary */}
            <div className="grid grid-cols-4 gap-2 mb-5">
              {[
                { label: "Calories", value: Math.round(selectedTotals.calories), unit: "kcal", icon: "🔥", goal: GOALS.calories, color: "text-purple-600" },
                { label: "Protein", value: Math.round(selectedTotals.protein_g), unit: "g", icon: "💪", goal: GOALS.protein_g, color: "text-green-600" },
                { label: "Carbs", value: Math.round(selectedTotals.carbs_g), unit: "g", icon: "🌾", goal: GOALS.carbs_g, color: "text-amber-600" },
                { label: "Fat", value: Math.round(selectedTotals.fat_g), unit: "g", icon: "🥑", goal: GOALS.fat_g, color: "text-red-500" },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-base mb-1">{stat.icon}</p>
                  <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-400">{stat.unit}</p>
                  <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${stat.color.replace("text", "bg")}`}
                      style={{ width: `${Math.min((stat.value / stat.goal) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-300 mt-1">/{stat.goal}</p>
                </div>
              ))}
            </div>

            {/* Goal status */}
            <div className={`text-center text-xs font-medium px-3 py-2 rounded-xl mb-5 ${
              selectedTotals.calories >= GOALS.calories * 0.9
                ? "bg-green-50 text-green-600"
                : selectedTotals.calories >= GOALS.calories * 0.5
                ? "bg-amber-50 text-amber-600"
                : "bg-red-50 text-red-500"
            }`}>
              {selectedTotals.calories >= GOALS.calories * 0.9
                ? "✓ Calorie goal met!"
                : selectedTotals.calories >= GOALS.calories * 0.5
                ? `${Math.round(GOALS.calories - selectedTotals.calories)} kcal short of goal`
                : "Low calorie day"}
            </div>

            {/* Meals list */}
            <h3 className="font-semibold text-gray-800 mb-3 text-sm">Meals</h3>
            <div className="flex flex-col gap-3">
              {selectedLogs.map((meal) => (
                <div key={meal.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-lg">{SLOT_EMOJI[meal.meal_slot || ""] || "🍽️"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{meal.description}</p>
                    <p className="text-xs text-gray-400 capitalize mb-1">{meal.meal_slot}</p>
                    <div className="flex gap-3 text-xs">
                      {meal.calories && <span className="text-purple-600 font-medium">🔥 {Math.round(meal.calories)} kcal</span>}
                      {meal.protein_g && <span className="text-green-600">💪 {Math.round(meal.protein_g)}g</span>}
                      {meal.carbs_g && <span className="text-amber-600">🌾 {Math.round(meal.carbs_g)}g</span>}
                      {meal.fat_g && <span className="text-red-500">🥑 {Math.round(meal.fat_g)}g</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}