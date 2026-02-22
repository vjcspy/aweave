import {
  getDomainConfigDir,
  getUserConfigPath,
  loadConfig,
} from '@hod/aweave-config-core';
import { resolveDevtoolsRoot } from '@hod/aweave-node-shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

import { ConfigDomainDto, GetConfigResponseDto } from '../dtos/configs.dto';

@Injectable()
export class ConfigsService {
  private readonly logger = new Logger(ConfigsService.name);

  /**
   * Discovers domains by scanning the workspaces/devtools folder (up to root).
   */
  private findDevtoolsRoot(): string | null {
    return resolveDevtoolsRoot({
      cwd: process.cwd(),
      moduleDir: __dirname,
    });
  }

  getAvailableConfigs(): ConfigDomainDto[] {
    const devtoolsRoot = this.findDevtoolsRoot();
    if (!devtoolsRoot) {
      this.logger.warn('Config discovery failed: devtools root not found');
      return [];
    }

    const results: ConfigDomainDto[] = [];
    const entries = fs.readdirSync(devtoolsRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name === 'node_modules' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }

      const domainDir = path.join(devtoolsRoot, entry.name);
      const defaultsDir = path.join(domainDir, 'config', 'defaults');
      if (fs.existsSync(defaultsDir)) {
        const files = fs
          .readdirSync(defaultsDir)
          .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
        results.push({
          domain: entry.name,
          files: files.map((f) => ({
            name: f.replace(/\.ya?ml$/, ''),
            path: path.join(defaultsDir, f),
          })),
        });
      }
    }

    this.logger.log(
      {
        domainCount: results.length,
        totalFiles: results.reduce((sum, d) => sum + d.files.length, 0),
      },
      'Config discovery completed',
    );

    return results;
  }

  getConfigDetails(domain: string, name: string): GetConfigResponseDto {
    const devtoolsRoot = this.findDevtoolsRoot();
    if (!devtoolsRoot) {
      throw new Error('Could not find devtools root');
    }

    const defaultsDir = path.join(devtoolsRoot, domain, 'config', 'defaults');
    const defaultFilePathYml = path.join(defaultsDir, `${name}.yml`);
    const defaultFilePathYaml = path.join(defaultsDir, `${name}.yaml`);

    let defaultConfigPath = defaultFilePathYaml;
    if (fs.existsSync(defaultFilePathYml))
      defaultConfigPath = defaultFilePathYml;
    else if (!fs.existsSync(defaultFilePathYaml)) {
      throw new NotFoundException(
        `Default config for ${domain}/${name} not found`,
      );
    }

    const userConfigPath = getUserConfigPath(domain, name);

    let rawDefaultConfig = '';
    try {
      rawDefaultConfig = fs.readFileSync(defaultConfigPath, 'utf8');
    } catch (e) {
      this.logger.warn(
        { domain, name, error: String(e) },
        'Failed to read default config',
      );
    }

    let rawUserConfig = '';
    if (fs.existsSync(userConfigPath)) {
      try {
        rawUserConfig = fs.readFileSync(userConfigPath, 'utf8');
      } catch (e) {
        this.logger.warn(
          { domain, name, error: String(e) },
          'Failed to read user config',
        );
      }
    }

    let effectiveConfig = {};
    try {
      // NOTE: loadConfig pattern requires knowing envOverrides or schemas if strict,
      // but without the specific domain index imports we can do a generic load
      // which will just merge defaults + user configs + basic env vars.
      // E.g. basic raw merge by passing just dir.
      effectiveConfig = loadConfig({
        domain,
        name,
        defaultsDir,
      });
    } catch (e) {
      this.logger.error(
        { domain, name, error: String(e) },
        'Failed to load effective config',
      );
      effectiveConfig = { _error: String(e) };
    }

    return {
      success: true,
      rawDefaultConfig,
      defaultConfigPath,
      rawUserConfig,
      userConfigPath,
      effectiveConfig,
    };
  }

  saveUserConfig(domain: string, name: string, rawContent: string): void {
    const userConfigDir = getDomainConfigDir(domain);
    if (!fs.existsSync(userConfigDir)) {
      fs.mkdirSync(userConfigDir, { recursive: true });
    }
    const destPath = path.join(userConfigDir, `${name}.yaml`);
    fs.writeFileSync(destPath, rawContent, 'utf8');
    this.logger.log({ domain, name, path: destPath }, 'User config saved');
  }
}
