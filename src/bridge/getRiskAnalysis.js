import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import api, { route } from '@forge/api';
import mlService from '../services/mlService_v3.js';
import teamMetricsService from '../services/teamMetricsService.js';
import geminiService from '../services/geminiService.js';

const resolver = new Resolver();

/**
 * MAIN RISK ANALYSIS HANDLER
 */
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
      files: prDetails.files || []
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
      prId: prInfo.prId,
      prTitle: prDetails.title,
      risk_score: riskAnalysis.risk_score,
      confidence: riskAnalysis.confidence || 0.85,
      filesChanged: filesChanged.slice(0, 10).map(f => ({
        filename: f.path || f.filename || 'unknown',
        changes: (f.lines_added || 0) + (f.lines_removed || 0),
        additions: f.lines_added || 0,
        deletions: f.lines_removed || 0,
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
      // Map ML factors to UI-friendly format
      risk_factors: [
        {
          name: 'Code Size',
          value: Math.round(Math.min((riskAnalysis.factors?.size_vs_benchmark || 1) * 20, 100)),
          description: riskAnalysis.factors?.size_vs_benchmark > 1.5 ? 'Large change' : 'Moderate size'
        },
        {
          name: 'File Complexity',
          value: Math.round(Math.min((riskAnalysis.factors?.files_vs_benchmark || 1) * 20, 100)),
          description: riskAnalysis.factors?.files_vs_benchmark > 1.5 ? 'Wide scope' : 'Focused changes'
        },
        {
          name: 'Documentation',
          value: Math.round(100 - (Math.min(riskAnalysis.factors?.title_quality || 1, 1) * 100)),
          description: riskAnalysis.factors?.title_quality < 0.5 ? 'Poorly documented' : 'Good context'
        }
      ],
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
      ml_analysis: riskAnalysis, // Full ML data
      timestamp: new Date().toISOString(),
      version: '2.1-id-fix',
    };

    console.log('✨ Analysis Complete!');
    console.log('📊 Final Risk Score:', result.risk_score);
    console.log('📁 Files Changed:', result.filesChanged.map(f => `${f.filename} (${f.changes} changes, risk: ${f.risk_score})`));

    // Record metrics for team dashboard
    await teamMetricsService.recordPRMetric(
      {
        prId: prInfo.prId,
        title: prDetails.title,
        author: prDetails.author,
        filesChanged: filesChanged.map(f => f.path || f.filename),
        additions: prDetails.additions,
        deletions: prDetails.deletions
      },
      {
        risk_score: Math.round(riskAnalysis.risk_score * 100)
      }
    );

    return result;

  } catch (error) {
    console.error('❌ Error in getRiskAnalysis:', error);
    console.error('Stack:', error.stack);
    return getDefaultResponse('Error analyzing PR: ' + error.message);
  }
});


/**
 * GEMINI AI REMEDIATION HANDLER
 */
resolver.define('getAIRemediation', async (req) => {
  const { payload } = req;
  const { prData, riskAnalysis, forceRefresh } = payload;

  console.log('🔧 AI Remediation requested for PR:', prData.prId || prData.id);

  try {
    // Content-aware cache key
    const contentHash = `${prData.additions || 0}_${prData.deletions || 0}`;
    const cacheKey = `ai_remediation_v3_${prData.prId || prData.id}_${contentHash}`;

    if (!forceRefresh) {
      const cached = await storage.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        console.log('✅ Returning cached AI suggestions');
        return cached.data;
      }
    } else {
      console.log('🔄 Force refresh requested - bypassing cache');
    }

    // Generate fresh suggestions
    const result = await geminiService.generateRemediations(prData, riskAnalysis);

    // Cache ONLY if successful
    if (result.success) {
      await storage.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
    }

    return result;

  } catch (error) {
    console.error('❌ Error generating AI remediation:', error);
    return {
      success: false,
      error: error.message,
      suggestions: []
    };
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
 */
async function fetchBitbucketPR(prInfo) {
  try {
    console.log('🔍 Fetching PR details using UUIDs...');

    const workspaceUuidWithBraces = `{${prInfo.workspaceUuid}}`;
    const repoUuidWithBraces = `{${prInfo.repoUuid}}`;

    const prUrl = route`/2.0/repositories/${workspaceUuidWithBraces}/${repoUuidWithBraces}/pullrequests/${prInfo.prId}`;
    const diffstatUrl = route`/2.0/repositories/${workspaceUuidWithBraces}/${repoUuidWithBraces}/pullrequests/${prInfo.prId}/diffstat`;

    // Use asApp() for app-level authentication
    const prResponse = await api.asApp().requestBitbucket(prUrl);

    if (prResponse.status !== 200) {
      const error = await prResponse.text();
      console.error('PR fetch failed:', prResponse.status, error);
      return null;
    }

    const prData = await prResponse.json();

    // Fetch diffstat for file changes
    let files = [];
    let additions = 0;
    let deletions = 0;

    try {
      console.log('🔍 Fetching diffstat...');
      const diffResponse = await api.asApp().requestBitbucket(diffstatUrl);

      if (diffResponse.status === 200) {
        const diffData = await diffResponse.json();
        files = (diffData.values || []).map(f => ({
          ...f,
          path: f.new?.path || f.old?.path || 'unknown'
        }));

        files.forEach(f => {
          additions += f.lines_added || 0;
          deletions += f.lines_removed || 0;
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
