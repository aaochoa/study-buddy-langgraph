from typing import Annotated, Literal

from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

MessageIntent = Literal["chat", "knowledge", "code"]


class IntentClassifier(BaseModel):
    """Schema for classifying user intent."""
    message_intent: MessageIntent = Field(
        description="The intent of the user's message. Must be one of 'chat', 'knowledge', or 'code'."
    )


class State(TypedDict):
    """Primary state for the Study Buddy LangGraph workflow."""
    messages: Annotated[list, add_messages]
    message_intent: MessageIntent | None
