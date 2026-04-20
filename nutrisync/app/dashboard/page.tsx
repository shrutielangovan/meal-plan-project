"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const getCards = (isLoggedIn: boolean, guestMealCount: number, guestChatCount: number) => [
  {
    title: "Meal Plan",
    description: isLoggedIn 
      ? "View and manage your personalized daily meal plan."
      : "Explore sample meal plans — vegan and non-veg options.",
    icon: "🗓️",
    href: "/dashboard/meal-plan",
    color: "bg-purple-50 border-purple-200 hover:border-purple-400",
    iconBg: "bg-purple-100",
    locked: false,
    guestLimit: undefined,  
    guestUsed: undefined,   
    showLimit: false,       
  },
  {
    title: "Chat with Agent",
    description: "Ask your AI nutrition assistant anything.",
    icon: "🤖",
    href: "/dashboard/chat",
    color: "bg-blue-50 border-blue-200 hover:border-blue-400",
    iconBg: "bg-blue-100",
    locked: false,
    guestLimit: 3,
    guestUsed: guestChatCount,
    showLimit: !isLoggedIn,
  },
  {
    title: "Pantry",
    description: "Track what ingredients you have at home.",
    icon: "🏠",
    href: "/dashboard/pantry",
    color: isLoggedIn
      ? "bg-amber-50 border-amber-200 hover:border-amber-400"
      : "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60",
    iconBg: isLoggedIn ? "bg-amber-100" : "bg-gray-100",
    locked: !isLoggedIn,
    showLimit: false,
  },
  {
    title: "Nutrition Tracker",
    description: "Monitor your daily macros, calories and health goals.",
    icon: "📊",
    href: "/dashboard/nutrition",
    color: isLoggedIn
      ? "bg-green-50 border-green-200 hover:border-green-400"
      : "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60",
    iconBg: isLoggedIn ? "bg-green-100" : "bg-gray-100",
    locked: !isLoggedIn,
    showLimit: false,
  },
  {
    title: "Grocery List",
    description: "Smart shopping list generated from your meal plan.",
    icon: "🛒",
    href: "/dashboard/grocery",
    color: "bg-orange-50 border-orange-200 hover:border-orange-400",
    iconBg: "bg-orange-100",
    locked: !isLoggedIn,
    showLimit: false,
  },
];

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [guestMealCount, setGuestMealCount] = useState(0);
  const [guestChatCount, setGuestChatCount] = useState(0);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem("user_name");
    const mealCount = parseInt(localStorage.getItem("guest_meal_count") || "0");
    const chatCount = parseInt(localStorage.getItem("guest_chat_count") || "0");
    setIsLoggedIn(!!name);
    setUserName(name);
    setGuestMealCount(mealCount);
    setGuestChatCount(chatCount);
  }, []);

  const handleCardClick = (card: ReturnType<typeof getCards>[0]) => {
    if (card.locked) {
      setShowModal(true);
      return;
    }
    if (card.showLimit && card.guestUsed !== undefined && card.guestLimit !== undefined) {
      if (card.guestUsed >= card.guestLimit) {
        setShowModal(true);
        return;
      }
    }
    router.push(card.href);
  };

  const cards = getCards(isLoggedIn, guestMealCount, guestChatCount);

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-6 py-12">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          {isLoggedIn ? (
            <>
              <p className="text-xl text-purple-600 font-medium mb-1">👋 Hey, {userName}!</p>
              <p className="text-lg text-black-500 mt-2">What would you like to do today?</p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-gray-900">
                Explore <span className="text-purple-700">NutriSync</span>
              </h1>
              <p className="text-gray-500 mt-2">
                Try it out — or{" "}
                <Link href="/signup" className="text-purple-600 hover:underline font-medium">
                  sign up
                </Link>{" "}
                for full access.
              </p>
            </>
          )}
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-6">
          {cards.map((card, index) => (
            <div
              key={card.title}
              onClick={() => handleCardClick(card)}
              className={`border-2 rounded-2xl p-6 transition-all duration-200 cursor-pointer ${card.color}
            ${index < 2 ? "md:col-span-3" : "md:col-span-2"}`} 
              
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${card.iconBg}`}>
                  {card.icon}
                </div>
                {card.locked && (
                  <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-full">
                    🔒 Login required
                  </span>
                )}
                {card.showLimit && card.guestLimit && (
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    card.guestUsed! >= card.guestLimit
                      ? "bg-red-100 text-red-500"
                      : "bg-purple-100 text-purple-600"
                  }`}>
                    {card.guestUsed}/{card.guestLimit} used
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">{card.title}</h2>
              <p className="text-gray-500 text-sm">{card.description}</p>
              {!card.locked && (
                <p className="text-purple-600 text-sm font-medium mt-4">
                  {card.showLimit && card.guestUsed! >= card.guestLimit!
                    ? "Sign up to continue →"
                    : "Go →"}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sign up modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign up to continue</h2>
            <p className="text-gray-500 text-sm mb-6">
              Create a free account to unlock your pantry, nutrition tracker, and unlimited meal plans and chats.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/signup" className="bg-purple-700 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-800 transition">
                Create Free Account
              </Link>
              <Link href="/login" className="border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition">
                Already have an account? Login
              </Link>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xs hover:text-gray-600">
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}