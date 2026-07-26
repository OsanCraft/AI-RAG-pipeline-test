import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from rag_bot import build_context_text


def test_build_context_text_formats_sources_and_chunks():
    chunks = [
        {"source": "doc1.txt", "text": "Alpha"},
        {"source": "doc2.txt", "text": "Beta"},
    ]

    result = build_context_text(chunks)

    assert result.startswith("[Source: doc1.txt]\nAlpha")
    assert "[Source: doc2.txt]\nBeta" in result
