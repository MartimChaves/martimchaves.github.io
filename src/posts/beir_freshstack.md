---
title: "BEIR and FreshStack"
date: "2025-01-30"
description: "Two benchmarks for evaluating information retrieval systems"
draft: false
tags: ["LLM", "IR"]
slug: "beir-freshstack"
type: "notes"
---

When building retrieval systems, you need a way to measure how good they are. That's what benchmarks are for!

### BEIR

BEIR (Benchmarking Information Retrieval) is a collection of 19 datasets covering different retrieval tasks - question answering, fact-checking, citation recommendation, and more. The idea is simple: run your model across all 19, compare the scores, and get a sense of how well it generalises.

The metric used is **nDCG@10** (Normalized Discounted Cumulative Gain at 10). It measures the quality of the top 10 results returned. The intuition:

- A relevant document at position 1 is worth more than the same document at position 5. Earlier is better.
- You sum scores across all 10 positions, where each position's score is `relevance / log₂(position + 1)`. Position 1 gives full credit, position 2 gives ~63%, position 3 ~50%, and so on.
- You then divide by the score of the *perfect* ranking, bringing the final number between 0 and 1.

So nDCG@10 = 1.0 means your top 10 is in perfect order. nDCG@10 = 0.5 means your ranking is roughly half as good as it could be.

BEIR was originally designed as a *zero-shot* benchmark - models weren't meant to train on it, which was supposed to make the scores more trustworthy. In practice that's hard to guarantee today, especially with closed models. You can also indirectly optimise for BEIR by repeatedly picking the strategies that score best on it. So headline numbers should be taken with a grain of salt.

### FreshStack

FreshStack is a framework for building *custom* RAG benchmarks. The motivation: BEIR's datasets are static and increasingly familiar to models. FreshStack creates fresh benchmarks from recent StackOverflow threads and GitHub repositories, making it much harder to game.

The pipeline:

1. Pick recent StackOverflow questions and answers on niche topics.
2. Break each answer into atomic facts - called *nuggets*.
3. Collect a corpus of relevant documents from GitHub.
4. Use an LLM as a judge to score how well retrieved documents support each nugget.

Three metrics come out of this:

- **Diversity** (alpha-nDCG@10): rewards retrieving fewer, non-redundant documents. Penalises retrieving multiple documents that all say the same thing.
- **Grounding** (Coverage@20): measures whether the top 20 results collectively cover all nuggets. Are all the facts accounted for?
- **Relevance** (Recall@50): checks what fraction of the top 50 results are actually on-topic.

Together these give a more complete picture than a single score - a system can be accurate but redundant, or relevant but missing key facts.
