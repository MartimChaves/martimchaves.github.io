---
title: "Seven Levels of RAG on Top of RAGBandit"
date: "2026-06-28"
description: "An example of building RAG on RAGBandit, from a naive baseline up to a smart router, where each level is a single file you can copy."
draft: false
tags: ["RAG", "RAGBandit", "Python"]
slug: "ragbandit-rag"
type: "tech"
---

A while back errybody was saying that "RAG is dead". But RAG is fundamentally just an idea - add relevant information to the LLM's context. There are a lot of ways to do this, some better than others, depending on the circumstances. The goal of this post is to explore different types of RAG, from a very simple approach (classic, naive RAG), to a more complex setup with multiple agents and a smart router. I'll be using the RAGBandit API to handle the retrieval, so that we can focus on the augmented generation part.

````tangent
Using RAGBandit for retrieval

[RAGBandit](https://ragbandit.com) is a web app that allows us to experiment with different document processing pipelines to improve the retrieval part of a RAG system. It exposes a search endpoint that will be used in this post. After experimenting with different pipelines, we can use the best one to retrieve information from our documents - this way, we can just worry about the generation part. If you're interested, [here's a use case example](https://ragbandit.com/use-cases/optimizing-insurance-document-retrieval) on how to run some experiments and improve your retrieval.

To search, we just have to make a `POST` request to `https://api.ragbandit.com/api/v1/datasets/{dataset_id}/search` with an API key. A tiny client is all that is needed:

```python
import requests

class RagbanditClient:
    def __init__(self, api_key, dataset_id,
                 base_url="https://api.ragbandit.com/api/v1"):
        self.dataset_id = dataset_id
        self.base_url = base_url
        self.headers = {"X-API-Key": api_key}

    def search(self, query, top_k=5, similarity_threshold=0.5):
        resp = requests.post(
            f"{self.base_url}/datasets/{self.dataset_id}/search",
            headers=self.headers,
            json={
                "query": query,
                "top_k": top_k,
                "similarity_threshold": similarity_threshold,
            },
        )
        resp.raise_for_status()
        return resp.json()["results"]
```

Besides the API key, we need the dataset ID, a query, and, optionally, the top-k chunks to consider and a similarity threshold.

```python
client = RagbanditClient(api_key="sk-live-...", dataset_id="your-dataset-id")

for chunk in client.search("How does reranking work?"):
    print(chunk["similarity_score"], chunk["chunk_text"])
```

We can loop over the search results to check out all of the chunks returned. All of the levels in this post start from a `client.search(...)` call.

> The version in the repo uses `httpx` so it can fire several searches concurrently (the agentic levels lean on that), and it wraps each result in a small dataclass.
````

## The different levels of RAG

Here's a summary list of the different levels of RAG that we'll be approaching:

- Naive: the simplest form, vector search, add the chunks to the context besides the inital prompt query, let the LLM answer.
- Hybrid: do keyword search (i.e. keywords have to match between the query and the documents) and join the results of that with the vector search results. Useful when exact matches are needed (like when referencing acronyms).
- Reranking: wait for the chunk evaluation to complete (which takes a bit), and use only the chunks that were considered relevant.
- Multimodal: if there are images attached to chunks, send them to a vision model for extra context, in case the answer is in the image.
- Agentic: the LLM drives its own search loop with five tools at its disposal: `search` (query the collection), `rephrase_query` (rewrite a query via sub-questions, HyDE, or step-back), `evaluate_retrieval` (judge whether the evidence so far is sufficient, ambiguous, or insufficient), `critique_draft` (check a draft answer for unsupported claims), and `finish` (submit the final answer). It can break down the query, run several searches, and retry when the results are not good enough.
- Multi-agent: similar to the agentic level, but with specialist agents for search, keywords, documents, and vision, plus a grounding check on every claim.
- Smart router: pick the right level for each question.

Every snippet below reuses the search `client` from above, plus two small helpers: one to turn chunks into a numbered context string, and one to call an LLM. I'm using Claude here, but the LLM layer is swappable - you can use your LLM provider of choice.

```python
import anthropic

llm = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

def format_context(chunks):
    return "\n\n".join(
        f"[{i}] {c['chunk_text']}" for i, c in enumerate(chunks, 1)
    )

def ask_llm(prompt, system="Answer using only the provided context. Cite [chunk] numbers."):
    resp = llm.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return resp.content[0].text
```

## Naive RAG

This is really the simplest form of RAG. Get chunks -> pass them to the context -> query LLM. In theory, if you fill the context with exactly the claims that are needed to answer the query, this should work just fine. But in practice, it's a bit harder than that. This simple setup can yield great answers, but more often than not, it fails. Still, it's a good baseline!

```python
def naive_rag(client, question, top_k=5):
    chunks = client.search(question, top_k=top_k)
    context = format_context(chunks)
    return ask_llm(f"Context:\n{context}\n\nQuestion: {question}")
```

## Hybrid RAG

A good bump in performance usually comes from adding in keyword search. If you want to get fancy, ask an LLM to extract the keywords from a query - or work out some complicated regular expression. In this case, we're using the entire query for the keyword search.

Vector search works on semantic similarity. If your documents have obscure acronyms, or specific codes, or anything that can relate to a query in an analytical way, not a semantic way, then hybrid search will be your friend.

The tricky part is that if you're running keyword search over your entire corpus, then you should probably load the whole corpus once and serve it, instead of loading it everytime you need to run a query.

Alternatively, you can run keyword search over a subset of the corpus, but this requires you to have a way to filter the corpus based on the query.

In this case, we're running keyword search over the entire dataset. This means that, if you're going to try this at home, you might want to be careful with the size of your RAGBandit dataset.

Working with RAGBandit, the search endpoint is vector-only, so we have to dig a bit to get the corpus that we need for the keyword search. Getting all of the chunks in the dataset is a short walk: dataset members -> embedding results -> chunking results. Note that we're assuming that the chunking method used also works for keyword search.

```python
import re
import requests
from rank_bm25 import BM25Okapi

def tokenize(text):
    return re.findall(r"\w+", text.lower())

def all_chunks(client):
    """Every chunk in the dataset - the corpus BM25 searches over.
    We walk from the dataset ID, to the embedding resutls, to the parent chunking results to get the chunks."""
    members = requests.get(
        f"{client.base_url}/datasets/{client.dataset_id}/members",
        headers=client.headers,
    ).json()
    corpus = []
    for m in members:
        emb = requests.get(
            f"{client.base_url}/embeddings/{m['embedding_result_id']}",
            headers=client.headers,
        ).json()
        detail = requests.get(
            f"{client.base_url}/chunking-results/{emb['chunking_result_id']}",
            headers=client.headers,
        ).json()
        for ch in detail["chunks"]:
            corpus.append({
                "chunk_id": str(ch["id"]),
                "chunk_text": ch.get("text", ""),
                "document_filename": emb.get("document_filename"),
                "page_number": ch.get("page_index"),
            })
    return corpus
```

With the corpus in hand, hybrid is: vector search, an independent BM25 pass over everything, union (i.e. a list with both the vector search chunks and keyword scores chunks), fuse.

We fuse the chunks using reciprocal rank fusion. This means that for each chunk ID in both of the search results, we score them based on where in the list they show up, and we add the scores if they show up in both of the lists. This means that chunks high up in each list should make the cut, as well as chunks that are in both lists, even if they didn't score very high. `k` is a smoothing factor - the higher it is the less relevant the difference is between a chunk that appears first, and a chunk that appears last.

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    # rankings is a list of the two lists containing the searches results
    for ranking in rankings:  # Go over both the vector search results and the bm25 results
        for rank, chunk_id in enumerate(ranking, start=1):  # rank = index of the chunk in the ranking
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
    return scores
```

Now we can implement the hybrid RAG function. Note that there are fundamentally two searches: one keyword, and one vector. Even if you run them in parallel, this should take longer, but might yield better results.

```python
def hybrid_rag(client, question, top_k=5):
    # Retriever 1: vector search (over-fetch a bit)
    # Comes pre-sorted
    vector_hits = client.search(question, top_k=top_k * 2)

    # Retriever 2: BM25 over the ENTIRE corpus - this is what lets hybrid
    # surface a chunk vector search never returned.
    corpus = all_chunks(client)  # cache this in real code
    bm25 = BM25Okapi([tokenize(c["chunk_text"]) for c in corpus])
    bm25_scores = bm25.get_scores(tokenize(question))
    # Sort the BM25 scores
    bm25_hits = [
        c for c, _ in
        sorted(zip(corpus, bm25_scores), key=lambda p: p[1], reverse=True)
    ][:top_k * 2]

    # Union the two candidate sets and fuse their rankings with RRF
    vector_ranking = [c["chunk_id"] for c in vector_hits]
    bm25_ranking = [c["chunk_id"] for c in bm25_hits]
    fused = reciprocal_rank_fusion([vector_ranking, bm25_ranking])

    by_id = {c["chunk_id"]: c for c in corpus}
    by_id.update({c["chunk_id"]: c for c in vector_hits})
    best_ids = sorted(fused, key=fused.get, reverse=True)[:top_k]

    context = format_context([by_id[cid] for cid in best_ids])
    return ask_llm(f"Context:\n{context}\n\nQuestion: {question}")
```

````tangent
So how does BM25 actually score a chunk?

BM25 ("Best Matching 25", the 25th iteration of the idea) is a formula that scores how well a chunk matches a query. It's built on two old, intuitive ideas: term frequency and inverse document frequency.

Term frequency (TF): a chunk that mentions a query word more often is probably more relevant. But with diminishing returns - the 10th "sinkhole" tells you a lot less than the 2nd. So BM25 lets the score saturate as the count grows.

Inverse document frequency (IDF): rare words carry more signal. "the" shows up in every chunk, so matching on it tells you nothing; "sinkhole" shows up in a handful, so matching on it is a strong hint. IDF weights each word by how rare it is across the whole corpus - which is why keyword search needs every chunk, not just the ones vector search returned.

There's one more thing: long chunks contain more words, so they'd rack up matches just by being long. BM25 divides that out, normalising by how the chunk's length compares to the average.

Put together, the score of a chunk for a query $q$ is the sum, over each query word $w$, of that word's IDF times a saturating term-frequency factor:

$$
\text{score} = \sum_{w \in q} \text{IDF}(w) \cdot \frac{f(w)\,(k_1 + 1)}{f(w) + k_1\left(1 - b + b\,\dfrac{\text{len}}{\text{avg\_len}}\right)}
$$

where $f(w)$ is how many times $w$ appears in the chunk, $\text{len}$ is the chunk's length (in words), $\text{avg\_len}$ the average chunk length, and $k_1$ (~1.5) and $b$ (~0.75) are knobs controlling how fast TF saturates and how hard length is penalised. Add up the per-word scores and you get the chunk's ranking.

The $\text{IDF}(w)$ term deserves its own formula. If $N$ is the number of chunks in the corpus and $n(w)$ is how many of them contain the word $w$, then:

$$
\text{IDF}(w) = \ln\!\left(1 + \frac{N - n(w) + 0.5}{n(w) + 0.5}\right)
$$

The $0.5$s smooth it and the $+1$ inside the log keeps it positive. The intuition: when a word shows up in only a few chunks ($n(w)$ small), the fraction is large, so $\text{IDF}$ is large - a rare word is a strong signal. When it's in almost every chunk, $\text{IDF}$ collapses towards zero. This is also the part that needs the whole corpus: you can't know how rare a word is without counting across every chunk.

We're using the term "words", but strictly speaking you do BM25 search using tokens - but how you tokenize is up to you! So, we've been using words here to simplify, and also because tokens is a loaded word nowadays, with LLMs and all. Our `tokenize` (for BM25 search) just lowercases and splits on words. Again, BM25 matches on exact tokens! That's its strength - it nails `XUBNE` (Xenitar Uber Bank National Entity) - I just made this up - and other odd acronyms that embeddings don't know how to represent; and its weakness - it has no idea that "car" and "automobile" mean the same thing. Which is the whole reason we fuse it with vector search rather than pick one.

Enough formulas - here's the whole thing wired up. Edit the query or the corpus, drag `k1` and `b`, and watch the scores and the per-term breakdown shift. Try a rare word like "sinkhole" versus a common one like "coverage" to see IDF at work.

```bm25-explorer
```
````

## Reranking RAG

- Similarity scores are cheap but blunt. Ask an LLM-as-judge to actually read each chunk and decide whether it's relevant.
- RAGBandit can do this server-side: pass `calculate_metrics: True`, then poll the query log until the evaluations are ready.
- Keep only the chunks the judge marked relevant. Fewer, cleaner chunks in the prompt means a more focused answer.

```python
import time
import requests

def search_with_metrics(client, question, top_k):
    resp = requests.post(
        f"{client.base_url}/datasets/{client.dataset_id}/search",
        headers=client.headers,
        json={"query": question, "top_k": top_k, "calculate_metrics": True},
    )
    resp.raise_for_status()
    data = resp.json()
    return data["results"], data["query_log_id"]

def poll_metrics(client, query_log_id, timeout=60, interval=2):
    url = f"{client.base_url}/query-logs/{query_log_id}"
    for _ in range(int(timeout / interval)):
        log = requests.get(url, headers=client.headers).json()
        metrics = log.get("metrics")
        if metrics and metrics.get("status") != "calculating":
            return metrics
        time.sleep(interval)  # evaluations are computed asynchronously
    return {"evaluations": []}

def rerank_rag(client, question, top_k=5):
    chunks, query_log_id = search_with_metrics(client, question, top_k * 2)

    metrics = poll_metrics(client, query_log_id)
    relevant_ids = {
        e["chunk_id"] for e in metrics["evaluations"] if e["is_relevant"]
    }
    chunks = [c for c in chunks if c["chunk_id"] in relevant_ids][:top_k]

    context = format_context(chunks)
    return ask_llm(f"Context:\n{context}\n\nQuestion: {question}")
```

## Multimodal RAG

- Sometimes the answer is in a figure, chart, or table - text-only retrieval can't see it.
- Chunks can have images attached. Fetch them and send them alongside the text to a vision model.
- Same retrieval as before, just a richer prompt: text blocks plus base64 image blocks.

```python
import requests

def get_chunk_images(client, chunking_result_id, chunk_id):
    url = f"{client.base_url}/chunking-results/{chunking_result_id}"
    chunks = requests.get(url, headers=client.headers).json()["chunks"]
    for c in chunks:
        if str(c["id"]) == chunk_id:
            return [img["image_base64"] for img in c.get("images", [])]
    return []

def multimodal_rag(client, question, top_k=5):
    chunks = client.search(question, top_k=top_k)

    content = [{
        "type": "text",
        "text": f"Context:\n{format_context(chunks)}\n\nQuestion: {question}",
    }]
    for c in chunks:
        for b64 in get_chunk_images(client, c["chunking_result_id"], c["chunk_id"]):
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/png", "data": b64},
            })

    resp = llm.messages.create(
        model="claude-sonnet-4-6", max_tokens=1024,
        messages=[{"role": "user", "content": content}],
    )
    return resp.content[0].text
