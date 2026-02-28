export const WORKSPACE_TOOLS = [
  {
    name: 'workspace_get_context',
    description:
      'MUST use this tool as the first retrieval step for workspace-scoped tasks. MUST detect workspace/domain/repository/topics from concrete evidence. NEVER guess missing scope or topic values. If scope or schema is ambiguous/invalid, STOP and ask the user to correct it. Defaults return scope_overview_t1, folder_structure (directories only), overviews, loaded_skills, decisions_t0, and lessons_t0; decisions_t0/lessons_t0 aggregate by scope ladder (workspace -> domain -> repository). Requested topics return { overview_t1, entries }, where overview_t1 is resolved from the nearest scope topic OVERVIEW.md (fallback up the scope tree). topics=decisions or topics=lessons return full body_t1 per entry; other topics remain lightweight.',
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
            'Include defaults (scope_overview_t1, folder_structure, overviews, loaded_skills, decisions_t0, lessons_t0)',
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
