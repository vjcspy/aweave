/**
 * Demo Workflow — comprehensive case study for the workflow engine.
 *
 * Covers all task types and features:
 *   1. Parallel execution (validate environment)
 *   2. Race execution + cancellation (test suites)
 *   3. Dynamic tasks via prepareTasks (code analysis)
 *   4. Human-in-the-loop (approval gate)
 *   5. Conditional stage (deploy)
 *   6. Sequential + retry + exponential backoff (deploy tasks)
 *   7. Streaming output
 *   8. Stage reducer (aggregate analysis)
 *   9. onFailed with skip (notifications)
 *   10. Timeout handling
 *   11. Logging at all levels
 */

import type {
  StageContext,
  TaskHandler,
  TaskOutput,
  WorkflowDefinition,
} from '@hod/aweave-workflow-engine';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('Aborted'));
      },
      { once: true },
    );
  });
}

// ---------------------------------------------------------------------------
// Stage 1: Validate Environment  [parallel]
// ---------------------------------------------------------------------------

const checkNode: TaskHandler = async (ctx) => {
  ctx.log('Checking Node.js version...');
  await sleep(400, ctx.signal);
  const version = process.version;
  ctx.log(`Node.js ${version}`);
  return {
    data: { version, compatible: true },
    summary: `Node ${version}`,
    detail: [
      'Node.js Version Check',
      '═════════════════════',
      `Version:  ${version}`,
      'Required: >= 20.0.0',
      'Status:   ✅ Compatible',
    ].join('\n'),
  };
};

const checkGit: TaskHandler = async (ctx) => {
  ctx.log('Checking git status...');
  await sleep(600, ctx.signal);
  const branch = 'feature/demo';
  ctx.log(`Branch: ${branch}, clean working tree`);
  return {
    data: { branch, clean: true, ahead: 2, behind: 0 },
    summary: `${branch} (clean)`,
    detail: [
      'Git Status',
      '══════════',
      `Branch:      ${branch}`,
      'Working tree: clean',
      'Ahead:       2 commits',
      'Behind:      0 commits',
    ].join('\n'),
  };
};

const checkDisk: TaskHandler = async (ctx) => {
  ctx.log('Checking disk space...');
  await sleep(350, ctx.signal);
  const freeGb = 42.5;
  ctx.log(`Free: ${freeGb}GB`);
  return {
    data: { freeGb, totalGb: 256 },
    summary: `${freeGb}GB free`,
    detail: [
      'Disk Space',
      '══════════',
      `Total: 256 GB`,
      `Used:  213.5 GB (83%)`,
      `Free:  ${freeGb} GB`,
      'Status: ✅ Sufficient',
    ].join('\n'),
  };
};

// ---------------------------------------------------------------------------
// Stage 2: Run Tests  [race] — first passing suite wins
// ---------------------------------------------------------------------------

const runUnitTests: TaskHandler = async (ctx) => {
  ctx.log('Running unit tests...');
  const files = ['math', 'string', 'array', 'date', 'crypto'];
  for (let i = 0; i < files.length; i++) {
    if (ctx.signal.aborted) return { data: null, summary: 'Cancelled' };
    await sleep(200, ctx.signal);
    ctx.stream(`  PASS src/utils/${files[i]}.test.ts\n`);
  }
  ctx.log('Unit tests passed');
  return {
    data: { suite: 'unit', passed: 42, failed: 0, skipped: 1 },
    summary: '42 passed, 0 failed (1.0s)',
    detail: [
      'Unit Test Results',
      '═════════════════',
      'Test Suites: 5 passed, 5 total',
      'Tests:       42 passed, 1 skipped, 0 failed',
      'Duration:    1.0s',
      '',
      'PASS src/utils/math.test.ts        (12 tests)',
      'PASS src/utils/string.test.ts      (8 tests)',
      'PASS src/utils/array.test.ts       (9 tests)',
      'PASS src/utils/date.test.ts        (7 tests)',
      'PASS src/utils/crypto.test.ts      (6 tests)',
    ].join('\n'),
  };
};

const runIntegrationTests: TaskHandler = async (ctx) => {
  ctx.log('Running integration tests...');
  const apis = [
    'auth',
    'users',
    'products',
    'orders',
    'payments',
    'notifications',
  ];
  for (let i = 0; i < apis.length; i++) {
    if (ctx.signal.aborted) return { data: null, summary: 'Cancelled' };
    await sleep(500, ctx.signal);
    ctx.stream(`  PASS tests/integration/api/${apis[i]}.test.ts\n`);
  }
  ctx.log('Integration tests passed');
  return {
    data: { suite: 'integration', passed: 28, failed: 0, skipped: 0 },
    summary: '28 passed, 0 failed (3.2s)',
  };
};