```

## Agentic RAG

- Instead of one fixed search, hand the LLM a `search` tool and let it drive its own loop.
- It can break the question into pieces, search several times, and stop when it has enough.
- The snippet below shows the core loop with just `search`. The repo adds `rephrase_query`, `evaluate_retrieval`, `critique_draft`, and `finish` as extra tools.

```python
SEARCH_TOOL = {
    "name": "search",
    "description": "Search the document collection for relevant chunks.",
    "input_schema": {
        "type": "object",
        "properties": {"query": {"type": "string"}},
        "required": ["query"],
    },
}

def agentic_rag(client, question, max_iterations=5):
    messages = [{"role": "user", "content": f"Question: {question}"}]

    for _ in range(max_iterations):
        resp = llm.messages.create(
            model="claude-sonnet-4-6", max_tokens=1024,
            system="Research the question. Use the search tool until you can answer.",
            tools=[SEARCH_TOOL], messages=messages,
        )
        messages.append({"role": "assistant", "content": resp.content})

        if resp.stop_reason != "tool_use":
            return resp.content[0].text  # the model answered directly

        # Run every search the model asked for, feed the chunks back.
        tool_results = []
        for block in resp.content:
            if block.type == "tool_use" and block.name == "search":
                chunks = client.search(block.input["query"])
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": format_context(chunks),
                })
        messages.append({"role": "user", "content": tool_results})

    return "Ran out of iterations."
