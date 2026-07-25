from flask import Flask, request, jsonify
from flask_cors import CORS
from rag_bot import (
    load_and_chunk_documents,
    build_or_load_embeddings,
    semantic_search,
    ask_strict_ai,
    DOCS_DIR,
)

app = Flask(__name__)
CORS(app)  # allows the React dev server (different port) to call this API

# Load documents and embeddings ONCE when the server starts, not on every request -
# re-embedding on every question would make each answer take way longer than it needs to.
print("🤖 Loading documents and embeddings...")
chunks = load_and_chunk_documents(DOCS_DIR)
chunk_embeddings = build_or_load_embeddings(chunks)
print("✅ Backend ready.")


@app.route("/api/query", methods=["POST"])
def query():
    data = request.get_json(silent=True) or {}
    question = data.get("question", "").strip()

    if not question:
        return jsonify({"error": "No question provided"}), 400

    top_chunks = semantic_search(question, chunks, chunk_embeddings, n=5)
    answer = ask_strict_ai(question, top_chunks)

    return jsonify({"answer": answer})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)