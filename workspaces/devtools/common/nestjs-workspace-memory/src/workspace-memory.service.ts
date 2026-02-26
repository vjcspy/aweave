import {
  getContext,
  GetContextParams,
  GetContextResponse,
  saveMemory,
  SaveMemoryParams,
  SaveMemoryResult,
  Topic,
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

  saveMemory(params: SaveMemoryParams): SaveMemoryResult {
    return saveMemory(this.projectRoot, params);
  }

  parseTopics(topicsStr?: string): Topic[] | undefined {
    if (!topicsStr) return undefined;
    return topicsStr.split(',').map((t) => t.trim()) as Topic[];
  }
}
