import fg from 'fast-glob';
import { existsSync, readFileSync } from 'fs';
import { relative } from 'path';
import { parse as parseYaml } from 'yaml';

import { generateFolderStructure } from '../parsers/folder-structure';
import { parseFrontMatter } from '../parsers/front-matter';
import { getSkillsPath } from '../shared/paths';
import type { DefaultsResponse, OverviewEntry, SkillEntry } from './types';

export async function getDefaults(
  resourcesDir: string,
  projectRoot: string,
): Promise<DefaultsResponse> {
  const folderStructure = generateFolderStructure(resourcesDir, {
    maxDepth: 4,
    baseDir: projectRoot,
  });

  const overviews = await scanOverviews(resourcesDir, projectRoot);
  const loadedSkills = loadSkills(projectRoot);

  return {
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
      name: frontMatter.name as string | undefined,
      description: frontMatter.description as string | undefined,
      tags: frontMatter.tags as string[] | undefined,
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