const runE2ETests: TaskHandler = async (ctx) => {
  ctx.log('Running E2E tests (slowest suite)...');
  const flows = [
    'login',
    'signup',
    'checkout',
    'profile',
    'search',
    'admin',
    'reports',
  ];
  for (let i = 0; i < flows.length; i++) {
    if (ctx.signal.aborted) return { data: null, summary: 'Cancelled' };
    await sleep(800, ctx.signal);
    ctx.stream(`  PASS tests/e2e/${flows[i]}.spec.ts\n`);
  }
  ctx.log('E2E tests passed');
  return {
    data: { suite: 'e2e', passed: 14, failed: 0, skipped: 2 },
    summary: '14 passed, 0 failed (5.8s)',
  };
};

// ---------------------------------------------------------------------------
// Stage 3: Code Analysis  [parallel, dynamic tasks]
// ---------------------------------------------------------------------------

function createAnalyzeHandler(moduleName: string): TaskHandler {
  return async (ctx) => {
    ctx.log(`Analyzing module: ${moduleName}...`);
    const totalSteps = 4;
    const stepDuration = 300 + Math.floor(Math.random() * 400);

    for (let i = 1; i <= totalSteps; i++) {
      if (ctx.signal.aborted) return { data: null };
      await sleep(stepDuration, ctx.signal);
      ctx.stream(
        `  [${moduleName}] ${['Parsing AST', 'Checking types', 'Lint rules', 'Complexity'][i - 1]}... ${Math.round((i / totalSteps) * 100)}%\n`,
      );
    }

    const issues = Math.floor(Math.random() * 6);
    const warnings = Math.floor(Math.random() * 4);
    const filesChecked = 8 + Math.floor(Math.random() * 15);

    ctx.log(`${moduleName}: ${issues} issues, ${warnings} warnings`);
    return {
      data: { module: moduleName, issues, warnings, filesChecked },
      summary: `${issues} issues, ${warnings} warnings`,
      detail: [
        `Module: ${moduleName}`,
        '═══════' + '═'.repeat(moduleName.length),
        `Files checked: ${filesChecked}`,
        `Issues:        ${issues}`,
        `Warnings:      ${warnings}`,
        `Complexity:    ${['Low', 'Medium', 'Medium', 'High'][Math.floor(Math.random() * 4)]}`,
        '',
        issues > 0
          ? `⚠ ${issues} issue(s) require attention`
          : '✅ No issues found',
      ].join('\n'),
    };
  };
}

function analysisReducer(taskOutputs: Record<string, TaskOutput>): unknown {
  let totalIssues = 0;
  let totalWarnings = 0;
  let totalFiles = 0;

  for (const output of Object.values(taskOutputs)) {
    const data = output.data as {
      issues: number;
      warnings: number;
      filesChecked: number;
    } | null;
    if (data) {
      totalIssues += data.issues;
      totalWarnings += data.warnings;
      totalFiles += data.filesChecked;
    }
  }

  return {
    totalIssues,
    totalWarnings,
    totalFiles,
    moduleCount: Object.keys(taskOutputs).length,
  };
}

// ---------------------------------------------------------------------------
// Stage 4: Review & Approve  [sequential, human-in-the-loop]
// ---------------------------------------------------------------------------

