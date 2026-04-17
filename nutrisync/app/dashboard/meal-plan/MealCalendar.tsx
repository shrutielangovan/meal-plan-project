"use client";
import { useState } from "react";

type LoggedMeal = {
  id: string;
  description: string;
  meal_slot: string | null;
  logged_at: string;
  calories: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const SLOT_EMOJI: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

export default function MealCalendar({ loggedMeals }: { loggedMeals: LoggedMeal[] }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [showModal, setShowModal] = useState(false);

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getMealsForDate = (date: Date) => {
    return loggedMeals.filter((m) => {
      const logDate = new Date(m.logged_at);
      return logDate.toDateString() === date.toDateString();
    });
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (date: Date) => {
    const meals = getMealsForDate(date);
    if (meals.length > 0) {
      setSelectedDate(date);
      setShowModal(true);
    }
  };

  const isToday = (date: Date) => date.toDateString() === today.toDateString();
  const isFuture = (date: Date) => date > today;

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);

  const selectedMeals = selectedDate ? getMealsForDate(selectedDate) : [];
  const totalCals = selectedMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalProtein = selectedMeals.reduce((sum, m) => sum + (m.protein_g || 0), 0);
  const totalCarbs = selectedMeals.reduce((sum, m) => sum + (m.carbs_g || 0), 0);
  const totalFat = selectedMeals.reduce((sum, m) => sum + (m.fat_g || 0), 0);

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 text-lg">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
            >
              ‹
            </button>
            <button
              onClick={() => {
                setCurrentMonth(today.getMonth());
                setCurrentYear(today.getFullYear());
              }}
              className="px-3 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition"
            >
              ›
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-gray-400 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for first day offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const date = new Date(currentYear, currentMonth, i + 1);
            const meals = getMealsForDate(date);
            const hasMeals = meals.length > 0;
            const todayDate = isToday(date);
            const future = isFuture(date);

            return (
              <div
                key={i}
                onClick={() => !future && handleDayClick(date)}
                className={`
                  relative flex flex-col items-center py-1.5 px-1 rounded-xl transition
                  ${future ? "opacity-30 cursor-default" : hasMeals ? "cursor-pointer hover:bg-purple-50" : "cursor-default"}
                  ${todayDate ? "bg-purple-700 text-white" : ""}
                  ${hasMeals && !todayDate ? "bg-green-50" : ""}
                `}
              >
                <span className={`text-sm font-medium ${todayDate ? "text-white" : "text-gray-700"}`}>
                  {i + 1}
                </span>

                {/* Meal dots */}
                {hasMeals && (
                  <div className="flex gap-0.5 mt-0.5">
                    {meals.slice(0, 3).map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-1 h-1 rounded-full ${todayDate ? "bg-white" : "bg-purple-400"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-50">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-purple-700" />
            <span className="text-xs text-gray-400">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-100 border border-green-200" />
            <span className="text-xs text-gray-400">Meals logged</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-100" />
            <span className="text-xs text-gray-400">No logs</span>
          </div>
        </div>
      </div>

      {/* Day detail modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl max-h-[80vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">
                  {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{selectedMeals.length} meals logged</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl"
              >
                ✕
              </button>
            </div>

            {/* Daily nutrition summary */}
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

            {/* Meal list */}
            <div className="flex flex-col gap-3">
              {selectedMeals.map((meal) => (
                <div key={meal.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <span className="text-lg">
                    {SLOT_EMOJI[meal.meal_slot || ""] || "🍽️"}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{meal.description}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      {meal.calories && <span>🔥 {Math.round(meal.calories)} cal</span>}
                      {meal.protein_g && <span>💪 {Math.round(meal.protein_g)}g</span>}
                      <span className="capitalize">{meal.meal_slot || "meal"}</span>
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