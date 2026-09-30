import logging
import os
import uuid
from collections.abc import AsyncIterable
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.sse import EventSourceResponse, ServerSentEvent
from langgraph.graph.state import CompiledStateGraph

from src.config import ALL_CONFIGURED_MODELS, LLM_MODEL
from src.graph import create_study_buddy_graph
from src.schemas import ChatRequest, ChatResponse, HealthResponse

# Configure logging
logger = logging.getLogger("study_buddy.api")
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle and graph compilation."""
    logger.info("Initializing Study Buddy LangGraph workflow...")
    app.state.graph = create_study_buddy_graph()
    logger.info("LangGraph workflow compiled and ready.")
    yield


app = FastAPI(
    title="Study Buddy API",
    description="FastAPI server powered by LangChain and LangGraph multi-agent workflows.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
# For security and credentialed requests, explicit origins are preferred over wildcards
cors_origins_raw = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
)
allowed_origins = [
    origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Dependency Injection for Compiled Graph
def get_graph(request: Request) -> CompiledStateGraph:
    """Retrieve compiled graph singleton from app state."""
    return request.app.state.graph


GraphDep = Annotated[CompiledStateGraph, Depends(get_graph)]


@app.get("/health")
async def health_check() -> HealthResponse:
    """Health check endpoint providing LLM and system status."""
    return HealthResponse(
        status="ok",
        primary_model=LLM_MODEL,
        all_configured_models=ALL_CONFIGURED_MODELS,
    )


@app.post("/chat")
async def chat(request: ChatRequest, graph: GraphDep) -> ChatResponse:
    """Execute the multi-agent workflow and return structured response."""
    thread_id = request.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    try:
        result = await graph.ainvoke(
            {"messages": [request.message]},
            config=config,
        )

        messages = result.get("messages", [])
        last_message = messages[-1] if messages else None

        content = getattr(last_message, "content", "") if last_message else ""
        if not isinstance(content, str):
            content = str(content)

        model_used = None
        if last_message and hasattr(last_message, "response_metadata"):
            model_used = last_message.response_metadata.get("model_name")

        intent = result.get("message_intent")

        return ChatResponse(
            response=content,
            thread_id=thread_id,
            intent=intent,
            model_used=model_used,
        )
    except Exception as e:
        logger.exception("Failed to execute chat workflow for thread_id=%s", thread_id)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while generating the assistant response.",
        ) from e


@app.post("/chat/stream", response_class=EventSourceResponse)
async def chat_stream(
    request: ChatRequest, graph: GraphDep
) -> AsyncIterable[ServerSentEvent]:
    """Stream response tokens using native FastAPI Server-Sent Events (SSE)."""
    thread_id = request.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}

    try:
        # Emit session initialization
        yield ServerSentEvent(
            event="session",
            data={"thread_id": thread_id},
        )

        # Stream LangGraph events
        async for event in graph.astream_events(
            {"messages": [request.message]},
            config=config,
            version="v2",
        ):
            event_type = event.get("event")
            node = event.get("metadata", {}).get("langgraph_node")

            # Emit classified intent when classifier node finishes
            if event_type == "on_chain_end" and node == "classifier":
                output = event.get("data", {}).get("output", {})
                intent = (
                    output.get("message_intent")
                    if isinstance(output, dict)
                    else None
                )
                if intent:
                    yield ServerSentEvent(
                        event="intent",
                        data={"intent": intent},
                    )

            # Emit tokens only from generation agents (chat, rag, code)
            if event_type == "on_chat_model_stream" and node in (
                "chat_agent",
                "rag_agent",
                "code_agent",
            ):
                chunk = event.get("data", {}).get("chunk")
                content = getattr(chunk, "content", "")
                if content:
                    yield ServerSentEvent(
                        event="token",
                        data={"token": content},
                    )

        # Emit completion event
        yield ServerSentEvent(
            event="done",
            data={"status": "completed", "thread_id": thread_id},
        )

    except Exception:
        logger.exception("Error during token streaming for thread_id=%s", thread_id)
        yield ServerSentEvent(
            event="error",
            data={"error": "An error occurred during streaming."},
        )

