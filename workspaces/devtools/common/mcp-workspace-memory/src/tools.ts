export const WORKSPACE_TOOLS = [
  {
    name: 'workspace_get_context',
    description:
      'Get workspace context. Defaults include scope_overview_t1, folder_structure, overviews, and loaded_skills. Requested topics return { overview_t1, entries }, with overview_t1 resolved from the nearest scope topic OVERVIEW.md and fallback up the scope tree.',
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
            'Comma-separated topic names (e.g. "plans,decisions,lessons"). Topics map to _{topicName}/ folders in resources/, except "features" and "overview" which have special handling.',
        },
        include_defaults: {
          type: 'boolean',
          description:
            'Include defaults (scope_overview_t1, folder_structure, overviews, loaded_skills)',
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
