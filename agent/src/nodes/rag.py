from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import llm
from src.database import db
from src.state import State

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
)


async def prompt_llm_rag(state: State):
    """RAG-augmented assistant handler for knowledge-based queries.

    If no similar documents are found in the vector store, the LLM response
    is saved to the knowledge base to serve future queries.
    """
    query = state["messages"][-1].content
    similar_documents = await db.asimilarity_search_relevant(query, k=2)

    has_match = bool(similar_documents)
    context = (
        "\n".join([doc.page_content for doc in similar_documents])
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

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ] + state["messages"]

    response = await llm.ainvoke(messages)

    # If no matching knowledge was found, chunk and cache the generated answer for future queries
    if not has_match and response.content:
        content_str = (
            response.content
            if isinstance(response.content, str)
            else str(response.content)
        )
        raw_chunks = text_splitter.split_text(content_str)
        total_chunks = len(raw_chunks)

        texts_to_cache = []
        metadatas = []
        for idx, chunk in enumerate(raw_chunks):
            chunk_entry = f"Topic/Question: {query}\nInformation: {chunk}"
            texts_to_cache.append(chunk_entry)
            metadatas.append(
                {
                    "query": str(query),
                    "source": "generated_cache",
                    "chunk_index": idx,
                    "total_chunks": total_chunks,
                }
            )

        if texts_to_cache:
            await db.aadd_texts(
                texts=texts_to_cache,
                metadatas=metadatas,
            )

    return {"messages": [response]}
