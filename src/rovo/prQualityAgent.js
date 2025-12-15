/**
 * Rovo Agent: PR Quality Improver
 * AI agent that analyzes PRs and provides actionable improvement suggestions
 * Based on similarity to high-quality PRs from top companies
 */

import api from '@forge/api';
import Resolver from '@forge/resolver';
import mlService from '../services/mlService_v3.js';

const { calculateMLRiskScore, findSimilarPRs, getPRImprovementSuggestions } = mlService;

const resolver = new Resolver();

resolver.define('improvePRQuality', async (req) => {
  const { context, payload } = req;
  const { action, prData } = payload || {};
  
  console.log('🤖 PR Quality Agent activated');
  console.log('Action:', action);
  
  try {
    // Action 1: Analyze PR and provide overall assessment
    if (action === 'analyze') {
      return await analyzePR(prData);
    }
    
    // Action 2: Find similar high-quality PRs
    if (action === 'find_similar') {
      return await findSimilarQualityPRs(prData);
    }
    
    // Action 3: Generate improvement plan
    if (action === 'improve') {
      return await generateImprovementPlan(prData);
    }
    
    // Action 4: Compare with best practices
    if (action === 'compare') {
      return await compareWithBestPractices(prData);
    }
    
    // Default: Comprehensive analysis
    return await comprehensiveAnalysis(prData);
    
  } catch (error) {
    console.error('PR Quality Agent error:', error);
    return {
      success: false,
      message: 'Failed to analyze PR quality',
      error: error.message
    };
  }
});

/**
 * Analyze PR and provide risk assessment
 */
