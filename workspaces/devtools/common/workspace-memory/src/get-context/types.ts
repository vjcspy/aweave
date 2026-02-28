export interface Scope {
  workspace: string;
  domain?: string;
  repository?: string;
}

export type Topic = string;

export interface GetContextParams {
  scope: Scope;
  topics?: Topic[];
  includeDefaults?: boolean;
  filters?: {
    status?: string[];
    tags?: string[];
    category?: string;
  };
}

export interface EntryMeta {
  document_path: string;
}

export interface OverviewEntry {
  scope: string;
  name?: string;
  description?: string;
  tags?: string[];
  folder_structure?: string;
  status_values?: string[];
  category_values?: string[];
  tag_values?: string[];
  _meta: Pick<EntryMeta, 'document_path'>;
}

export interface FeatureEntry {
  name: string;
  path: string;
  _meta: EntryMeta;
}

export interface SkillEntry {
  name: string;
  description: string;
  skill_path: string;
}

export interface LearningT0Entry {
  name: string;
  description: string;
  tags?: string[];
  category?: string;
  created?: string;
  status?: string;
  path: string;
  _meta: Pick<EntryMeta, 'document_path'>;
}

export interface LearningTopicEntry extends LearningT0Entry {
  body_t1: string;
  [key: string]: unknown;
}

export interface DefaultsResponse {
  scope_overview_t1: string | null;
  folder_structure: string;
  overviews: OverviewEntry[];
  loaded_skills: SkillEntry[];
  decisions_t0: LearningT0Entry[];
  lessons_t0: LearningT0Entry[];
}

export interface TopicEntriesResponse<TEntry = unknown> {
  overview_t1: string | null;
  entries: TEntry[];
}

export interface TopicContext {
  resourcesDir: string;
  projectRoot: string;
  filters?: {
    status?: string[];
    tags?: string[];
    category?: string;
  };
}

export interface GetContextResponse {
  defaults?: DefaultsResponse;
  overview?: TopicEntriesResponse;
  [topic: string]: unknown;
}
