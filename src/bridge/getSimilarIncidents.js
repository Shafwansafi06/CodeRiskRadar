import Resolver from '@forge/resolver';
import { HistorianAgent } from '../rovo/historianAgent';

const resolver = new Resolver();

/**
 * Get similar historical incidents
 */
resolver.define('getSimilarIncidents', async (req) => {
  const { payload } = req;
  
  console.log('getSimilarIncidents invoked');

  try {
    const { embedding, code_diff, top_k = 5 } = payload;
    
    if (!embedding && !code_diff) {
      throw new Error('Must provide either embedding or code_diff');
    }

    const historianAgent = new HistorianAgent();
    
    const result = await historianAgent.query({
      embedding,
      code_diff,
      top_k
    });

    console.log('Similar incidents retrieved:', result.similar_incidents?.length || 0);
    return result;

  } catch (error) {
    console.error('Get similar incidents failed:', error);
    return {
      similar_incidents: [],
      patterns: [],
      recommendations: [],
      error: error.message
    };
  }
});

export const handler = resolver.getDefinitions();
