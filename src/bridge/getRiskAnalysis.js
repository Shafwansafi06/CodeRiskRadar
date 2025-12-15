import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import mlService from '../services/mlService_v3.js';

const resolver = new Resolver();

resolver.define('getRiskAnalysis', async (req) => {
  const { context } = req;
  
  console.log('=== Risk Analysis Started ===');
  console.log('Context:', JSON.stringify(context, null, 2));

  try {
    // Extract Bitbucket PR information
    const prInfo = extractBitbucketPR(context);
    
    if (!prInfo) {
      console.error('❌ Could not extract PR info from context');
      return getDefaultResponse('Unable to extract PR information');
    }

    console.log('✅ PR Info:', prInfo);

    // CACHE DISABLED FOR TESTING - ALWAYS FETCH FRESH DATA
    const cacheKey = `risk_v2_${prInfo.workspace}_${prInfo.repo}_${prInfo.prId}`;
    // const cached = await storage.get(cacheKey);
    // if (cached && (Date.now() - cached.timestamp < 300000)) {
    //   console.log('📦 Returning cached data');
    //   return cached.data;
    // }

    console.log('🔄 Fetching fresh data (cache disabled)...');
    
    // Fetch PR details from Bitbucket API
    const prDetails = await fetchBitbucketPR(prInfo);
    
    if (!prDetails) {
      console.error('❌ Could not fetch PR from Bitbucket');
      return getDefaultResponse('Unable to fetch PR details');
    }

    console.log('✅ PR Details:', {
      title: prDetails.title,
      additions: prDetails.additions,
      deletions: prDetails.deletions,
      files: prDetails.changed_files,
      fileList: prDetails.files.map(f => f.path).join(', ')
    });

    // Calculate REAL risk score using ML with cosine similarity
    console.log('🔬 Calculating ML risk score with cosine similarity:', {
      additions: prDetails.additions,
      deletions: prDetails.deletions,
      changed_files: prDetails.changed_files,
      title: prDetails.title
    });
    
    const prData = {
      id: `bitbucket-${prInfo.prId}`,
      title: prDetails.title,
      body: prDetails.description || '',
      additions: prDetails.additions,
      deletions: prDetails.deletions,
      changed_files: prDetails.changed_files,
    };
    
    // Use new ML service with vector embeddings
    const riskAnalysis = await mlService.calculateMLRiskScore(prData);
    
    console.log('✅ ML Risk Analysis:', {
      score: riskAnalysis.risk_score,
      model: riskAnalysis.ml_model,
      data_source: riskAnalysis.data_source
    });

    // Get file risks
    let filesChanged = prDetails.files || [];
    
    // Get PR improvement suggestions using ML
    const suggestions = await mlService.getPRImprovementSuggestions(prData);
    
    console.log('💡 Generated', suggestions.length, 'improvement suggestions');

    // Find similar PRs using cosine similarity
    const prText = `${prDetails.title} ${prDetails.description || ''}`;
    const similarPRs = await mlService.findSimilarPRs(prText, 5);
    
    console.log('🔍 Found', similarPRs.length, 'similar PRs');

    const result = {
      prTitle: prDetails.title,
      risk_score: riskAnalysis.risk_score,
      confidence: riskAnalysis.confidence || 0.85,
      filesChanged: filesChanged.slice(0, 10).map(f => ({
        filename: f.path || f.filename || 'unknown',
        changes: f.lines_added + f.lines_removed,
        additions: f.lines_added,
        deletions: f.lines_removed,
        risk_score: calculateFileRisk(f),
      })),
      stats: {
        additions: prDetails.additions,
        deletions: prDetails.deletions,
        changedFiles: prDetails.changed_files,
      },
      suggestions: suggestions.map(s => ({
        title: s.category,
        description: s.suggestion,
        severity: s.severity,
        current: s.current,
        reference: s.reference
      })),
      factors: riskAnalysis.factors,
      similarIncidents: similarPRs.slice(0, 5).map(pr => ({
        id: pr.doc_id || pr.id,
        title: pr.title || 'Similar PR',
        similarity: Math.round((pr.similarity || 0) * 100),
        organization: (pr.doc_id || '').split('/')[0],
        metrics: {
          additions: pr.additions,
          deletions: pr.deletions,
          changed_files: pr.changed_files
        }
      })),
      dataSource: riskAnalysis.data_source || 'bitbucket_ml_cosine_similarity',
      mlModel: riskAnalysis.ml_model,
      mlStats: riskAnalysis.similar_prs || [],
      timestamp: new Date().toISOString(),
      version: '2.0-fresh-data',
    };

    // Cache result (disabled for testing)
    // await storage.set(cacheKey, {
    //   data: result,
    //   timestamp: Date.now(),
    // });

    console.log('✨ Analysis Complete!');
    console.log('📊 Final Risk Score:', result.risk_score);
    console.log('📁 Files Changed:', result.filesChanged.map(f => `${f.filename} (${f.changes} changes, risk: ${f.risk_score})`));
    
    return result;

  } catch (error) {
    console.error('❌ Error in getRiskAnalysis:', error);
    console.error('Stack:', error.stack);
    return getDefaultResponse('Error analyzing PR: ' + error.message);
  }
});

/**
 * Extract Bitbucket PR info from context
 */