const reviewAndApprove: TaskHandler = async (ctx) => {
  ctx.log('Preparing review summary...');
  await sleep(300, ctx.signal);

  // Gather results from previous stages
  const envResult = ctx.stageResults['validate-env'];
  const testResult = ctx.stageResults['run-tests'];
  const analysisResult = ctx.stageResults['code-analysis'];

  const envTasks = envResult ? Object.keys(envResult.tasks).length : 0;
  const testWinner = testResult ? Object.keys(testResult.tasks)[0] : 'none';
  const analysis = analysisResult?.aggregated as
    | {
        totalIssues: number;
        totalWarnings: number;
        totalFiles: number;
        moduleCount: number;
      }
    | undefined;

  ctx.stream('╔══════════════════════════════════════╗\n');
  ctx.stream('║        Pipeline Summary              ║\n');
  ctx.stream('╠══════════════════════════════════════╣\n');
  ctx.stream(`║ Environment: ${envTasks}/3 checks passed     ║\n`);
  ctx.stream(`║ Tests:       Winner = ${testWinner.padEnd(14)}║\n`);
  ctx.stream(
    `║ Analysis:    ${analysis?.totalIssues ?? '?'} issues, ${analysis?.totalWarnings ?? '?'} warnings  ║\n`,
  );
  ctx.stream(
    `║ Files:       ${analysis?.totalFiles ?? '?'} files in ${analysis?.moduleCount ?? '?'} modules ║\n`,
  );
  ctx.stream('╚══════════════════════════════════════╝\n');

  const { value } = await ctx.waitForInput({
    prompt: 'How would you like to proceed?',
    options: [
      { label: '🚀 Deploy to staging', value: 'deploy' },
      { label: '📊 Generate report only (skip deploy)', value: 'report' },
      { label: '⏭  Skip everything, just notify', value: 'skip' },
      { label: '🛑 Abort workflow', value: 'abort' },
    ],
  });

  ctx.log(`User decision: ${value}`);

  if (value === 'abort') {
    throw new Error('User chose to abort workflow');
  }

  return {
    data: { decision: value },
    summary: `Decision: ${value}`,
    detail: `User chose: ${value}\nTimestamp: ${new Date().toISOString()}`,
  };
};

// ---------------------------------------------------------------------------
// Stage 5: Deploy  [sequential, conditional, retry]
// ---------------------------------------------------------------------------

const buildProject: TaskHandler = async (ctx) => {
  ctx.log('Starting build...');
  const steps = [
    'Compiling TypeScript',
    'Bundling assets',
    'Tree-shaking unused code',
    'Optimizing for production',
    'Generating sourcemaps',
    'Writing output',
  ];

  for (const step of steps) {
    if (ctx.signal.aborted) return { data: null };
    await sleep(400, ctx.signal);
    ctx.stream(`  ▸ ${step}...\n`);
  }

  ctx.log('Build completed successfully');
  return {
    data: { success: true, outputSize: '2.4MB', files: 127 },
    summary: 'Build OK (2.4MB)',
    detail: [
      'Build Result',
      '════════════',
      'Status:      ✅ Success',
      'Output size: 2.4 MB',
      'Files:       127',
      'Sourcemaps:  Yes',
      'Duration:    2.4s',
    ].join('\n'),
  };
};

const deployToStaging: TaskHandler = async (ctx) => {
  ctx.log(`Deploying to staging (attempt ${ctx.execution.attempt})...`);

  // Simulate transient failure on first attempt
  if (ctx.execution.attempt === 1) {
    await sleep(500, ctx.signal);
    ctx.log('Connection timeout on first attempt', 'error');
    throw new Error('ECONNRESET: Connection reset by peer');
  }

  const steps = [
    'Uploading artifacts',
    'Running health checks',
    'Switching traffic',
    'Verifying',
  ];
  for (const step of steps) {
    if (ctx.signal.aborted) return { data: null };
    await sleep(600, ctx.signal);
    ctx.stream(`  ▸ ${step}...\n`);
  }

  ctx.log('Deploy to staging successful');
  return {
    data: { url: 'https://staging.example.com', version: '1.2.3' },
    summary: 'Deployed v1.2.3',
    detail: [
      'Deploy Result',
      '═════════════',
      'Status:  ✅ Success',
      'URL:     https://staging.example.com',
      'Version: 1.2.3',
      `Attempt: ${ctx.execution.attempt}`,
      'Region:  us-east-1',
    ].join('\n'),
  };
};

// ---------------------------------------------------------------------------
// Stage 6: Generate Report  [sequential, conditional]
// ---------------------------------------------------------------------------

const generateReport: TaskHandler = async (ctx) => {
  ctx.log('Generating final report...');

  const sections = [
    '## Environment\n\nAll checks passed. Node.js compatible, git clean, disk OK.',
    '## Tests\n\nFastest test suite won the race. All assertions passed.',
    '## Code Analysis\n\nStatic analysis complete across all modules.',
    '## Recommendations\n\n- Address lint issues before production deploy\n- Consider adding integration test coverage\n- Review complexity warnings in core module',
  ];

  for (const section of sections) {
    if (ctx.signal.aborted) return { data: null };
    await sleep(400, ctx.signal);
    ctx.stream(section + '\n\n');
  }

  ctx.log('Report generated');
  return {
    data: { path: '.workflow/demo/report.md', sections: sections.length },
    summary: 'Report generated (4 sections)',
    detail: sections.join('\n\n'),
  };
};

// ---------------------------------------------------------------------------
// Stage 7: Notify  [sequential, onFailed: skip, timeout]
// ---------------------------------------------------------------------------

