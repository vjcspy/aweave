import { join } from 'path';

import { resolveScope } from '../shared/scope';
import { getDefaults } from './defaults';
import { loadScopeOverviewT1, loadTopicOverviewT1 } from './overview';
import { scanFeatures } from './topics/features';
import { scanLearningTopic } from './topics/learning';
import { scanResourceTopic } from './topics/resource';
import type {
  GetContextParams,
  GetContextResponse,
  Scope,
  TopicContext,
} from './types';

export async function getContext(
  projectRoot: string,
  params: GetContextParams,
): Promise<GetContextResponse> {
  const { scope, topics, includeDefaults = true, filters } = params;
  const resolved = resolveScope(projectRoot, scope);
  const response: GetContextResponse = {};

  if (includeDefaults) {
    response.defaults = await getDefaults(resolved.resourcesDir, projectRoot, {
      ladderDirs: buildScopeLadderDirs(projectRoot, scope),
    });
  }

  if (!topics || topics.length === 0) {
    return response;
  }

  const ctx: TopicContext = {
    resourcesDir: resolved.resourcesDir,
    projectRoot,
    filters,
  };

  for (const topic of topics) {
    if (topic === 'overview') {
      response[topic] = {
        overview_t1: loadScopeOverviewT1(resolved.resourcesDir),
        entries: [],
      };
      continue;
    }

    const overview_t1 = loadTopicOverviewT1(
      topic,
      resolved.resourcesDir,
      projectRoot,
    );

    if (topic === 'features') {
      response[topic] = {
        overview_t1,
        entries: await scanFeatures(ctx),
      };
    } else if (topic === 'decisions' || topic === 'lessons') {
      response[topic] = {
        overview_t1,
        entries: await scanLearningTopic(topic, ctx),
      };
    } else {
      response[topic] = {
        overview_t1,
        entries: await scanResourceTopic(topic, ctx),
      };
    }
  }

  return response;
}

function buildScopeLadderDirs(projectRoot: string, scope: Scope): string[] {
  const baseWorkspaceDir = join(
    projectRoot,
    'resources',
    'workspaces',
    scope.workspace,
  );

  if (!scope.domain) return [baseWorkspaceDir];
  const domainDir = join(baseWorkspaceDir, scope.domain);

  if (!scope.repository) return [baseWorkspaceDir, domainDir];

  return [baseWorkspaceDir, domainDir, join(domainDir, scope.repository)];
}
