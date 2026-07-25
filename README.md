# LocalRAG Chat

## Overview

LocalRAG Chat is a local Retrieval-Augmented Generation (RAG) chat assistant that answers questions from a private corpus of text files. The app uses:

- a Python Flask backend for document indexing, semantic search, and answer generation
- a React + Vite frontend with a chat-style UI
- Ollama for embeddings and language model inference

The system is designed to answer strictly from the provided documents and not rely on external knowledge.

---

## Repository Layout

```text
AI_Modeltests/
├── backend/
│   ├── Dockerfile
│   ├── __init__.py
│   ├── embeddings_cache.pkl
│   ├── fetch_youtube.py
│   ├── rag_bot.py
│   ├── server.py
│   └── webscraper.py
├── client/
│   ├── Dockerfile
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── Ragquery.jsx
│       ├── index.css
│       └── main.jsx
├── contextfolder/
│   └── *.txt
├── docker-compose.yml
├── .venv/
├── LICENSE
└── README.md
```

---

## How the app works

### Backend

The backend lives in [backend/server.py](backend/server.py) and exposes a Flask endpoint at `/api/query`.

It loads the document corpus from `contextfolder/`, creates or loads embeddings, and uses Ollama to answer questions based on the most relevant chunks.

### Frontend

The frontend is a React app in [client/src/Ragquery.jsx](client/src/Ragquery.jsx). It sends chat messages to the backend, stores chat history in local storage, and renders streamed responses.

---

## Run with Docker (recommended)

From the repository root, run:

```bash
docker compose up --build
```

This starts:

- the backend on `http://localhost:5050`
- the frontend on `http://localhost:5173`
- Ollama on `http://localhost:11434`

### Notes

- The backend binds to `0.0.0.0` inside the container so it is reachable from the frontend.
- The frontend uses the backend URL from `VITE_API_URL` when available, otherwise it defaults to `http://localhost:5050/api/query`.

---

## Run locally without Docker

### 1. Backend setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Then start the backend from the repository root:

```bash
python backend/server.py
```

### 2. Frontend setup

In a separate terminal:

```bash
cd client
npm install
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

---

## Useful files

- [backend/server.py](backend/server.py): Flask entrypoint
- [backend/rag_bot.py](backend/rag_bot.py): document loading, embeddings, and search logic
- [backend/fetch_youtube.py](backend/fetch_youtube.py): downloads YouTube transcripts into the corpus
- [backend/webscraper.py](backend/webscraper.py): scrapes wiki-style content into text files
- [client/src/Ragquery.jsx](client/src/Ragquery.jsx): main chat UI and API calls
- [docker-compose.yml](docker-compose.yml): Docker Compose setup for backend, frontend, and Ollama

---

## Extending the corpus

Place `.txt` or `.md` files into `contextfolder/` and restart the backend. If the corpus changes, embeddings will be rebuilt automatically when needed.

---

## Troubleshooting

### Frontend cannot reach the backend

- Make sure the backend is running on port `5050`
- Check that the frontend is calling `http://localhost:5050/api/query`
- If you are using Docker, make sure `docker compose up --build` completed successfully

### Ollama issues

- Confirm Ollama is running on port `11434`
- If the model is missing, Docker will pull it during startup

### Embeddings cache issues

- Delete `backend/embeddings_cache.pkl` if you want to force a full rebuild
- Restart the backend afterward
