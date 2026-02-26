import { existsSync } from 'fs';

import { Scope } from '../get-context/types';
import { getMemoryPath, getResourcesPath } from './paths';

export interface ResolvedScope {
  scope: Scope;
  resourcesDir: string;
  memoryDir: string;
}

export function resolveScope(
  projectRoot: string,
  scope: Scope,
): ResolvedScope {
  if (!scope.workspace) {
    throw new Error('workspace is required in scope');
  }

  if (scope.repository && !scope.domain) {
    throw new Error('domain is required when repository is specified');
  }

  const resourcesDir = getResourcesPath(projectRoot, scope);
  const memoryDir = getMemoryPath(projectRoot, scope);

  return { scope, resourcesDir, memoryDir };
}

export function validateResourcesDir(resolved: ResolvedScope): void {
  if (!existsSync(resolved.resourcesDir)) {
    throw new Error(
      `Resources directory not found: ${resolved.resourcesDir}`,
    );
  }
}
