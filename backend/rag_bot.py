import os
import glob
import pickle
import hashlib
import numpy as np
import ollama
from langchain_text_splitters import RecursiveCharacterTextSplitter
# pip install langchain-text-splitters numpy --break-system-packages
# Also run: ollama pull nomic-embed-text

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(BACKEND_DIR, "contextfolder")
MODEL_NAME = "qwen2.5:3b"          # generation model - answers the question
EMBED_MODEL = "nomic-embed-text"   # embedding model - turns text into meaning-vectors for search
CACHE_FILE = os.path.join(BACKEND_DIR, "embeddings_cache.pkl")


def load_and_chunk_documents(folder):
    """Finds all .txt and .md files and splits them into clean, boundary-aware chunks."""
    chunks = []
    file_paths = glob.glob(os.path.join(folder, "*.txt")) + glob.glob(os.path.join(folder, "*.md"))

    if not file_paths:
        print(f"No .txt or .md files found in {folder}. Please add some documents.")
        return []

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        length_function=len
    )

    for path in file_paths:
        with open(path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()

        for chunk_text in text_splitter.split_text(content):
            if chunk_text.strip():
                chunks.append({"text": chunk_text.strip(), "source": os.path.basename(path)})

    return chunks


def get_corpus_fingerprint(chunks):
    """Creates a short hash representing the current set of chunks.

    Embedding hundreds of chunks isn't instant, so we don't want to redo it every
    single time you run the script if nothing has changed. This fingerprint lets us
    detect "did my source files change since last time?" without re-embedding to check.
    """
    combined = "".join(c["text"] for c in chunks)
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def embed_text(text):
    """Converts a piece of text into a semantic vector using the embedding model."""
    response = ollama.embeddings(model=EMBED_MODEL, prompt=text)
    return response["embedding"]


def normalize_vectors(vectors):
    """Returns unit-length vectors so cosine similarity can be computed efficiently."""
    vectors = np.asarray(vectors, dtype=np.float32)
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    safe_norms = np.where(norms == 0, 1.0, norms)
    return vectors / safe_norms


def build_context_text(chunks):
    """Formats retrieved chunks into a compact prompt context."""
    return "\n\n".join([f"[Source: {chunk['source']}]\n{chunk['text']}" for chunk in chunks])


def build_or_load_embeddings(chunks):
    """Returns a numpy array of embeddings and their normalized form, using a cache when possible."""
    fingerprint = get_corpus_fingerprint(chunks)

    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "rb") as f:
            cached = pickle.load(f)
        if cached.get("fingerprint") == fingerprint:
            print("✅ Loaded cached embeddings (no changes detected in source files).")
            embeddings = np.asarray(cached["embeddings"], dtype=np.float32)
            normalized_embeddings = np.asarray(cached.get("normalized_embeddings", normalize_vectors(embeddings)), dtype=np.float32)
            return embeddings, normalized_embeddings
        else:
            print("📄 Source files changed since last run - re-embedding...")

    embeddings = []
    for i, chunk in enumerate(chunks, start=1):
        print(f"  Embedding chunk {i}/{len(chunks)}...")
        embeddings.append(embed_text(chunk["text"]))

    embeddings = np.asarray(embeddings, dtype=np.float32)
    normalized_embeddings = normalize_vectors(embeddings)

    with open(CACHE_FILE, "wb") as f:
        pickle.dump({"fingerprint": fingerprint, "embeddings": embeddings, "normalized_embeddings": normalized_embeddings}, f)

    return embeddings, normalized_embeddings


def cosine_similarity(query_vec, normalized_chunk_vecs):
    """Measures how close the query's meaning is to each chunk's meaning.

    Cosine similarity compares the ANGLE between two vectors, not their length -
    so it captures 'do these mean similar things' rather than 'are these the same
    length of text.' Result ranges from -1 (opposite meaning) to 1 (identical meaning).
    """
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return np.zeros(len(normalized_chunk_vecs), dtype=np.float32)

    normalized_query = query_vec / query_norm
    return normalized_chunk_vecs @ normalized_query  # dot product of normalized vectors = cosine similarity


def semantic_search(query, chunks, chunk_embeddings, normalized_chunk_embeddings=None, n=5):
    """Finds the n chunks whose meaning is closest to the query's meaning."""
    query_embedding = np.asarray(embed_text(query), dtype=np.float32)
    if normalized_chunk_embeddings is None:
        normalized_chunk_embeddings = normalize_vectors(chunk_embeddings)

    scores = cosine_similarity(query_embedding, normalized_chunk_embeddings)

    if len(scores) <= n:
        top_indices = np.argsort(scores)[::-1]
    else:
        top_indices = np.argpartition(scores, -n)[-n:]
        top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

    return [chunks[i] for i in top_indices]


def ask_strict_ai(query, relevant_chunks):
    """Sends the context and question to Ollama with a strict system jail."""
    context_text = build_context_text(relevant_chunks)

    system_prompt = (
        "You are a strict data assistant. You must answer the user's question relying "
        "EXCLUSIVELY on the provided file context. If the answer cannot be found verbatim "
        "within the text blocks provided, reply with exactly: 'I cannot answer this based on the provided files.' "
        "Do not use any outside knowledge or make assumptions."
    )

    user_prompt = f"FILE CONTEXT:\n{context_text}\n\nUSER QUESTION: {query}"

    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        options={
            "temperature": 0.9,
            "top_p": 0.95,
            "top_k": 60,
            "num_ctx": 8192
        }
    )

    return response['message']['content']


def main():
    print("🤖 Indexing documents...")
    chunks = load_and_chunk_documents(DOCS_DIR)

    if not chunks:
        return

    print(f"✅ Loaded {len(chunks)} chunks. Preparing embeddings...")
    chunk_embeddings, normalized_chunk_embeddings = build_or_load_embeddings(chunks)

    print("✅ System Ready! Ask a question or type 'exit'.")

    while True:
        query = input("\n📝 Ask your question: ")
        if query.lower() in ['exit', 'quit']:
            break

        top_chunks = semantic_search(query, chunks, chunk_embeddings, normalized_chunk_embeddings=normalized_chunk_embeddings, n=5)

        answer = ask_strict_ai(query, top_chunks)
        print(f"\n🤖 AI Answer:\n{answer}")

if __name__ == "__main__":
    main()