```

## Multi-agent RAG

- The agentic loop with specialists: one orchestrator delegates to a search agent, a keyword agent, a document agent, and a vision agent.
- Searches fan out in parallel into a shared evidence store that dedupes by `chunk_id`, so agents build on each other's findings.
- Before answering, a grounding agent checks every claim against the evidence - if something isn't supported, the orchestrator searches again.

```python
def parallel_search(client, queries):
    evidence = {}
    for q in queries:                 # the repo runs these concurrently
        for chunk in client.search(q):
            evidence[chunk["chunk_id"]] = chunk   # dedupe by chunk_id
    return list(evidence.values())

def is_grounded(answer, evidence):
    verdict = ask_llm(
        f"Answer:\n{answer}\n\nEvidence:\n{format_context(evidence)}\n\n"
        "Is every claim supported by the evidence? Reply 'yes' or 'no'.",
        system="You are a fact-checker.",
    )
    return verdict.strip().lower().startswith("yes")

def multiagent_rag(client, question):
    # Orchestrator fans out a few angles, pools the evidence, then verifies.
    evidence = parallel_search(client, [
        question,
        f"background context for: {question}",
        f"specific details about: {question}",
    ])
    answer = ask_llm(f"Context:\n{format_context(evidence)}\n\nQuestion: {question}")

    if not is_grounded(answer, evidence):
        answer += "\n\n(Note: some claims could not be fully grounded.)"
    return answer
