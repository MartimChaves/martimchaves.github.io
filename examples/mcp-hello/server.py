from mcp.server.fastmcp import FastMCP

mcp = FastMCP("hello-server")


@mcp.tool()
def hello_greeting(name: str) -> str:
    """Greets a person by name."""
    return f"Hello, {name}!"


if __name__ == "__main__":
    mcp.run(transport="stdio")
