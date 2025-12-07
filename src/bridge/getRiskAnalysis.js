import Resolver from '@forge/resolver';
import { RiskAnalystAgent } from '../rovo/riskAgent';
import { HistorianAgent } from '../rovo/historianAgent';
import { storage } from '@forge/api';

const resolver = new Resolver();

/**
 * Get risk analysis for current PR
 * This function is called when the Custom UI loads
 */
resolver.define('getRiskAnalysis', async (req) => {
  const { context } = req;
  
  console.log('getRiskAnalysis invoked with context:', context);

  try {
    // Extract PR context from Bitbucket/GitHub
    const prContext = extractPRContext(context);
    
    if (!prContext.prNumber || !prContext.repository) {
      throw new Error('Invalid PR context - missing PR number or repository');
    }

    console.log('Analyzing PR:', prContext);

    // Check cache first
    const cacheKey = `risk_analysis:${prContext.repository}:${prContext.prNumber}`;
    const cached = await storage.get(cacheKey);
    
    if (cached && isCacheFresh(cached.timestamp)) {
      console.log('Returning cached analysis');
      return cached.data;
    }

    // Fetch PR diff
    const diffContent = await fetchPRDiff(prContext);
    
    if (!diffContent) {
      throw new Error('Failed to fetch PR diff');
    }

    // Analyze with RiskAnalyst agent
    console.log('Invoking RiskAnalyst agent...');
    const riskAgent = new RiskAnalystAgent();
    const riskAnalysis = await riskAgent.analyze({
      code_diff: diffContent,
      file_path: prContext.filePath || 'unknown',
      pr_number: prContext.prNumber,
      repository: prContext.repository
    });

    console.log('Risk analysis complete:', riskAnalysis);

    // Get similar incidents from Historian
    console.log('Querying Historian agent...');
    const historianAgent = new HistorianAgent();
    const historicalContext = await historianAgent.query({
      code_diff: diffContent.substring(0, 5000), // Limit for embedding
      top_k: 3
    });

    console.log('Historical context retrieved');

    // Compile result
    const result = {
      risk_analysis: riskAnalysis,
      historical_context: historicalContext,
      metadata: {
        file_path: prContext.filePath,
        pr_number: prContext.prNumber,
        repository: prContext.repository,
        author: prContext.author,
        branch: prContext.branch,
        diff_url: prContext.diffUrl,
        analyzed_at: new Date().toISOString()
      }
    };

    // Cache result (30 minutes TTL)
    await storage.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;

  } catch (error) {
    console.error('Risk analysis failed:', error);
    return {
      error: error.message,
      risk_analysis: {
        risk_score: 0,
        risk_level: 'unknown',
        explanation: 'Analysis failed: ' + error.message,
        actions: [],
        top_features: []
      },
      historical_context: {
        similar_incidents: [],
        patterns: [],
        recommendations: []
      },
      metadata: {}
    };
  }
});

/**
 * Refresh analysis (clear cache and re-analyze)
 */
resolver.define('refreshAnalysis', async (req) => {
  const { context } = req;
  
  try {
    const prContext = extractPRContext(context);
    const cacheKey = `risk_analysis:${prContext.repository}:${prContext.prNumber}`;
    
    // Clear cache
    await storage.delete(cacheKey);
    
    // Re-run analysis
    return await resolver.resolve('getRiskAnalysis', req);
    
  } catch (error) {
    console.error('Refresh failed:', error);
    throw error;
  }
});

/**
 * Extract PR context from Forge context object
 */
function extractPRContext(context) {
  // Bitbucket context
  if (context.extension?.pullRequest) {
    const pr = context.extension.pullRequest;
    const repo = context.extension.repository;
    
    return {
      prNumber: pr.id,
      repository: repo?.full_name || repo?.name,
      author: pr.author?.username,
      branch: pr.source?.branch?.name,
      filePath: pr.destination?.commit?.hash,
      diffUrl: pr.links?.diff?.href,
      provider: 'bitbucket'
    };
  }
  
  // GitHub context
  if (context.extension?.pull_request) {
    const pr = context.extension.pull_request;
    const repo = context.extension.repository;
    
    return {
      prNumber: pr.number,
      repository: repo?.full_name,
      author: pr.user?.login,
      branch: pr.head?.ref,
      filePath: null,
      diffUrl: pr.diff_url,
      provider: 'github'
    };
  }
  
  return {};
}

/**
 * Fetch PR diff content
 */
async function fetchPRDiff(prContext) {
  if (!prContext.diffUrl) {
    console.warn('No diff URL available, using placeholder');
    return '// Diff content not available';
  }

  try {
    // Use Forge's fetch with authentication
    const { requestBitbucket, requestGitHub } = await import('@forge/api');
    const requestFn = prContext.provider === 'bitbucket' ? requestBitbucket : requestGitHub;
    
    const response = await requestFn(prContext.diffUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.status}`);
    }
    
    return await response.text();
    
  } catch (error) {
    console.error('Error fetching diff:', error);
    return null;
  }
}

/**
 * Check if cached data is still fresh (30 minutes)
 */
function isCacheFresh(timestamp) {
  const TTL = 30 * 60 * 1000; // 30 minutes
  return Date.now() - timestamp < TTL;
}

export const handler = resolver.getDefinitions();
