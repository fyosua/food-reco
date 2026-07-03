import { useState, useEffect } from "react";

interface ChatPanelProps {
  planId: string | null;
  onSendMessage: (message: string) => Promise<void>;
  isSending: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Ganti lauk dengan ayam",
  "Bikin lebih pedas",
  "Tambah sayur",
  "Kurangi porsi karbohidrat",
  "Ganti dengan menu yang lebih murah",
  "Saya ingin menu Sunda",
];

export default function ChatPanel({ planId, onSendMessage, isSending }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Listen for open-chat custom event from the Sesuaikan button in Plan.tsx
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener("open-chat", handler);
    return () => window.removeEventListener("open-chat", handler);
  }, []);

  const handleSend = async (text?: string) => {
    const msg = (text || message).trim();
    if (!msg || !planId) return;

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setMessage("");

    await onSendMessage(msg);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "✅ Rencana sudah diperbarui! Cek menu baru di atas.",
      },
    ]);
  };

  const hasPlan = !!planId;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-full shadow-lg transition-all duration-300 ${
          hasPlan
            ? "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-xl hover:scale-105 animate-[pulse_2s_ease-in-out_infinite]"
            : "bg-gray-400 text-white/70 cursor-not-allowed"
        }`}
        disabled={!hasPlan}
        title={hasPlan ? "Sesuaikan Rencana Makan" : "Buat rencana dulu"}
      >
        <span className={`text-xl ${hasPlan ? "animate-bounce" : ""}`}>💬</span>
        <span className="text-sm font-semibold whitespace-nowrap">
          {hasPlan ? "Sesuaikan" : "Buat Rencana Dulu"}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">✏️ Sesuaikan Rencana</h3>
          <p className="text-xs text-primary-100">
            Minta perubahan menu sesuai selera
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/80 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="space-y-3 py-2">
            <div className="text-center">
              <div className="text-3xl mb-2">🍽️</div>
              <p className="text-sm font-medium text-gray-700 mb-1">
            Butuh perubahan?
              </p>
              <p className="text-xs text-gray-400">
            Coba klik salah satu saran di bawah atau tulis sendiri
              </p>
            </div>
            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={isSending}
                  className="bg-white border border-primary-200 text-primary-700 text-xs px-2.5 py-1.5 rounded-full hover:bg-primary-50 hover:border-primary-300 transition disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                msg.role === "user"
                  ? "bg-primary-600 text-white rounded-br-sm"
                  : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm shadow-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm text-gray-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ketik permintaanmu..."
            disabled={!planId || isSending}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!message.trim() || !planId || isSending}
            className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            Kirim
          </button>
        </div>
      </div>
    </div>
  );
}