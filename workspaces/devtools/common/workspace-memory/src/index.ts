export { getContext } from './get-context/get-context';
export type {
  ArchitectureEntry,
  DefaultsResponse,
  EntryMeta,
  FeatureEntry,
  GetContextParams,
  GetContextResponse,
  OverviewT0,
  Scope,
  SkillEntry,
  Topic,
} from './get-context/types';

export { saveMemory } from './save-memory/save-memory';
export type {
  MemoryType,
  SaveMemoryParams,
  SaveMemoryResult,
} from './save-memory/types';

export {
  bootstrapIndex,
  getOrBootstrapIndex,
  readIndex,
  updateIndex,
} from './metadata/index-manager';
export type {
  CategoryEntry,
  IndexSchema,
  TagEntry,
} from './metadata/types';

export { parseFrontMatter } from './parsers/front-matter';
export type { ParsedFrontMatter } from './parsers/front-matter';

export { generateFolderStructure } from './parsers/folder-structure';

export { resolveScope, validateResourcesDir } from './shared/scope';
export type { ResolvedScope } from './shared/scope';
