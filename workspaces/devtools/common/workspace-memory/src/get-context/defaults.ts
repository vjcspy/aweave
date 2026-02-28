import fg from 'fast-glob';
import { existsSync, readFileSync } from 'fs';
import { basename, relative } from 'path';
import { parse as parseYaml } from 'yaml';

import { generateFolderStructure } from '../parsers/folder-structure';
import { parseFrontMatter } from '../parsers/front-matter';
import { getSkillsPath } from '../shared/paths';
import { loadScopeOverviewT1 } from './overview';
import type {
  DefaultsResponse,
  LearningT0Entry,
  OverviewEntry,
  SkillEntry,
} from './types';

interface GetDefaultsOptions {
  ladderDirs?: string[];
}

export async function getDefaults(
  resourcesDir: string,
  projectRoot: string,
  options: GetDefaultsOptions = {},
): Promise<DefaultsResponse> {
  const { ladderDirs = [resourcesDir] } = options;
  const scopeOverviewT1 = loadScopeOverviewT1(resourcesDir);
  const folderStructure = generateFolderStructure(resourcesDir, {
    maxDepth: 4,
    baseDir: projectRoot,
  });

  const overviews = await scanOverviews(resourcesDir, projectRoot);
  const loadedSkills = loadSkills(projectRoot);
  const decisionsT0 = await scanLearningDefaults(
    ladderDirs,
    'decisions',
    projectRoot,
  );
  const lessonsT0 = await scanLearningDefaults(
    ladderDirs,
    'lessons',
    projectRoot,
  );

  return {
    scope_overview_t1: scopeOverviewT1,
    folder_structure: folderStructure,
    overviews,
    loaded_skills: loadedSkills,
    decisions_t0: decisionsT0,
    lessons_t0: lessonsT0,
  };
}

async function scanOverviews(
  resourcesDir: string,
  projectRoot: string,
): Promise<OverviewEntry[]> {
  const pattern = `${resourcesDir}/**/OVERVIEW.md`;
  const files = await fg(pattern, { absolute: true });
  const entries: OverviewEntry[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const { frontMatter } = parseFrontMatter(content);
    const relPath = relative(projectRoot, file);
    const scopePath = relative(
      projectRoot + '/resources/workspaces',
      file.replace(/\/OVERVIEW\.md$/, ''),
    );

    entries.push({
      scope: scopePath,
      name: asString(frontMatter.name),
      description: asString(frontMatter.description),
      tags: asStringArray(frontMatter.tags),
      folder_structure: asString(frontMatter.folder_structure),
      status_values: asStringArray(frontMatter.status_values),
      category_values: asStringArray(frontMatter.category_values),
      tag_values: asStringArray(frontMatter.tag_values),
      _meta: {
        document_path: relPath,
      },
    });
  }

  return entries.sort((a, b) => a.scope.localeCompare(b.scope));
}

function loadSkills(projectRoot: string): SkillEntry[] {
  const skillsPath = getSkillsPath(projectRoot);
  if (!existsSync(skillsPath)) return [];

  try {
    const content = readFileSync(skillsPath, 'utf-8');
    const parsed = parseYaml(content) as {
      skills?: Array<{
        name: string;
        description: string;
        skill_path: string;
      }>;
    };
    if (!parsed?.skills) return [];

    return parsed.skills.map((s) => ({
      name: s.name,
      description: s.description,
      skill_path: relative(projectRoot, s.skill_path),
    }));
  } catch {
    return [];
  }
}

async function scanLearningDefaults(
  ladderDirs: string[],
  topicName: 'decisions' | 'lessons',
  projectRoot: string,
): Promise<LearningT0Entry[]> {
  const entriesByPath = new Map<string, LearningT0Entry>();

  for (const levelDir of ladderDirs) {
    const pattern = `${levelDir}/_${topicName}/**/*.md`;
    const files = await fg(pattern, {
      absolute: true,
      ignore: ['**/OVERVIEW.md'],
    });

    for (const file of files) {
      const relPath = relative(projectRoot, file);
      if (entriesByPath.has(relPath)) continue;

      const content = readFileSync(file, 'utf-8');
      const { frontMatter } = parseFrontMatter(content);
      const name = asString(frontMatter.name) ?? basename(file, '.md');

      entriesByPath.set(relPath, {
        name,
        description: asString(frontMatter.description) ?? '',
        tags: asStringArray(frontMatter.tags),
        category: asString(frontMatter.category),
        created: asString(frontMatter.created),
        status: asString(frontMatter.status),
        path: relPath,
        _meta: {
          document_path: relPath,
        },
      });
    }
  }

  return [...entriesByPath.values()].sort(compareLearningByDateThenName);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}

function compareLearningByDateThenName(
  a: LearningT0Entry,
  b: LearningT0Entry,
): number {
  if (a.created && b.created) {
    const dateOrder = b.created.localeCompare(a.created);
    if (dateOrder !== 0) return dateOrder;
  } else if (a.created) {
    return -1;
  } else if (b.created) {
    return 1;
  }

  return a.name.localeCompare(b.name);
}
