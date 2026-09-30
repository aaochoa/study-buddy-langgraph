import logging

from src.config import llm
from src.state import IntentClassifier, MessageIntent, State

logger = logging.getLogger(__name__)


async def classify_intent(state: State):
    """Classify the user's latest message into 'chat', 'knowledge', or 'code'."""
    try:
        structured_llm = llm.with_structured_output(IntentClassifier)
        result = await structured_llm.ainvoke([
            {
                "role": "system",
                "content": "Classify the user message into one of the following categories: chat, knowledge, or code.",
            },
            {
                "role": "user",
                "content": state["messages"][-1].content,
            },
        ])

        intent: MessageIntent | None = None
        if isinstance(result, IntentClassifier):
            intent = result.message_intent
        elif isinstance(result, dict):
            intent = result.get("message_intent")

        if intent in ("chat", "knowledge", "code"):
            return {"message_intent": intent}
    except Exception as e:  # noqa: BLE001
        logger.warning("Intent classification failed (%s). Defaulting to 'chat'.", e)

    return {"message_intent": "chat"}
