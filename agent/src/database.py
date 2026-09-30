import logging
import os
from typing import Optional

import chromadb
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore, VectorStore
from langchain_openai import OpenAIEmbeddings

load_dotenv()

logger = logging.getLogger(__name__)

# Seed Knowledge Base
KNOWLEDGE_BASE = [
    "LangGraph is a framework for building stateful, multi-agent applications on top of LangChain.",
    "A graph is a collection of nodes and edges.",
    "State graphs allow you to define custom states that can be passed between nodes.",
    "Nodes are the basic building blocks of a graph.",
    "Edges are the connections between nodes.",
    "A checkpoint is a snapshot of the graph's state.",
    "A checkpoint is used to restore the graph's state.",
    "A checkpoint is used to resume the graph's execution.",
    "A checkpoint is used to debug the graph's execution.",
    "A checkpoint is used to test the graph's execution.",
    "A checkpoint is used to deploy the graph's execution.",
    "RAG, or Retrieval Augmented Generation, is a technique that allows you to retrieve relevant information from a knowledge base and use it to generate a response.",
]


class DatabaseManager:
    """Singleton manager for vector database operations (Chroma Cloud with InMemory fallback)."""

    _instance: Optional["DatabaseManager"] = None
    _initialized: bool = False

    def __new__(cls) -> "DatabaseManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._embeddings = OpenAIEmbeddings(
            model=os.getenv("LLM_EMBEDDINGS", "nvidia/nemotron-3-embed-1b:free"),
            api_key=os.getenv("OPENROUTER_API_KEY"),
            base_url="https://openrouter.ai/api/v1",
            check_embedding_ctx_length=False,
            model_kwargs={"encoding_format": "float"},
        )
        self._vectorstore: VectorStore = self._init_vectorstore()
        self._initialized = True

    def _get_chroma_client(self):
        """Initialize Chroma Cloud client if environment variables are set."""
        api_key = os.getenv("CHROMA_API_KEY")
        tenant = os.getenv("CHROMA_TENANT")
        database = os.getenv("CHROMA_DATABASE")

        if api_key and tenant and database:
            return chromadb.CloudClient(
                api_key=api_key,
                tenant=tenant,
                database=database,
            )
        return None

    def _init_vectorstore(self) -> VectorStore:
        """Initialize Chroma vectorstore or fallback to InMemoryVectorStore."""
        try:
            client = self._get_chroma_client()
            if client:
                return Chroma(
                    client=client,
                    collection_name="study_buddy_knowledge",
                    embedding_function=self._embeddings,
                )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "Could not connect to Chroma Cloud (%s). Using In-Memory vectorstore.", e
            )

        return InMemoryVectorStore.from_texts(
            texts=KNOWLEDGE_BASE,
            embedding=self._embeddings,
        )

    @property
    def vectorstore(self) -> VectorStore:
        """Get the underlying vectorstore instance."""
        return self._vectorstore

    @property
    def embeddings(self) -> OpenAIEmbeddings:
        """Get the embeddings model instance."""
        return self._embeddings

    def similarity_search(self, query: str, k: int = 2) -> list[Document]:
        """Perform similarity search on the vectorstore."""
        return self._vectorstore.similarity_search(query, k=k)

    def similarity_search_with_score(self, query: str, k: int = 2) -> list[tuple[Document, float]]:
        """Perform similarity search returning documents and their distance/similarity scores."""
        return self._vectorstore.similarity_search_with_score(query, k=k)

    def similarity_search_relevant(
        self,
        query: str,
        k: int = 2,
        max_distance: float = 1.2,
        min_similarity: float = 0.5,
    ) -> list[Document]:
        """Perform similarity search returning only semantically relevant documents."""
        docs_and_scores = self.similarity_search_with_score(query, k=k)
        relevant_docs = []

        is_chroma = isinstance(self._vectorstore, Chroma)
        for doc, score in docs_and_scores:
            if is_chroma:
                if score <= max_distance:
                    relevant_docs.append(doc)
            else:
                if score >= min_similarity:
                    relevant_docs.append(doc)

        return relevant_docs

    async def asimilarity_search_with_score(
        self, query: str, k: int = 2
    ) -> list[tuple[Document, float]]:
        """Asynchronously perform similarity search returning documents and scores."""
        return await self._vectorstore.asimilarity_search_with_score(query, k=k)

    async def asimilarity_search_relevant(
        self,
        query: str,
        k: int = 2,
        max_distance: float = 1.2,
        min_similarity: float = 0.5,
    ) -> list[Document]:
        """Asynchronously perform similarity search returning only semantically relevant documents."""
        docs_and_scores = await self.asimilarity_search_with_score(query, k=k)
        relevant_docs = []

        is_chroma = isinstance(self._vectorstore, Chroma)
        for doc, score in docs_and_scores:
            if is_chroma:
                if score <= max_distance:
                    relevant_docs.append(doc)
            else:
                if score >= min_similarity:
                    relevant_docs.append(doc)

        return relevant_docs

    def add_texts(self, texts: list[str], metadatas: list[dict] | None = None) -> list[str]:
        """Add text items to the vectorstore."""
        return self._vectorstore.add_texts(texts=texts, metadatas=metadatas)

    async def aadd_texts(
        self, texts: list[str], metadatas: list[dict] | None = None
    ) -> list[str]:
        """Asynchronously add text items to the vectorstore."""
        return await self._vectorstore.aadd_texts(texts=texts, metadatas=metadatas)


# Global singleton instance & convenience exports
db = DatabaseManager()
vectorstore = db.vectorstore
