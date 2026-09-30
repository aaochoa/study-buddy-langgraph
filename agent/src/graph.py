from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph

from src.config import default_retry_policy
from src.nodes import (
    classify_intent,
    prompt_llm_chat,
    prompt_llm_code,
    prompt_llm_rag,
)
from src.state import State


def create_study_buddy_graph(checkpointer=None):
    """Build and compile the Study Buddy LangGraph workflow."""
    builder = StateGraph(State)  # type: ignore

    # Register Nodes with Retry Policies
    builder.add_node("classifier", classify_intent)
    builder.add_node("chat_agent", prompt_llm_chat, retry_policy=default_retry_policy)
    builder.add_node("rag_agent", prompt_llm_rag, retry_policy=default_retry_policy)
    builder.add_node("code_agent", prompt_llm_code, retry_policy=default_retry_policy)

    # Connect Edges
    builder.add_edge(START, "classifier")
    builder.add_conditional_edges(
        "classifier",
        lambda state: state["message_intent"],
        {
            "chat": "chat_agent",
            "knowledge": "rag_agent",
            "code": "code_agent",
        },
    )
    builder.add_edge("chat_agent", END)
    builder.add_edge("rag_agent", END)
    builder.add_edge("code_agent", END)

    # Use default in-memory checkpointer if not provided
    if checkpointer is None:
        checkpointer = InMemorySaver()

    return builder.compile(checkpointer=checkpointer)
