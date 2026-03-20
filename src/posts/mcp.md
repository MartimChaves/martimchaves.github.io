---
title: "Model Context Protocol (MCP)"
date: "2026-03-20"
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

MCP introduces a proper client-server architecture with three distinct roles:

```
┌──────────────────────────────────────────────────────────────┐
│  Host application (e.g. Claude Desktop, Cursor, IDE)         │
│                                                              │
│  ┌───────────┐    tool call      ┌────────────────────────┐  │
│  │           │ ────────────────► │                        │  │
│  │    LLM    │  (predicted       │      MCP Client        │  │
│  │           │   tokens)         │  (translates to/from   │  │
│  │           │ ◄──────────────── │   MCP protocol)        │  │
│  └───────────┘  tool result      └───────────┬────────────┘  │
│                 (formatted for               │ ▲             │
│                  the LLM)                    │ │             │
└──────────────────────────────────────────────┼─┼─────────────┘
                                               │ │
                                   MCP request │ │  MCP response
                                   (JSON-RPC)  │ │  (JSON-RPC)
                                               ▼ │
                                    ┌──────────────────────┐
                                    │                      │
                                    │     MCP Server       │
                                    │   (validates &       │
                                    │    executes)         │
                                    │                      │
                                    └──────────────────────┘
```

The **LLM** is trained to support tool use - meaning it can predict tokens that represent a structured tool call rather than plain text. But the LLM doesn't speak MCP directly. It outputs something like:

```
{ "type": "tool_use", "name": "hello_greeting", "input": { "name": "World" } }
```

The **MCP client** - which lives in the host application - picks up that tool call and translates it into a proper MCP protocol message. MCP uses JSON-RPC 2.0, so the client wraps the call like this:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "hello_greeting",
    "arguments": { "name": "World" }
  }
}
```

The client is the bridge: it knows how to read the LLM's output on one side and speak MCP on the other.

The **MCP server** receives the request, validates it - does this tool exist? are the arguments correct? - and if everything checks out, executes the function and responds:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Hello, World!" }]
  }
}
```

The client then takes this response and formats it back into something the LLM understands - a `tool_result` message that gets appended to the conversation:

```
{ "type": "tool_result", "tool_use_id": "1", "content": "Hello, World!" }
```

The LLM sees the result and continues generating.

If something goes wrong - say the LLM used the wrong argument name - the server sends back an error instead:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "greeting_name is not an argument to hello_greeting. Available arguments: name"
  }
}
```

The client passes this back to the LLM, which can understand the mistake and try again.

### Tool discovery

Before any of this can happen, the LLM needs to know what tools are available. When the client first connects to an MCP server, it sends a `tools/list` request. The server responds with every tool it exposes - including names, descriptions, and input schemas:

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "tools": [
      {
        "name": "hello_greeting",
        "description": "Greets a person by name",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": { "type": "string", "description": "The name to greet" }
          },
          "required": ["name"]
        }
      }
    ]
  }
}
```

The client takes this list and includes it in the LLM's context - typically as part of the system prompt or a dedicated tools block. This is how the LLM knows what it can call and what arguments each tool expects. For our `hello_greeting` example, the system prompt might look something like:

```
You are a helpful assistant. You have access to the following tools:

- hello_greeting(name: string): Greets a person by name.

When you want to use a tool, respond with a tool_use message
containing the tool name and arguments.
```

Every message the user sends, this system prompt - including the tool definitions - is sent along with the full conversation history. The LLM is stateless; it doesn't remember previous requests, so the entire context is reused each time.

There's a trade-off here: the more tools a server exposes, the more context gets consumed, the more expensive each request becomes (and remember, these extra tokens defining the tools are included in every request - it adds up!).

An MCP server with dozens of tools means a large chunk of the LLM's context window is spent just on tool definitions, leaving less room for the actual conversation. Imagine a server exposing 30 tools - the system prompt might balloon to something like:

```
You are a helpful assistant. You have access to the following tools:

- hello_greeting(name: string): Greets a person by name.
- get_schema(database: string): Returns the schema for a database.
- run_query(sql: string): Executes a SQL query and returns results.
- list_tables(database: string): Lists all tables in a database.
- create_user(name: string, email: string): Creates a new user.
- delete_user(user_id: string): Deletes a user by ID.
- send_email(to: string, subject: string, body: string): Sends an email.
- ... (23 more tools)

When you want to use a tool, respond with a tool_use message
containing the tool name and arguments.
```

That's a lot of tokens before the user has even said anything. This can degrade the LLM's performance - it has more to keep track of and is more likely to pick the wrong tool or hallucinate arguments. In practice, keeping tool lists focused and well-described matters a lot. Some folks end up connecting to multiple MCP servers, each exposing their own dozen tools, and we can end up with a system prompt with hundreds of tool definitions. Things can get a bit crazy!

