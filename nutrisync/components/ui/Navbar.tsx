"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";

const Navbar = () => {
  const router   = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);
  const [avatar, setAvatar]     = useState<string | null>(null);

  useEffect(() => {
    const userName = localStorage.getItem("user_name");
    const userId   = localStorage.getItem("user_id");
    setUserName(userName);

    // Load avatar from DB on mount so it persists across refreshes
    if (userId) {
      fetch(`http://localhost:8000/api/users/${userId}`)
        .then(r => r.json())
        .then(data => { if (data.profile_picture) setAvatar(data.profile_picture); })
        .catch(() => {});
    }

    const handleAuthChange   = () => setUserName(localStorage.getItem("user_name"));
    const handleAvatarChange = (e: Event) => {
      const url = (e as CustomEvent).detail;
      if (url) setAvatar(url);
    };

    window.addEventListener("auth-change",   handleAuthChange);
    window.addEventListener("avatar-change", handleAvatarChange);
    return () => {
      window.removeEventListener("auth-change",   handleAuthChange);
      window.removeEventListener("avatar-change", handleAvatarChange);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_name");
    setUserName(null);
    setAvatar(null);
    window.dispatchEvent(new Event("auth-change"));
    router.push("/");
  };

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`px-4 py-2 rounded-md transition text-sm ${
        pathname === href ? "bg-white/15 text-white font-medium" : "hover:bg-white/10 text-white/80"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-3 bg-black text-white shadow-lg">

      {/* Left: Logo + Nav Links */}
      <div className="flex items-center gap-6">
        <Link href="/" className="hover:opacity-80 transition">
          <Image src="/favicon.ico" alt="NutriSync logo" width={40} height={40} />
        </Link>
        <div className="flex gap-1">
          {navLink("/dashboard", "Dashboard")}
          {navLink("/about",     "About Us")}
          {navLink("/support",   "Support")}
        </div>
      </div>

      {/* Right: Auth or Profile */}
      <div className="flex items-center gap-3">
        {userName ? (
          <>
            <Link
              href="/profile"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition"
            >
              <div className="w-8 h-8 rounded-full bg-purple-600 overflow-hidden flex items-center justify-center text-sm font-semibold flex-shrink-0">
                {avatar
                  ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                  : userName.charAt(0).toUpperCase()
                }
              </div>
              <span className="text-sm text-white/90">{userName}</span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 rounded-lg border border-white/20 hover:bg-white hover:text-black transition text-sm"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login"
              className="px-4 py-1.5 rounded-lg border border-white/20 hover:bg-white hover:text-black transition text-sm">
              Login
            </Link>
            <Link href="/signup"
              className="px-4 py-1.5 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition text-sm">
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;