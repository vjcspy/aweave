import fg from 'fast-glob';
import { existsSync, readFileSync } from 'fs';
import { relative } from 'path';
import { parse as parseYaml } from 'yaml';

import { generateFolderStructure } from '../parsers/folder-structure';
import { parseFrontMatter } from '../parsers/front-matter';
import { getSkillsPath } from '../shared/paths';
import { loadScopeOverviewT1 } from './overview';
import type { DefaultsResponse, OverviewEntry, SkillEntry } from './types';

export async function getDefaults(
  resourcesDir: string,
  projectRoot: string,
): Promise<DefaultsResponse> {
  const scopeOverviewT1 = loadScopeOverviewT1(resourcesDir);
  const folderStructure = generateFolderStructure(resourcesDir, {
    maxDepth: 4,
    baseDir: projectRoot,
  });

  const overviews = await scanOverviews(resourcesDir, projectRoot);
  const loadedSkills = loadSkills(projectRoot);

  return {
    scope_overview_t1: scopeOverviewT1,
    folder_structure: folderStructure,
    overviews,
    loaded_skills: loadedSkills,
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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string');
}
