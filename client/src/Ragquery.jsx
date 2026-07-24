import { useState } from "react";

const API_URL = "http://127.0.0.1:5000/api/query";

export default function RagQuery() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    setIsLoading(true);
    setError("");
    setAnswer("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const data = await response.json();
      setAnswer(data.answer);
    } catch (err) {
      setError("Couldn't reach the RAG backend. Is server.py running?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Ask your documents</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          style={{ flex: 1, padding: 8, fontSize: 16 }}
        />
        <button type="submit" disabled={isLoading} style={{ padding: "8px 16px" }}>
          {isLoading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {error && (
        <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>
      )}

      {answer && (
        <div style={{ marginTop: 24, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
          <strong>Answer:</strong>
          <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p>
        </div>
      )}
    </div>
  );
}
