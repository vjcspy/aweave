import {
  getContext,
  GetContextParams,
  GetContextResponse,
} from '@hod/aweave-workspace-memory';
import { Injectable } from '@nestjs/common';
import { resolve } from 'path';

@Injectable()
export class WorkspaceMemoryService {
  private readonly projectRoot: string;

  constructor() {
    this.projectRoot = resolve(process.cwd(), '..', '..', '..');
  }

  async getContext(params: GetContextParams): Promise<GetContextResponse> {
    return getContext(this.projectRoot, params);
  }

  parseTopics(topicsStr?: string): string[] | undefined {
    if (!topicsStr) return undefined;
    return topicsStr.split(',').map((t) => t.trim());
  }
}
