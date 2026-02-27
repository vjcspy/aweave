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
          anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
          description:
            'Topic names as comma-separated string or string[] (e.g. "plans,decisions,lessons" or ["plans","decisions","lessons"]). Topics map to _{topicName}/ folders in resources/, except "features" and "overview" which have special handling.',
        },
        include_defaults: {
          type: 'boolean',
          description:
            'Include defaults (scope_overview_t1, folder_structure, overviews, loaded_skills)',
          default: true,
        },
        filter_status: {
          anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
          description: 'Status filter as comma-separated string or string[]',
        },
        filter_tags: {
          anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' } },
          ],
          description: 'Tag filter as comma-separated string or string[]',
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
