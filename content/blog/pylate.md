+++
title = "PyLate and late interaction models"
date = "2025-01-30T11:22:13Z"
description = ""
draft = false

tags = ["LLM", "IR"]
+++

Late interaction models basically means a model that doesn't compress several embedding vectors into a single vector. So instead of having just one embedding vector for a bit of text, you have N.

This way, when comparing between a query and a document, less context is missed/destroyed. This has shown great results. This preserves context and nuance, improving retrieval accuracy.

The major downside is that it's compute intensive - after all instead of searching for just one embedding vector, we have to compare between groups of N embedding vectors.

TBC...