async function analyzePR(prData) {
  const { title, body, additions, deletions, changed_files } = prData;
  
  // Calculate ML risk score
  const riskAnalysis = await calculateMLRiskScore(prData);
  
  // Get improvement suggestions
  const suggestions = await getPRImprovementSuggestions(prData);
  
  const riskLevel = riskAnalysis.risk_score < 0.4 ? 'LOW' : 
                     riskAnalysis.risk_score < 0.7 ? 'MEDIUM' : 'HIGH';
  
  return {
    agent: 'PR Quality Improver',
    action: 'analyze',
    result: {
      risk_level: riskLevel,
      risk_score: Math.round(riskAnalysis.risk_score * 100),
      summary: generateSummary(riskAnalysis, suggestions),
      factors: riskAnalysis.factors,
      suggestions: suggestions.slice(0, 5),
      similar_quality_prs: riskAnalysis.similar_prs || []
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Find similar high-quality PRs for reference
 */
async function findSimilarQualityPRs(prData) {
  const { title, body } = prData;
  const prText = `${title || ''} ${body || ''}`;
  
  // Find similar PRs
  const similarPRs = await findSimilarPRs(prText, 10);
  
  // Filter for high quality
  const highQuality = similarPRs.filter(pr => 
    pr.additions + pr.deletions < 1000 &&
    pr.changed_files < 20 &&
    pr.title && pr.title.length > 20
  );
  
  return {
    agent: 'PR Quality Improver',
    action: 'find_similar',
    result: {
      total_found: similarPRs.length,
      high_quality_count: highQuality.length,
      recommendations: highQuality.slice(0, 5).map(pr => ({
        title: pr.title,
        organization: pr.doc_id.split('/')[0],
        similarity: Math.round(pr.similarity * 100),
        metrics: {
          additions: pr.additions,
          deletions: pr.deletions,
          changed_files: pr.changed_files
        },
        why_good: generateQualityReason(pr)
      }))
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate actionable improvement plan
 */
async function generateImprovementPlan(prData) {
  const suggestions = await getPRImprovementSuggestions(prData);
  
  // Group by severity
  const critical = suggestions.filter(s => s.severity === 'high');
  const important = suggestions.filter(s => s.severity === 'medium');
  const recommended = suggestions.filter(s => s.severity === 'info');
  
  // Create action plan
  const actionPlan = [];
  
  if (critical.length > 0) {
    actionPlan.push({
      priority: 'CRITICAL',
      items: critical.map(s => ({
        task: s.suggestion,
        category: s.category,
        impact: 'High - Must fix before merge'
      }))
    });
  }
  
  if (important.length > 0) {
    actionPlan.push({
      priority: 'IMPORTANT',
      items: important.map(s => ({
        task: s.suggestion,
        category: s.category,
        impact: 'Medium - Strongly recommended'
      }))
    });
  }
  
  if (recommended.length > 0) {
    actionPlan.push({
      priority: 'RECOMMENDED',
      items: recommended.map(s => ({
        task: s.suggestion,
        category: s.category,
        impact: 'Low - Nice to have'
      }))
    });
  }
  
  return {
    agent: 'PR Quality Improver',
    action: 'improve',
    result: {
      total_improvements: suggestions.length,
      action_plan: actionPlan,
      estimated_impact: calculateEstimatedImpact(critical, important),
      next_steps: generateNextSteps(critical, important)
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Compare with best practices from top companies
 */
async function compareWithBestPractices(prData) {
  const { title, body, additions, deletions, changed_files } = prData;
  const prText = `${title || ''} ${body || ''}`;
  
  // Find similar PRs from top companies
  const similarPRs = await findSimilarPRs(prText, 20);
  
  // Group by organization
  const byOrg = {};
  similarPRs.forEach(pr => {
    const org = pr.doc_id.split('/')[0];
    if (!byOrg[org]) byOrg[org] = [];
    byOrg[org].push(pr);
  });
  
  // Calculate benchmarks
  const benchmarks = Object.keys(byOrg).map(org => {
    const orgPRs = byOrg[org];
    const avgAdditions = orgPRs.reduce((sum, pr) => sum + pr.additions, 0) / orgPRs.length;
    const avgDeletions = orgPRs.reduce((sum, pr) => sum + pr.deletions, 0) / orgPRs.length;
    const avgFiles = orgPRs.reduce((sum, pr) => sum + pr.changed_files, 0) / orgPRs.length;
    const avgTitleLength = orgPRs.reduce((sum, pr) => sum + (pr.title?.length || 0), 0) / orgPRs.length;
    
    return {
      organization: org,
      sample_size: orgPRs.length,
      averages: {
        additions: Math.round(avgAdditions),
        deletions: Math.round(avgDeletions),
        changed_files: Math.round(avgFiles),
        title_length: Math.round(avgTitleLength)
      },
      comparison: {
        your_size: (additions || 0) + (deletions || 0),
        their_avg_size: Math.round(avgAdditions + avgDeletions),
        size_difference: Math.round(((additions || 0) + (deletions || 0)) - (avgAdditions + avgDeletions)),
        your_files: changed_files || 0,
        their_avg_files: Math.round(avgFiles)
      }
    };
  });
  
  return {
    agent: 'PR Quality Improver',
    action: 'compare',
    result: {
      your_pr: {
        additions: additions || 0,
        deletions: deletions || 0,
        changed_files: changed_files || 0,
        title_length: title?.length || 0,
        has_description: !!(body && body.length > 50)
      },
      industry_benchmarks: benchmarks,
      recommendations: generateBenchmarkRecommendations(prData, benchmarks)
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Comprehensive analysis combining all insights
 */
async function comprehensiveAnalysis(prData) {
  const [analysis, similar, plan, comparison] = await Promise.all([
    analyzePR(prData),
    findSimilarQualityPRs(prData),
    generateImprovementPlan(prData),
    compareWithBestPractices(prData)
  ]);
  
  return {
    agent: 'PR Quality Improver',
    action: 'comprehensive',
    result: {
      risk_assessment: analysis.result,
      similar_prs: similar.result,
      improvement_plan: plan.result,
      industry_comparison: comparison.result,
      overall_score: calculateOverallScore(analysis, similar, plan),
      recommendation: generateFinalRecommendation(analysis, similar, plan)
    },
    timestamp: new Date().toISOString()
  };
}

// Helper functions

function generateSummary(riskAnalysis, suggestions) {
  const criticalCount = suggestions.filter(s => s.severity === 'high').length;
  const riskLevel = riskAnalysis.risk_score < 0.4 ? 'low' : 
                     riskAnalysis.risk_score < 0.7 ? 'medium' : 'high';
  
  if (riskLevel === 'low' && criticalCount === 0) {
    return `✅ Excellent! This PR follows best practices from top companies. Risk is low with ${Math.round(riskAnalysis.risk_score * 100)}% score.`;
  } else if (riskLevel === 'medium' || criticalCount <= 2) {
    return `⚠️ Good PR with room for improvement. ${criticalCount} critical issues found. With adjustments, this can match quality standards from top companies.`;
  } else {
    return `🔴 This PR needs significant improvements. ${criticalCount} critical issues detected. Follow the suggestions below to reach industry-standard quality.`;
  }
}

function generateQualityReason(pr) {
  const reasons = [];
  
  if (pr.additions + pr.deletions < 500) reasons.push('Focused scope');
  if (pr.changed_files < 10) reasons.push('Limited file changes');
  if (pr.title && pr.title.length > 30) reasons.push('Descriptive title');
  if (pr.body && pr.body.length > 200) reasons.push('Detailed description');
  
  return reasons.length > 0 ? reasons.join(', ') : 'Well-structured PR';
}

function calculateEstimatedImpact(critical, important) {
  const criticalImpact = critical.length * 30;
  const importantImpact = important.length * 15;
  const totalImpact = criticalImpact + importantImpact;
  
  return {
    risk_reduction: `${totalImpact}%`,
    merge_confidence: totalImpact > 50 ? 'High increase' : totalImpact > 20 ? 'Moderate increase' : 'Slight increase',
    review_time: totalImpact > 50 ? 'Significantly faster' : totalImpact > 20 ? 'Faster' : 'Slightly faster'
  };
}

function generateNextSteps(critical, important) {
  const steps = [];
  
  if (critical.length > 0) {
    steps.push('1. Address all critical issues first - these are blockers');
  }
  
  if (important.length > 0) {
    steps.push(`${steps.length + 1}. Review important suggestions - these significantly improve quality`);
  }
  
  steps.push(`${steps.length + 1}. Run tests and verify all changes`);
  steps.push(`${steps.length + 1}. Request review from team members`);
  
  return steps;
}

function generateBenchmarkRecommendations(prData, benchmarks) {
  const recommendations = [];
  const totalChanges = (prData.additions || 0) + (prData.deletions || 0);
  
  if (benchmarks.length === 0) {
    return ['No benchmark data available'];
  }
  
  const avgBenchmarkSize = benchmarks.reduce((sum, b) => sum + b.averages.additions + b.averages.deletions, 0) / benchmarks.length;
  
  if (totalChanges > avgBenchmarkSize * 1.5) {
    recommendations.push(`Your PR is ${Math.round((totalChanges / avgBenchmarkSize - 1) * 100)}% larger than industry average. Consider splitting into smaller PRs.`);
  }
  
  const avgBenchmarkFiles = benchmarks.reduce((sum, b) => sum + b.averages.changed_files, 0) / benchmarks.length;
  
  if ((prData.changed_files || 0) > avgBenchmarkFiles * 1.5) {
    recommendations.push(`You're modifying ${Math.round(((prData.changed_files || 0) / avgBenchmarkFiles - 1) * 100)}% more files than typical. Focus on single responsibility.`);
  }
  
  if (!prData.title || prData.title.length < 20) {
    const avgTitleLength = benchmarks.reduce((sum, b) => sum + b.averages.title_length, 0) / benchmarks.length;
    recommendations.push(`Industry standard title length is ~${Math.round(avgTitleLength)} chars. Make yours more descriptive.`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ Your PR metrics align well with industry standards!');
  }
  
  return recommendations;
}

function calculateOverallScore(analysis, similar, plan) {
  const riskScore = 100 - analysis.result.risk_score;
  const similarityScore = similar.result.high_quality_count > 0 ? 80 : 50;
  const improvementScore = Math.max(0, 100 - (plan.result.total_improvements * 15));
  
  const overall = (riskScore * 0.4 + similarityScore * 0.3 + improvementScore * 0.3);
  
  return {
    score: Math.round(overall),
    grade: overall >= 80 ? 'A' : overall >= 60 ? 'B' : overall >= 40 ? 'C' : 'D',
    breakdown: {
      risk: Math.round(riskScore),
      similarity: Math.round(similarityScore),
      improvement_potential: Math.round(improvementScore)
    }
  };
}

function generateFinalRecommendation(analysis, similar, plan) {
  const score = calculateOverallScore(analysis, similar, plan).score;
  
  if (score >= 80) {
    return '🎉 Excellent work! This PR meets high-quality standards. Ready for review.';
  } else if (score >= 60) {
    return '👍 Good PR! Address the key suggestions to reach top-tier quality.';
  } else if (score >= 40) {
    return '⚠️ Needs improvement. Follow the action plan to significantly enhance quality.';
  } else {
    return '🔴 Significant improvements required. Review the comprehensive suggestions carefully.';
  }
}

export const handler = resolver.getDefinitions();
