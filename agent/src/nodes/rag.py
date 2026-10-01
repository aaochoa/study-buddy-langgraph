import asyncio
import logging

from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import llm
from src.database import db
from src.state import State

logger = logging.getLogger(__name__)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
)


def _extract_content(msg) -> str:
    """Extract string content from a message object, dict, or string."""
    if isinstance(msg, dict):
        return str(msg.get("content", ""))
    return str(getattr(msg, "content", msg))


async def _condense_query(messages: list) -> str:
    """Condense multi-turn chat history into a standalone retrieval query."""
    if not messages:
        return ""
    if len(messages) <= 1:
        return _extract_content(messages[-1])

    latest_content = _extract_content(messages[-1])
    recent_history = messages[-5:-1]

    prompt = [
        {
            "role": "system",
            "content": (
                "Given a conversation and a follow-up question, rephrase the follow-up question "
                "into a standalone search query containing all necessary technical keywords and context. "
                "Output ONLY the standalone query with no explanation."
            ),
        }
    ]

    for msg in recent_history:
        role = getattr(msg, "type", "user") if not isinstance(
            msg, dict) else msg.get("role", "user")
        if role in ("human", "user"):
            prompt_role = "user"
        elif role in ("ai", "assistant"):
            prompt_role = "assistant"
        else:
            prompt_role = "user"
        prompt.append({"role": prompt_role, "content": _extract_content(msg)})

    prompt.append(
        {"role": "user", "content": f"Follow-up question: {latest_content}"})

    try:
        res = await llm.ainvoke(prompt)
        condensed = _extract_content(res).strip()
        if condensed:
            return condensed
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "Failed to condense query for RAG (%s). Using raw query.", e)

    return latest_content


async def prompt_llm_rag(state: State):
    """RAG-augmented assistant handler for knowledge-based queries.

    Uses context-aware multi-turn query rewriting, relevance filtering,
    and non-blocking background caching of generated answers.
    """
    messages = state["messages"]
    raw_query = _extract_content(messages[-1]) if messages else ""

    # 1. Condense multi-turn chat into a standalone search query
    retrieval_query = await _condense_query(messages)

    # 2. Retrieve relevant documents with semantic distance threshold (k=4)
    similar_documents = await db.asimilarity_search_relevant(retrieval_query, k=4)

    has_match = bool(similar_documents)
    context = (
        "\n\n".join([f"[{i + 1}] {doc.page_content}" for i,
                    doc in enumerate(similar_documents)])
        if has_match
        else "No prior context found in the knowledge base."
    )

    system_prompt = (
        "You are an expert Study Buddy and technical interview assistant.\n\n"
        "### Instructions:\n"
        "1. **Context Evaluation**:\n"
        "   - Review the provided context below. If it contains sufficient, accurate, and up-to-date information to answer the user's question, use it as your primary reference.\n"
        "   - If the context is missing, incomplete, or contains outdated/obsolete information, do NOT rely solely on it. Complement or answer directly using your comprehensive, up-to-date technical knowledge.\n"
        "2. **Information Freshness & Accuracy**:\n"
        "   - Prioritize modern industry best practices and current framework versions.\n"
        "   - If the retrieved context contradicts current standards, prioritize the accurate, modern answer and briefly clarify the distinction if helpful.\n"
        "3. **Tone & Formatting**:\n"
        "   - Provide clear, concise, and structured explanations suitable for interview preparation and study.\n\n"
        "### Retrieved Context:\n"
        f"{context}"
    )

    llm_messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ] + messages

    response = await llm.ainvoke(llm_messages)

    # 3. If no matching knowledge was found, cache the generated answer in the background
    if not has_match and response.content:
        content_str = _extract_content(response)
        raw_chunks = text_splitter.split_text(content_str)
        total_chunks = len(raw_chunks)

        texts_to_cache = []
        metadatas = []
        for idx, chunk in enumerate(raw_chunks):
            chunk_entry = f"Topic/Question: {retrieval_query}\nInformation: {chunk}"
            texts_to_cache.append(chunk_entry)
            metadatas.append(
                {
                    "query": retrieval_query,
                    "source": "generated_cache",
                    "chunk_index": idx,
                    "total_chunks": total_chunks,
                }
            )

        if texts_to_cache:
            async def _persist_cache_async():
                try:
                    await db.aadd_texts(
                        texts=texts_to_cache,
                        metadatas=metadatas,
                    )
                    logger.info(
                        "Cached %d chunks for query '%s' in background.",
                        len(texts_to_cache),
                        retrieval_query[:50],
                    )
                except Exception as err:  # noqa: BLE001
                    logger.warning(
                        "Failed to persist generated knowledge to cache: %s", err)

            asyncio.create_task(_persist_cache_async())

    return {"messages": [response]}
