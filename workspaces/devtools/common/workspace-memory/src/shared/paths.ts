import { join } from 'path';

import { Scope } from '../get-context/types';

export function getResourcesPath(projectRoot: string, scope: Scope): string {
  const parts = [projectRoot, 'resources', 'workspaces', scope.workspace];
  if (scope.domain) parts.push(scope.domain);
  if (scope.repository) parts.push(scope.repository);
  return join(...parts);
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
