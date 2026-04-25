"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { useSearchParams } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Session = {
  id: string;
  title: string | null;
  created_at: string;
};

export default function ChatPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const GUEST_LIMIT = 3;
  const [messages, setMessages] = useState<Message[]>([]); // Start empty
  const searchParams = useSearchParams();

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt) setInput(prompt);
    const id = localStorage.getItem("user_id");
    const count = parseInt(localStorage.getItem("guest_chat_count") || "0");
    const name = localStorage.getItem("user_name");
    
    setIsLoggedIn(!!id);
    setUserId(id);
    setGuestCount(count);
    setMounted(true);
    setUserName(name);

    // Set welcome message now that we have the name
    setMessages([
      {
        role: "assistant",
        content: `Welcome back ${name ?? "there"}! I'm ready to help you sync your nutrition. What's on the menu today?`,
      },
    ]);

    if (id) fetchSessions(id);
  }, []);

  const fetchSessions = async (uid: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/chat/${uid}/sessions`);
      const data = await res.json();
      // Latest 5 sessions
      setSessions(data.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch sessions", err);
    }
  };

  const loadSession = async (session: Session) => {
    if (!userId) return;
    setLoadingSession(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/chat/${userId}/sessions/${session.id}/messages`
      );
      const data = await res.json();
      const loaded: Message[] = data.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(loaded.length > 0 ? loaded : [{ role: "assistant", content: "No messages in this session yet." }]);
      setSessionId(session.id);
    } catch (err) {
      console.error("Failed to load session", err);
    } finally {
      setLoadingSession(false);
    }
  };

  const startNewChat = () => {
    setMessages([{
      role: "assistant",
      content: `Welcome back ${userName}! I'm ready to help you sync your nutrition. What's on the menu today?`,
    }]);
    setSessionId(null);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!isLoggedIn && guestCount >= GUEST_LIMIT) {
      setShowModal(true);
      return;
    }

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    if (!isLoggedIn) {
      const newCount = guestCount + 1;
      setGuestCount(newCount);
      localStorage.setItem("guest_chat_count", newCount.toString());
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, userId, sessionId }),
      });

      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        // Refresh sessions list
        if (userId) fetchSessions(userId);
      }

      setMessages([...updatedMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages([...updatedMessages, { role: "assistant", content: "I'm having trouble syncing right now. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex font-sans">

      {/* Sidebar — only for logged in users */}
      {isLoggedIn && (
        <aside className="w-64 bg-[#F9FAFB] border-r border-gray-100 flex flex-col px-4 py-8 gap-4">
          <button
            onClick={startNewChat}
            className="bg-[#6D4C97] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#5A3D7A] transition"
          >
            + New Chat
          </button>

          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mt-2">
            Recent Sessions
          </p>

          {sessions.length === 0 ? (
            <p className="text-xs text-gray-400">No past sessions yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition ${
                    sessionId === session.id
                      ? "bg-purple-100 text-purple-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <p className="truncate">{session.title || "NutriSync Chat"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(session.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col px-6 py-12 max-w-4xl mx-auto w-full">

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-[#8B5CF6] font-medium mb-2 text-sm">👋 Personal Assistant</p>
          <h1 className="text-5xl font-bold text-[#111827] tracking-tight">
            Chat with <span className="text-[#6D4C97] italic font-serif">sync</span>
          </h1>
          {mounted && !isLoggedIn && (
            <p className={`text-xs mt-3 font-medium ${guestCount >= GUEST_LIMIT ? "text-red-500" : "text-purple-600"}`}>
              {guestCount}/{GUEST_LIMIT} free messages used —{" "}
              <Link href="/signup" className="underline hover:text-purple-800">
                sign up for unlimited
              </Link>
            </p>
          )}
        </div>

        {/* Chat Window */}
        <div className="flex-1 border-2 border-[#6D4C97]/30 bg-[#F9FAFB] rounded-3xl p-8 flex flex-col gap-6 overflow-y-auto max-h-[550px] shadow-sm">
          {loadingSession ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-gray-400 text-sm animate-pulse">Loading session...</p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-6 py-3 rounded-2xl text-[15px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#6D4C97] text-white rounded-tr-none shadow-md"
                      : "bg-white text-gray-700 border border-gray-100 rounded-tl-none"
                  }`}>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-1">{children}</p>,
                        strong: ({ children }) => <span className="font-semibold">{children}</span>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1">{children}</ol>,
                        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
                        li: ({ children }) => <li>{children}</li>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 text-gray-400 px-6 py-3 rounded-2xl rounded-tl-none text-sm animate-pulse">
                    Syncing response...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="mt-8 flex gap-3 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={
              mounted && !isLoggedIn && guestCount >= GUEST_LIMIT
                ? "Sign up to keep chatting..."
                : "Ask about your meal plan or grocery list..."
            }
            disabled={mounted && !isLoggedIn && guestCount >= GUEST_LIMIT}
            className="flex-1 bg-white border border-gray-200 rounded-2xl px-6 py-4 text-sm outline-none focus:ring-2 focus:ring-[#6D4C97]/20 focus:border-[#6D4C97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={loading || (mounted && !isLoggedIn && guestCount >= GUEST_LIMIT)}
            className="bg-[#6D4C97] text-white px-8 py-4 rounded-xl text-sm font-semibold hover:bg-[#5A3D7A] transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-[#6D4C97]/20"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>
      </div>

      {/* Sign up modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
            <div className="text-4xl mb-4">💬</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">You've used your free messages</h2>
            <p className="text-gray-500 text-sm mb-6">
              Sign up for free to get unlimited access to your NutriSync nutrition assistant.
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