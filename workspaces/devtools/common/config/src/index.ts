import path from 'node:path';

import type { ConfigSchema } from '@hod/aweave-config-core';

// ---------------------------------------------------------------------------
// @hod/aweave-config-common — Default configs for the "common" domain
// ---------------------------------------------------------------------------

/** Absolute path to the defaults/ directory (works from both src/ and dist/) */
export const DEFAULT_CONFIG_DIR = path.resolve(__dirname, '..', 'defaults');

/** Domain name used for config path resolution (~/.aweave/config/common/) */
export const DOMAIN = 'common';

/** List of default config files shipped with this package */
export const DEFAULT_CONFIG_FILES = ['server.yaml', 'cli.yaml'] as const;

// ---------------------------------------------------------------------------
// Schema definitions for validation
// ---------------------------------------------------------------------------

export const CONFIG_SCHEMAS: Record<string, ConfigSchema> = {
  server: {
    configVersion: 1,
    fields: {
      'server.port': {
        type: 'number',
        required: true,
        description: 'NestJS server port',
      },
      'server.host': {
        type: 'string',
        required: true,
        description: 'NestJS server bind host',
      },
      'database.debate.dir': {
        type: 'string',
        description: 'Debate database directory',
      },
      'database.debate.name': {
        type: 'string',
        description: 'Debate database filename',
      },
      'database.docstore.path': {
        type: 'string',
        description: 'Docstore database path',
      },
    },
  },

  cli: {
    configVersion: 1,
    fields: {
      'debate.serverUrl': {
        type: 'string',
        required: true,
        description: 'Debate server URL',
      },
      'debate.waitDeadline': {
        type: 'number',
        description: 'Wait command deadline in seconds',
      },
      'debate.pollInterval': {
        type: 'number',
        description: 'Poll interval in seconds',
      },
      'debate.autoStartServices': {
        type: 'boolean',
        description: 'Auto-start services on debate commands',
      },
      'services.server.name': {
        type: 'string',
        description: 'pm2 process name for server',
      },
      'services.server.port': {
        type: 'number',
        description: 'Server port',
      },
      'services.server.healthUrl': {
        type: 'string',
        description: 'Server health check URL',
      },

      'test.cursor.browserChannel': {
        type: 'string',
        description:
          'Playwright system browser channel for aw test cursor commands',
      },
      'services.forwarder.enabled': {
        type: 'boolean',
        description: 'Enable forwarder defaults for convenience',
      },
      'services.forwarder.listenHost': {
        type: 'string',
        description: 'Forwarder bind host',
      },
      'services.forwarder.listenPort': {
        type: 'number',
        description: 'Forwarder listen port',
      },
      'services.forwarder.targetHost': {
        type: 'string',
        description: 'Upstream target host',
      },
      'services.forwarder.targetPort': {
        type: 'number',
        description: 'Upstream target port',
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Environment variable override maps
// ---------------------------------------------------------------------------

/** Maps config dot-paths to environment variable names for server.yaml */
export const SERVER_ENV_OVERRIDES: Record<string, string> = {
  'server.port': 'SERVER_PORT',
  'server.host': 'SERVER_HOST',
  'database.debate.dir': 'DEBATE_DB_DIR',
  'database.debate.name': 'DEBATE_DB_NAME',
  'database.docstore.path': 'AWEAVE_DB_PATH',
};

/** Maps config dot-paths to environment variable names for cli.yaml */
export const CLI_ENV_OVERRIDES: Record<string, string> = {
  'debate.serverUrl': 'DEBATE_SERVER_URL',
  'debate.waitDeadline': 'DEBATE_WAIT_DEADLINE',
  'debate.pollInterval': 'DEBATE_POLL_INTERVAL',
  'debate.autoStartServices': 'DEBATE_AUTO_START',
  'services.server.port': 'DEBATE_SERVER_PORT',

  'test.cursor.browserChannel': 'AWEAVE_CURSOR_BROWSER_CHANNEL',
  'services.forwarder.enabled': 'AWEAVE_FORWARDER_ENABLED',
  'services.forwarder.listenHost': 'AWEAVE_FORWARDER_LISTEN_HOST',
  'services.forwarder.listenPort': 'AWEAVE_FORWARDER_LISTEN_PORT',
  'services.forwarder.targetHost': 'AWEAVE_FORWARDER_TARGET_HOST',
  'services.forwarder.targetPort': 'AWEAVE_FORWARDER_TARGET_PORT',
};
