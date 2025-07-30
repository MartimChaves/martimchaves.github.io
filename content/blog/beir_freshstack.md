+++
title = "BEIR and FreshStack"
date = "2025-01-30T11:22:13Z"
description = ""
draft = false

tags = ["LLM", "IR"]
+++

### BEIR
* The BEIR benchmark (Benchmarking Information Retrieval) is a collection of 19 datasets. Each dataset tests information retrieval for a specific task (question answering, fact-checking, ...).
* It was supposedly a zero-shot benchmark - models wouldn't use BEIR to train, so their results on BEIR would be more reliable.
* But nowadays, that doesn't really happen - after all, there are some private models, and even with open models, you can, indirectly, tune for a high BEIR score (i.e. keep choosing the best performing strategies for BEIR and improve those).
* The scoring algorithm checks if the top 10 retrieved documents are, in order, the best document to answer the query.
	* The algo is called nDCG@10 (Normalized Discounted Cumulative Gain at 10). How it works:
		* DCG@10 = sum for positions 1 to 10:
			* sum relevance of i / log⁡2(i+1) for i in top 10 retrieved documents;
			* e.g. if ranking is:
				* Doc A (rel = 2) at pos 1,
				* Doc B (rel = 1) at pos 2,
				* others zero:
					* DCG = 2 / log₂(2) + 1 / log₂(3) ≈ 2 / 1 + 1 / 1.585 ≈ 2 + 0.63 = 2.63
		* IDCG@10 = the ideal (best possible) DCG using perfect ordering by relevance. If only those two relevant docs, same order gives IDCG ≈ 2.63.
		* nDCG@10 = DCG@10 / IDCG@10. In this case: 2.63 / 2.63 = 1.0 (perfect score).

### FreshStack

FreshStack was created as a framework to create tailored benchmarks for RAG. It works by:
* Getting queries and answers from stackoverflow (selected recent queries and answers from niche topics)
* Transforming each answer into a set of atomic facts - the nuggets
* Getting a corpus of documents from github using several methods that are relevant to those queries
* Use LLM-as-a-judge to determine if the documents retrieved were relevant to support the nuggets

The three metrics introduced to check the quality of FreshStack pipeline results are:
* Diversity (alpha-nDCG@10): Prioritize retrieving as little documents as possible. Penalizes the retrieval of multiple documents that support the same fact (measure redundancy).
* Grounding (Coverage@20): Make sure that all nuggets are supported. Measures the percentage of unique nuggets supported by the retrieved documents, directly evaluating evidence collection.
* Relevance (Recall@50): Check whether the retrieved documents are on-topic - % of relevant documents in top 50 retrieved documents.