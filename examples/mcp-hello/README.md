# MCP Hello Example

A minimal example of the Model Context Protocol (MCP) in action. An MCP server exposes a `hello_greeting` tool, and a client connects to it, discovers the tool, and uses it via an LLM.

## Setup

1. Copy the example env file and configure your provider:

```bash
cp .env.example .env
# Edit .env: set LLM_PROVIDER (mistral, openai, or anthropic)
# and add the matching API key
```

2. Build and run:

```bash
docker compose build
docker compose run mcp-hello
```

## What happens

On startup, the client:

1. Spawns the **MCP server** as a subprocess (stdio transport).
2. Calls `tools/list` and discovers the `hello_greeting` tool.
3. Shows the system prompt and tool definitions that will be included in every LLM request.
4. Drops you into an interactive prompt.

For each message you type:

1. The client sends your message + conversation history + tools to the **LLM** (Mistral, OpenAI, or Anthropic - your choice).
2. If the LLM decides to call a tool, the client forwards it to the **MCP server**.
3. The server executes the function and returns the result to the client.
4. The client sends the result back to the LLM.
5. The LLM produces a final response.

Every message flowing between the LLM, MCP client, and MCP server is printed with color-coded labels so you can follow the full flow.

## Files

- `server.py` - MCP server with the `hello_greeting` tool
- `client.py` - Interactive MCP client that logs all messages between LLM, client, and server
- `docker-compose.yml` - Docker Compose configuration
- `Dockerfile` - Container setup
