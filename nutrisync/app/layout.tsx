import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "NutriSync",
  description: "Your AI-powered weekly meal planner. Get personalized meal plans, nutrition breakdowns, and smart grocery lists — tailored to your diet, goals, and pantry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}