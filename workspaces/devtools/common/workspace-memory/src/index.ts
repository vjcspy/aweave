export { getContext } from './get-context/get-context';
export type { ResourceEntry } from './get-context/topics/resource';
export type {
  DefaultsResponse,
  EntryMeta,
  FeatureEntry,
  GetContextParams,
  GetContextResponse,
  LearningT0Entry,
  LearningTopicEntry,
  OverviewEntry,
  Scope,
  SkillEntry,
  Topic,
  TopicContext,
  TopicEntriesResponse,
} from './get-context/types';
export { generateFolderStructure } from './parsers/folder-structure';
export type { ParsedFrontMatter } from './parsers/front-matter';
export { parseFrontMatter } from './parsers/front-matter';
export type { ResolvedScope } from './shared/scope';
export { resolveScope, validateResourcesDir } from './shared/scope';
