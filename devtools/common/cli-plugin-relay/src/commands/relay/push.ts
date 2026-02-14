import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

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
import { encrypt } from '../../lib/crypto';
import {
  pollStatus,
  signalComplete,
  uploadChunk,
} from '../../lib/relay-client';

export class RelayPush extends Command {
  static description = 'Push local commits to GitHub via the relay';

  static flags = {
    repo: Flags.string({
      required: true,
      description: 'GitHub repo (format: owner/repo)',
    }),
    commit: Flags.string({
      required: true,
      description: 'Commit ID to push (e.g., abc123, HEAD)',
    }),
    branch: Flags.string({
      description: 'Target branch to push (default: current branch name)',
    }),
    base: Flags.string({
      description: 'Base branch on remote (default: "main")',
    }),
    commits: Flags.integer({
      default: 1,
      description: 'Number of commits to include starting from --commit',
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
    '$ aw relay push --repo user/my-app --commit HEAD --branch feature/auth',
    '$ aw relay push --repo user/my-app --commit HEAD --commits 3',
    '$ aw relay push --repo user/my-app --commit abc123 --branch hotfix/typo',
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

    // 3. Verify commit exists
    const commitId = flags.commit;
    try {
      execSync(`git rev-parse --verify ${commitId}`, { stdio: 'pipe' });
    } catch {
      output(
        errorResponse('INVALID_INPUT', `Commit ${commitId} not found`),
        flags.format,
      );
      this.exit(4);
    }

    // 4. Generate patch
    const commitCount = flags.commits;
    const range = `${commitId}~${commitCount}..${commitId}`;
    let patch: Buffer;

    try {
      patch = execSync(`git format-patch --binary --stdout ${range}`, {
        maxBuffer: 50 * 1024 * 1024, // 50MB max
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output(
        errorResponse('GIT_ERROR', `Failed to generate patch: ${message}`),
        flags.format,
      );
      this.exit(3);
    }

    if (patch.length === 0) {
      output(
        errorResponse('INVALID_INPUT', 'No changes in the specified commit(s)'),
        flags.format,
      );
      this.exit(4);
    }

    // 5. Encrypt
    const { encrypted, iv, authTag } = encrypt(patch, config.encryptionKey!);

    // 6. Chunk
    const chunks = splitIntoChunks(encrypted, chunkSize);

    // 7. Upload chunks
    const sessionId = randomUUID();
    const branch = flags.branch || this.getCurrentBranch();
    const baseBranch = flags.base || config.defaultBaseBranch || 'main';

    try {
      for (let i = 0; i < chunks.length; i++) {
        await uploadChunk(config.relayUrl!, config.apiKey!, {
          sessionId,
          chunkIndex: i,
          totalChunks: chunks.length,
          data: chunks[i].toString('base64'),
        });
      }

      // 8. Signal complete
      await signalComplete(config.relayUrl!, config.apiKey!, {
        sessionId,
        repo: flags.repo,
        branch,
        baseBranch,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
      });

      // 9. Poll status
      const result = await pollStatus(
        config.relayUrl!,
        config.apiKey!,
        sessionId,
      );

      // 10. Output result
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
              ? `Pushed ${commitCount} commit(s) to ${flags.repo}:${branch}`
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
