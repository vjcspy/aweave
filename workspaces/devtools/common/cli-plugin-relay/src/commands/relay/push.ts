import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

import { DEFAULT_CHUNK_SIZE, splitIntoChunks } from '../../lib/chunker';
import { loadConfig, validateRequiredConfig } from '../../lib/config';
import {
  getRemoteInfo,
  pollStatus,
  signalComplete,
  triggerGR,
  uploadChunk,
} from '../../lib/relay-client';

export class RelayPush extends Command {
  static description = 'Push local commits to GitHub via the relay';

  static flags = {
    repo: Flags.string({
      required: false,
      description: 'GitHub repo (format: owner/repo). Auto-detects from remote origin if omitted.',
    }),
    branch: Flags.string({
      description: 'Target branch to push (default: current branch name)',
    }),
    base: Flags.string({
      description: 'Base branch on remote (default: "main")',
    }),
    'chunk-size': Flags.integer({
      description: 'Chunk size in bytes (default: 3145728, max: 3400000)',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  static examples = [
    '$ aw relay push',
    '$ aw relay push --repo user/my-app --branch feature/auth',
  ];

  async run() {
    const { flags } = await this.parse(RelayPush);
    const config = loadConfig();

    // 1. Validate config
    const missingConfig = validateRequiredConfig(config);
    if (missingConfig.length > 0) {
      output(
        errorResponse(
          'INVALID_INPUT',
          `Missing relay config: ${missingConfig.join(', ')}`,
          'Run: aw relay config set --help',
        ),
        flags.format,
      );
      this.exit(4);
    }

    // 2. Validate chunk size
    const chunkSize =
      flags['chunk-size'] || config.chunkSize || DEFAULT_CHUNK_SIZE;
    if (chunkSize > 3_400_000) {
      output(
        errorResponse(
          'INVALID_INPUT',
          'Max chunk size is 3.4MB (base64+JSON must fit in Vercel 4.5MB limit)',
        ),
        flags.format,
      );
      this.exit(4);
    }

    // 3. Resolve Repo and Branch
    let repo = flags.repo; // config.defaultRepo not in types/config but we can rely on flag
    if (!repo) {
      try {
        const originUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
        const match = originUrl.match(/github\.com[/:](.+?\/.+?)(?:\.git)?$/);
        if (match) repo = match[1];
      } catch {}
    }

    if (!repo) {
      output(
        errorResponse('INVALID_INPUT', '--repo flag is required if cannot detect from git origin remote'),
        flags.format,
      );
      return this.exit(4);
    }

    const branch = flags.branch || this.getCurrentBranch();

    // 4. Pre-flight Check (Get Remote SHA)
    let remoteSha: string;
    try {
      remoteSha = await getRemoteInfo(
        config.relayUrl!,
        config.apiKey!,
        repo,
        branch,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output(
        errorResponse('NETWORK_ERROR', `Failed to get remote info: ${message}`),
        flags.format,
      );
      return this.exit(3);
    }

    // 5. Validation / Ancestry Check
    let range = '';
    if (!remoteSha) {
      // First push of this branch
      range = 'HEAD';
    } else {
      try {
        // Check if remote-sha exists locally
        execSync(`git cat-file -t ${remoteSha}`, { stdio: 'pipe' });
        // Check ancestry
        execSync(`git merge-base --is-ancestor ${remoteSha} HEAD`, { stdio: 'pipe' });
      } catch {
        output(
          errorResponse(
            'ERR_OUT_OF_SYNC',
            `[ERR_OUT_OF_SYNC]: Branch bị diverge hoặc local của bạn bị cũ. Yêu cầu update/pull từ external repo về private network trước.\n(Remote SHA: ${remoteSha.substring(0, 8)})`
          ),
          flags.format,
        );
        return this.exit(4);
      }

      const localHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      if (remoteSha === localHead) {
        output(
          new MCPResponse({
            success: true,
            content: [new MCPContent({ type: ContentType.TEXT, text: 'Branch is already up-to-date.' })],
            metadata: { resource_type: 'relay_push', message: 'Everything up-to-date' },
          }),
          flags.format
        );
        return this.exit(0);
      }

      range = `${remoteSha}..HEAD`;
    }

    // 6. Generate Bundle
    let patch: Buffer;
    const bundleFile = path.join(os.tmpdir(), `relay-${Date.now()}.bundle`);
    try {
      execSync(`git bundle create ${bundleFile} ${range}`, { stdio: 'pipe' });
      patch = fs.readFileSync(bundleFile);
      fs.rmSync(bundleFile, { force: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output(
        errorResponse('GIT_ERROR', `Failed to generate bundle: ${message}`),
        flags.format,
      );
      return this.exit(3);
    }

    if (patch.length === 0) {
      output(
        errorResponse('INVALID_INPUT', 'No changes configured to push'),
        flags.format,
      );
      return this.exit(4);
    }

    // 5. Chunk raw patch data
    const chunks = splitIntoChunks(patch, chunkSize);

    // 7. Upload chunks
    const sessionId = randomUUID();
    const baseBranch = flags.base || /* config.defaultBaseBranch wait removed that */ 'main';

    try {
      for (let i = 0; i < chunks.length; i++) {
        await uploadChunk(
          config.relayUrl!,
          config.apiKey!,
          config.encryptionKey!,
          {
            sessionId,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
          chunks[i],
        );
      }

      // 8. Signal complete
      await signalComplete(
        config.relayUrl!,
        config.apiKey!,
        config.encryptionKey!,
        {
          sessionId,
        },
      );

      // 9. Trigger GR processing
      await triggerGR(config.relayUrl!, config.apiKey!, config.encryptionKey!, {
        sessionId,
        repo,
        branch,
        baseBranch,
      });

      // 10. Poll status
      const result = await pollStatus(
        config.relayUrl!,
        config.apiKey!,
        sessionId,
      );

      // 11. Output result
      const success = result.status === 'pushed';
      output(
        new MCPResponse({
          success,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: result as unknown as Record<string, unknown>,
            }),
          ],
          metadata: {
            resource_type: 'relay_push',
            message: success
              ? `Pushed bundle to ${repo}:${branch}`
              : `Push failed: ${result.message}`,
          },
        }),
        flags.format,
      );

      if (!success) {
        this.exit(3);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output(
        errorResponse('NETWORK_ERROR', message, 'Check relay URL and API key'),
        flags.format,
      );
      this.exit(3);
    }
  }

  /** Get current git branch name */
  private getCurrentBranch(): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        encoding: 'utf-8',
      }).trim();
    } catch {
      return 'main';
    }
  }
}
