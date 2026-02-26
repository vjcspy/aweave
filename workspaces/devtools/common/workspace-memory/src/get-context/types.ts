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
  document_id: string;
}

export interface OverviewT0 {
  scope: string;
  name?: string;
  description?: string;
  tags?: string[];
  _meta: EntryMeta;
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

export interface DefaultsResponse {
  folder_structure: string;
  overviews_t0: OverviewT0[];
  loaded_skills: SkillEntry[];
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
  [topic: string]: unknown;
}
