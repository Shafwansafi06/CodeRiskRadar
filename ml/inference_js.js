/**
 * JavaScript Inference for Code Risk Radar
 * Lightweight implementation for Atlassian Forge Functions
 * 
 * This is a pure JS port of the Python model using exported coefficients.
 * No external ML libraries required!
 */

// Load model coefficients (exported from Python training)
// In production, load this from Forge storage or bundle with app
const MODEL_COEFFICIENTS = null; // Will be loaded from model_coefficients.json

class JSRiskPredictor {
  constructor(coefficients) {
    this.intercept = coefficients.intercept;
    this.coefficients = coefficients.coefficients;
    this.scalerMean = coefficients.scaler_mean;
    this.scalerScale = coefficients.scaler_scale;
    this.featureNames = Object.keys(this.coefficients);
  }

  /**
   * Predict risk score for a PR
   * @param {Object} prPayload - Bitbucket PR payload
   * @returns {Object} Risk prediction with explanations
   */
  predict(prPayload) {
    // Extract features (same logic as Python)
    const features = this.extractFeatures(prPayload);
    const axisScores = this.extractAxisScores(features);
    
    // Scale features
    const scaledFeatures = this.scaleFeatures(features);
    
    // Linear model prediction: risk_score = intercept + sum(coef * feature)
    let riskScore = this.intercept;
    const contributions = {};
    
    for (const [featureName, scaledValue] of Object.entries(scaledFeatures)) {
      const coef = this.coefficients[featureName];
      const contribution = coef * scaledValue;
      riskScore += contribution;
      contributions[featureName] = {
        value: features[featureName],
        scaledValue: scaledValue,
        coefficient: coef,
        contribution: contribution
      };
    }
    
    // Clip to valid range
    riskScore = Math.max(0, Math.min(100, riskScore));
    
    // Determine risk level
    let riskLevel;
    if (riskScore < 30) riskLevel = 'low';
    else if (riskScore < 70) riskLevel = 'medium';
    else riskLevel = 'high';
    
    // Get top contributing features
    const topFeatures = this.getTopFeatures(contributions, 5);
    
    // Estimate confidence
    const confidence = this.estimateConfidence(riskScore);
    
    return {
      risk_score: Math.round(riskScore * 10) / 10,
      risk_level: riskLevel,
      axis_scores: this.roundAxisScores(axisScores),
      top_features: topFeatures,
      confidence: Math.round(confidence * 100) / 100,
      metadata: {
        model_type: 'ridge_regression_js',
        n_features: this.featureNames.length,
        pr_id: prPayload.pullrequest?.id
      }
    };
  }

  /**
   * Scale features using stored mean and scale
   */
  scaleFeatures(features) {
    const scaled = {};
    for (const [name, value] of Object.entries(features)) {
      const mean = this.scalerMean[name];
      const scale = this.scalerScale[name];
      scaled[name] = (value - mean) / scale;
    }
    return scaled;
  }

  /**
   * Get top N contributing features sorted by absolute contribution
   */
  getTopFeatures(contributions, topN = 5) {
    const sorted = Object.entries(contributions)
      .map(([feature, data]) => ({
        feature,
        value: data.value,
        contribution: data.contribution,
        impact: data.contribution > 0 ? 'increases risk' : 'decreases risk'
      }))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    
    return sorted.slice(0, topN);
  }

  /**
   * Estimate prediction confidence
   */
  estimateConfidence(riskScore) {
    if (riskScore >= 30 && riskScore <= 70) return 0.7; // Boundary region
    if (riskScore < 10 || riskScore > 90) return 0.95; // Extreme values
    return 0.85;
  }

  /**
   * Round axis scores to 1 decimal
   */
  roundAxisScores(scores) {
    const rounded = {};
    for (const [axis, score] of Object.entries(scores)) {
      rounded[axis] = Math.round(score * 10) / 10;
    }
    return rounded;
  }

