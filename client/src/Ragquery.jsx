import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "tv-chat-history";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api/query";
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const makeChatTitle = (text) => {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "New chat";
  return clean.length > 28 ? `${clean.slice(0, 28)}...` : clean;
};

const createChat = () => ({
  id: generateId(),
  title: "New chat",
  messages: [],
  createdAt: Date.now(),
});

export default function RagQuery() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [draft, setDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [typing, setTyping] = useState(false);

  const typingIntervalRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.chats) && parsed.chats.length > 0) {
          setChats(parsed.chats);
          setCurrentChatId(parsed.currentChatId || parsed.chats[0].id);
          return;
        }
      } catch (err) {
        console.warn("Invalid local storage data", err);
      }
    }

    const firstChat = createChat();
    setChats([firstChat]);
    setCurrentChatId(firstChat.id);
  }, []);

  useEffect(() => {
    if (!currentChatId) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ chats, currentChatId })
    );
  }, [chats, currentChatId]);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  const currentChat = chats.find((chat) => chat.id === currentChatId) || chats[0] || null;
  const messages = currentChat?.messages || [];
  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNewChat = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
    const nextChat = createChat();
    setChats((prev) => [nextChat, ...prev]);
    setCurrentChatId(nextChat.id);
    setDraft("");
    setError("");
    setSearchTerm("");
    setShowSearch(false);
  };

  const handleSelectChat = (chatId) => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
      setTyping(false);
    }
    setCurrentChatId(chatId);
    setError("");
  };

  const handleDeleteChat = (chatId) => {
    setChats((prev) => {
      const nextChats = prev.filter((chat) => chat.id !== chatId);
      if (nextChats.length === 0) {
        const newChat = createChat();
        setCurrentChatId(newChat.id);
        return [newChat];
      }

      if (chatId === currentChatId) {
        setCurrentChatId(nextChats[0].id);
      }
      return nextChats;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !currentChat) return;

    const userContent = draft.trim();
    const userMessage = {
      id: generateId(),
      role: "user",
      content: userContent,
      createdAt: Date.now(),
    };

    setDraft("");
    setError("");
    setIsLoading(true);

    setChats((prev) =>
      prev.map((chat) => {
        if (chat.id !== currentChat.id) return chat;
        const newTitle = chat.title === "New chat" ? makeChatTitle(userContent) : chat.title;
        return {
          ...chat,
          title: newTitle,
          messages: [...chat.messages, userMessage],
        };
      })
    );

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userContent }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      const fullAnswer = data.answer || "";
      const assistantMessageId = generateId();

      setChats((prev) =>
        prev.map((chat) => {
          if (chat.id !== currentChat.id) return chat;
          return {
            ...chat,
            messages: [
              ...chat.messages,
              {
                id: assistantMessageId,
                role: "assistant",
                content: "",
                createdAt: Date.now(),
              },
            ],
          };
        })
      );

      setTyping(true);
      let index = 0;
      typingIntervalRef.current = setInterval(() => {
        index += 1;
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== currentChat.id) return chat;
            const updatedMessages = chat.messages.map((message) => {
              if (message.id !== assistantMessageId) return message;
              return {
                ...message,
                content: fullAnswer.slice(0, index),
              };
            });
            return { ...chat, messages: updatedMessages };
          })
        );

        if (index >= fullAnswer.length) {
          setTyping(false);
          setIsLoading(false);
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }, 28);
    } catch (err) {
      setError("Couldn't reach the RAG backend. Is server.py running?");
      setIsLoading(false);
      setTyping(false);
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    }
  };

  const activeChats = showSearch ? filteredChats : chats;

  return (
    <div style={{ minHeight: "100vh", minWidth: "100%", width: "100%", background: "#090a0f", color: "#f3f4f6", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(7, 8, 13, 0.92)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#4f46e5",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              color: "white",
              fontSize: 18,
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>TvChatAI</div>
            <div style={{ fontSize: 12, color: "#a1a1aa" }}>Your private chat workspace</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={handleNewChat}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#f3f4f6",
              padding: "10px 16px",
              borderRadius: 999,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            New chat
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSearch((prev) => !prev);
              setSearchTerm("");
            }}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#f3f4f6",
              padding: "10px 16px",
              borderRadius: 999,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {showSearch ? "Close search" : "Search chats"}
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 24, padding: "24px", width: "100%", minHeight: "0" }}>
        <aside
          style={{
            borderRadius: 14,
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1" }}>Chats</div>
          {showSearch && (
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search existing chats"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "#f8fafc",
                outline: "none",
              }}
            />
          )}

          <div
            style={{
              display: "grid",
              gap: 8,
              overflowY: "auto",
              minHeight: 0,
              maxHeight: "calc(100vh - 220px)",
            }}
          >
            {activeChats.map((chat) => (
              <div key={chat.id} style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSelectChat(chat.id)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: 14,
                    border: "none",
                    background:
                      chat.id === currentChat?.id
                        ? "rgba(79, 70, 229, 0.2)"
                        : "rgba(255,255,255,0.03)",
                    color: "#e2e8f0",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {chat.title}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteChat(chat.id)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.05)",
                    color: "#f87171",
                    cursor: "pointer",
                    fontSize: 16,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  x
                </button>
              </div>
            ))}
            {activeChats.length === 0 && (
              <div style={{ color: "#94a3b8", padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)" }}>
                No chats match that search.
              </div>
            )}
          </div>
        </aside>

        <main
          style={{
            display: "flex",
            flexDirection: "column",
            borderRadius: 24,
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {messages.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "80px 36px",
                  textAlign: "center",
                  minHeight: 0,
                }}
              >
                <div>
                  <h1 style={{ fontSize: 52, margin: 0, letterSpacing: "-0.08em", color: "#ffffff" }}>
                    Where should we begin?
                  </h1>
                  <p style={{ marginTop: 18, fontSize: 18, color: "#cbd5e1" }}>
                    Ask anything and I’ll answer with context from your RAG backend.
                  </p>
                </div>
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "24px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  minHeight: 0,
                }}
              >
                {messages.map((message) => {
                  const isUser = message.role === "user";
                  return (
                    <div
                      key={message.id}
                      style={{
                        display: "flex",
                        justifyContent: isUser ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "84%",
                          padding: "18px 22px",
                          borderRadius: 24,
                          background: isUser ? "rgba(79, 70, 229, 0.95)" : "rgba(255,255,255,0.06)",
                          color: isUser ? "white" : "#e2e8f0",
                          boxShadow: isUser
                            ? "0 30px 45px rgba(79, 70, 229, 0.18)"
                            : "0 24px 45px rgba(0, 0, 0, 0.16)",
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.7,
                          wordBreak: "break-word",
                        }}
                      >
                        {message.content || (isUser ? message.content : "...")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "18px 24px" }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={messages.length === 0 ? "Ask something..." : "Send a new message..."}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "14px 18px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "#f8fafc",
                  outline: "none",
                  fontSize: 16,
                }}
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || typing || !draft.trim()}
                style={{
                  border: "none",
                  borderRadius: 18,
                  padding: "14px 22px",
                  background: "#4f46e5",
                  color: "white",
                  fontWeight: 700,
                  cursor: isLoading || typing || !draft.trim() ? "not-allowed" : "pointer",
                }}
              >
                {isLoading || typing ? "Thinking..." : "Send"}
              </button>
            </form>
            {error && (
              <p style={{ marginTop: 12, color: "#f87171", fontSize: 14 }}>{error}</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
