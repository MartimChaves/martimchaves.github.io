---
title: "PyLate and late interaction models"
date: "2025-01-30"
description: "why one embedding vector per document isn't always enough"
draft: false
tags: ["LLM", "IR"]
slug: "pylate"
type: "notes"
---

Most retrieval models work like this: encode your query into a single vector, encode each document into a single vector, then find the documents whose vectors are closest to the query vector. Fast and simple.

The downside is that compressing an entire document into one vector loses information. A long document covers multiple ideas, and a single vector has to somehow represent all of them at once. Nuance gets blurred.

### late interaction: multiple vectors per document

Late interaction models - the most well-known being ColBERT - take a different approach. Instead of producing one vector per document, they produce *N* vectors - one per token. When you run a query, you similarly get multiple vectors, and the relevance score is computed by matching each query token against the best-matching document token.

This preserves much more detail. A query asking about a specific technical concept can match directly against the document token that covers that concept, rather than hoping the single document embedding captured it adequately.

The results back this up - late interaction models consistently outperform single-vector models on retrieval benchmarks, particularly for longer documents and more specific queries.

### the tradeoff

The catch is cost. Storing N vectors per document instead of one means much larger indexes. Scoring a query against a document requires comparing multiple vector pairs rather than a single dot product. At scale, this adds up fast.

This is where PyLate comes in - it's a library that makes working with late interaction models more practical, handling the indexing and scoring efficiently so you don't have to implement all of that yourself.

Whether the accuracy gain is worth the extra compute depends on your use case. For high-stakes retrieval where missing a relevant document is costly, it usually is.
