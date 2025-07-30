+++
title = "Promptriever - instructions-aware IR"
date = "2025-01-30T11:22:13Z"
description = ""
draft = false

tags = ["LLM", "IR"]
+++

Promptriever is an encoding transformer (aka like regular LLM) that has been finetuned to create embeddings that learn instructions for queries used in IR.

The creators of promptriever started with a dataset of pairs of (query, relevant document). From these pairs, they created triplets with a positive instruction (i.e. an instruction that the relevant document respected) and a negative instruction (an instruction that the document didn't respect). Then they finetuned the model to bring the embedding of the [query+positive instruction] closer to the embedding of the relevant document, and the opposite for the negative instruction. This is how they created this model that respects instructions when retrieving documents.

Example:
Query: What is the capital of France?
Document: Oh lala le capital of France is none other than the beatiful ville of Paris!

Triplets created:
Query: What is the capital of France?
Positive instruction: In a fun, informal way
Relevant Document: Oh lala le capital of France is none other than the beatiful ville of Paris!
-> pull these embeddings closer

Query: What is the capital of France?
Negative instruction: In a very formal way
Relevant Document (same document as before): Oh lala le capital of France is none other than the beatiful ville of Paris!
-> pull these embeddings apart

TBC...