This has led some people to question whether MCP is even necessary. Modern LLMs are already very familiar with CLI tools - they've seen vast amounts of shell commands, curl calls, and git operations in their training data. The argument is: why wrap these capabilities in MCP servers when the LLM can just call the CLI tools directly? It's a simpler setup, no protocol overhead, and the LLM already knows the interface. That said, MCP still offers structured validation, discoverability, and a standard contract that raw CLI calls don't provide - whether that's worth the extra layer depends on the use case.

### Beyond tools

By the way, MCP isn't just about tool calls. Servers can also expose **resources**, like files, schemas, documentation, and **prompt templates**, i.e. pre-built prompts that help the users make better requests.

These are discovered separately from tools. When a client connects, it can call `resources/list` to see what data is available. For example, a database MCP server might expose:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resources": [
      {
        "uri": "db://production/schema",
        "name": "Production DB Schema",
        "mimeType": "application/json",
        "description": "Table definitions and relationships for the production database"
      }
    ]
  }
}
```

Unlike tools, the LLM doesn't call a resource. The client manages them. Here's how it works in practice:

1. On startup, the client calls `resources/list` and sees there's a "Production DB Schema" resource.
2. The client decides this is relevant (or the user/host application tells it to include it) and calls `resources/read` with the URI `db://production/schema`.
3. The server responds with the actual schema contents - table names, columns, types, relationships.
4. The client injects this into the LLM's context, typically as part of the system prompt or an auxiliary context block, *before* the LLM sees the user's message.

So by the time the user asks "write me a query that finds all users who signed up last week", the LLM already has the schema in its context and knows there's a `users` table with a `created_at` column. No tool call needed - the information was already there.

Think of resources as background context that the client manages, not something the LLM actively invokes. You could achieve something similar with a tool like `get_schema` that the LLM calls on demand - and many MCP servers do exactly that. The trade-off is: resources are always available in context with zero latency, but they consume context space even when they're not needed. Tools are on-demand and save context, but require a round-trip. Resources make the most sense for things you want the LLM to *always* have - like a style guide or a repo README - rather than things it only occasionally needs.

Similarly, the client can call `prompts/list` to discover prompt templates. I personally find this aspect a bit confusing, because when I think of prompt templates, I think of examples that can be given to the LLM to improve tool calls, but that's not really it. It's actually something used to improve the user prompt that's sent to the LLM down the line. The same database server might offer:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "prompts": [
      {
        "name": "query_builder",
        "description": "Generate a SQL query from a natural language question",
        "arguments": [
          { "name": "question", "description": "The question to answer", "required": true }
        ]
      }
    ]
  }
}
```
The user can use this template, like with a slash command, or maybe even with something in the UI, but the important part is that the user prompt is sent to the MCP server as the argument to the prompt template. The server then expands it into a full prompt that includes the schema context and formatting instructions. The client then passes this expanded prompt to the LLM - so the LLM gets a well-structured request every time, without the user having to craft it manually.

For example, the user types something like `/query_builder How many users signed up last week?` in the client UI. The client sends this to the server:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "prompts/get",
  "params": {
    "name": "query_builder",
    "arguments": { "question": "How many users signed up last week?" }
  }
}
```

The server expands the template and responds with a fully formed prompt:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Given the following database schema:\n- users (id, name, email, created_at)\n- orders (id, user_id, amount, created_at)\n\nWrite a SQL query to answer: \"How many users signed up last week?\"\nReturn only the SQL, no explanation."
        }
      }
    ]
  }
}
```

The client takes those messages and passes them to the LLM. The LLM has no idea a template was involved - it just sees a well-structured prompt with the schema already included, and can get straight to writing the query. So, like the bits of code that exist to actually run the tools, there's some code that exists to actually run the prompt templates, and transform simple prompts to more (hopefully) complete ones. This is more of a UX feature, but thought it was cool to include it here.

### Transport

MCP works over two transports: **stdio** for local processes (the client spawns the server as a subprocess and communicates over stdin/stdout) and **HTTP with SSE** (Server-Sent Events) for remote servers. This means MCP servers can run locally on your machine or be hosted remotely.

### Seeing it in action

Enough theory - let's see the full flow with real code. We'll build a minimal MCP server, connect a client to it, and watch every message that flows between the user, the MCP client, the LLM, and the MCP server.

The full example is in the [examples/mcp-hello](https://github.com/martimchaves/martimchaves.github.io/tree/main/examples/mcp-hello) directory. You can run it with Docker Compose using Mistral, OpenAI, or Anthropic as the LLM provider.

#### The MCP server

The server is as simple as it gets - a single tool that greets someone by name:

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("hello-server")


@mcp.tool()
def hello_greeting(name: str) -> str:
    """Greets a person by name."""
    return f"Hello, {name}!"


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

That's it. The `@mcp.tool()` decorator registers the function as an MCP tool, and `FastMCP` handles all the JSON-RPC protocol details. The server runs over stdio - the client will spawn it as a subprocess.

#### The MCP client

The client is where the interesting stuff happens. It connects to the server, discovers tools, and orchestrates the conversation with the LLM. Here's the core flow, stripped of the logging code for clarity:

**1. Connect to the MCP server and discover tools:**

```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(
    command="python",
    args=["server.py"],
)

