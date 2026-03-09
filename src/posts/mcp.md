---
title: "Model Context Protocol (MCP)"
date: "2025-08-19"
description: "How LLMs went from hoping for clean JSON to a proper standard for calling tools"
draft: false
tags: ["LLM", "MCP"]
slug: "mcp"
type: "tech"
---

MCP stands for Model Context Protocol - a standard that was developed to make LLM tool use more reliable.

### The problem it solves

People started using LLMs to produce JSON that could be parsed and used to call a function. Say you have this:

```python
def hello_greeting(name: str):
    print(f"Hello, {name}!")
```

You'd tell the LLM about the tool in your system prompt, then hope that whenever it needed to use it, it would output something like:

```json
{ "tool_name": "hello_greeting", "arguments": { "name": "world" } }
```

You'd parse that and call the function. This worked! But it was fragile. You were relying on the LLM to always produce valid JSON, use the right field names, and remember every tool you'd described. Any variation and your parser would break.

### How MCP fixes this

MCP introduces a proper client-server architecture. The LLM (client) is trained to emit structured messages that explicitly label what they are - plain text, a tool call, or a tool result:

```
{ "type": "text", "text": "Sure, I'll call the greeting tool." }
{ "type": "tool_use", "name": "hello_greeting", "input": { "name": "World" } }
{ "type": "tool_result", "text": "Hello, World!" }
```

When the LLM emits a `tool_use` message, it gets sent to an MCP server rather than your ad-hoc parser. The server validates the call - does this tool exist? are the arguments correct? - and if everything checks out, it executes the call and returns the result in a standard format.

If something is wrong, the server sends back a clear error:

```
{ "type": "tool_error", "text": "greeting_name is not an argument to hello_greeting. Available arguments: name" }
```

The LLM sees this, understands the mistake, and tries again with the right arguments.

### Why this matters

The MCP server adds a validation layer between the LLM's non-deterministic output and your actual functions. Instead of hoping the LLM gets it right every time, you now have structured error handling and a defined contract. It also means tool definitions are portable - any MCP-compatible client can connect to any MCP server without custom integration work.

In short: MCP turns "hope the LLM produces valid JSON" into a proper, robust protocol.
