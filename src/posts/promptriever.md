---
title: "Promptriever - instruction-aware retrieval"
date: "2025-01-30"
description: "teaching a retrieval model to follow instructions, not just match keywords"
draft: false
tags: ["LLM", "IR"]
slug: "promptriever"
type: "tech"
---

Standard retrieval models find documents that are *relevant* to a query. But relevance depends on context. "Tell me about Paris" means something different depending on whether you want a travel guide, a history article, or a French grammar lesson.

Promptriever is a retrieval model trained to factor in instructions alongside the query - so you can say not just *what* you're looking for, but *how* you want it answered.

### how it was trained

The training started with a standard dataset of (query, relevant document) pairs. For each pair, the authors generated two extra things:

- A **positive instruction** - a description of a style or constraint that the document already satisfies (e.g. "explain it informally").
- A **negative instruction** - a constraint the document does *not* satisfy (e.g. "explain it in a very formal academic tone").

This created triplets: (query + positive instruction, relevant document) and (query + negative instruction, same document). The model was then trained with contrastive learning - pulling the [query + positive instruction] embedding closer to the document embedding, and pushing the [query + negative instruction] embedding away.

Here's the example from the paper:

> **Query:** What is the capital of France?
> **Document:** Oh lala le capital of France is none other than the beautiful ville of Paris!

| Instruction | Direction |
|---|---|
| "In a fun, informal way" | pull closer - document matches this |
| "In a very formal academic way" | push apart - document doesn't match this |

### what this enables

After training, the model learns that the same document can be a good or bad match for the same query depending on the instruction. You can now retrieve documents filtered not just by topic, but by tone, depth, format, or any other property you can describe in natural language.

This is useful in RAG pipelines where different downstream tasks need different kinds of documents - a chatbot and a citation tool might query the same index but want very different results.
