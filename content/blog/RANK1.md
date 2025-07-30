+++
title = "Rank1 - IR with reasoning"
date = "2025-01-30T11:22:13Z"
description = ""
draft = false

tags = ["LLM", "IR"]
+++

* RANK1 is a **reranker**. It takes in a query and a document and determines the value of the document to answer the query.
* It has the architecture of a regular LLM, but it was finetuned with the chain of thought trace of larger reasoning models - DeepSeek R1.
* So, even though it's doing next token prediction, it can, in a way, reason about how the document fetched is valuable to answer the query. This makes it more available to capture nuance in the instructions of the query.
* After the chain of thought, the model predicts, as a next token, the score, from 0 to 1, of how relevant the document is to the query.

TBC...