# AI Modeltests

## Overview

This repository is a local Retrieval-Augmented Generation (RAG) chat assistant built from two main pieces:

- `backend/`: Python Flask API that indexes text documents, builds embeddings, and answers questions using Ollama.
- `client/`: React + Vite frontend that provides a modern chat UI with persistent chat history, search, new chat creation, and chat deletion.
- `contextfolder/`: The document corpus used by the RAG system. These are the `.txt` files the assistant uses as source context.

The app is designed to run locally and answer questions strictly from the provided corpus, without external knowledge.

---

## Repository Layout

```text
AI_Modeltests/
├── backend/
│   ├── __init__.py
│   ├── embeddings_cache.pkl
│   ├── fetch_youtube.py
│   ├── rag_bot.py
│   ├── server.py
│   └── webscraper.py
├── client/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── src/
│   │   ├── App.css
│   │   ├── App.jsx
│   │   ├── Ragquery.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── public/
│   └── README.md
├── contextfolder/
│   └── *.txt
├── .venv/
├── LICENSE
└── README.md
```

> Note: There is also a stray `contextfolder/server.py` file in the workspace. The correct backend entrypoint is `backend/server.py`.

---

## Backend Architecture

The backend is a Python Flask service that serves chat queries over HTTP.

### Key files

- `backend/server.py`
  - Flask app exposing `POST /api/query`
  - Loads document chunks and embeddings once at startup
  - Uses `backend/rag_bot.py` for document processing, embedding caching, semantic search, and answer generation

- `backend/rag_bot.py`
  - `load_and_chunk_documents(folder)`: reads `.txt` and `.md` files from the corpus and splits them into chunks
  - `build_or_load_embeddings(chunks)`: embeds chunks with Ollama and caches results to `embeddings_cache.pkl`
  - `semantic_search(query, chunks, chunk_embeddings, n=5)`: finds the top relevant chunks via cosine similarity
  - `ask_strict_ai(query, relevant_chunks)`: sends a strict prompt to Ollama so answers are based only on provided context

- `backend/fetch_youtube.py`
  - Downloads YouTube transcripts via `youtube_transcript_api`
  - Saves clean text files into `contextfolder/`

- `backend/webscraper.py`
  - Scrapes Fandom wiki pages using the MediaWiki API and BeautifulSoup
  - Saves cleaned article text under `./raw_scrapes/`

### Important backend details

- `DOCS_DIR` in `backend/rag_bot.py` is set to `./contextfolder`
- `CACHE_FILE` is `./embeddings_cache.pkl`
- Both paths are relative to the repository root when running `backend/server.py`
- `backend/__init__.py` exists so `backend` can be imported as a package from `backend/server.py`

### Python dependencies

The backend requires these Python packages:

- `flask`
- `flask-cors`
- `numpy`
- `ollama`
- `langchain-text-splitters`
- `youtube-transcript-api`
- `beautifulsoup4`
- `requests`

---

## Frontend Architecture

The frontend is a React application powered by Vite.

### Key files

- `client/src/Ragquery.jsx`
  - Main chat UI component
  - Handles:
    - sending queries to the backend
    - typewriter-style assistant output
    - chat history persistence via `localStorage`
    - new chat creation
    - searching chats
    - deleting chats

- `client/src/App.jsx`
  - Renders the `RagQuery` component

- `client/src/App.css`
  - Defines the visual theme and layout overrides for the chat experience

- `client/src/index.css`
  - Global styles for the client app

- `client/src/main.jsx`
  - App bootstrap file for Vite + React

### Client behavior

- The frontend calls the backend endpoint at `http://127.0.0.1:5000/api/query`
- Chat history is saved in browser `localStorage` under `tv-chat-history`
- Each chat stores a title and an ordered message list
- The UI supports:
  - new chat creation
  - chat search
  - chat deletion
  - answer streaming with type-reveal animation

---

## Running the Project Locally

### 1. Backend setup

From the repository root:

```bash
cd /Users/faithful/Desktop/AI_Modeltests
python3 -m venv .venv
source .venv/bin/activate
pip install flask flask-cors numpy ollama langchain-text-splitters youtube-transcript-api beautifulsoup4 requests
```

Then start the backend server:

```bash
python backend/server.py
```

> Important: Run this command from the repository root so `./contextfolder` and `./embeddings_cache.pkl` resolve correctly.

### 2. Frontend setup

In a separate terminal:

```bash
cd /Users/faithful/Desktop/AI_Modeltests/client
npm install
npm run dev
```

Open the Vite URL printed in the terminal (usually `http://localhost:5173`).

### 3. Using the app

- Ask a question in the chat input
- The frontend sends the query to the Flask backend
- The backend returns an answer built from the indexed text files
- The UI saves chat sessions automatically in local storage
- Use `New chat`, `Search chats`, and delete buttons in the sidebar

---

## Extending the Corpus

### Add plain text documents

Place `.txt` or `.md` files into `contextfolder/`.
Then restart the backend server; if the corpus changed, `rag_bot.py` will detect it and rebuild embeddings.

### Add YouTube transcripts

Run:

```bash
python backend/fetch_youtube.py
```

Enter the URL when prompted. The transcript will be saved into `contextfolder/`.

### Scrape wiki content

Run:

```bash
python backend/webscraper.py
```

This generates cleaned article text files under `raw_scrapes/`.

---

## Troubleshooting

### Backend fails with import errors

- Ensure you are inside the root virtual environment: `source .venv/bin/activate`
- Run `python backend/server.py` from the repository root
- Make sure `backend/__init__.py` exists so `backend` is importable

### Frontend cannot reach backend

- Confirm backend is running on `http://127.0.0.1:5050`
- Confirm `client/src/Ragquery.jsx` still points to `API_URL = "http://127.0.0.1:5050/api/query"`
- If ports differ, update that URL in the frontend

### Embeddings cache issues

- Delete `backend/embeddings_cache.pkl` to force a full re-embedding pass
- Restart `python backend/server.py`

---

## Notes

- The backend is intentionally strict and will answer only from provided files.
- `contextfolder/` is the primary source corpus; the app does not rely on any external database.
- If you want to switch to a different Ollama model, update `MODEL_NAME` and `EMBED_MODEL` in `backend/rag_bot.py`.

---

## File Ownership

- Backend code: `backend/`
- Frontend code: `client/`
- Corpus and data: `contextfolder/`
- Local Python environment: `.venv/`

---

## Recommended next improvements

- Add a root-level `requirements.txt` for the backend
- Add a root-level `package.json` if you want one unified install command
- Add a `docker-compose.yml` if you want containerized backend and frontend
- Add a root-level `Makefile` or `dev.sh` script for one-command startup
