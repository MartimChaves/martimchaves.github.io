---
title: "Uncommon is an uncommon word - a short intro to tokenization"
date: "2025-01-30"
description: "What tokens are, how they're built, and why \"uncommon\" doesn't get one"
draft: false
tags: ["LLM", "language"]
slug: "tokenization"
type: "tech"
---

Did you know that "uncommon" is an uncommon word? We can learn this from tokenizers!

Building a tokenizer is the first step in building a large language model. A tokenizer's job is to break text into *tokens* - the smallest meaningful units the model will work with. "Influx", for example, splits into "in" and "flux". Both carry independent meaning: "in" appears in "incoming", "inside", "input"; "flux" appears in "influx", "reflux", "superflux". Splitting them is more useful than treating "influx" as one opaque blob.

Tokens aren't always sub-word pieces. Very common words like "hello" or "the" get their own token. The goal is that tokens be the Lego bricks of language - small enough to recombine freely, meaningful enough to be useful on their own.

### How a tokenizer is built

A tokenizer is essentially a lookup table: a list of character sequences, each with a unique ID. The question is which sequences earn a spot in that table.

The answer comes from frequency analysis on a large corpus of text. Sequences that appear together often get merged into a single token. Sequences that rarely appear together stay as separate characters. This process is called Byte Pair Encoding (BPE), and it's the algorithm behind most modern tokenizers. This is why common words get their own token, and rare or unusual words get split into smaller pieces.

From this process: "uncommon" doesn't appear frequently enough to earn its own token - so it gets split up. And that's how we know it's genuinely uncommon.

### The compression bonus

There's a secondary benefit to this approach: compression. Representing language as tokens rather than individual characters (or full words) reduces the number of symbols the model needs to work with.

Consider "incoming", "in", and "coming". With character-level encoding you'd need to represent each letter separately. With word-level encoding, each word needs its own ID - including every inflection and compound. With tokens, "in" + "coming" covers all three. Fewer symbols, same expressive power.

This is why most modern LLMs share a roughly similar vocabulary size (around 50k–100k tokens) - it's the sweet spot between coverage and efficiency.

So next time you see a word split into pieces by a tokenizer, you'll know why - it just wasn't common enough to earn its own token. "Uncommon", as it turns out, really is.
