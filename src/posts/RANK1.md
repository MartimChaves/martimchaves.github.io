---
title: "Rank1 - retrieval with reasoning"
date: "2025-01-30"
description: "what happens when you give a reranker the ability to think before scoring"
draft: false
tags: ["LLM", "IR"]
slug: "rank1"
type: "notes"
---

Retrieval systems typically work in two stages. First, a fast model retrieves a large candidate set (hundreds of documents). Then a *reranker* re-scores those candidates to find the best ones. Rerankers are slower but more precise - they can look at the query and document together, not just in isolation.

Rank1 is a reranker. What makes it different is that it uses chain-of-thought reasoning before producing a score.

### how it works

Rank1 has the architecture of a standard LLM, but it was fine-tuned using reasoning traces from DeepSeek R1 - a large reasoning model. During fine-tuning, Rank1 learned to generate a chain of thought about why a document is or isn't relevant to a query, and *then* predict a relevance score between 0 and 1 as its next token.

In practice this means the model doesn't just pattern-match on surface similarity. It reasons through the relevance: Does this document actually answer the question? Does it respect any constraints in the query? Is it addressing the right aspect?

### why reasoning helps

Standard rerankers are good at relevance in the broad sense but can miss nuance. If a query asks for something "without using library X" or "as a beginner-friendly explanation", a standard reranker might still score a technically relevant document highly even if it violates those constraints.

Because Rank1 generates a chain of thought, it has the opportunity to notice and reason about those constraints before scoring. The score becomes a conclusion, not just a similarity measure.

The tradeoff is latency - generating reasoning tokens before each score is slower than a direct scoring approach. But for use cases where precision matters more than throughput, this is often a worthwhile trade.
