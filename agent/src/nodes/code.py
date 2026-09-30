from src.config import llm
from src.state import State


async def prompt_llm_code(state: State):
    """Code generation and assistance handler."""
    messages = [
        {
            "role": "system",
            "content": "You are a helpful assistant that writes clean, well-documented code. Be polite and concise.",
        }
    ] + state["messages"]

    response = await llm.ainvoke(messages)
    return {"messages": [response]}
