---
title: "Building an AI Agent That Processes Invoices (and Learns From Its Mistakes)"
date: "2026-03-24"
description: "How I built a tool-using AI agent with Claude that extracts invoice data, validates it, and gets smarter over time through vector similarity and correction propagation."
draft: false
tags: ["AI", "Agents", "Claude", "Python"]
slug: "smol-invoice-agent"
type: "tech"
---

I built [Smol Invoice Agent](https://smolinvoiceagent.com). It's an agent that takes a PDF invoice, extracts structured data from it, validates everything, and exports clean JSON. Here's the cool part - we let the user make corrections, and we use those corrections to make the agent smarter over time. If future invoices are similar to the invoices that have had corrections made to them, we automatically apply those corrections. One important thing to note is that these corrections are based on user preferences - we don't use user A's corrections on user B's invoices.

In this post I'll walk through the core agent loop with runnable code so you can understand the pattern. All the examples below are available as runnable scripts in the [examples/smol-invoice-agent](https://github.com/martimchaves/martimchaves.github.io/tree/master/examples/smol-invoice-agent) directory.

I'm using [Simon Willison's definition of agent](https://simonwillison.net/2025/Sep/18/agents/) - an LLM in a loop that has access to tools with an objective.

## The idea

Invoice processing is tedious. You get a PDF, you manually pull out the vendor name, line items, totals, dates. Then you double-check the math, categorize each line item, and enter it into your system.

Agents shine in this domain. Invoices are generally structured documents with consistent patterns. But, at the same time, they can vary quite a bit in formatting, layout, and even language. This makes them ideal for LLM-based extraction - LLMs can easily deal with slight variations in formatting and layout, all the while aiming for a consistent output structure. Another thing - if the agent messes up, it's something that can be fixed and the downstream effects of having slight errors in invoice data aren't catastrophic.

Although an LLM can do most of this, we can use tools to make the output more robust. For example, we can let the LLM use tools that allow it to:

1. **Extract** text from the PDF
2. **Validate** the data has all required fields
3. **Normalize** the vendor name against known vendors
4. **Categorize** each line item
5. **Check** for duplicates, tax errors, anomalies
6. **Export** the final structured data

Although there's generally a clear order to follow, letting the LLM choose which tools to call allows for more flexibility. For example, if the extracted text is missing a vendor name, the agent might skip the vendor lookup step and flag it for human review instead. This flexibility is another benefit of using an agent over a rigid pipeline/workflow.

## The agent loop

The agent loop is as follows: send a message to Claude, Claude calls tools, we execute the tools and return the results, repeating this process until Claude says it's done. Here's the core loop:

```python
messages = [{"role": "user", "content": "Process the invoice."}]

for iteration in range(20):  # safety limit
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=messages,
    )

    messages.append({"role": "assistant", "content": response.content})

    if response.stop_reason == "end_turn":
        break  # Claude is done

    # Execute each tool call and return results
    tool_results = []
    for block in response.content:
        if block.type == "tool_use":
            # TOOL_DISPATCH is a dictionary that links tool name
            # to the actual code that should be run when that tool is called
            result = TOOL_DISPATCH[block.name](block.input)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": block.id,
                "content": result,
            })

    messages.append({"role": "user", "content": tool_results})
```

A couple of things to note. We have to set a safety limit known as the number of max iterations. This is so that the agent doesn't get stuck in an infinite loop. We pass the system prompt, the tools, and previous messages via the SDK client args, as each model was trained with a specific template, and the SDK handles that for us. In other words, each LLM expects the tools and messages laid out in a specific way. The rest is just defining the tools and their implementations. Let's go through each piece.

The system prompt tells the agent what it is and gives it a suggested workflow. It's a guideline, not a rigid script. We explicitly tell the agent it can adapt based on what it finds in the invoice. This is important because invoices vary a lot, and we want the agent to handle edge cases without us having to anticipate all of them.

```python
import json
import anthropic

client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY env var

SYSTEM_PROMPT = """\
You are an invoice processing agent. Process the invoice using the tools provided.

Workflow:
1. Extract text from the invoice using extract_text
2. Validate the data has required fields using validate_schema
3. Categorize each line item using categorize_line_item
4. Export the final result using export_invoice

The workflow above is a guideline, but you can adapt based on the invoice content.
"""
```

Next, we need to tell Claude what tools are available. Each tool is defined as a JSON object with a name, description, and input schema. Claude reads these definitions and decides which tools to call and with what arguments. We never hard-code the order.

```python
TOOLS = [
    {
        "name": "extract_text",
        "description": "Extract text content from the invoice PDF.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "validate_schema",
        "description": "Validate that invoice data contains required fields: invoice_number, date, vendor, line_items, total.",
        "input_schema": {
            "type": "object",
            "properties": {
                "invoice_data": {
                    "type": "object",
                    "description": "The invoice data to validate",
                }
            },
            "required": ["invoice_data"],
        },
    },
    {
        "name": "categorize_line_item",
        "description": "Assign a category to an invoice line item.",
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
```

Finally, we need the actual code that runs when Claude calls a tool. Each function takes the parameters Claude provides and returns a JSON string. For this demo, some of these are simplified. For example, `extract_text` returns hardcoded invoice text instead of reading a real PDF, and `export_invoice` just prints to the console instead of saving to a database. The important thing is that each tool is a simple function that does one thing and returns structured data.

```python
# Simulated invoice text (in the real system this reads a PDF from the database)
SAMPLE_INVOICE_TEXT = """
INVOICE #2024-0042
Date: 2024-11-15
From: Acme Cloud Services Ltd.

Description                    Qty    Unit Price    Amount
-----------------------------------------------------------
Cloud Hosting (Pro Plan)        1      450.00       450.00
SSL Certificate Renewal         2       29.99        59.98
Data Backup Service             1       89.00        89.00

                                     Subtotal:     598.98
                                     Tax (10%):     59.90
                                     TOTAL:        658.88
"""

CATEGORIES = {
    "hosting": "Infrastructure",
    "cloud": "Infrastructure",
    "ssl": "Security",
    "certificate": "Security",
    "backup": "Infrastructure",
    "license": "Software",
    "consulting": "Professional Services",
}

REQUIRED_FIELDS = ["invoice_number", "date", "vendor", "line_items", "total"]


def extract_text(params):
    return json.dumps({
        "text": SAMPLE_INVOICE_TEXT,
        "pages": 1,
        "file": "invoice-2024-0042.pdf",
    })


def validate_schema(params):
    data = params["invoice_data"]
    missing = [f for f in REQUIRED_FIELDS if f not in data or data[f] is None]
    return json.dumps({"valid": len(missing) == 0, "missing_fields": missing})


def categorize_line_item(params):
    desc = params["description"].lower()
    for keyword, category in CATEGORIES.items():
        if keyword in desc:
            return json.dumps({"category": category, "source": "keyword_match"})
    return json.dumps({"category": "Uncategorized", "source": "no_match"})


def export_invoice(params):
    data = params["invoice_data"]
    # In the real system this saves to PostgreSQL
    print(f"\n--- Exported Invoice ---")
    print(json.dumps(data, indent=2))
    return json.dumps({"status": "exported", "invoice_id": "inv_001"})


TOOL_DISPATCH = {
    "extract_text": extract_text,
    "validate_schema": validate_schema,
    "categorize_line_item": categorize_line_item,
    "export_invoice": export_invoice,
}
```

And finally, the full loop wrapped in a function:

```python
def run_agent():
    messages = [
        {"role": "user", "content": "Process the invoice. Start by extracting text."}
    ]

    for iteration in range(20):  # safety limit
        print(f"\n=== Iteration {iteration + 1} ===")

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
        )

        # Add assistant response to conversation
        messages.append({"role": "assistant", "content": response.content})

        # If Claude is done talking, we're finished
        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    print(f"\nAgent: {block.text}")
            return

        # Otherwise, process tool calls
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                print(f"  Tool: {block.name}({json.dumps(block.input)[:100]}...)")

                if block.name in TOOL_DISPATCH:
                    result = TOOL_DISPATCH[block.name](block.input)
                else:
                    result = json.dumps({"error": f"Unknown tool: {block.name}"})

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "user", "content": tool_results})

    print("Max iterations reached!")


if __name__ == "__main__":
    run_agent()
```

Run it with `uv pip install anthropic python-dotenv`, add your key to a `.env` file (`ANTHROPIC_API_KEY=your-key`), and run `python agent_loop.py`. Claude will:

1. Call `extract_text` to get the invoice text
2. Parse the text into structured data
3. Call `validate_schema` to check required fields
4. Call `categorize_line_item` for each line item
5. Call `export_invoice` with the complete structured result

The key insight is that **Claude decides the flow**. We give it tools and a system prompt describing the workflow. It figures out which tools to call, in what order, and with what arguments. If validation fails, it tries to fix the data. If a field is missing, it re-extracts. On the flip side, this flexibility means that Claude can deviate from the expected flow, sometimes in useful ways, sometimes not. Finding the right balance between flexibility and consistency is an ongoing process: we track user corrections and feedback, and use that to refine the system prompt and tool designs over time.

## The self-improvement loop

When a user corrects an invoice (for example, renames a vendor, recategorizes a line item), we save that correction to the database. When the next invoice comes in, we:

1. **Embed** the invoice text into a vector (using Voyage AI)
2. **Search** for similar past invoices using pgvector cosine distance
3. **Retrieve** corrections from those similar invoices
4. **Pass** them to the agent alongside the extracted text

Here's a simplified version showing the concept. We need two things: a way to turn invoice text into a vector (an embedding), and a way to compare two vectors to see how similar they are. In the real system we use Voyage AI for embeddings and pgvector for similarity search. For this demo, we fake the embeddings using a SHA-256 hash and compute cosine similarity with numpy.

```python
import json
import numpy as np

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
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr)))
```

Next, we need functions to store invoices and corrections. When we save an invoice, we embed its text and store the vector. Corrections are saved alongside the invoice they belong to.

```python
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
```

The key function is `find_similar_and_get_corrections`. Given a new invoice's text, it embeds the text, compares the vector against all stored invoices, and returns corrections from the most similar ones above a similarity threshold.

```python
def find_similar_and_get_corrections(text: str, exclude_id: str, k: int = 3, threshold: float = 0.5):
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
            all_corrections.append({**c, "from_invoice": inv_id, "similarity": round(sim, 3)})

    return all_corrections
```

Note that we have a threshold that we can tune to either only consider invoices that are very similar or to be more relaxed about it. We also use a top K to only consider corrections made to the very most similar invoices. The exclude_id is to prevent an invoice from matching against itself.

Now let's put it all together. We process a first invoice, simulate user corrections on it (renaming a vendor, recategorizing a line item), then process a second similar invoice and see if the corrections carry over.

```python
def demo():
    # Step 1: Process first invoice
    invoice_1_text = """
    INVOICE #1001
    From: ACME Cloud Svcs
    SSL Certificate Renewal - $59.98
    Cloud Hosting Pro Plan - $450.00
    """
    save_invoice("inv_1", invoice_1_text)

    # Step 2: User corrects invoice 1
    save_correction("inv_1", "vendor", {
        "raw_name": "acme cloud svcs",
        "correct_name": "Acme Cloud Services Ltd.",
    })
    save_correction("inv_1", "category", {
        "item": "ssl certificate renewal",
        "correct_category": "Security",
    })

    # Step 3: New similar invoice arrives
    invoice_2_text = """
    INVOICE #1002
    From: ACME Cloud Svcs
    SSL Certificate Renewal - $59.98
    Data Backup Monthly - $89.00
    """
    save_invoice("inv_2", invoice_2_text)

    # Step 4: Find corrections from similar invoices
    corrections = find_similar_and_get_corrections(invoice_2_text, exclude_id="inv_2")

    print(f"\n  Found {len(corrections)} corrections from similar invoices:")
    for c in corrections:
        print(f"    [{c['type']}] {json.dumps(c['data'])} (similarity: {c['similarity']})")

    # Step 5: These corrections get passed to the agent in extract_text results
    # The agent sees them and applies the vendor rename + category fix automatically


if __name__ == "__main__":
    demo()
```

You just need the numpy package to run `vector_demo.py` (no API key needed for this one!). The output shows how corrections from invoice 1 are found and would be passed to the agent when processing invoice 2.

In the real system, this happens inside the `extract_text` tool. After extracting text from the PDF, it embeds the text, searches pgvector for similar past invoices, retrieves their corrections, and includes them in the tool result:

```python
# Simplified from the real extract_text tool
result = {"text": extracted_text, "pages": page_count}

embedding = embed_text(extracted_text)  # Voyage AI
save_invoice_embedding(session, invoice_id, embedding)

similar = find_similar_invoices(session, tenant_id, embedding, k=5)
if similar:
    similar_ids = [sid for sid, _score in similar]
    corrections = get_corrections_for_invoices(session, similar_ids)
    if corrections:
        result["similar_invoice_corrections"] = [
            {"type": c.type, "data": c.data} for c in corrections
        ]
```

The agent's system prompt tells it to apply these corrections during processing - if it sees fit. Individual tools like `lookup_vendor` and `categorize_line_item` also query the corrections table directly, so corrections are applied at two levels: the agent level (strategic) and the tool level (automatic).

## Putting it all together

The [examples/smol-invoice-agent](https://github.com/martimchaves/martimchaves.github.io/tree/master/examples/smol-invoice-agent) directory has the complete runnable version that ties both pieces together: real PDF extraction, the agent loop, and simulated correction memory. The key difference from the snippets above: `extract_text` reads actual PDFs using pymupdf instead of returning hardcoded text.

```python
import pymupdf

def extract_pdf_text(pdf_path: str) -> tuple[str, int]:
    """Extract text from a PDF file. Returns (text, page_count)."""
    doc = pymupdf.open(pdf_path)
    page_count = len(doc)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text, page_count
```

The `invoices/` directory ships with two similar invoices from the same vendor (ACME Cloud Svcs) with overlapping line items. The script:

1. Processes the first invoice with the agent
2. Simulates a user correcting the vendor name ("ACME Cloud Svcs" → "Acme Cloud Services Ltd.") and recategorizing "SSL Certificate Renewal" as "Security"
3. Processes the second invoice, where the corrections from step 2 are automatically applied

To run it:

```bash
cd examples/smol-invoice-agent
uv venv .venv && uv pip install anthropic numpy python-dotenv pymupdf
cp .env.example .env  # add your Anthropic API key
.venv/bin/python smol_agent_demo.py
```

In the output for the second invoice, you should see the vendor name normalized and the SSL line item categorized as "Security", without any manual intervention.

## Why this pattern works

The agent loop is simple. It's just a while loop with tool dispatch. The power comes from three things:

1. **Claude decides the flow.** The system prompt describes a workflow, but Claude adapts. If validation fails, it retries. If data is ambiguous, it makes judgment calls. You don't need to hard-code branching logic.

2. **Tools are pure functions.** Each tool does one thing: validate, categorize, look up, export. They're easy to test, easy to swap out, easy to add new ones.

3. **Corrections compound.** Every user correction improves future processing. The vector similarity search means corrections transfer across invoices that look similar, even if they're from different vendors or have different structures.

The full system adds PostgreSQL with pgvector, Celery for async processing, Voyage AI for real embeddings, and a React frontend for reviewing and correcting invoices. But the core loop is exactly what you see above.
