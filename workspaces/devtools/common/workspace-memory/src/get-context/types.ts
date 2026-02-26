export interface Scope {
  workspace: string;
  domain?: string;
  repository?: string;
}

export type Topic =
  | 'plans'
  | 'features'
  | 'architecture'
  | 'overview'
  | 'decisions'
  | 'lessons';

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

export interface PlanEntry {
  name: string;
  description?: string;
  status?: string;
  created?: string;
  tags?: string[];
  _meta: EntryMeta;
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

export interface ArchitectureEntry {
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
  memory_metadata: Record<string, unknown> | null;
  loaded_skills: SkillEntry[];
}

export interface GetContextResponse {
  defaults?: DefaultsResponse;
  plans?: PlanEntry[];
  features?: FeatureEntry[];
  architecture?: ArchitectureEntry[];
  overview?: string;
  decisions?: string;
  lessons?: string;
}