  // ============================================================
  // FEATURE EXTRACTION (Same logic as Python feature_extractor.py)
  // ============================================================

  extractFeatures(prPayload) {
    const pr = prPayload.pullrequest || {};
    const diffStats = prPayload.diff_stats || {};
    const commits = prPayload.commit_history || [];
    const diffText = prPayload.diff_text || '';
    
    return {
      // Complexity features
      ...this.extractComplexityFeatures(diffStats, diffText),
      // Bug probability features
      ...this.extractBugProbabilityFeatures(pr, diffText, commits),
      // Security features
      ...this.extractSecurityFeatures(diffStats, diffText),
      // Coupling features
      ...this.extractCouplingFeatures(diffStats, diffText),
      // Volatility features
      ...this.extractVolatilityFeatures(pr, commits),
      // Change surface features
      ...this.extractChangeSurfaceFeatures(pr, diffText)
    };
  }

  extractComplexityFeatures(diffStats, diffText) {
    const filesChanged = (diffStats.files || []).length;
    const linesAdded = diffStats.lines_added || 0;
    const linesDeleted = diffStats.lines_deleted || 0;
    const totalLines = linesAdded + linesDeleted;
    
    const complexityKeywords = (diffText.match(/\b(if|else|elif|for|while|switch|case|catch|&&|\|\|)\b/gi) || []).length;
    
    const addedLines = diffText.split('\n').filter(l => l.startsWith('+'));
    const maxIndent = Math.max(...addedLines.map(l => {
      const trimmed = l.trimStart();
      return trimmed ? (l.length - trimmed.length) : 0;
    }), 0);
    
    return {
      complexity_files_changed: filesChanged,
      complexity_lines_added: linesAdded,
      complexity_lines_deleted: linesDeleted,
      complexity_total_lines: totalLines,
      complexity_churn_ratio: linesDeleted / Math.max(linesAdded, 1),
      complexity_keywords_count: complexityKeywords,
      complexity_max_indent: maxIndent / 4,
      complexity_avg_lines_per_file: totalLines / Math.max(filesChanged, 1)
    };
  }

  extractBugProbabilityFeatures(pr, diffText, commits) {
    const combined = ((pr.title || '') + ' ' + (pr.description || '')).toLowerCase();
    const bugKeywords = ['fix', 'bug', 'issue', 'error', 'crash', 'fail'];
    const bugMentions = bugKeywords.filter(kw => combined.includes(kw)).length;
    
    const testFiles = diffText.split('\n').filter(l =>
      l.toLowerCase().includes('test') && (l.startsWith('+++') || l.startsWith('---'))
    ).length;
    
    const nullChecks = (diffText.match(/(!=|==)\s*(null|undefined|None)/g) || []).length;
    const exceptionHandling = (diffText.match(/\b(try|catch|except|raise|throw)\b/g) || []).length;
    const longMethods = (diffText.match(/^\+.*function.*\{[\s\S]{500,}?\}/gm) || []).length;
    
    return {
      bug_fix_keywords: bugMentions,
      bug_test_files_changed: testFiles,
      bug_null_checks: nullChecks,
      bug_exception_handling: exceptionHandling,
      bug_long_methods: longMethods,
      bug_commit_count: commits.length,
      bug_has_tests: testFiles > 0 ? 1.0 : 0.0
    };
  }

