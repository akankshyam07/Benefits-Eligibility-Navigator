"""
One-time ingestion script: reads all PDFs from backend/data/,
chunks them, embeds with sentence-transformers, and upserts to Pinecone.

Usage:
  cd backend
  python ingest.py
"""
import os
import sys
import hashlib
import logging
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR   = Path(__file__).parent / "data"
CHUNK_SIZE = 500     # characters per chunk
CHUNK_OVERLAP = 80
BATCH_SIZE = 100     # upsert batch size
EMBED_DIM  = 384     # all-MiniLM-L6-v2 output dimension


def chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP):
    """Simple character-based sliding window chunker."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end].strip())
        start += size - overlap
    return [c for c in chunks if len(c) > 50]  # drop tiny fragments


def main():
    # ── Validate environment ──────────────────────────────────────────────────
    pinecone_key  = os.getenv("PINECONE_API_KEY")
    index_name    = os.getenv("PINECONE_INDEX_NAME", "benefits-eligibility")

    if not pinecone_key:
        sys.exit("❌  PINECONE_API_KEY not set in .env")

    pdfs = list(DATA_DIR.glob("*.pdf"))
    if not pdfs:
        sys.exit(f"❌  No PDFs found in {DATA_DIR}. Drop eligibility PDFs there first.")

    logger.info("Found %d PDF(s) to ingest.", len(pdfs))

    # ── Load models / clients ─────────────────────────────────────────────────
    logger.info("Loading sentence-transformer model…")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    from pinecone import Pinecone, ServerlessSpec
    pc = Pinecone(api_key=pinecone_key)

    existing = [i.name for i in pc.list_indexes()]
    if index_name not in existing:
        logger.info("Creating Pinecone index '%s' (dim=%d)…", index_name, EMBED_DIM)
        pc.create_index(
            name=index_name,
            dimension=EMBED_DIM,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )
    index = pc.Index(index_name)
    logger.info("Connected to index '%s'.", index_name)

    # ── Extract + embed + upsert ──────────────────────────────────────────────
    from pypdf import PdfReader

    all_vectors = []

    for pdf_path in pdfs:
        logger.info("Processing %s…", pdf_path.name)
        try:
            reader = PdfReader(str(pdf_path))
            full_text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            )
        except Exception as exc:
            logger.warning("  Skipping %s: %s", pdf_path.name, exc)
            continue

        chunks = chunk_text(full_text)
        logger.info("  %d chunks extracted.", len(chunks))

        embeddings = model.encode(chunks, show_progress_bar=True, batch_size=32)

        for i, (chunk, vec) in enumerate(zip(chunks, embeddings)):
            doc_id = hashlib.md5(f"{pdf_path.name}_{i}".encode()).hexdigest()
            all_vectors.append(
                {
                    "id": doc_id,
                    "values": vec.tolist(),
                    "metadata": {
                        "text": chunk,
                        "source": pdf_path.name,
                        "chunk_index": i,
                    },
                }
            )

    # Upsert in batches
    total = len(all_vectors)
    logger.info("Upserting %d vectors to Pinecone…", total)
    for start in range(0, total, BATCH_SIZE):
        batch = all_vectors[start : start + BATCH_SIZE]
        index.upsert(vectors=batch)
        logger.info("  Upserted %d / %d", min(start + BATCH_SIZE, total), total)

    logger.info("✅  Ingestion complete. %d vectors stored in '%s'.", total, index_name)


if __name__ == "__main__":
    main()
