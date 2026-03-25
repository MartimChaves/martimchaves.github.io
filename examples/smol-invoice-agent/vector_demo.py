"""
Vector similarity demo.

Shows how corrections transfer between similar invoices.

Uses real PDF extraction but no API key needed.

Requirements:
    uv venv .venv && uv pip install numpy pymupdf

Usage:
    .venv/bin/python vector_demo.py
"""

import json
from pathlib import Path

import numpy as np
import pymupdf

INVOICE_DIR = Path(__file__).parent / "invoices"

# ---- Simulated vector store ----

EMBEDDING_DIM = 8  # real system uses 512-dim Voyage AI embeddings
invoice_store = {}  # invoice_id -> {"embedding": [...], "corrections": [...]}


def fake_embed(text: str) -> list[float]:
    """Deterministic fake embedding based on text hash (for demo purposes)."""
    import hashlib
    h = hashlib.sha256(text.encode()).digest()
    vec = [float(b) / 255.0 for b in h[:EMBEDDING_DIM]]
    norm = sum(x**2 for x in vec) ** 0.5
    return [x / norm for x in vec]  # unit normalize


def cosine_similarity(a: list[float], b: list[float]) -> float:
    a_arr, b_arr = np.array(a), np.array(b)
    dot = np.dot(a_arr, b_arr)
    norms = np.linalg.norm(a_arr) * np.linalg.norm(b_arr)
    return float(dot / norms)


def extract_pdf_text(pdf_path: str) -> str:
    """Extract text from a PDF file."""
    doc = pymupdf.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text


def save_invoice(invoice_id: str, text: str):
    """Embed and store an invoice."""
    embedding = fake_embed(text)
    invoice_store[invoice_id] = {"embedding": embedding, "corrections": []}
    print(f"  Saved embedding for {invoice_id}")


def save_correction(invoice_id: str, correction_type: str, data: dict):
    """Save a user correction linked to an invoice."""
    if invoice_id in invoice_store:
        invoice_store[invoice_id]["corrections"].append(
            {"type": correction_type, "data": data}
        )
        print(f"  Saved correction on {invoice_id}: {correction_type}")


def find_similar_and_get_corrections(
    text: str, exclude_id: str, k: int = 3,
    threshold: float = 0.5,
):
    """Find similar invoices and return their corrections."""
    query_vec = fake_embed(text)
    similarities = []

    for inv_id, inv_data in invoice_store.items():
        if inv_id == exclude_id:
            continue
        sim = cosine_similarity(query_vec, inv_data["embedding"])
        if sim >= threshold:
            similarities.append((inv_id, sim, inv_data["corrections"]))

    similarities.sort(key=lambda x: x[1], reverse=True)
    top_k = similarities[:k]

    all_corrections = []
    for inv_id, sim, corrections in top_k:
        for c in corrections:
            all_corrections.append({
                **c,
                "from_invoice": inv_id,
                "similarity": round(sim, 3),
            })

    return all_corrections


# ---- Demo ----

def demo():
    pdf_files = sorted(INVOICE_DIR.glob("*.pdf"))
    if len(pdf_files) < 2:
        print(f"Need at least 2 PDFs in {INVOICE_DIR}/ for this demo.")
        print("Add invoice PDFs and try again.")
        return

    # Step 1: Extract text from the first invoice and store it
    pdf_1 = pdf_files[0]
    print(f"Step 1: Extract and embed {pdf_1.name}")
    text_1 = extract_pdf_text(str(pdf_1))
    print(f"  Extracted {len(text_1)} chars")
    save_invoice("inv_1", text_1)

    # Step 2: Simulate user corrections on first invoice
    print(f"\nStep 2: User corrects {pdf_1.name}")
    save_correction("inv_1", "vendor", {
        "raw_name": "acme cloud svcs",
        "correct_name": "Acme Cloud Services Ltd.",
    })
    save_correction("inv_1", "category", {
        "item": "ssl certificate renewal",
        "correct_category": "Security",
    })

    # Step 3: New invoice arrives
    pdf_2 = pdf_files[1]
    print(f"\nStep 3: New invoice arrives: {pdf_2.name}")
    text_2 = extract_pdf_text(str(pdf_2))
    print(f"  Extracted {len(text_2)} chars")
    save_invoice("inv_2", text_2)

    # Step 4: Find corrections from similar invoices
    print("\nStep 4: Search for similar invoices and retrieve corrections")
    corrections = find_similar_and_get_corrections(text_2, exclude_id="inv_2")

    if corrections:
        print(
            f"\n  Found {len(corrections)} corrections"
            " from similar invoices:"
        )
        for c in corrections:
            print(
                f"    [{c['type']}] {json.dumps(c['data'])}"
                f" (similarity: {c['similarity']})"
            )
        print(
            "\n  These corrections would be passed to"
            " the agent for automatic application."
        )
    else:
        print("\n  No similar invoices found above threshold.")
        print("  (This is expected with fake embeddings")
        print("   on different invoices — real Voyage AI")
        print("   embeddings would find semantic")
        print("   similarity.)")
        print()
        print("  In the real system, invoices from the")
        print("  same vendor or with similar line items")
        print("  would score high similarity, and")
        print("  corrections would transfer.")


if __name__ == "__main__":
    demo()
