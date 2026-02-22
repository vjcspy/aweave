import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import matter from 'gray-matter';
import * as os from 'os';
import * as path from 'path';

export interface SkillItem {
  id: string; // The folder name or relative path
  name: string;
  description: string;
  path: string;
}

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);
  private readonly activeSkillsPath = path.join(
    os.homedir(),
    '.aweave',
    'active-skills.json',
  );
  private get loadedSkillsMdPath(): string {
    return path.resolve(os.homedir(), '.aweave/loaded-skills.md');
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

    // Scan agent/skills in project root
    if (projectRoot) {
      const projectSkillsDir = path.join(projectRoot, 'agent', 'skills');
      skills.push(...this.scanSkillsDirectory(projectSkillsDir, projectRoot));
    } else {
      this.logger.warn('Project root with agent/skills not found — skipping project skills scan');
    }

    // Scan ~/.aweave/skills
    const globalSkillsDir = path.join(os.homedir(), '.aweave', 'skills');
    if (fs.existsSync(globalSkillsDir)) {
      skills.push(
        ...this.scanSkillsDirectory(globalSkillsDir, globalSkillsDir),
      );
    }

    this.logger.log(
      { totalSkills: skills.length, projectSkills: projectRoot ? skills.length : 0 },
      'Skills scan completed',
    );

    return skills;
  }

  getActiveSkillIds(): string[] {
    if (!fs.existsSync(this.activeSkillsPath)) {
      return [];
    }
    try {
      const fileData = fs.readFileSync(this.activeSkillsPath, 'utf8');
      const data = JSON.parse(fileData);
      return Array.isArray(data.active) ? data.active : [];
    } catch (e) {
      this.logger.error({ path: this.activeSkillsPath, error: String(e) }, 'Failed to read active skills JSON');
      return [];
    }
  }

  async setSkillActive(skillId: string, active: boolean): Promise<void> {
    const activeIds = new Set(this.getActiveSkillIds());
    if (active) {
      activeIds.add(skillId);
    } else {
      activeIds.delete(skillId);
    }

    const newActiveArray = Array.from(activeIds);
    // Ensure dir exists
    fs.mkdirSync(path.dirname(this.activeSkillsPath), { recursive: true });
    fs.writeFileSync(
      this.activeSkillsPath,
      JSON.stringify({ active: newActiveArray }, null, 2),
      'utf8',
    );
    this.logger.log(
      { skillId, active, totalActive: newActiveArray.length },
      'Skill active state updated',
    );

    await this.generateLoadedSkillsMd();
  }

  private scanSkillsDirectory(
    baseDir: string,
    rootDirForId: string,
  ): SkillItem[] {
    const results: SkillItem[] = [];
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
      };
    } catch (e) {
      this.logger.error({ skillMdPath, error: String(e) }, 'Error parsing skill frontmatter');
      return null;
    }
  }

  private async generateLoadedSkillsMd(): Promise<void> {
    const allSkills = await this.getAllSkills();
    const activeIds = new Set(this.getActiveSkillIds());

    let mdContent = `# Active Skills Context\n\n`;
    mdContent += `> This active skills list is dynamically generated by the DevTools Dashboard. Do not edit this file directly.\n\n`;

    const activeSkillsList = allSkills.filter((s) => activeIds.has(s.id));

    if (activeSkillsList.length === 0) {
      mdContent += `No extra skills are currently active.\n`;
    } else {
      activeSkillsList.forEach((s) => {
        mdContent += `## ${s.name}\n`;
        mdContent += `${s.description}\n`;
        mdContent += `**Reference:** [${s.name}](${s.path})\n\n`;
      });
    }

    try {
      const dir = path.dirname(this.loadedSkillsMdPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.loadedSkillsMdPath, mdContent, 'utf8');
      this.logger.log(
        { path: this.loadedSkillsMdPath, activeCount: activeSkillsList.length },
        'Generated active skills context',
      );
    } catch (e) {
      this.logger.error(
        { path: this.loadedSkillsMdPath, error: String(e) },
        'Failed to write loaded-skills.md',
      );
    }
  }
}
