import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from langchain_core.documents import Document

from src.database import DatabaseManager, db
from src.nodes.rag import _condense_query, prompt_llm_rag
from src.state import State


@pytest.mark.asyncio
async def test_deterministic_deduplication():
    """Verify that adding the same text multiple times generates deterministic IDs."""
    texts = ["Test unique concept 123", "Another concept 456"]
    with patch.object(db._vectorstore, "aadd_texts", new_callable=AsyncMock) as mock_aadd:
        mock_aadd.return_value = ["id1", "id2"]
        await db.aadd_texts(texts=texts)

        assert mock_aadd.called
        call_args = mock_aadd.call_args[1]
        ids = call_args.get("ids")
        assert ids is not None
        assert len(ids) == 2
        # Identical text should yield same SHA-256 hash ID
        import hashlib
        expected_id_0 = hashlib.sha256(texts[0].encode("utf-8")).hexdigest()
        assert ids[0] == expected_id_0


@pytest.mark.asyncio
async def test_condense_query_single_turn():
    """Single turn query should return immediately without LLM invocation."""
    messages = [MagicMock(content="What is LangGraph?")]
    condensed = await _condense_query(messages)
    assert condensed == "What is LangGraph?"


@pytest.mark.asyncio
async def test_condense_query_multi_turn():
    """Multi-turn query should invoke LLM to rewrite into standalone query."""
    messages = [
        {"role": "user", "content": "Tell me about state graphs."},
        {"role": "assistant",
            "content": "State graphs represent workflows as nodes and edges."},
        {"role": "user", "content": "How do checkpoints work in it?"},
    ]

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(
        return_value=MagicMock(
            content="How do checkpoints work in LangGraph state graphs?")
    )
    with patch("src.nodes.rag.llm", mock_llm):
        condensed = await _condense_query(messages)
        assert condensed == "How do checkpoints work in LangGraph state graphs?"
        assert mock_llm.ainvoke.called


@pytest.mark.asyncio
async def test_prompt_llm_rag_background_caching():
    """Verify that when no match is found, response is cached in background without blocking."""
    mock_response = MagicMock(content="Detailed explanation of custom topic.")
    state: State = {
        "messages": [MagicMock(content="Tell me about custom topic XYZ")],
        "message_intent": "knowledge",
    }

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with (
        patch.object(db, "asimilarity_search_relevant", new_callable=AsyncMock) as mock_search,
        patch("src.nodes.rag.llm", mock_llm),
        patch.object(db, "aadd_texts", new_callable=AsyncMock) as mock_aadd,
    ):
        mock_search.return_value = []  # No match

        result = await prompt_llm_rag(state)
        assert result["messages"] == [mock_response]

        # Let the event loop execute background tasks
        await asyncio.sleep(0.05)
        assert mock_aadd.called
        call_kwargs = mock_aadd.call_args[1]
        assert len(call_kwargs["texts"]) >= 1
        assert "custom topic XYZ" in call_kwargs["metadatas"][0]["query"]


@pytest.mark.asyncio
async def test_similarity_search_relevant_filtering():
    """Verify semantic distance threshold filtering."""
    doc_close = Document(page_content="Relevant content")
    doc_far = Document(page_content="Irrelevant content")

    with patch.object(
        db,
        "asimilarity_search_with_score",
        new_callable=AsyncMock,
        return_value=[(doc_close, 0.4), (doc_far, 0.95)],
    ):
        # max_distance 0.8 should keep doc_close and exclude doc_far (if Chroma)
        with patch("src.database.isinstance", return_value=True):
            relevant = await db.asimilarity_search_relevant("query", max_distance=0.8)
            assert len(relevant) == 1
            assert relevant[0].page_content == "Relevant content"
