import os

from dotenv import load_dotenv
from langchain_openrouter.chat_models import ChatOpenRouter
from langgraph.types import RetryPolicy

load_dotenv()

# OpenRouter LLM Configuration
LLM_MODEL = os.getenv("LLM_MODEL", "nvidia/nemotron-3-super-120b-a12b:free")
LLM_FALLBACK_MODELS_RAW = os.getenv(
    "LLM_FALLBACK_MODELS",
    "nvidia/nemotron-3.5-lightning:free,nvidia/nemotron-3-ultra-550b-a55b:free,cohere/north-mini-code:free,poolside/laguna-s-2.1:free,liquid/lfm-2.5-2.6b:free",
)
LLM_FALLBACK_MODELS = [
    model.strip()
    for model in LLM_FALLBACK_MODELS_RAW.split(",")
    if model.strip() and model.strip() != LLM_MODEL
]
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.8"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "100000"))


def _create_chat_model(model_name: str) -> ChatOpenRouter:
    return ChatOpenRouter(
        model=model_name,
        temperature=LLM_TEMPERATURE,
        max_tokens=LLM_MAX_TOKENS,
    )


primary_llm = _create_chat_model(LLM_MODEL)
fallback_llms = [_create_chat_model(model) for model in LLM_FALLBACK_MODELS]

# Wrap with fallbacks to rotate through models if querying one fails
llm = primary_llm.with_fallbacks(fallback_llms) if fallback_llms else primary_llm

ALL_CONFIGURED_MODELS = [LLM_MODEL] + LLM_FALLBACK_MODELS

# Resilience & Retry Policies
default_retry_policy = RetryPolicy(
    max_attempts=3,
    initial_interval=1.0,
    backoff_factor=2.0,
)
