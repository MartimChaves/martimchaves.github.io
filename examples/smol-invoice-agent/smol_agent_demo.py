"""
Smol Invoice Agent - complete runnable demo.

Shows the full agent loop with tool use, real PDF extraction,
and self-improving corrections via vector similarity.

Requirements:
    uv venv .venv && uv pip install anthropic numpy python-dotenv pymupdf

Usage:
    cp .env.example .env  # add your Anthropic API key
    .venv/bin/python smol_agent_demo.py
"""

import json
import os
import time
import hashlib
import sys
from pathlib import Path

import numpy as np
import pymupdf
from dotenv import load_dotenv
import anthropic

load_dotenv()

client = anthropic.Anthropic()
MODEL = os.getenv("MODEL", "claude-sonnet-4-20250514")

INVOICE_DIR = Path(__file__).parent / "invoices"

# ---------------------------------------------------------------------------
# Fake vector store (replaces pgvector in the real system)
# ---------------------------------------------------------------------------

EMBEDDING_DIM = 8
_store: dict[str, dict] = {}
_corrections: list[dict] = []


def _fake_embed(text: str) -> list[float]:
    h = hashlib.sha256(text.encode()).digest()
    vec = [float(b) / 255.0 for b in h[:EMBEDDING_DIM]]
    norm = sum(x**2 for x in vec) ** 0.5
    return [x / norm for x in vec]


def _cosine(a: list[float], b: list[float]) -> float:
    a_, b_ = np.array(a), np.array(b)
    return float(np.dot(a_, b_) / (np.linalg.norm(a_) * np.linalg.norm(b_)))


def _find_corrections_for_text(text: str, exclude_id: str) -> list[dict]:
    vec = _fake_embed(text)
    hits = []
    for inv_id, data in _store.items():
        if inv_id == exclude_id:
            continue
        sim = _cosine(vec, data["embedding"])
        if sim > 0.5:
            hits.append((inv_id, sim))
    hits.sort(key=lambda x: x[1], reverse=True)
    similar_ids = {inv_id for inv_id, _ in hits[:3]}
    return [c for c in _corrections if c.get("invoice_id") in similar_ids]


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def extract_pdf_text(pdf_path: str) -> tuple[str, int]:
    """Extract text from a PDF file. Returns (text, page_count)."""
    doc = pymupdf.open(pdf_path)
    page_count = len(doc)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text, page_count


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

CATEGORIES = {
    "hosting": "Infrastructure",
    "cloud": "Infrastructure",
    "backup": "Infrastructure",
    "license": "Software & Subscriptions",
    "software": "Software & Subscriptions",
    "saas": "Software & Subscriptions",
    "web design": "Professional Services",
    "consulting": "Professional Services",
    "design": "Professional Services",
    "chair": "Office Furniture",
    "furniture": "Office Furniture",
    "desk": "Office Furniture",
    "shipping": "Shipping & Logistics",
}

# These get set by run_agent() before starting the loop
_current_invoice_text: str = ""
_current_invoice_file: str = ""
_current_invoice_pages: int = 0
_current_invoice_id: str = ""


def extract_text(params):
    result = {
        "text": _current_invoice_text,
        "pages": _current_invoice_pages,
        "file": _current_invoice_file,
    }

    # Embed and search for similar invoices
    embedding = _fake_embed(_current_invoice_text)
    _store[_current_invoice_id] = {"embedding": embedding}

    corrections = _find_corrections_for_text(
        _current_invoice_text,
        exclude_id=_current_invoice_id,
    )
    if corrections:
        result["similar_invoice_corrections"] = [
            {"type": c["type"], "data": c["data"]} for c in corrections
        ]

    return json.dumps(result)


def validate_schema(params):
    data = params["invoice_data"]
    required = ["invoice_number", "date", "vendor", "line_items", "total"]
    missing = [f for f in required if f not in data or data[f] is None]
    return json.dumps({"valid": len(missing) == 0, "missing_fields": missing})


def categorize_line_item(params):
    desc = params["description"].lower()

    # Check learned corrections first
    for c in _corrections:
        item = c["data"].get("item", "").lower()
        if c["type"] == "category" and item in desc:
            return json.dumps({
                "category": c["data"]["correct_category"],
                "source": "learned_correction",
            })

    # Fall back to keyword matching
    for keyword, category in CATEGORIES.items():
        if keyword in desc:
            return json.dumps({
                "category": category,
                "source": "keyword_match",
            })

    return json.dumps({"category": "Uncategorized", "source": "no_match"})


def lookup_vendor(params):
    raw = params["vendor_name"]
    key = raw.lower().strip()

    # Check learned corrections
    for c in _corrections:
        raw = c["data"].get("raw_name", "").lower()
        if c["type"] == "vendor" and raw in key:
            return json.dumps({
                "canonical_name": c["data"]["correct_name"],
                "source": "learned_correction",
            })

    return json.dumps({"canonical_name": raw, "source": "not_found"})


def export_invoice(params):
    data = params["invoice_data"]
    print(f"\n{'='*50}")
    print("EXPORTED INVOICE DATA:")
    print('='*50)
    print(json.dumps(data, indent=2))
    print('='*50)
    return json.dumps({
        "status": "exported",
        "invoice_id": _current_invoice_id,
    })


TOOL_DISPATCH = {
    "extract_text": extract_text,
    "validate_schema": validate_schema,
    "categorize_line_item": categorize_line_item,
    "lookup_vendor": lookup_vendor,
    "export_invoice": export_invoice,
}

