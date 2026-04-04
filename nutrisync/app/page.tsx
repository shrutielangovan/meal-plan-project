"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Home() {
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const name = localStorage.getItem("user_name");
    setUserName(name);

    const handleAuthChange = () => {
      setUserName(localStorage.getItem("user_name"));
    };

    window.addEventListener("auth-change", handleAuthChange);
    return () => window.removeEventListener("auth-change", handleAuthChange);
  }, []);

  return (
    <div>
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        {userName ? (
          <>
            <p className="text-lg text-purple-600 font-medium mb-2">
              👋 Welcome back, {userName}!
            </p>
            <h1 className="text-5xl font-bold text-center">
              Ready to <span style={{ color: '#6D4298' }}>sync</span> today?
            </h1>
            <p className="mt-4 text-xl text-gray-600 text-center max-w-xl">
              Jump back into your meal plan, check your grocery list, or chat with your nutrition assistant.
            </p>
            <div className="mt-8 flex gap-4">
              <Link href="/dashboard" className="px-6 py-3 bg-[#6D4298] text-white rounded-md hover:bg-purple-800 transition">
                Go to Dashboard
              </Link>
              <Link href="/dashboard/chat" className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-100 transition">
                Chat with Agent
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-bold text-center">
              Welcome to <span style={{ color: '#6D4298' }}>NutriSync</span>
            </h1>
            <p className="mt-4 text-xl text-gray-600 text-center max-w-xl">
              Your personalized nutrition assistant. Sync your meals, track your macros, and achieve your health goals with ease.
            </p>
            <div className="mt-8 flex gap-4">
              <Link href="/signup" className="px-6 py-3 bg-[#6D4298] text-white rounded-md hover:bg-gray-900 transition">
                Get Started
              </Link>
              <Link href="/about" className="px-6 py-3 border border-gray-300 rounded-md hover:bg-gray-100 transition">
                Learn More
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}