const sendNotification: TaskHandler = async (ctx) => {
  ctx.log('Sending notifications...');

  const channels = [
    { name: 'Email → team@example.com', icon: '📧' },
    { name: 'Slack → #deployments', icon: '💬' },
    { name: 'Webhook → CI/CD', icon: '🔗' },
  ];

  for (const channel of channels) {
    if (ctx.signal.aborted) return { data: null };
    await sleep(300, ctx.signal);
    ctx.stream(`  ${channel.icon} ${channel.name}... sent\n`);
    ctx.log(`Notified: ${channel.name}`);
  }

  return {
    data: {
      channels: channels.map((c) => c.name),
      sentAt: new Date().toISOString(),
    },
    summary: `Notified ${channels.length} channels`,
    detail: [
      'Notifications Sent',
      '══════════════════',
      ...channels.map((c) => `${c.icon} ${c.name} — ✅`),
    ].join('\n'),
  };
};

// ---------------------------------------------------------------------------
// Workflow Definition
// ---------------------------------------------------------------------------

export const demoWorkflow: WorkflowDefinition = {
  id: 'demo-pipeline',
  name: 'Demo Pipeline',
  description: 'Comprehensive demo showcasing all workflow engine features',

  stages: [
    // Stage 1: Parallel environment validation
    {
      id: 'validate-env',
      name: 'Validate Environment',
      execution: 'parallel',
      tasks: [
        { id: 'check-node', name: 'Check Node.js', handler: checkNode },
        { id: 'check-git', name: 'Check Git', handler: checkGit },
        { id: 'check-disk', name: 'Check Disk', handler: checkDisk },
      ],
    },

    // Stage 2: Race — first passing test suite wins
    {
      id: 'run-tests',
      name: 'Run Tests (Race)',
      execution: 'race',
      tasks: [
        { id: 'unit-tests', name: 'Unit Tests', handler: runUnitTests },
        {
          id: 'integration-tests',
          name: 'Integration Tests',
          handler: runIntegrationTests,
        },
        { id: 'e2e-tests', name: 'E2E Tests', handler: runE2ETests },
      ],
    },

    // Stage 3: Parallel dynamic tasks + reducer
    {
      id: 'code-analysis',
      name: 'Code Analysis',
      execution: 'parallel',
      prepareTasks: (_ctx: StageContext) => {
        // Dynamic: generate one task per module
        const modules = ['core', 'api', 'auth', 'database', 'utils'];
        return modules.map((mod) => ({
          id: `analyze-${mod}`,
          name: `Lint ${mod}`,
          handler: createAnalyzeHandler(mod),
        }));
      },
      reducer: analysisReducer,
    },

    // Stage 4: Human-in-the-loop
    {
      id: 'review',
      name: 'Review & Approve',
      execution: 'sequential',
      tasks: [
        { id: 'review', name: 'Approval Gate', handler: reviewAndApprove },
      ],
    },

    // Stage 5: Conditional deploy with retry
    {
      id: 'deploy',
      name: 'Deploy',
      execution: 'sequential',
      condition: (ctx: StageContext) => {
        const decision = ctx.stageResults['review']?.tasks?.['review']?.data as
          | { decision: string }
          | undefined;
        return decision?.decision === 'deploy';
      },
      tasks: [
        { id: 'build', name: 'Build', handler: buildProject },
        {
          id: 'deploy-staging',
          name: 'Deploy Staging',
          handler: deployToStaging,
          retry: { maxAttempts: 3, delayMs: 1000, backoff: 'exponential' },
        },
      ],
    },

    // Stage 6: Conditional report generation
    {
      id: 'report',
      name: 'Generate Report',
      execution: 'sequential',
      condition: (ctx: StageContext) => {
        const decision = ctx.stageResults['review']?.tasks?.['review']?.data as
          | { decision: string }
          | undefined;
        return (
          decision?.decision === 'report' || decision?.decision === 'deploy'
        );
      },
      tasks: [
        {
          id: 'generate-report',
          name: 'Generate Report',
          handler: generateReport,
        },
      ],
    },

    // Stage 7: Notifications — onFailed: skip (never blocks workflow)
    {
      id: 'notify',
      name: 'Notify',
      execution: 'sequential',
      tasks: [
        {
          id: 'send-notification',
          name: 'Send Notifications',
          handler: sendNotification,
          timeout: 10_000, // 10s timeout
        },
      ],
      onFailed: () => ({ action: 'skip' }),
    },
  ],
};
