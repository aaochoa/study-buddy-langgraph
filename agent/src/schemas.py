from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, description="User prompt or question")
    thread_id: str | None = Field(
        default=None,
        description="Optional session/thread ID for conversation continuity",
    )


class ChatResponse(BaseModel):
    response: str
    thread_id: str
    intent: str | None = None
    model_used: str | None = None


class HealthResponse(BaseModel):
    status: str
    primary_model: str
    all_configured_models: list[str]
