# Dedalus MCP Test Suite

End-to-end test suite for validating Dedalus MCP servers are working correctly.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your DEDALUS_API_KEY
   ```

3. Run tests:
   ```bash
   npm test
   ```

## Configuration

### Adding/Editing Servers

Edit `servers.json` to configure which MCP servers to test:

```json
{
  "servers": [
    {
      "id": "my-server",
      "name": "My MCP Server",
      "mcpServer": "username/server-name",
      "enabled": true,
      "tests": [
        {
          "name": "Test name",
          "description": "What this test validates",
          "input": "The prompt to send to the agent",
          "expectedToolPattern": "regex pattern for tool names",
          "timeout": 30000
        }
      ]
    }
  ],
  "config": {
    "model": "openai/gpt-4o-mini",
    "maxSteps": 5,
    "defaultTimeout": 60000,
    "verbose": false
  }
}
```

### Test Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `name` | string | Name of the test (required) |
| `description` | string | Description of what the test validates |
| `input` | string | The prompt to send to the agent (required) |
| `expectedToolPattern` | string | Regex pattern to match expected tool names |
| `expectedOutputPattern` | string | Regex pattern to match expected output |
| `timeout` | number | Timeout in milliseconds for this test |

### Global Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `openai/gpt-4o-mini` | Model to use for tests |
| `maxSteps` | number | `5` | Maximum agent steps |
| `defaultTimeout` | number | `60000` | Default timeout in ms |
| `verbose` | boolean | `false` | Enable verbose output |

## CLI Options

```bash
npm test                           # Run all tests
npm test -- -v                     # Run with verbose output
npm test -- -s marketplace-crawler # Run tests for specific server
npm test -- -h                     # Show help
```

## Test Results

The test suite outputs results in the console with:
- Per-server test results with pass/fail status
- Tools called during each test
- Duration for each test
- Overall summary with totals

Exit code is `0` if all tests pass, `1` if any fail.

## Currently Configured Servers

- `meanerbeaver/dedalus-marketplace-crawler-ts` - TypeScript marketplace crawler
- `meanerbeaver/dedalus-marketplace-crawler` - Python marketplace crawler

## Development

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run test:watch
```

## Resources

- [Dedalus Documentation](https://docs.dedaluslabs.ai/)
- [Dedalus SDK - MCP Servers](https://docs.dedaluslabs.ai/sdk/mcp)
- [MCP Server Guidelines](https://docs.dedaluslabs.ai/sdk/guides/server-guidelines)
