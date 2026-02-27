import { getContext } from '@hod/aweave-workspace-memory';

interface ToolCallResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

function parseCommaSeparated(value?: string): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map((s) => s.trim());
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }

  return defaultValue;
}

export async function handleToolCall(
  projectRoot: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  switch (toolName) {
    case 'workspace_get_context':
      return handleGetContext(projectRoot, args);
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
  }
}

async function handleGetContext(
  projectRoot: string,
  params: Record<string, unknown>,
): Promise<ToolCallResult> {
  const includeDefaults = parseBoolean(params.include_defaults, true);

  const result = await getContext(projectRoot, {
    scope: {
      workspace: params.workspace as string,
      domain: params.domain as string | undefined,
      repository: params.repository as string | undefined,
    },
    topics: parseCommaSeparated(params.topics as string),
    includeDefaults,
    filters: {
      status: parseCommaSeparated(params.filter_status as string),
      tags: parseCommaSeparated(params.filter_tags as string),
      category: params.filter_category as string | undefined,
    },
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
