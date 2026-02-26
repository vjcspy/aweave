export const WORKSPACE_TOOLS = [
  {
    name: 'workspace_get_context',
    description:
      'Get workspace context: folder structure, overviews, plans, features, architecture, decisions, lessons, and loaded skills. Topics are auto-discovered from _{topicName}/ folders in resources/.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        workspace: {
          type: 'string',
          description: 'Workspace name (e.g. "devtools")',
        },
        domain: { type: 'string', description: 'Domain within workspace' },
        repository: {
          type: 'string',
          description: 'Repository within domain',
        },
        topics: {
          type: 'string',
          description:
            'Comma-separated topic names (e.g. "plans,decisions,lessons"). Topics map to _{topicName}/ folders in resources/, except "features" which has special handling.',
        },
        include_defaults: {
          type: 'boolean',
          description: 'Include defaults (folder structure, overviews, skills)',
          default: true,
        },
        filter_status: {
          type: 'string',
          description: 'Comma-separated status filter',
        },
        filter_tags: {
          type: 'string',
          description: 'Comma-separated tag filter',
        },
        filter_category: {
          type: 'string',
          description: 'Category filter',
        },
      },
      required: ['workspace'],
    },
  },
];
