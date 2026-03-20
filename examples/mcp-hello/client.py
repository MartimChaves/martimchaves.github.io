import asyncio
import json

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from llm_provider import get_client, get_model, chat_complete, PROVIDER

BLUE = "\033[94m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


def section(color, label, content):
    print(f"\n{color}{BOLD}{'─' * 60}")
    print(f"  {label}")
    print(f"{'─' * 60}{RESET}")
    if content:
        print(content)


def log_raw_prompt(messages, tools):
    """Print the raw data sent to the LLM for educational purposes."""
    print(f"\n{RED}{BOLD}{'═' * 60}")
    print("  RAW PROMPT (what the LLM actually receives)")
    print(f"{'═' * 60}{RESET}")
    print(f"\n{RED}--- messages ({len(messages)}) ---{RESET}")
    for i, msg in enumerate(messages):
        if isinstance(msg, dict):
            role = msg.get("role", "?")
        else:
            role = getattr(msg, "role", "?")
        if isinstance(msg, dict):
            content = msg.get("content", "")
            tc = msg.get("tool_calls")
            if tc:
                names = [c["function"]["name"] for c in tc]
                content = f"[tool_calls: {names}]"
        else:
            content = getattr(msg, "content", "") or ""
        # Truncate long content for readability
        preview = str(content)[:200]
        if len(str(content)) > 200:
            preview += "..."
        print(f"  [{i}] {role}: {preview}")
    print(f"\n{RED}--- tools ({len(tools)}) ---{RESET}")
    for t in tools:
        fn = t["function"]
        print(f"  - {fn['name']}({', '.join(fn['parameters'].get('required', []))})")  # noqa: E501
        print(f"    {fn['description']}")
    print(f"{RED}{'═' * 60}{RESET}\n")


async def main():
    # 1. Connect to the MCP server
    server_params = StdioServerParameters(
        command="python",
        args=["server.py"],
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # 2. Discover tools
            tools_result = await session.list_tools()
            section(
                CYAN,
                "MCP CLIENT → MCP SERVER: tools/list",
                "Client requests available tools from server.",
            )

            tool_info = ""
            for tool in tools_result.tools:
                schema = json.dumps(tool.inputSchema, indent=2)
                tool_info += f"  {tool.name}: {tool.description}\n"
                tool_info += f"  Schema: {schema}\n"

            section(
                GREEN,
                "MCP SERVER → MCP CLIENT: tools/list response",
                f"Found {len(tools_result.tools)} tool(s):\n{tool_info}",
            )

            # 3. Convert MCP tools to LLM function format
            llm_tools = []
            for tool in tools_result.tools:
                llm_tools.append(
                    {
                        "type": "function",
                        "function": {
                            "name": tool.name,
                            "description": tool.description,
                            "parameters": tool.inputSchema,
                        },
                    }
                )

            # 4. Set up LLM client
            client = get_client()
            model = get_model()

            system_msg = "You are a helpful assistant."
            messages = [{"role": "system", "content": system_msg}]

            section(
                MAGENTA,
                f"SYSTEM PROMPT (included in every LLM request)"
                f" [{PROVIDER} / {model}]",
                f"  {system_msg}",
            )

            tool_names = [t["function"]["name"] for t in llm_tools]
            section(
                MAGENTA,
                "TOOLS (included in every LLM request)",
                f"  {tool_names}",
            )

            # 5. Interactive loop
            print(f"\n{BOLD}Ready! Type a message (or 'quit' to exit).{RESET}\n")  # noqa:E501

            while True:
                try:
                    user_input = input(f"{BOLD}You: {RESET}")
                except (EOFError, KeyboardInterrupt):
                    print("\nBye!")
                    break

                if user_input.strip().lower() in ("quit", "exit", "q"):
                    print("Bye!")
                    break

                if not user_input.strip():
                    continue

                messages.append({"role": "user", "content": user_input})

                section(
                    BLUE,
                    "MCP CLIENT → LLM: chat request",
                    f"  Messages: {len(messages)} "
                    f"(system + {len(messages) - 1} conversation)\n"
                    f"  Latest user message: \"{user_input}\"\n"
                    f"  Tools: {tool_names}",
                )

                log_raw_prompt(messages, llm_tools)

                finish_reason, msg = chat_complete(
                    client, model, messages, llm_tools,
                )

                # 6. Handle tool calls in a loop
                while finish_reason == "tool_calls":
                    # Append assistant message once before all tool results
                    messages.append(msg)

                    for tc in msg["tool_calls"]:
                        fn_name = tc["function"]["name"]
                        fn_args = tc["function"]["arguments"]
                        section(
                            YELLOW,
                            "LLM → MCP CLIENT: tool_use",
                            f"  Tool: {fn_name}\n"
                            f"  Arguments: {fn_args}",
                        )

                        # Send to MCP server
                        args = json.loads(fn_args)
                        section(
                            CYAN,
                            f"MCP CLIENT → MCP SERVER: tools/call"
                            f" ({fn_name})",
                            f"  Arguments: {json.dumps(args, indent=2)}",
                        )

                        result = await session.call_tool(
                            fn_name, arguments=args
                        )

                        tool_result_text = result.content[0].text
                        section(
                            GREEN,
                            "MCP SERVER → MCP CLIENT: tool result",
                            f"  Result: {tool_result_text}",
                        )

                        # Send tool result
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": tool_result_text,
                            }
                        )

                        section(
                            BLUE,
                            "MCP CLIENT → LLM: tool_result",
                            f"  tool_call_id: {tc['id']}\n"
                            f"  content: \"{tool_result_text}\"",
                        )

                    log_raw_prompt(messages, llm_tools)

                    finish_reason, msg = chat_complete(
                        client, model, messages, llm_tools,
                    )

                # 7. Final text response
                messages.append(msg)

                section(
                    GREEN,
                    "LLM → MCP CLIENT: assistant response",
                    f"  {msg['content']}",
                )

                print(
                    f"\n{BOLD}Assistant:{RESET} "
                    f"{msg['content']}\n"
                )


if __name__ == "__main__":
    asyncio.run(main())
