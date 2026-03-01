import { resolveProjectRootFromDevtools } from '@hod/aweave-node-shared';
import {
  getContext,
  GetContextParams,
  GetContextResponse,
} from '@hod/aweave-workspace-memory';
import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkspaceMemoryService {
  private readonly projectRoot: string;

  constructor() {
    const projectRoot = resolveProjectRootFromDevtools({
      cwd: process.cwd(),
      moduleDir: __dirname,
    });

    if (!projectRoot) {
      throw new Error(
        'Could not resolve project root. Set AWEAVE_DEVTOOLS_ROOT or run from within the aweave workspace.',
      );
    }

    this.projectRoot = projectRoot;
  }

  async getContext(params: GetContextParams): Promise<GetContextResponse> {
    return getContext(this.projectRoot, params);
  }

  parseTopics(topicsStr?: string): string[] | undefined {
    if (!topicsStr) return undefined;
    return topicsStr.split(',').map((t) => t.trim());
  }
}
