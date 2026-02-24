import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';
import * as os from 'os';
import * as path from 'path';

export interface SkillItem {
  id: string; // The folder name or relative path
  name: string;
  description: string;
  path: string;
  source: 'project' | 'global';
  active?: boolean;
}

export interface PersistedSkillState {
  name: string;
  description: string;
  skill_path: string;
}

interface PersistedSkillsDocument {
  skills?: PersistedSkillState[];
}

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);
  private get loadedSkillsYamlPath(): string | null {
    const projectRoot = this.findProjectRoot();
    if (!projectRoot) {
      return null;
    }

    return path.join(projectRoot, '.aweave', 'loaded-skills.yaml');
  }

  private findProjectRoot(): string | null {
    let dir = __dirname;
    for (let i = 0; i < 15; i++) {
      if (fs.existsSync(path.join(dir, 'agent', 'skills'))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  }

  async getAllSkills(): Promise<SkillItem[]> {
    const projectRoot = this.findProjectRoot();
    const skills: SkillItem[] = [];
    let projectSkillsCount = 0;

    // Scan agent/skills in project root
    if (projectRoot) {
      const projectSkillsDir = path.join(projectRoot, 'agent', 'skills');
      const projectSkills = this.scanSkillsDirectory(
        projectSkillsDir,
        projectRoot,
        'project',
      );
      projectSkillsCount = projectSkills.length;
      skills.push(...projectSkills);
    } else {
      this.logger.warn(
        'Project root with agent/skills not found — skipping project skills scan',
      );
    }

    // Scan ~/.aweave/skills
    const globalSkillsDir = path.join(os.homedir(), '.aweave', 'skills');
    if (fs.existsSync(globalSkillsDir)) {
      skills.push(
        ...this.scanSkillsDirectory(globalSkillsDir, globalSkillsDir, 'global'),
      );
    }

    skills.sort((a, b) => a.path.localeCompare(b.path));
    const persistedSkillPaths = new Set(
      this.readSkillsYaml().map((skill) => skill.skill_path),
    );

    this.logger.log(
      {
        totalSkills: skills.length,
        projectSkills: projectSkillsCount,
      },
      'Skills scan completed',
    );

    return skills.map((skill) => ({
      ...skill,
      active: persistedSkillPaths.has(skill.path),
    }));
  }

  async getActiveSkillIds(): Promise<string[]> {
    const allSkills = await this.getAllSkills();
    return allSkills.filter((skill) => skill.active).map((skill) => skill.id);
  }

  async setSkillActive(skillId: string, active: boolean): Promise<void> {
    const snapshot = await this.getAllSkills();
    const targetSkill = snapshot.find((skill) => skill.id === skillId);
    if (!targetSkill) {
      throw new Error(`Skill with ID ${skillId} not found`);
    }

    targetSkill.active = active;

    const activeSkills = snapshot
      .filter((skill) => skill.active)
      .map<PersistedSkillState>((skill) => ({
        name: skill.name,
        description: skill.description,
        skill_path: skill.path,
      }));

    this.writeSkillsYaml(activeSkills);
    this.logger.log(
      { skillId, active, totalActive: activeSkills.length },
      'Skill active state updated',
    );
  }

  private scanSkillsDirectory(
    baseDir: string,
    rootDirForId: string,
    source: 'project' | 'global',
  ): SkillItem[] {
    const results: SkillItem[] = [];
    if (!fs.existsSync(baseDir)) {
      return results;
    }

    const scanRecursively = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(currentDir, entry.name);
          const skillMdPath = path.join(dirPath, 'SKILL.md');
          if (fs.existsSync(skillMdPath)) {
            const skill = this.parseSkillFrontmatter(
              skillMdPath,
              dirPath,
              rootDirForId,
              source,
            );
            if (skill) {
              results.push(skill);
            }
          }
          // Continue scanning recursively
          scanRecursively(dirPath);
        }
      }
    };
    scanRecursively(baseDir);
    return results;
  }

  private parseSkillFrontmatter(
    skillMdPath: string,
    dirPath: string,
    rootDirForId: string,
    source: 'project' | 'global',
  ): SkillItem | null {
    try {
      const content = fs.readFileSync(skillMdPath, 'utf8');
      const parsed = matter(content);
      if (!parsed.data.name || !parsed.data.description) {
        this.logger.warn(
          { skillMdPath },
          'SKILL.md missing name or description in frontmatter',
        );
        return null; // Must adhere to https://agentskills.io/what-are-skills
      }
      return {
        id: path.relative(rootDirForId, dirPath) || path.basename(dirPath),
        name: parsed.data.name,
        description: parsed.data.description,
        path: skillMdPath,
        source,
      };
    } catch (e) {
      this.logger.error(
        { skillMdPath, error: String(e) },
        'Error parsing skill frontmatter',
      );
      return null;
    }
  }

  private readSkillsYaml(): PersistedSkillState[] {
    const yamlPath = this.loadedSkillsYamlPath;
    if (!yamlPath || !fs.existsSync(yamlPath)) {
      return [];
    }

    try {
      const fileData = fs.readFileSync(yamlPath, 'utf8');
      const parsed = yaml.load(fileData);
      if (!parsed || typeof parsed !== 'object') {
        return [];
      }

      const { skills } = parsed as PersistedSkillsDocument;
      if (!Array.isArray(skills)) {
        return [];
      }

      return skills.filter((skill): skill is PersistedSkillState => {
        const isValid =
          typeof skill?.name === 'string' &&
          typeof skill?.description === 'string' &&
          typeof skill?.skill_path === 'string';

        if (!isValid) {
          this.logger.warn({ skill }, 'Skipping invalid skill entry in YAML');
        }

        return isValid;
      });
    } catch (e) {
      this.logger.error(
        { path: yamlPath, error: String(e) },
        'Failed to read loaded-skills.yaml',
      );
      return [];
    }
  }

  private writeSkillsYaml(skills: PersistedSkillState[]): void {
    const yamlPath = this.loadedSkillsYamlPath;
    if (!yamlPath) {
      throw new Error(
        'Project root not found — cannot write loaded-skills.yaml',
      );
    }

    const yamlBody = yaml.dump(
      { skills },
      {
        noRefs: true,
        lineWidth: 100,
        sortKeys: false,
      },
    );
    const content =
      '# Auto-generated by DevTools Dashboard. Do not edit directly.\n' +
      '# This file only contains ACTUALLY LOADED skills.\n' +
      yamlBody;

    fs.mkdirSync(path.dirname(yamlPath), { recursive: true });
    fs.writeFileSync(yamlPath, content, 'utf8');
    this.logger.log(
      { path: yamlPath, activeCount: skills.length },
      'Updated loaded-skills.yaml',
    );
  }
}