```

## Smart router

- The expensive levels are wasted on easy questions. Spend one cheap LLM call to pick the right level first.
- The router classifies the question and returns a level number; you dispatch to that pipeline.
- Cheapest level that can answer well wins, so most questions never touch the heavy machinery.

```python
import json

ROUTER_SYSTEM = """Pick exactly ONE level for the question:
1 Naive — a simple, single-topic factual lookup
2 Hybrid — needs exact terms, names, codes, or numbers
3 Reranking — needs high precision among many similar passages
4 Multimodal — about images, figures, charts, or tables
5 Agentic — a complex, multi-part question needing iterative search
6 Multi-Agent — broad research spanning many documents
Prefer the cheapest level that can answer well.
Reply with ONLY a JSON object: {"level": <1-6>, "reason": "<short>"}"""

LEVELS = {
    1: naive_rag, 2: hybrid_rag, 3: rerank_rag,
    4: multimodal_rag, 5: agentic_rag, 6: multiagent_rag,
}

def router_rag(client, question):
    choice = json.loads(ask_llm(question, system=ROUTER_SYSTEM))
    level = choice["level"]
    print(f"Routing to level {level}: {choice['reason']}")
    return LEVELS[level](client, question)
```

## Links

- Repo: https://github.com/MartimChaves/ragbandit-rag
- RAGBandit: https://ragbandit.com
