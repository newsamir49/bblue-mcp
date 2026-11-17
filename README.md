# bblue MCP Server

Generate AI images on [bblue.net](https://bblue.net) directly from Claude.

## Tools

- **generate_image** — Generate images with 5 AI models. Supports text-to-image and image editing (paste reference images in Claude).
- **get_credits** — Check your credit balance.
- **list_generations** — Browse your generation history.

## Setup

### 1. Get your API key

Log in to [bblue.net](https://bblue.net), go to Settings, and create an API key.

### 2. Install

```bash
git clone https://github.com/newsamir49/bblue-mcp.git
cd bblue-mcp
npm install
```

### 3. Configure Claude

Add this to your Claude Desktop config file:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bblue": {
      "command": "node",
      "args": ["/full/path/to/bblue-mcp/server.mjs"],
      "env": {
        "BBLUE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

For **Claude Code**, create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "bblue": {
      "command": "node",
      "args": ["/full/path/to/bblue-mcp/server.mjs"],
      "env": {
        "BBLUE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 4. Restart Claude

Close and reopen Claude Desktop (or Claude Code). The bblue tools will appear automatically.

## Usage

Just ask Claude:

- "Generate 4 images of a sunset on the beach"
- "How many credits do I have?"
- "Show me my recent generations"

You can also paste images into Claude and ask it to edit them:

- Paste a photo and say "Make this look like a watercolor painting"
- Paste two images and say "Combine the person from the first image with the background from the second"

## Models

| Model | Credits/frame | Best for |
|-------|--------------|----------|
| seedream-5 | 2 | Latest, general purpose |
| wan-2-7 | 2 | Fast generation |
| seedream-4-5 | 3 | Photorealistic |
| wan-2-7-pro | 4 | 4K text-to-image |
| nano-banana-pro | 5 | Sharp edits, highest quality |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BBLUE_API_KEY` | Yes | Your API key from bblue.net |
| `BBLUE_URL` | No | API base URL (default: `https://bblue.net`) |
