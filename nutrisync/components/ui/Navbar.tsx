"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

const Navbar = () => {
  const router = useRouter();
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

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    setUserName(null);
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 bg-black text-white shadow-lg">

      {/* Left Side: Logo + Nav Links */}
      <div className="flex items-center gap-6">
        <Link href="/" className="hover:opacity-80 transition">
          <Image
            src="/favicon.ico"
            alt="NutriSync logo"
            width={60}
            height={60}
          />
        </Link>

        <div className="flex gap-2">
          <Link href="/dashboard" className="px-4 py-2 rounded-md hover:bg-white/10 transition">
            Dashboard
          </Link>
          <Link href="/about" className="px-4 py-2 rounded-md hover:bg-white/10 transition">
            About Us
          </Link>
        </div>
      </div>

      {/* Right Side: Auth Buttons OR Profile */}
      <div className="flex items-center gap-3">
        {userName ? (
          <>
            <Link
              href="/profile"
              className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-white/10 transition"
            >
              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-sm font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm">{userName}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-md border border-white/20 hover:bg-white hover:text-black transition text-sm"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="px-4 py-2 rounded-md border border-white/20 hover:bg-white hover:text-black transition"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 bg-white text-black font-semibold rounded-md hover:bg-gray-200 transition"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;