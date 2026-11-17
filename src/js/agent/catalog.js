// Everything the connector tells Claude: its instructions, the tools (in MCP's shape, with hints about
// which only look) and the ready-made prompts. mcp/catalog.json is a copy of this, for when Current is
// not open; tests/connector.js checks that the copy is up to date.
import { toolList, isReadOnly } from './tools.js';
import { GUIDE, PROMPTS } from './guide.js';

export const CATALOG_VERSION = 1;
const titleOf = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');

export function catalog() {
  return {
    version: CATALOG_VERSION,
    instructions: GUIDE,
    tools: toolList().map((t) => ({
      name: t.name,
      title: titleOf(t.name),
      description: t.description,
      inputSchema: t.input_schema,
      annotations: { title: titleOf(t.name), readOnlyHint: isReadOnly(t.name), destructiveHint: t.name === 'delete', openWorldHint: false },
    })),
    prompts: PROMPTS,
  };
}
