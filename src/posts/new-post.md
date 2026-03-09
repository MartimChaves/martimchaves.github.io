---
title: "uncommon is an uncommon word - a short intro to tokenization"
date: "2025-01-30"
description: "what tokens are, how they're built, and why \"uncommon\" doesn't get one"
draft: false
tags: ["LLM", "language"]
slug: "tokenization"
type: "tech"
---

did you know that "uncommon" is an uncommon word? you can figure this out from tokenizers.

building a tokenizer is the first step in building a large language model. a tokenizer's job is to break text into *tokens* - the smallest meaningful units the model will work with. "influx", for example, splits into "in" and "flux". both carry independent meaning: "in" appears in "incoming", "inside", "input"; "flux" appears in "influxdb", "reflux", "superflux". splitting them is more useful than treating "influx" as one opaque blob.

tokens aren't always sub-word pieces. very common words like "hello" or "the" get their own token. the goal is that tokens be the lego bricks of language - small enough to recombine freely, meaningful enough to be useful on their own.

### how a tokenizer is built

a tokenizer is essentially a lookup table: a list of character sequences, each with a unique ID. the question is which sequences earn a spot in that table.

the answer comes from frequency analysis on a large corpus of text. sequences that appear together often get merged into a single token. sequences that rarely appear together stay as separate characters. this is why common words get their own token, and rare or unusual words get split into smaller pieces.

from this process: "uncommon" doesn't appear frequently enough to earn its own token - so it gets split up. and that's how we know it's genuinely uncommon.

### the compression bonus

there's a secondary benefit to this approach: compression. representing language as tokens rather than individual characters (or full words) reduces the number of symbols the model needs to work with.

consider "incoming", "in", and "coming". with character-level encoding you'd need to represent each letter separately. with word-level encoding, each word needs its own ID - including every inflection and compound. with tokens, "in" + "coming" covers all three. fewer symbols, same expressive power.

this is why most modern LLMs share a roughly similar vocabulary size (around 50k–100k tokens) - it's the sweet spot between coverage and efficiency.
