import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

import { DEFAULT_CHUNK_SIZE, splitIntoChunks } from '../../../lib/chunker';
import { loadConfig, validateRequiredConfig } from '../../../lib/config';
import {
  pollStatus,
  signalComplete,
  triggerFileStore,
  uploadChunk,
} from '../../../lib/relay-client';

/** Default maximum file size: 100 MB */
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

export class RelayFilePush extends Command {
  static description =
    'Upload a file to git-relay-server via encrypted chunk transport';

  static flags = {
    file: Flags.string({
      required: true,
      description: 'Path to the file to upload',
    }),
    name: Flags.string({
      description: 'Filename to store on server (default: basename of --file)',
    }),
    wait: Flags.boolean({
      default: true,
      allowNo: true,
      description: 'Wait for server to finish storing the file (default: true)',
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
    '$ aw relay file push --file ./backup.tar.gz',
    '$ aw relay file push --file ./data.zip --name archive-2026.zip --no-wait',
  ];

  async run() {
    const { flags } = await this.parse(RelayFilePush);
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

    // 3. Validate file exists and size
    const filePath = path.resolve(flags.file);
    if (!fs.existsSync(filePath)) {
      output(
        errorResponse('INVALID_INPUT', `File not found: ${filePath}`),
        flags.format,
      );
      return this.exit(4);
    }

    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      output(
        errorResponse('INVALID_INPUT', `Not a file: ${filePath}`),
        flags.format,
      );
      return this.exit(4);
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
      output(
        errorResponse(
          'INVALID_INPUT',
          `File size ${stat.size} bytes exceeds max ${MAX_FILE_SIZE_BYTES} bytes (100 MB)`,
        ),
        flags.format,
      );
      return this.exit(4);
    }

    if (stat.size === 0) {
      output(errorResponse('INVALID_INPUT', 'File is empty'), flags.format);
      return this.exit(4);
    }

    // 4. Read file and compute SHA256
    const fileData = fs.readFileSync(filePath);
    const sha256 = createHash('sha256').update(fileData).digest('hex');
    const fileName = flags.name || path.basename(filePath);

    // 5. Split into chunks
    const chunks = splitIntoChunks(fileData, chunkSize);

    // 6. Upload chunks
    const sessionId = randomUUID();

    try {
      for (let i = 0; i < chunks.length; i++) {
        await uploadChunk(
          config.relayUrl!,
          config.apiKey!,
          config,
          {
            sessionId,
            chunkIndex: i,
            totalChunks: chunks.length,
          },
          chunks[i],
        );
      }

      // 7. Signal complete
      await signalComplete(config.relayUrl!, config.apiKey!, config, {
        sessionId,
      });

      // 8. Trigger file store
      await triggerFileStore(config.relayUrl!, config.apiKey!, config, {
        sessionId,
        fileName,
        size: fileData.length,
        sha256,
      });

      // 9. Optionally wait for stored | failed
      if (flags.wait) {
        const result = await pollStatus(
          config.relayUrl!,
          config.apiKey!,
          sessionId,
          { successStates: ['stored'], failureStates: ['failed'] },
        );

        const success = result.status === 'stored';
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
              resource_type: 'relay_file_push',
              message: success
                ? `File stored: ${fileName}`
                : `File store failed: ${result.message}`,
            },
          }),
          flags.format,
        );

        if (!success) {
          this.exit(3);
        }
      } else {
        // No-wait mode: return sessionId for manual status check
        output(
          new MCPResponse({
            success: true,
            content: [
              new MCPContent({
                type: ContentType.JSON,
                data: { sessionId, fileName, size: fileData.length, sha256 },
              }),
            ],
            metadata: {
              resource_type: 'relay_file_push',
              message: `Upload complete, processing in background. Use: aw relay status ${sessionId}`,
            },
          }),
          flags.format,
        );
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
}
