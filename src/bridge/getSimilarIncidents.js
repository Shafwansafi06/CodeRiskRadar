import Resolver from '@forge/resolver';
import mlService from '../services/mlService_v3.js';

const { findSimilarPRs } = mlService;

const resolver = new Resolver();

/**
 * Get similar historical incidents using ML service
 */
resolver.define('getSimilarIncidents', async (req) => {
  const { payload } = req;
  
  console.log('getSimilarIncidents invoked');

  try {
    const { title, body, code_diff, top_k = 5 } = payload;
    
    if (!title && !body && !code_diff) {
      throw new Error('Must provide title, body, or code_diff');
    }

    const prText = `${title || ''} ${body || ''} ${code_diff || ''}`;
    const similarPRs = await findSimilarPRs(prText, top_k);
    
    console.log('Similar incidents retrieved:', similarPRs.length);
    return {
      similar_incidents: similarPRs,
      total_found: similarPRs.length
    };

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
