import { resolveScope } from '../shared/scope';
import { getDefaults } from './defaults';
import { scanFeatures } from './topics/features';
import { scanResourceTopic } from './topics/resource';
import type {
  GetContextParams,
  GetContextResponse,
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
    response.defaults = await getDefaults(resolved.resourcesDir, projectRoot);
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
    if (topic === 'features') {
      response[topic] = await scanFeatures(ctx);
    } else {
      const result = await scanResourceTopic(topic, ctx);
      if (result.length > 0) response[topic] = result;
    }
  }

  return response;
}
