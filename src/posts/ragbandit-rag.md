---
title: "Seven Levels of RAG"
date: "2026-06-28"
description: "An example of building RAG on RAGBandit, from a naive baseline up to a smart router, where each level is a single file you can copy."
draft: false
tags: ["RAG", "RAGBandit", "Python"]
slug: "ragbandit-rag"
type: "tech"
---

A while back errybody was saying that "RAG is dead". But RAG is fundamentally just an idea - add relevant information to the LLM's context. There are a lot of ways to do this, some better than others, depending on the circumstances. The goal of this post is to explore different types of RAG, from a very simple approach (classic, naive RAG), to a more complex setup with multiple agents and a smart router. I'll be using the RAGBandit API to handle the retrieval, so that we can focus on the augmented generation part. Along the way there's copy-pasteable code, live demos, and even an interactive widget for getting a feel for BM25!

You can find the code from this post [here](https://github.com/MartimChaves/ragbandit-rag). Each level is roughly one file you can copy and run. The snippets below are trimmed-down versions to keep things readable. The repo has a frontend that you can run and use to play around with all of the different levels.

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

For disclosure, I built RAGBandit.
````

## The different levels of RAG

Here's a summary list of the different levels of RAG that we'll be approaching:

- Naive: the simplest form, vector search, add the chunks to the context besides the initial prompt query, let the LLM answer.
- Hybrid: do keyword search (i.e. keywords have to match between the query and the documents) and join the results of that with the vector search results. Useful when exact matches are needed (like when referencing acronyms).
- Filtering with LLM-as-judge: wait for the chunk evaluation to complete (which takes a bit), and use only the chunks that were considered relevant.
- Multimodal: if there are images attached to chunks, send them to a vision model for extra context, in case the answer is in the image.
- Agentic: the LLM drives its own search loop with five tools at its disposal: `search` (query the collection), `rephrase_query` (rewrite a query via sub-questions, HyDE, or step-back), `evaluate_retrieval` (judge whether the evidence so far is sufficient, ambiguous, or insufficient), `critique_draft` (check a draft answer for unsupported claims), and `finish` (submit the final answer). It can break down the query, run several searches, and retry when the results are not good enough.
- Multi-agent: similar to the agentic level, but with specialist agents for search, keywords, and vision, plus a grounding check on every claim.
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
    We walk from the dataset ID, to the embedding results, to the parent chunking results to get the chunks."""
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

With the corpus in hand, hybrid is: vector search, an independent BM25 pass over everything, union (i.e. a list with both the vector search chunks and keyword-scored chunks), fuse.

We fuse the chunks using reciprocal rank fusion. This means that for each chunk ID that shows up in the search results, we score them based on where in the list they show up, and we add the scores if they show up in both of the lists. This means that chunks high up in each list should make the cut, as well as chunks that are in both lists, even if they didn't score very high. `k` is a smoothing factor - the higher it is the less relevant the difference is between a chunk that appears first, and a chunk that appears last.

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    # rankings is a list of the two lists containing the searches results
    for ranking in rankings:  # Go over both the vector search results and the bm25 results
        for rank, chunk_id in enumerate(ranking, start=1):  # rank = index of the chunk in the ranking
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank)
    return scores
```

Now we can implement the hybrid RAG function. Note that there are fundamentally two searches: one keyword, and one vector. Even if you run them in parallel, this should take longer than a naive RAG setup, but might yield better results.

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

![Hybrid RAG answering a question in the RAGBandit RAG app](/images/ragbandit-rag/hybrid.gif)

*Hybrid RAG answering a sinkhole coverage question (sped up).*

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

## Filtering with LLM-as-judge

So, it turns out, vector search sometimes isn't enough. Why? Well, there are several reasons. One, when comparing a query and chunk, we're compressing the entire text of the query and the chunk into two embeddings, so some information is lost there. And also, because embedding models aren't flawless - semantically related things can land far apart in the embedding space, while unrelated things can end up close together. Another point, is that similarity scores are based on cosine similarity, which can lose some nuance, and focus on the wrong things (aspects that aren't relevant to the query). Piotr Migdał wrote a [great piece](https://p.migdal.pl/blog/2025/01/dont-use-cosine-similarity/) on this. So, to deal with this, we want a second opinion on the chunks that vector search hands us.

The approach here is to *filter*: take advantage of the LLM-as-judge that RAGBandit offers, and have it classify each chunk as relevant or not. We poll the query log until the evaluations are ready, and we only keep the chunks that were considered relevant. This way, we get fewer chunks (so less context rot), and the LLM has an easier shot at generating a better answer. The downside of this is that it's slower. To trigger the LLM-as-judge evaluations, we just have to pass `calculate_metrics: True` when searching:

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
    return {"evaluations": []}  # on timeout, no evaluations -> we keep all chunks below

def judge_filter_rag(client, question, top_k=5):
    chunks, query_log_id = search_with_metrics(client, question, top_k * 2)

    metrics = poll_metrics(client, query_log_id)
    relevant_ids = {
        e["chunk_id"] for e in metrics["evaluations"] if e["is_relevant"]
    }
    # if the judge timed out (no evaluations), fall back to the unfiltered chunks
    if relevant_ids:
        chunks = [c for c in chunks if c["chunk_id"] in relevant_ids]
    chunks = chunks[:top_k]

    context = format_context(chunks)
    return ask_llm(f"Context:\n{context}\n\nQuestion: {question}")
```

LLM-as-judge is a tool that we can use - but, we have to use this responsibly. Generally speaking, an LLM won't have the same knowledge as a domain expert, so, unless you're aligning the LLM with one (either by prompt engineering or fine tuning), we should expect the LLM-as-judge to be flawed. So, it's not useful as a definitive scorer, but more of as a general guide.

One thing worth being precise about: this *filters* chunks (drops the ones the judge rejects) but it doesn't *reorder* them - the survivors keep their vector-search ranking. True reranking is a related but distinct idea, and a natural next step here. You run every candidate through a reranker - a model that takes the query and chunk together and produces a relevance score - and then sort by that score. Because it looks at the pair jointly (instead of comparing two independent embeddings) it can catch nuance the vector search misses, and it's usually fast and cheap. RAGBandit doesn't ship a dedicated reranker today, so the LLM-as-judge is our stand-in for the same goal of higher-precision context - maybe something to add in the future!

## Multimodal RAG

Sometimes, we can extract relevant information from an image. When we get the chunks back from the search, if they have images attached, we can use those images as an extra source of information, by sending them alongside the query to a vision model. Again, we're just working on making the context that we give to an LLM to answer a query richer. This is also more expensive, and we don't always know if an image can add value. We could try to be more precise, but for now, here's a simple implementation:

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
        system="Answer using only the provided context. Cite [chunk] numbers.",
        messages=[{"role": "user", "content": content}],
    )
    return resp.content[0].text
```

## Agentic RAG

Agentic RAG is a big step change when compared to the previous versions of RAG. Instead of running a single search, we let the LLM drive the process, using several tools at its disposal, such as search and rephrasing the query. So, with queries that are more complex, instead of just running one search and being stuck with the results that we get back, a powerful LLM can split the query into smaller parts, search several times, and stop when it has enough information. This should improve the quality of the responses, with the downside of being way more expensive, and taking a lot more time. The snippet below shows the core loop with just the `search` tool, but the repo contains other tools: `rephrase_query`, `evaluate_retrieval`, `critique_draft`, and `finish`. Check out the [invoice agent post](https://martimchaves.com/#/blog/smol-invoice-agent) that goes deeper into how an agent works.

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

    # Bailing out here is crude - a nicer version would ask the model for a
    # best-effort answer from what it has gathered so far, instead of giving up.
    return "Ran out of iterations."
```

![Agentic RAG running its search loop in the RAGBandit RAG app](/images/ragbandit-rag/agentic.gif)

*Agentic RAG working through its search loop. Heads up: this one takes a while to finish in real time - it runs several searches back to back, so the clip above is sped up roughly 10x.*

## Multi-agent RAG

Multi-agent RAG is agentic RAG with a boost: instead of using just one agent, we use different specialized agents. By specialized agents, we mean agents that have a single, smaller task, with a specific system prompt, and specific tools.

Why do this? The big one is managing context. Instead of having an LLM deal with an ever increasing context, with lots of different facts, and chunks, and image info, we split the broader tasks into sub-tasks, so that each agent can deal with a smaller, easier to manage context, and a clearer goal.

Having smaller goals, with less information, generally leads to better results. One mega-prompt that keeps accumulating can get very expensive and slow things down. The downside is that there are more agents to manage, and more coordination overhead, which can complicate things.

To do multi-agent RAG we need an orchestrator, an agent that delegates, and specialized agents that perform specific tasks - a search agent, a keyword search agent, a vision agent, a grounding agent (an agent that checks the claims made against the evidence). The code snippet below is simplified to make it easier to understand.

```python
import json

# Each specialist owns a retrieval strategy, its own prompt, and its own tools.
# In the repo these are full agentic loops (like agentic_rag); here they're
# compact retrieval functions so the orchestration stays easy to read.
def search_agent(client, question):
    return client.search(question)                      # semantic vector search

def keyword_agent(client, question):
    corpus = all_chunks(client)                         # exact-term BM25 over everything
    bm25 = BM25Okapi([tokenize(c["chunk_text"]) for c in corpus])
    ranked = sorted(zip(corpus, bm25.get_scores(tokenize(question))),
                    key=lambda p: p[1], reverse=True)
    return [c for c, _ in ranked[:5]]

def vision_agent(client, question):
    chunks = client.search(question)                    # keep only chunks that carry images
    return [c for c in chunks
            if get_chunk_images(client, c["chunking_result_id"], c["chunk_id"])]

SPECIALISTS = {"search": search_agent, "keyword": keyword_agent, "vision": vision_agent}

ORCHESTRATOR_SYSTEM = """You route a question to retrieval specialists.
Reply with ONLY a JSON list drawn from: "search" (semantic), "keyword" (exact
terms, codes, acronyms), "vision" (figures, charts, tables). Pick all that apply."""

def is_grounded(answer, evidence):
    verdict = ask_llm(
        f"Answer:\n{answer}\n\nEvidence:\n{format_context(evidence)}\n\n"
        "Is every claim supported by the evidence? Reply 'yes' or 'no'.",
        system="You are a fact-checker.",
    )
    return verdict.strip().lower().startswith("yes")

def multiagent_rag(client, question):
    # Orchestrator delegates: pick the specialists worth running for this question.
    picks = json.loads(ask_llm(question, system=ORCHESTRATOR_SYSTEM))

    evidence = {}                                       # shared store, deduped by chunk_id
    for name in picks:                                  # the repo runs these concurrently
        for chunk in SPECIALISTS[name](client, question):
            evidence[chunk["chunk_id"]] = chunk
    evidence = list(evidence.values())

    answer = ask_llm(f"Context:\n{format_context(evidence)}\n\nQuestion: {question}")

    # Grounding agent: if a claim isn't supported, flag it (the repo re-searches).
    if not is_grounded(answer, evidence):
        answer += "\n\n(Note: some claims could not be fully grounded.)"
    return answer
```

## Smart router

There's one thing that's tricky with the multi-agent RAG setup - there are a lot of calls, a lot of parallel calls, and it can be hard to debug! If you'd like to have some sort of way to control how complex the approach should be to answering a query, you can try a smart router. Put simply, we're considering a smart router another LLM call that decides which of the RAG approaches to use.

You may ask, but doesn't the multi-agent RAG already sort of do that? Well, it does, but a smart router can be cheaper, and it works especially well if the vast majority of your queries don't need much more than vector search or hybrid RAG. The multi-agent setup can have an inclination to dig deeper, spending more tokens, making more checks, and with a smart router, you can just focus on the task of making sure it's choosing the appropriate level of complexity.

Of course, the smart router can also fail, and pick a route that's too simple, producing an underwhelming answer. This is a trade-off that we have to make and improve with time.

Here's a simple setup for a smart router:

```python
import json

ROUTER_SYSTEM = """Pick exactly ONE level for the question:
1 Naive: a simple, single-topic factual lookup
2 Hybrid: needs exact terms, names, codes, or numbers
3 Judge filter: needs high precision among many similar passages
4 Multimodal: about images, figures, charts, or tables
5 Agentic: a complex, multi-part question needing iterative search
6 Multi-Agent: broad research spanning many documents
Prefer the cheapest level that can answer well.
Reply with ONLY a JSON object: {"level": <1-6>, "reason": "<short>"}"""

LEVELS = {
    1: naive_rag, 2: hybrid_rag, 3: judge_filter_rag,
    4: multimodal_rag, 5: agentic_rag, 6: multiagent_rag,
}

def router_rag(client, question):
    choice = json.loads(ask_llm(question, system=ROUTER_SYSTEM))
    level = choice["level"]
    print(f"Routing to level {level}: {choice['reason']}")
    return LEVELS[level](client, question)
```

## Ok, but which one of these should I use?

If you're just starting off, I'd go with the hybrid RAG. Sometimes that's all you need! Using RAGBandit to tune the vector search, plus using keyword search to deal with acronyms or words/expressions that the embedding model used doesn't really know about, can be just what you need.

But as you're working on your RAG system, I'd make it a priority to set up some sort of evaluation system for the generation part - since evaluating the retrieval part can be done with RAGBandit. The simplest way to do this is adding a thumbs up/down to your answers - this way you're getting direct feedback from your users.

Another way, is having a domain expert craft a dataset of questions, and periodically rate the answers of your RAG system as good or bad with feedback. Over time, as you iterate on your RAG system, the percentage of good responses should go up. Maybe you can experiment with a model that selects keywords from the query for example. Or you can start adding judge filtering for more complex queries.

Also, keep an eye out for the cost - the best system is the one that is good enough and costs the least! Best of luck in your RAG endeavours!

## Links

- Repo: https://github.com/MartimChaves/ragbandit-rag
- RAGBandit: https://ragbandit.com
