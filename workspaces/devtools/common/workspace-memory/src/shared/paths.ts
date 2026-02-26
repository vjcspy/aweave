import { join } from 'path';

import { Scope } from '../get-context/types';

export function getResourcesPath(projectRoot: string, scope: Scope): string {
  const parts = [projectRoot, 'resources', 'workspaces', scope.workspace];
  if (scope.domain) parts.push(scope.domain);
  if (scope.repository) parts.push(scope.repository);
  return join(...parts);
}

export function getMemoryPath(projectRoot: string, scope: Scope): string {
  const parts = [
    projectRoot,
    'user',
    'memory',
    'workspaces',
    scope.workspace,
  ];
  if (scope.domain) parts.push(scope.domain);
  if (scope.repository) parts.push(scope.repository);
  return join(...parts);
}

export function getIndexPath(projectRoot: string, workspace: string): string {
  return join(
    projectRoot,
    'user',
    'memory',
    'workspaces',
    workspace,
    '_index.yaml',
  );
}

export function getSkillsPath(projectRoot: string): string {
  return join(projectRoot, '.aweave', 'loaded-skills.yaml');
}

export function getScopePath(scope: Scope): string {
  const parts = [scope.workspace];
  if (scope.domain) parts.push(scope.domain);
  if (scope.repository) parts.push(scope.repository);
  return parts.join('/');
}
