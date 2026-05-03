"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Ticket {
  id:                  string;
  ticket_id:           string;
  subject:             string;
  message:             string;
  status:              string;
  follow_up_requested: boolean;
  follow_up_count:     number;
  created_at:          string;
}

export default function SupportPage() {
  const router  = useRouter();
  const [userId, setUserId]       = useState<string | null>(null);
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [form, setForm]           = useState({ subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [success, setSuccess]     = useState("");
  const [error, setError]         = useState("");
  const [followUpLoading, setFollowUpLoading] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("user_id");
    if (!id) { router.push("/login"); return; }
    setUserId(id);
    loadTickets(id);
  }, [router]);

  const loadTickets = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/support/tickets/${id}`);
      if (res.ok) setTickets(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      setError("Please fill in both subject and message");
      return;
    }
    if (!userId) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`http://localhost:8000/api/support/submit?user_id=${userId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.subject.trim(),
          message: form.message.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || "Failed to submit ticket");
        return;
      }

      setSuccess("Ticket submitted! You will receive a confirmation email shortly.");
      setForm({ subject: "", message: "" });
      loadTickets(userId);
    } catch {
      setError("Could not connect to server");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFollowUp = async (ticketId: string) => {
    if (!userId) return;
    setFollowUpLoading(ticketId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`http://localhost:8000/api/support/followup?user_id=${userId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (res.ok) {
        setSuccess("Follow-up sent — support team has been notified.");
        loadTickets(userId);
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to send follow-up");
      }
    } catch {
      setError("Could not send follow-up");
    } finally {
      setFollowUpLoading(null);
    }
  };

  const formatDate = (str: string) =>
    new Date(str).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const statusStyle = (status: string) => {
    switch (status) {
      case "open":     return "bg-yellow-50 text-yellow-700 border border-yellow-200";
      case "resolved": return "bg-green-50 text-green-700 border border-green-200";
      case "closed":   return "bg-gray-100 text-gray-500 border border-gray-200";
      default:         return "bg-blue-50 text-blue-700 border border-blue-200";
    }
  };

  return (
    <main className="min-h-screen bg-[#F5F2EB] px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-gray-400 text-sm mt-1">
            Submit a ticket and we will get back to you. You will receive an email confirmation.
          </p>
        </div>

        {/* Banners */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
            <span>✓</span> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
            <span>✕</span> {error}
          </div>
        )}

        {/* Submit form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Submit a Ticket</h2>
          <p className="text-xs text-gray-400 mb-4">
            Describe your issue clearly. Our team will respond via email.
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Subject</label>
              <input
                placeholder="e.g. Cannot access my meal plan"
                value={form.subject}
                onChange={e => setForm({ ...form, subject: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Message</label>
              <textarea
                placeholder="Describe your issue in detail..."
                value={form.message}
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={5}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-purple-700 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-800 transition disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Ticket"}
            </button>
          </div>
        </div>

        {/* Ticket list */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">My Tickets</h2>
            {tickets.length > 0 && (
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
              <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              Loading tickets...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm text-gray-400">No tickets submitted yet.</p>
              <p className="text-xs text-gray-300 mt-1">Use the form above to get help.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tickets.map(ticket => (
                <div
                  key={ticket.id}
                  className="border border-gray-100 rounded-xl p-4 hover:border-purple-100 hover:bg-purple-50/30 transition"
                >
                  {/* Top row — ticket ID + status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                      {ticket.ticket_id}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(ticket.status)}`}>
                      {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                    </span>
                  </div>

                  {/* Subject + message */}
                  <p className="text-sm font-semibold text-gray-800 mb-1">{ticket.subject}</p>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
                    {ticket.message}
                  </p>

                  {/* Bottom row — date + follow-up button */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-300">{formatDate(ticket.created_at)}</p>

                    {ticket.status === "open" && (
                      <button
                        onClick={() => handleFollowUp(ticket.ticket_id)}
                        disabled={ticket.follow_up_requested || followUpLoading === ticket.ticket_id}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                          ticket.follow_up_requested
                            ? "border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50"
                            : "border-purple-200 text-purple-600 hover:bg-purple-50"
                        }`}
                      >
                        {followUpLoading === ticket.ticket_id
                          ? "Sending..."
                          : ticket.follow_up_requested
                          ? "✓ Follow-up Sent"
                          : "Flag Follow-up"
                        }
                      </button>
                    )}
                  </div>

                  {/* Follow-up count badge */}
                  {ticket.follow_up_count > 0 && (
                    <p className="text-xs text-amber-500 mt-2">
                      ⚠️ {ticket.follow_up_count} follow-up{ticket.follow_up_count > 1 ? "s" : ""} sent
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}