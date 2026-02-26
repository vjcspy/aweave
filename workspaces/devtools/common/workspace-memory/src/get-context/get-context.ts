import { resolveScope } from '../shared/scope';
import { getDefaults } from './defaults';
import { getArchitecture } from './topics/architecture';
import { getDecisions } from './topics/decisions';
import { getFeatures } from './topics/features';
import { getLessons } from './topics/lessons';
import { getOverview } from './topics/overview';
import { getPlans } from './topics/plans';
import type { GetContextParams, GetContextResponse } from './types';

export async function getContext(
  projectRoot: string,
  params: GetContextParams,
): Promise<GetContextResponse> {
  const { scope, topics, includeDefaults = true, filters } = params;
  const resolved = resolveScope(projectRoot, scope);
  const response: GetContextResponse = {};

  if (includeDefaults) {
    response.defaults = await getDefaults(
      resolved.resourcesDir,
      projectRoot,
      scope.workspace,
    );
  }

  if (!topics || topics.length === 0) {
    return response;
  }

  for (const topic of topics) {
    switch (topic) {
      case 'plans':
        response.plans = await getPlans(
          resolved.resourcesDir,
          projectRoot,
          filters,
        );
        break;

      case 'features':
        response.features = await getFeatures(
          resolved.resourcesDir,
          projectRoot,
        );
        break;

      case 'architecture':
        response.architecture = await getArchitecture(
          resolved.resourcesDir,
          projectRoot,
        );
        break;

      case 'overview': {
        const overview = getOverview(resolved.resourcesDir);
        if (overview) response.overview = overview;
        break;
      }

      case 'decisions': {
        const decisions = getDecisions(resolved.memoryDir);
        if (decisions) response.decisions = decisions;
        break;
      }

      case 'lessons': {
        const lessons = getLessons(resolved.memoryDir);
        if (lessons) response.lessons = lessons;
        break;
      }
    }
  }

  return response;
}
