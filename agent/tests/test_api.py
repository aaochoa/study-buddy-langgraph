from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from main import app, get_graph


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    """Test health check returns system and model info."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "primary_model" in data
    assert isinstance(data["all_configured_models"], list)


def test_chat_validation_error(client):
    """Test empty message raises 422 Unprocessable Entity."""
    response = client.post("/chat", json={"message": ""})
    assert response.status_code == 422


def test_chat_with_dependency_override(client):
    """Verify dependency injection override for graph testing."""
    mock_message = MagicMock()
    mock_message.content = "Mocked response for testing"
    mock_message.response_metadata = {"model_name": "mock/model:free"}

    mock_graph = MagicMock()
    mock_graph.ainvoke = AsyncMock(
        return_value={
            "messages": [mock_message],
            "message_intent": "chat",
        }
    )

    app.dependency_overrides[get_graph] = lambda: mock_graph
    try:
        response = client.post(
            "/chat",
            json={"message": "Test message", "thread_id": "test-123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["response"] == "Mocked response for testing"
        assert data["thread_id"] == "test-123"
        assert data["intent"] == "chat"
        assert data["model_used"] == "mock/model:free"
    finally:
        app.dependency_overrides.clear()


def test_chat_stream_with_dependency_override(client):
    """Verify SSE streaming format with mocked graph events."""

    async def mock_astream_events(*args, **kwargs):
        yield {
            "event": "on_chain_end",
            "metadata": {"langgraph_node": "classifier"},
            "data": {"output": {"message_intent": "code"}},
        }
        mock_chunk = MagicMock()
        mock_chunk.content = "print('hello')"
        yield {
            "event": "on_chat_model_stream",
            "metadata": {"langgraph_node": "code_agent"},
            "data": {"chunk": mock_chunk},
        }

    mock_graph = MagicMock()
    mock_graph.astream_events = mock_astream_events

    app.dependency_overrides[get_graph] = lambda: mock_graph
    try:
        with client.stream(
            "POST",
            "/chat/stream",
            json={"message": "Write hello world in python"},
        ) as response:
            assert response.status_code == 200
            lines = [line for line in response.iter_lines() if line]
            assert "event: session" in lines
            assert "event: intent" in lines
            assert 'data: {"intent": "code"}' in lines
            assert "event: token" in lines
            assert 'data: {"token": "print(\'hello\')"}' in lines
            assert "event: done" in lines
    finally:
        app.dependency_overrides.clear()