function extractBitbucketPR(context) {
  try {
    if (!context.extension) {
      console.error('No extension context');
      return null;
    }

    const { pullRequest, repository } = context.extension;
    const installContext = context.installContext;
    
    if (!pullRequest || !repository || !installContext) {
      console.error('Missing PR, repo, or installContext');
      return null;
    }

    // Parse installContext: "ari:cloud:bitbucket::workspace/d98a2145-0d05-4089-b50c-dce5e0bed43e"
    // This gives us the workspace UUID
    const workspaceMatch = installContext.match(/workspace\/([^\/]+)/);
    const workspaceUuid = workspaceMatch ? workspaceMatch[1] : null;
    
    const repoUuid = repository.uuid.replace(/[{}]/g, '');

    console.log('📍 Extracted info:', {
      prId: pullRequest.id,
      workspaceUuid,
      repoUuid,
      installContext
    });

    if (!workspaceUuid) {
      console.error('Could not extract workspace UUID from installContext');
      return null;
    }

    return {
      prId: pullRequest.id,
      workspaceUuid,
      repoUuid,
    };
  } catch (error) {
    console.error('Error extracting PR context:', error);
    return null;
  }
}

/**
 * Fetch PR details from Bitbucket API using Forge
 * Uses UUIDs directly as per Bitbucket Forge API documentation
 */
async function fetchBitbucketPR(prInfo) {
  try {
    console.log('🔍 Fetching PR details using UUIDs...');
    console.log('PR Info:', {
      workspaceUuid: prInfo.workspaceUuid,
      repoUuid: prInfo.repoUuid,
      prId: prInfo.prId
    });
    
    // Use UUIDs directly in the API path as per Bitbucket documentation
    // Format: /2.0/repositories/{workspace_uuid}/{repo_uuid}/pullrequests/{pr_id}
    // UUIDs must include curly braces
    const workspaceUuidWithBraces = `{${prInfo.workspaceUuid}}`;
    const repoUuidWithBraces = `{${prInfo.repoUuid}}`;
    
    const prUrl = route`/2.0/repositories/${workspaceUuidWithBraces}/${repoUuidWithBraces}/pullrequests/${prInfo.prId}`;
    const diffstatUrl = route`/2.0/repositories/${workspaceUuidWithBraces}/${repoUuidWithBraces}/pullrequests/${prInfo.prId}/diffstat`;
    
    console.log('🔍 Fetching PR with UUIDs:', {
      workspace: workspaceUuidWithBraces,
      repo: repoUuidWithBraces,
      pr: prInfo.prId
    });
    
    // Use asApp() for app-level authentication
    const prResponse = await api.asApp().requestBitbucket(prUrl);
    
    if (prResponse.status !== 200) {
      const error = await prResponse.text();
      console.error('PR fetch failed:', prResponse.status, error);
      return null;
    }
    
    const prData = await prResponse.json();
    console.log('✅ PR fetched successfully:', {
      title: prData.title,
      state: prData.state,
      author: prData.author?.display_name
    });
    
    // Fetch diffstat for file changes
    let files = [];
    let additions = 0;
    let deletions = 0;
    
    try {
      console.log('🔍 Fetching diffstat...');
      const diffResponse = await api.asApp().requestBitbucket(diffstatUrl);
      
      if (diffResponse.status === 200) {
        const diffData = await diffResponse.json();
        files = diffData.values || [];
        
        // Calculate totals
        files.forEach(f => {
          additions += f.lines_added || 0;
          deletions += f.lines_removed || 0;
        });
        
        console.log('✅ Diffstat fetched successfully:', {
          filesCount: files.length,
          additions,
          deletions,
          files: files.map(f => f.path || f.filename).join(', ')
        });
      } else {
        const error = await diffResponse.text();
        console.error('Diffstat fetch failed:', diffResponse.status, error);
      }
    } catch (diffError) {
      console.error('Error fetching diffstat:', diffError);
    }

    return {
      title: prData.title,
      description: prData.description || '',
      additions: additions,
      deletions: deletions,
      changed_files: files.length,
      files: files,
      author: prData.author?.display_name || 'Unknown',
      state: prData.state,
    };
    
  } catch (error) {
    console.error('Error fetching Bitbucket PR:', error);
    return null;
  }
}

/**
 * Calculate file-level risk
 */
function calculateFileRisk(file) {
  const totalChanges = (file.lines_added || 0) + (file.lines_removed || 0);
  const changeScore = Math.min(totalChanges / 100, 1);
  
  const path = file.path || file.filename || '';
  const criticalPatterns = ['auth', 'security', 'password', 'token', 'api', 'config', 'database', 'payment'];
  const isCritical = criticalPatterns.some(p => path.toLowerCase().includes(p));
  
  // README, docs, and test files are low risk
  if (path.match(/readme|\.md$|\.txt$|docs?\//i)) {
    return Math.min(changeScore * 0.2, 0.3);
  }
  
  if (path.match(/test|spec|__tests__/i)) {
    return Math.min(changeScore * 0.4, 0.5);
  }
  
  return Math.min(changeScore * (isCritical ? 1.2 : 0.8), 1);
}

/**
 * Default response when something goes wrong
 */
function getDefaultResponse(message) {
  return {
    prTitle: 'PR Analysis',
    risk_score: 0.3,
    confidence: 0.1,
    filesChanged: [],
    stats: {
      additions: 0,
      deletions: 0,
      changedFiles: 0,
    },
    suggestions: [{
      title: 'Unable to analyze',
      description: message,
      impact: 0,
      priority: 'low',
    }],
    factors: {
      complexity: 0.3,
      changeSize: 0.3,
      fileRisk: 0.3,
      historical: 0.3,
    },
    similarIncidents: [],
    dataSource: 'error_fallback',
    timestamp: new Date().toISOString(),
  };
}

export const handler = resolver.getDefinitions();
