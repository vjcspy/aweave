import { Scope } from '../get-context/types';

export type MemoryType = 'decision' | 'lesson';

export interface SaveMemoryParams {
  scope: Scope;
  type: MemoryType;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export interface SaveMemoryResult {
  success: boolean;
  filePath: string;
  type: MemoryType;
  title: string;
}
