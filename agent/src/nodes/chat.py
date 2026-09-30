from src.config import llm
from src.state import State


async def prompt_llm_chat(state: State):
    """General conversation handler."""
    messages = [
        {"role": "system", "content": "You are a talkative chatbot for fun, be nice."}
    ] + state["messages"]

    response = await llm.ainvoke(messages)
    return {"messages": [response]}
