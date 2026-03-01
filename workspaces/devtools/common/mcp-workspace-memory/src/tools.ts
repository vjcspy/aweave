import { z } from 'zod/v3';

export const TOOL_NAME = 'workspace_get_context';

export const TOOL_DESCRIPTION =
  'Retrieve workspace context for workspace-scoped tasks. ' +
  'Defaults return scope_overview_t1, folder_structure (directories only), overviews, loaded_skills, decisions_t0, and lessons_t0; ' +
  'decisions_t0/lessons_t0 aggregate by scope ladder (workspace -> domain -> repository). ' +
  'Requested topics return { overview_t1, entries }, where overview_t1 is resolved from the nearest scope topic OVERVIEW.md (fallback up the scope tree). ' +
  'topics=decisions or topics=lessons return full body_t1 per entry; other topics remain lightweight.\n\n' +
  'Required: workspace. Optional: domain, repository, topics — only pass these when detected from concrete user context. ' +
  'Calling without topics returns the default structural orientation (no topic data).';

const stringOrArray = z.union([z.string(), z.array(z.string())]).optional();

export const workspaceGetContextInputSchema = z.object({
  workspace: z.string().describe('Workspace name (e.g. "devtools")'),
  domain: z.string().optional().describe('Domain within workspace'),
  repository: z.string().optional().describe('Repository within domain'),
  topics: stringOrArray.describe(
    'Topic names as comma-separated string or string[] (e.g. "plans,decisions,lessons" or ["plans","decisions","lessons"]). ' +
      'Topics map to _{topicName}/ folders in resources/, except "features" and "overview" which have special handling.',
  ),
  include_defaults: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Include defaults (scope_overview_t1, folder_structure, overviews, loaded_skills, decisions_t0, lessons_t0)',
    ),
  filter_status: stringOrArray.describe(
    'Status filter as comma-separated string or string[]',
  ),
  filter_tags: stringOrArray.describe(
    'Tag filter as comma-separated string or string[]',
  ),
  filter_category: z.string().optional().describe('Category filter'),
});

export type WorkspaceGetContextInput = z.infer<
  typeof workspaceGetContextInputSchema
>;
