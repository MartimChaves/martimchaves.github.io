"""
Simple agent loop demo — matches the blog post code exactly.

A self-contained agent that processes a hardcoded invoice using Claude's
tool-use API. No PDF files needed.

Requirements:
    uv pip install anthropic python-dotenv

Usage:
    cp .env.example .env  # add your Anthropic API key
    python agent_loop.py
"""

import json
import os

from dotenv import load_dotenv
import anthropic

load_dotenv()

client = anthropic.Anthropic()
MODEL = os.getenv("MODEL", "claude-sonnet-4-20250514")

SYSTEM_PROMPT = """\
You are an invoice processing agent.
Process the invoice using the tools provided.

Workflow:
1. Extract text from the invoice using extract_text
2. Validate the data has required fields using validate_schema
3. Categorize each line item using categorize_line_item
4. Export the final result using export_invoice

This workflow is a guideline. Adapt based on
the invoice content.
"""

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
        "description": "Validate that invoice data contains required fields: "
                       "invoice_number, date, vendor, line_items, total.",
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

# Simulated invoice text
# (in the real system this reads a PDF from the database)
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
            return json.dumps(
                {"category": category, "source": "keyword_match"}
            )
    return json.dumps({"category": "Uncategorized", "source": "no_match"})


def export_invoice(params):
    data = params["invoice_data"]
    # In the real system this saves to PostgreSQL
    print("\n--- Exported Invoice ---")
    print(json.dumps(data, indent=2))
    return json.dumps({"status": "exported", "invoice_id": "inv_001"})


TOOL_DISPATCH = {
    "extract_text": extract_text,
    "validate_schema": validate_schema,
    "categorize_line_item": categorize_line_item,
    "export_invoice": export_invoice,
}


def run_agent():
    messages = [
        {
            "role": "user",
            "content": "Process the invoice. Start by extracting text."
        }
    ]

    for iteration in range(20):  # safety limit
        print(f"\n=== Iteration {iteration + 1} ===")

        response = client.messages.create(
            model=MODEL,
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
                print(
                    f"  Tool: {block.name}({json.dumps(block.input)[:100]}...)"
                )

                if block.name in TOOL_DISPATCH:
                    result = TOOL_DISPATCH[block.name](block.input)
                else:
                    result = json.dumps(
                        {"error": f"Unknown tool: {block.name}"}
                    )

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                })

        messages.append({"role": "user", "content": tool_results})

    print("Max iterations reached!")


if __name__ == "__main__":
    run_agent()
