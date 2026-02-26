import fg from 'fast-glob';
import { existsSync, readFileSync } from 'fs';
import { relative } from 'path';
import { parse as parseYaml } from 'yaml';

import { getOrBootstrapIndex } from '../metadata/index-manager';
import { generateFolderStructure } from '../parsers/folder-structure';
import { parseFrontMatter } from '../parsers/front-matter';
import { getSkillsPath } from '../shared/paths';
import type { DefaultsResponse, OverviewT0, SkillEntry } from './types';

export async function getDefaults(
  resourcesDir: string,
  projectRoot: string,
  workspace: string,
): Promise<DefaultsResponse> {
  const folderStructure = generateFolderStructure(resourcesDir, {
    maxDepth: 4,
    baseDir: projectRoot,
  });

  const overviewsT0 = await scanOverviewT0(resourcesDir, projectRoot);

  const { index } = getOrBootstrapIndex(projectRoot, workspace);
  const memoryMetadata: Record<string, unknown> | null = index
    ? {
        workspace: index.workspace,
        last_updated: index.last_updated,
        tags: index.tags,
        categories: index.categories,
      }
    : null;

  const loadedSkills = loadSkills(projectRoot);

  return {
    folder_structure: folderStructure,
    overviews_t0: overviewsT0,
    memory_metadata: memoryMetadata,
    loaded_skills: loadedSkills,
  };
}

async function scanOverviewT0(
  resourcesDir: string,
  projectRoot: string,
): Promise<OverviewT0[]> {
  const pattern = `${resourcesDir}/**/OVERVIEW.md`;
  const files = await fg(pattern, { absolute: true });
  const entries: OverviewT0[] = [];

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
      name: frontMatter.name as string | undefined,
      description: frontMatter.description as string | undefined,
      tags: frontMatter.tags as string[] | undefined,
      _meta: {
        document_path: relPath,
        document_id: scopePath,
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