# ---------------------------------------------------------------------------
# Tool definitions for Claude
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "extract_text",
        "description": (
            "Extract text from the invoice PDF. May include"
            " similar_invoice_corrections from past"
            " corrected invoices."
        ),
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "validate_schema",
        "description": "Validate invoice data has required fields.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_data": {
                    "type": "object",
                    "description": "Invoice data to validate",
                }
            },
            "required": ["invoice_data"],
        },
    },
    {
        "name": "categorize_line_item",
        "description": (
            "Categorize a line item. Uses learned"
            " corrections from past feedback."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "description": {
                    "type": "string",
                    "description": "Line item description",
                },
                "amount": {
                    "type": "number",
                    "description": "Line item amount",
                },
            },
            "required": ["description"],
        },
    },
    {
        "name": "lookup_vendor",
        "description": (
            "Normalize a vendor name. Uses learned"
            " corrections from past feedback."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vendor_name": {
                    "type": "string",
                    "description": "Raw vendor name",
                }
            },
            "required": ["vendor_name"],
        },
    },
    {
        "name": "export_invoice",
        "description": "Export the final processed invoice data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_data": {
                    "type": "object",
                    "description": "Complete processed invoice data",
                }
            },
            "required": ["invoice_data"],
        },
    },
]

SYSTEM_PROMPT = """\
You are an invoice processing agent.

Workflow:
1. Extract text using extract_text. If the result
   includes similar_invoice_corrections, apply those
   learned corrections during processing.
2. Validate the extracted data using validate_schema
3. Normalize the vendor name using lookup_vendor
4. Categorize each line item using categorize_line_item
5. Export the final result using export_invoice

Tools like categorize_line_item and lookup_vendor
automatically apply learned corrections.
Always extract text first. Export the final result as JSON.\
"""

# ---------------------------------------------------------------------------
# Agent loop
# ---------------------------------------------------------------------------


def run_agent(pdf_path: str, invoice_id: str):
    global _current_invoice_text, _current_invoice_file
    global _current_invoice_pages, _current_invoice_id

    print(f"\nExtracting text from {pdf_path}...")
    _current_invoice_text, _current_invoice_pages = extract_pdf_text(pdf_path)
    _current_invoice_file = Path(pdf_path).name
    _current_invoice_id = invoice_id

    chars = len(_current_invoice_text)
    pages = _current_invoice_pages
    print(f"  Extracted {chars} chars from {pages} page(s)\n")

    if _corrections:
        print("Past corrections in memory:")
        for c in _corrections:
            print(f"  [{c['type']}] {json.dumps(c['data'])}")
        print()

    messages = [
        {
            "role": "user",
            "content": "Process the invoice."
                       " Start by extracting text.",
        }
    ]

    for iteration in range(20):
        print(f"--- Iteration {iteration + 1} ---")

        for attempt in range(5):
            try:
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=4096,
                    system=SYSTEM_PROMPT,
                    tools=TOOLS,
                    messages=messages,
                )
                break
            except anthropic.APIStatusError as e:
                if e.status_code == 529 and attempt < 4:
                    wait = 2 ** attempt
                    print(f"  API overloaded, retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    raise

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\nAgent summary: {block.text}")
            return

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                name = block.name
                if name in TOOL_DISPATCH:
                    result = TOOL_DISPATCH[name](block.input)
                else:
                    result = json.dumps(
                        {"error": f"Unknown tool: {name}"}
                    )
                print(f"  -> {name}()")
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "user", "content": tool_results})

    print("Max iterations reached!")


def main():
    # We expect two similar ACME invoices in the invoices/ directory
    pdf_files = sorted(INVOICE_DIR.glob("*.pdf"))
    if len(pdf_files) < 2:
        print(f"Need at least 2 PDFs in {INVOICE_DIR}/")
        print("The repo ships with acme-invoice-001.pdf")
        print("and acme-invoice-002.pdf.")
        sys.exit(1)

    print(f"Found {len(pdf_files)} invoice(s) in {INVOICE_DIR}/:")
    for f in pdf_files:
        print(f"  - {f.name}")

    # Step 1: Process the first invoice
    print(f"\n{'#'*60}")
    print(f"  Processing: {pdf_files[0].name} (id: inv_1)")
    print(f"{'#'*60}")
    run_agent(str(pdf_files[0]), "inv_1")

    # Step 2: Simulate user corrections on the first invoice
    # The user renames the vendor and recategorizes a line item.
    print(f"\n{'~'*60}")
    print("  Simulating user corrections on first invoice...")
    print(f"{'~'*60}")

    _corrections.append({
        "invoice_id": "inv_1",
        "type": "vendor",
        "data": {
            "raw_name": "acme cloud svcs",
            "correct_name": "Acme Cloud Services Ltd.",
        },
    })
    print("  [vendor] 'acme cloud svcs' -> 'Acme Cloud Services Ltd.'")

    _corrections.append({
        "invoice_id": "inv_1",
        "type": "category",
        "data": {
            "item": "ssl certificate renewal",
            "correct_category": "Security",
        },
    })
    print("  [category] 'ssl certificate renewal' -> 'Security'")

    # Step 3: Process the second invoice — corrections should apply
    print(f"\n{'#'*60}")
    print(f"  Processing: {pdf_files[1].name} (id: inv_2)")
    print("  Corrections from inv_1 should be applied automatically.")
    print(f"{'#'*60}")
    run_agent(str(pdf_files[1]), "inv_2")

    print(f"\n{'='*60}")
    print("  What to look for:")
    print(f"{'='*60}")
    print("  Invoice 1 (no corrections yet):")
    print("    - Vendor: 'ACME Cloud Svcs' (raw, unmodified)")
    print("    - SSL Certificate Renewal: 'Uncategorized'")
    print()
    print("  Invoice 2 (corrections applied):")
    print("    - Vendor: 'Acme Cloud Services Ltd.' (learned)")
    print("    - SSL Certificate Renewal: 'Security' (learned)")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
