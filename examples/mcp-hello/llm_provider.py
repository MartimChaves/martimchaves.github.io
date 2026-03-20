"""
LLM provider abstraction. Supports Mistral, OpenAI, and Anthropic.

Set the LLM_PROVIDER env var to one of: mistral, openai, anthropic
Each provider also needs its own API key env var:
  - MISTRAL_API_KEY
  - OPENAI_API_KEY
  - ANTHROPIC_API_KEY
"""

import json
import os


PROVIDER = os.environ.get("LLM_PROVIDER", "mistral").lower()


def _get_mistral_client():
    from mistralai.client import Mistral

    return Mistral(api_key=os.environ["MISTRAL_API_KEY"])


def _get_openai_client():
    from openai import OpenAI

    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def _get_anthropic_client():
    from anthropic import Anthropic

    return Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


# Default models per provider
MODELS = {
    "mistral": "mistral-small-latest",
    "openai": "gpt-4.1-nano",
    "anthropic": "claude-sonnet-4-20250514",
}


def get_client():
    if PROVIDER == "mistral":
        return _get_mistral_client()
    elif PROVIDER == "openai":
        return _get_openai_client()
    elif PROVIDER == "anthropic":
        return _get_anthropic_client()
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {PROVIDER}")


def get_model():
    model = os.environ.get("LLM_MODEL", "")
    if not model:
        model = MODELS.get(PROVIDER, "")
    return model


def chat_complete(client, model, messages, tools):
    """
    Unified chat completion. Returns (finish_reason, message).

    The returned message is a dict with:
      - role: str
      - content: str | None
      - tool_calls: list[dict] | None
        each tool_call: {"id": str,
          "function": {"name": str, "arguments": str}}
    """
    if PROVIDER == "mistral":
        return _mistral_complete(client, model, messages, tools)
    elif PROVIDER == "openai":
        return _openai_complete(client, model, messages, tools)
    elif PROVIDER == "anthropic":
        return _anthropic_complete(client, model, messages, tools)
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {PROVIDER}")


def _mistral_complete(client, model, messages, tools):
    response = client.chat.complete(
        model=model,
        messages=_to_mistral_messages(messages),
        tools=tools,
    )
    choice = response.choices[0]
    msg = _normalize_message(choice.message)
    return choice.finish_reason, msg


def _openai_complete(client, model, messages, tools):
    response = client.chat.completions.create(
        model=model,
        messages=_to_openai_messages(messages),
        tools=tools,
    )
    choice = response.choices[0]
    msg = _normalize_message(choice.message)
    return choice.finish_reason, msg


def _anthropic_complete(client, model, messages, tools):
    # Anthropic uses a different API shape
    system_msg = ""
    chat_messages = []
    for m in messages:
        if isinstance(m, dict):
            role = m["role"]
            content = m["content"]
        else:
            role = m.get("role", "user")
            content = m.get("content", "")
        if role == "system":
            system_msg = content or ""
        elif role == "tool":
            chat_messages.append({
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": (
                            m["tool_call_id"]
                            if isinstance(m, dict)
                            else m.get("tool_call_id", "")
                        ),
                        "content": content or "",
                    }
                ],
            })
        elif role == "assistant":
            # Reconstruct assistant message with tool_use blocks if needed
            tc = m.get("tool_calls") if isinstance(m, dict) else None
            if tc:
                blocks = []
                for call in tc:
                    if isinstance(call, dict):
                        fn = call["function"]
                        call_id = call["id"]
                    else:
                        fn = call
                        call_id = call.get("id", "")
                    if isinstance(fn, dict):
                        fn_name = fn["name"]
                        fn_args = fn["arguments"]
                    else:
                        fn_name = fn.get("name", "")
                        fn_args = fn.get("arguments", "{}")
                    blocks.append({
                        "type": "tool_use",
                        "id": call_id,
                        "name": fn_name,
                        "input": json.loads(fn_args),
                    })
                chat_messages.append({
                    "role": "assistant",
                    "content": blocks,
                })
            else:
                chat_messages.append({
                    "role": "assistant",
                    "content": content or "",
                })
        else:
            chat_messages.append({"role": "user", "content": content or ""})

    # Convert tools to Anthropic format
    anthropic_tools = []
    for t in tools:
        fn = t["function"]
        anthropic_tools.append({
            "name": fn["name"],
            "description": fn["description"],
            "input_schema": fn["parameters"],
        })

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_msg,
        messages=chat_messages,
        tools=anthropic_tools,
    )

    # Normalize Anthropic response
    content_text = ""
    tool_calls = []
    for block in response.content:
        if block.type == "text":
            content_text += block.text
        elif block.type == "tool_use":
            tool_calls.append({
                "id": block.id,
                "function": {
                    "name": block.name,
                    "arguments": json.dumps(block.input),
                },
            })

    finish_reason = "tool_calls" if tool_calls else "stop"
    msg = {
        "role": "assistant",
        "content": content_text or None,
        "tool_calls": tool_calls or None,
    }
    return finish_reason, msg


def _normalize_message(msg):
    """Normalize a provider-specific message object to a plain dict."""
    if isinstance(msg, dict):
        return msg

    role = getattr(msg, "role", "assistant")
    content = getattr(msg, "content", None)
    tool_calls = None

    if hasattr(msg, "tool_calls") and msg.tool_calls:
        tool_calls = []
        for tc in msg.tool_calls:
            tool_calls.append({
                "id": tc.id,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            })

    return {
        "role": role,
        "content": content,
        "tool_calls": tool_calls,
    }


def _to_mistral_messages(messages):
    """Mistral accepts both dicts and its own message objects."""
    return messages


def _to_openai_messages(messages):
    """Ensure messages are dicts for OpenAI."""
    result = []
    for m in messages:
        if isinstance(m, dict):
            msg = dict(m)
            # OpenAI expects tool_calls in a specific format
            if msg.get("tool_calls"):
                msg["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": tc["function"],
                    }
                    for tc in msg["tool_calls"]
                ]
            # Remove None tool_calls
            if msg.get("tool_calls") is None:
                msg.pop("tool_calls", None)
            result.append(msg)
        else:
            result.append(m)
    return result
