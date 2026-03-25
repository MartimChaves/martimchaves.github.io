# Smol Invoice Agent — Runnable Examples

Companion code for the [blog post](https://martimchaves.github.io/#/blog/smol-invoice-agent). Demonstrates a tool-using agent that extracts data from real PDF invoices and learns from corrections via vector similarity.

## Setup

```bash
uv venv .venv && uv pip install anthropic numpy python-dotenv pymupdf
cp .env.example .env
# Edit .env: add your Anthropic API key
```

## Running

### Simple agent loop (requires API key)

Self-contained agent loop that processes a hardcoded invoice. This is the code from the blog post. No PDF files needed.

```bash
uv pip install anthropic python-dotenv
cp .env.example .env  # add your Anthropic API key
python agent_loop.py
```

### Full agent demo (requires API key)

Processes every PDF in `invoices/`, calling Claude in a tool-use loop. After the first invoice, simulates user corrections so the second invoice benefits from learned fixes.

```bash
.venv/bin/python smol_agent_demo.py
```

### Vector similarity demo (no API key needed)

Shows how corrections transfer between invoices via embedding similarity. Extracts text from the sample PDFs but doesn't call any LLM.

```bash
.venv/bin/python vector_demo.py
```

You can drop your own invoice PDFs into `invoices/`. Both `smol_agent_demo.py` and `vector_demo.py` will pick them up automatically.

## Files

- `agent_loop.py` - Simple self-contained agent loop from the blog post (hardcoded invoice, no PDF needed)
- `smol_agent_demo.py` - Full agent loop: PDF extraction, Claude tool calls, correction memory
- `vector_demo.py` - Vector similarity search without an LLM
- `invoices/` - Sample invoice PDFs for testing
- `.env.example` - Template for API keys
