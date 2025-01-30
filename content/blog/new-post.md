+++
title = "uncommon is an uncommon word - or a short intro to tokenization"
date = "2025-01-30T11:22:13Z"
description = "short intro to tokenization"
draft = false

tags = ["LLM", "language"]
+++

did you know that "uncommon" is an uncommon word? we can arrive at this conclusion from tokenizers! creating a tokenizer is the first step towards building a large language model (LLM). tokenizers create tokens that can, ideally, represent the smallest units of meaning in language. for example, the word "influx" can be broken down into two tokens, "in" and "flux". 

the "in" token carries plenty of meaning, being used in the formation of other words, such as "incoming" for things that are coming in, into us. and "flux" also encapsulates an idea, flow, movement. but tokens aren't always sub-representations of words. tokens can also be entire words, like "hello". the principal idea is that tokens are the lego blocks of language, used to construct text with meaning. 

so you may be wondering, what exactly are tokenizers? in essence they're big tables that assign an id to a token. and in the process of creating these tables we determine which groups of letters should actually be considered tokens. doing this involves looking at the frequency of words and how the words are built. this helps us determine which groups of letters are more frequent and more indicative of relevant tokens.

from this process, very common words are actually assigned their own tokens. curiously, "uncommon" does not get its own token, and so we conclude that "uncommon" is an uncommon word!

i mentioned that tokenizers aim to build a table with the smallest units of meaning in language, but they also have another important role - compression. by creating tokens we reduce the number of building blocks needed to represent language compared to assigning each word an id. see for example the words "incoming", "in", and "coming". with just two tokens, "in" and "coming", we are able to represent these three words.