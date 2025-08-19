+++
title = "thoughts on llm evals"
date = "2025-08-19T11:22:13Z"
description = ""
draft = false

tags = ["LLM", "MCP"]
+++

MCP stans for Model Context Protocol. It's a protocol that has been developed to standardize tool use.

Some folks started using LLMs to produce json that could be parsed to run a function - i.e. a tool. Say you built a function that looks like this:

```python
def hello_greeting(name: str):
    print(f"Hello, {name}!")
```

You would tell your LLM, something like:
```
Assistant: If you want to run a greeting tool, you can run the following tool:
Tool name: 'hello_greeting'
Arguments:
  - name: string
```

And then, you hoped that, if there ever was a need to run this tool, the LLM would output something like this:

```json
{'tool_name': 'hello_greeting', 'arguments':{'name':'world'}}
```

You would parse this, and run the hello_greeting function - either passing the output of the function back to the LLM or just printing it out.

This worked! But it was a bit fragile. You're counting on the LLM to output clean json and to remember tools.

This was why MCP was invented. MCP requires a client (i.e. the streaming LLM) and a host server.

The streaming LLM has been rigurously trained to always output text following a format that explains what the words being output are part of - just a bit of text, a tool_call, or a tool_result. So the training data looks like this:

```
{ "type": "text", "text": "heya call the greeting tool to greet the world" }
{ "type": "text", "text": "Hey, how are you? Yes, I'll call the greeting tool!" }
{ "type": "tool_use", "name": "hello_greeting", "input": { "name": "World" } }
{ "type": "tool_result", "text": "Hello, world!" }
{ "type": "text", "text": "Hello, world!" }
```

Now, if an LLM wants to do a tool call, it will stream out something like this:
```
{ "type": "tool_use", "name": "hello_greeting", "input": { "name": "World" } }
```

Instead of this being just simply validated by a simple data model, the host server runs several checks to make sure that the function to run this tool exists, the arguments are right, and if all checks out, returns a nicely formated json tool call, something like:

```
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "callTool",
  "params": {
    "name": "hello_greeting",
    "arguments": {
      "name": "World"
    }
  }
}
```

This host server is another layer that helps deal with the non-determinis associated with LLMs. This way we guarantee that tool calls are made in a more robust way. If, for example, there's some argument missing or the tool is not available, that message can be returned back to the LLM so that it can try again:

```
{ "type": "tool_use", "name": "hello_greeting", "input": { "greeting_name": "World" } }
```

beep beep, processing... woops looks like there's no greeting_name argument!

```
{ "type": "tool_error", "text": "greeting_name is not an argument to the hello_greeting tool. Available arguments: name" }
```

And that's why MCP was developed - to standardize a robust way to allow LLMs to interact with tools.