async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()

        # Discover tools
        tools_result = await session.list_tools()
```

The client spawns `server.py` as a subprocess and communicates over stdin/stdout. After initialization, it calls `tools/list` to discover what tools the server exposes.

**2. Convert MCP tools to the LLM's format:**

```python
llm_tools = []
for tool in tools_result.tools:
    llm_tools.append({
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.inputSchema,
        },
    })
```

The MCP tool schema gets converted into the format the LLM API expects. This is the same structure whether you're using Mistral, OpenAI, or Anthropic - they all support a `tools` parameter with function definitions.

**3. Send the user's message to the LLM (with tools):**

```python
response = client.chat.complete(
    model=model,
    messages=messages,    # system prompt + conversation history
    tools=llm_tools,      # tool definitions from MCP server
)
```

Both the conversation messages and the tool definitions are sent with every request. The tools go as a separate API parameter (not inside the system prompt) because modern LLMs are trained with specific chat templates that expect tool definitions in a dedicated position.

**4. Handle tool calls:**

When the LLM decides to use a tool, it returns a tool call instead of a text response. The client forwards this to the MCP server:

```python
while finish_reason == "tool_calls":
    messages.append(msg)

    for tc in msg["tool_calls"]:
        args = json.loads(tc["function"]["arguments"])

        # Forward to MCP server
        result = await session.call_tool(
            tc["function"]["name"], arguments=args
        )

        # Send result back to LLM
        messages.append({
            "role": "tool",
            "tool_call_id": tc["id"],
            "content": result.content[0].text,
        })

    # Ask LLM to continue with the tool results
    finish_reason, msg = chat_complete(
        client, model, messages, llm_tools,
    )
```

This loop keeps going until the LLM is satisfied and produces a text response instead of another tool call. Notice how the assistant message (with tool calls) is appended once, followed by all the tool results - this ordering is important, especially for OpenAI's API which enforces it strictly.

#### Running it

```bash
cp .env.example .env
# Set LLM_PROVIDER (mistral, openai, or anthropic) and the API key
docker compose build
docker compose run mcp-hello
```

The example prints every message flowing through the system with color-coded labels. Here's what a session looks like:

#### Startup: tool discovery

When the client starts, it connects to the MCP server and discovers available tools:

![MCP startup: tool discovery and system prompt](/images/mcp/mcp-startup.png)

The client sends `tools/list` to the server, gets back the `hello_greeting` tool with its schema, and displays the system prompt and tools that will be included in every LLM request.

#### First message: single tool call

When the user says "hello i'm jony", the client sends the message to the LLM along with the tool definitions. The LLM decides to call `hello_greeting`:

![First message: single tool call (part 1)](/images/mcp/mcp-single-tool-call-1.png)
![First message: single tool call (part 2)](/images/mcp/mcp-single-tool-call-2.png)

Notice the **RAW PROMPT** section - it shows exactly what goes to the LLM: 2 messages (the system prompt and the user message) plus 1 tool definition. After the tool call, the raw prompt grows to 4 messages (system + user + assistant tool call + tool result) before the LLM produces its final response.

#### Second message: parallel tool calls

When the user says "i'm here with my friends rony and eliza", the LLM makes two tool calls in one go:

![Second message: parallel tool calls (part 1)](/images/mcp/mcp-parallel-tool-calls-1.png)
![Second message: parallel tool calls (part 2)](/images/mcp/mcp-parallel-tool-calls-2.png)
![Second message: parallel tool calls (part 3)](/images/mcp/mcp-parallel-tool-calls-3.png)

The LLM returns both `hello_greeting("Rony")` and `hello_greeting("Eliza")` in a single response. The client forwards each to the MCP server, collects both results, and sends them all back to the LLM. The raw prompt now has 9 messages - you can see the full conversation history accumulating, because remember: the LLM is stateless and needs the entire context every time.

This is the power of the protocol in action: the client handles all the orchestration, the server handles validation and execution, and the LLM just predicts tokens. Each component has a clear role, and MCP provides the standard glue between them.

### Why this matters

The MCP server adds a validation layer between the LLM's non-deterministic output and your actual functions. Instead of hoping the LLM gets it right every time, you now have structured error handling and a defined contract. It also means tool definitions are portable - any MCP-compatible client can connect to any MCP server without custom integration work.

In short: MCP turns "hope the LLM produces valid JSON" into a proper, robust protocol.
