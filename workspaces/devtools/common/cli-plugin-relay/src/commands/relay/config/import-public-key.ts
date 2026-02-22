import * as fs from 'node:fs';

import {
  ContentType,
  errorResponse,
  MCPContent,
  MCPResponse,
  output,
} from '@hod/aweave-cli-shared';
import { Command, Flags } from '@oclif/core';

import { getConfigPath, saveConfig } from '../../../lib/config';
import {
  computePublicKeyFingerprint,
  normalizeFingerprint,
  normalizePublicKeyPem,
} from '../../../lib/crypto';

export class RelayConfigImportPublicKey extends Command {
  static description =
    'Import and pin the relay server public key for v2 transport encryption';

  static flags = {
    'key-id': Flags.string({
      required: true,
      description: 'Server transport key ID (kid)',
    }),
    file: Flags.string({
      description: 'Path to public key PEM file (SPKI PEM recommended)',
      exclusive: ['pem'],
    }),
    pem: Flags.string({
      description: 'Public key PEM string (supports escaped \\n)',
      exclusive: ['file'],
    }),
    fingerprint: Flags.string({
      description: 'Expected fingerprint to verify (format: sha256:...)',
    }),
    format: Flags.string({
      default: 'json',
      options: ['json', 'markdown'],
      description: 'Output format',
    }),
  };

  async run() {
    const { flags } = await this.parse(RelayConfigImportPublicKey);

    if (!flags.file && !flags.pem) {
      output(
        errorResponse(
          'INVALID_INPUT',
          'Provide either --file or --pem',
          'Run: aw relay config import-public-key --help',
        ),
        flags.format,
      );
      this.exit(4);
    }

    try {
      const rawPem = flags.file
        ? fs.readFileSync(flags.file, 'utf-8')
        : (flags.pem as string).replace(/\\n/g, '\n');

      const normalizedPem = normalizePublicKeyPem(rawPem);
      const computedFingerprint = computePublicKeyFingerprint(normalizedPem);

      if (flags.fingerprint) {
        const expected = normalizeFingerprint(flags.fingerprint);
        const actual = normalizeFingerprint(computedFingerprint);
        if (expected !== actual) {
          output(
            errorResponse(
              'INVALID_INPUT',
              `Fingerprint mismatch: expected ${expected}, got ${actual}`,
            ),
            flags.format,
          );
          this.exit(4);
        }
      }

      saveConfig({
        transportMode: 'auto',
        serverKeyId: flags['key-id'],
        serverPublicKey: normalizedPem,
        serverPublicKeyFingerprint: computedFingerprint,
      });

      output(
        new MCPResponse({
          success: true,
          content: [
            new MCPContent({
              type: ContentType.JSON,
              data: {
                keyId: flags['key-id'],
                fingerprint: computedFingerprint,
                transportMode: 'auto',
                configPath: getConfigPath(),
              },
            }),
          ],
          metadata: {
            resource_type: 'relay_config',
            message: `Pinned relay server public key (${flags['key-id']})`,
          },
        }),
        flags.format,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output(errorResponse('INVALID_INPUT', message), flags.format);
      this.exit(4);
    }
  }
}