  extractSecurityFeatures(diffStats, diffText) {
    const files = diffStats.files || [];
    const sensitivePatterns = /auth|login|password|secret|token|key|credential/i;
    const sensitiveFiles = files.filter(f => sensitivePatterns.test(f)).length;
    
    const riskyExtensions = ['.sql', '.sh', '.bat', '.ps1', '.yaml', '.yml'];
    const riskyFiles = files.filter(f => riskyExtensions.some(ext => f.endsWith(ext))).length;
    
    const sqlInjection = (diffText.match(/execute\s*\(.*?\+/gi) || []).length;
    const hardcodedSecrets = (diffText.match(/(password|secret|api[_-]?key)\s*=\s*["\'][^"\']+["\']/gi) || []).length;
    const evalUsage = (diffText.match(/\beval\s*\(/g) || []).length;
    const authChanges = (diffText.match(/\b(auth|login|permission|role|access)\b/gi) || []).length;
    const cryptoChanges = (diffText.match(/\b(encrypt|decrypt|hash|cipher|ssl|tls)\b/gi) || []).length;
    
    return {
      security_sensitive_files: sensitiveFiles,
      security_risky_extensions: riskyFiles,
      security_sql_injection_risk: sqlInjection,
      security_hardcoded_secrets: hardcodedSecrets,
      security_eval_usage: evalUsage,
      security_auth_changes: authChanges,
      security_crypto_changes: cryptoChanges
    };
  }

  extractCouplingFeatures(diffStats, diffText) {
    const files = diffStats.files || [];
    const uniqueDirs = new Set(files.filter(f => f.includes('/')).map(f => f.split('/')[0])).size;
    
    const importChanges = (diffText.match(/^[+\-]\s*(import|from|require|include)/gm) || []).length;
    const depFiles = files.filter(f =>
      ['package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'go.mod'].some(dep => f.includes(dep))
    ).length;
    
    const interfaceChanges = (diffText.match(/\b(interface|abstract|protocol|trait)\b/g) || []).length;
    const publicMethodChanges = (diffText.match(/^[+\-].*\b(public|export)\s+.*function/gm) || []).length;
    
    return {
      coupling_unique_dirs: uniqueDirs,
      coupling_import_changes: importChanges,
      coupling_dep_files: depFiles,
      coupling_interface_changes: interfaceChanges,
      coupling_public_method_changes: publicMethodChanges,
      coupling_cross_module_ratio: uniqueDirs / Math.max(files.length, 1)
    };
  }

  extractVolatilityFeatures(pr, commits) {
    let reviewTimeHours = 0;
    try {
      const created = new Date(pr.created_on);
      const updated = new Date(pr.updated_on);
      reviewTimeHours = (updated - created) / (1000 * 60 * 60);
    } catch (e) {
      // Ignore date parsing errors
    }
    
    // Simplified author experience (would use real data in production)
    const authorName = pr.author?.display_name || 'unknown';
    const authorHash = this.simpleHash(authorName);
    const authorExperience = (authorHash % 10) + 1;
    
    const commitCount = commits.length;
    const prSizeScore = Math.min(commitCount / 10.0, 5.0);
    
    return {
      volatility_commit_count: commitCount,
      volatility_review_time_hours: reviewTimeHours,
      volatility_author_experience: authorExperience,
      volatility_pr_size_score: prSizeScore,
      volatility_is_rush_job: reviewTimeHours < 2 ? 1.0 : 0.0
    };
  }

  extractChangeSurfaceFeatures(pr, diffText) {
    const breakingPatterns = /BREAKING\s*CHANGE|deprecated|removed.*function|changed.*signature/gi;
    const breakingMentions = (pr.description || '').match(breakingPatterns)?.length || 0;
    
    const publicChanges = (diffText.match(/\b(public|export|exposed|api)\b/gi) || []).length;
    const removals = (diffText.match(/^-\s*(function|class|def|interface)/gm) || []).length;
    const majorVersionBump = (diffText.match(/["\'].*?:.*?["\']\s*["\'](\d+)\.0\.0["\']/g) || []).length;
    const docChanges = (diffText.match(/(readme|docs?\/)/gi) || []).length;
    
    return {
      surface_breaking_mentions: breakingMentions,
      surface_public_changes: publicChanges,
      surface_removals: removals,
      surface_major_version_bump: majorVersionBump,
      surface_doc_changes: docChanges,
      surface_has_breaking: breakingMentions > 0 ? 1.0 : 0.0
    };
  }

  extractAxisScores(features) {
    // Simplified axis score calculation (same logic as Python)
    const axisWeights = {
      complexity: [
        ['complexity_total_lines', 0.3, 500],
        ['complexity_files_changed', 0.25, 20],
        ['complexity_keywords_count', 0.2, 50],
        ['complexity_max_indent', 0.15, 10],
        ['complexity_churn_ratio', 0.1, 2]
      ],
      bug_probability: [
        ['bug_fix_keywords', 0.3, 5],
        ['bug_long_methods', 0.25, 3],
        ['bug_has_tests', -0.2, 1],
        ['bug_exception_handling', 0.15, 10],
        ['bug_commit_count', 0.1, 10]
      ],
      security: [
        ['security_hardcoded_secrets', 0.35, 3],
        ['security_sql_injection_risk', 0.25, 3],
        ['security_eval_usage', 0.2, 2],
        ['security_sensitive_files', 0.15, 5],
        ['security_auth_changes', 0.05, 10]
      ],
      coupling: [
        ['coupling_dep_files', 0.3, 2],
        ['coupling_cross_module_ratio', 0.25, 1],
        ['coupling_import_changes', 0.2, 15],
        ['coupling_public_method_changes', 0.15, 5],
        ['coupling_interface_changes', 0.1, 5]
      ],
      volatility: [
        ['volatility_pr_size_score', 0.3, 5],
        ['volatility_is_rush_job', 0.25, 1],
        ['volatility_author_experience', -0.2, 10],
        ['volatility_commit_count', 0.15, 10],
        ['volatility_review_time_hours', -0.1, 24]
      ],
      change_surface: [
        ['surface_breaking_mentions', 0.35, 2],
        ['surface_removals', 0.25, 5],
        ['surface_public_changes', 0.2, 10],
        ['surface_major_version_bump', 0.15, 2],
        ['surface_has_breaking', 0.05, 1]
      ]
    };
    
    const axisScores = {};
    for (const [axisName, weightedFeatures] of Object.entries(axisWeights)) {
      let score = 0;
      const totalWeight = weightedFeatures.reduce((sum, [, w]) => sum + Math.abs(w), 0);
      
      for (const [featName, weight, normFactor] of weightedFeatures) {
        const featValue = features[featName] || 0;
        const normalized = normFactor > 0 ? Math.min(featValue / normFactor, 1.0) : featValue;
        score += (normalized * weight / totalWeight) * 100;
      }
      
      axisScores[axisName] = Math.max(0, Math.min(100, score));
    }
    
    return axisScores;
  }

  // Simple hash function for author experience
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// ============================================================
// FORGE FUNCTION INTEGRATION
// ============================================================

/**
 * Forge Function handler for risk prediction
 * Usage in src/riskAnalyzer.js:
 * 
 * import { predictRiskJS } from './ml/inference_js';
 * const result = await predictRiskJS(prPayload);
 */
export async function predictRiskJS(prPayload) {
  // Load coefficients from Forge storage or bundle
  // For now, assume they're passed in or loaded from a static file
  const coefficients = await loadModelCoefficients();
  
  const predictor = new JSRiskPredictor(coefficients);
  return predictor.predict(prPayload);
}

/**
 * Load model coefficients from Forge storage or JSON file
 */
async function loadModelCoefficients() {
  // In production, load from Forge storage:
  // const { storage } = await import('@forge/api');
  // return await storage.get('model_coefficients');
  
  // For development, load from JSON file
  try {
    const fs = require('fs');
    const coefficients = JSON.parse(
      fs.readFileSync('./ml/models/model_coefficients.json', 'utf8')
    );
    return coefficients;
  } catch (e) {
    console.error('Failed to load model coefficients:', e);
    throw new Error('Model coefficients not found. Run training first.');
  }
}

// Export for use in other modules
module.exports = { JSRiskPredictor, predictRiskJS };
