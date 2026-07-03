import { useState } from "react";

interface ChatPanelProps {
  planId: string | null;
  onSendMessage: (message: string) => Promise<void>;
  isSending: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPanel({ planId, onSendMessage, isSending }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async () => {
    if (!message.trim() || !planId) return;

    const userMsg = message.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setMessage("");

    await onSendMessage(userMsg);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Plan updated! Check the new suggestions above.",
      },
    ]);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg hover:bg-primary-700 transition flex items-center justify-center text-2xl z-50"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Adjust Your Plan</h3>
          <p className="text-xs text-primary-100">
            Chat to refine your meal suggestions
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white/80 hover:text-white transition"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-3 space-y-3 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            Try: "Make it spicier" or "Swap lunch with chicken"
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
                  : "bg-white border border-gray-200 text-gray-700 rounded-bl-sm"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm text-gray-400">
              ...
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
            placeholder="Type your request..."
            disabled={!planId || isSending}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || !planId || isSending}
            className="bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}