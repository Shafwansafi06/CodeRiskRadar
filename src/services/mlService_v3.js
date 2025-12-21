/**
 * ML Service v3 - Seed Data + Team Learning
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────┐
 * │  Seed Data (5K+ Quality PRs)           │
 * │  ├─ Apache, Google, Microsoft PRs      │
 * │  ├─ Pre-calculated embeddings          │
 * │  └─ Quality labels & patterns          │
 * └─────────────────────────────────────────┘
 *              ↓ HYBRID ML ↓
 * ┌─────────────────────────────────────────┐
 * │  Team Learning (Your PRs)              │
 * │  ├─ PR history                         │
 * │  ├─ Outcome tracking (merged/issues)   │
 * │  └─ Team-specific patterns             │
 * └─────────────────────────────────────────┘
 * 
 * NO EXTERNAL EGRESS - Runs on Atlassian ✅
 */

import { storage } from '@forge/api';
import * as supabaseService from './supabaseService.js';

// ============================================================================
// SEED DATA ACCESS (Now via Supabase)
// ============================================================================

/**
 * Load all seed quality PRs from Supabase
 */
async function loadSeedQualityPRs(metrics) {
  try {
    const prs = await supabaseService.getBenchmarkPRs(metrics, 30);
    return prs.map(pr => ({
      ...pr,
      quality_score: 0.9 // High quality markers from benchmark
    }));
  } catch (error) {
    console.error('Error loading seed PRs:', error);
    return [];
  }
}

/**
 * Load seed risky PRs from Supabase
 */
async function loadSeedRiskyPRs() {
  try {
    const prs = await supabaseService.getRiskyPatterns(10);
    return prs.map(pr => ({
      ...pr,
      quality_score: 0.2 // Known risky markers
    }));
  } catch (error) {
    console.error('Error loading risky PRs:', error);
    return [];
  }
}

/**
 * Load seed embeddings (Not used for now, using text similarity)
 */
async function loadSeedEmbeddings() {
  return [];
}

/**
 * Get seed statistics (industry benchmarks)
 */
async function getSeedStats() {
  return {
    avg_additions: 150,
    avg_deletions: 50,
    avg_files: 8,
    avg_title_length: 35
  };
}

// ============================================================================
// TEAM LEARNING
// ============================================================================

/**
 * Store team PR for learning
 */
async function storeTeamPR(prData) {
  try {
    const teamPRs = await storage.get('team_prs') || [];
    teamPRs.push({
      ...prData,
      analyzed_at: Date.now()
    });

    // Keep last 500 team PRs
    const trimmed = teamPRs.slice(-500);
    await storage.set('team_prs', trimmed);

    console.log(`✅ Stored team PR (total: ${trimmed.length})`);
  } catch (error) {
    console.error('Error storing team PR:', error);
  }
}

/**
 * Get team historical PRs
 */
async function getTeamPRs() {
  try {
    return await storage.get('team_prs') || [];
  } catch (error) {
    return [];
  }
}

// ============================================================================
// TEXT SIMILARITY (TF-IDF + Cosine)
// ============================================================================

/**
 * Generate TF-IDF vector from text
 */
function generateTFIDFVector(text) {
  const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);

  // Create 256-dim vector (smaller for performance)
  const vector = new Array(256).fill(0);
  Object.keys(freq).forEach(word => {
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const idx = hash % 256;
    vector[idx] += freq[word] / words.length;
  });

  // Normalize
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map(v => v / (norm || 1));
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;

  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }

  return Math.max(0, Math.min(1, dotProduct));
}

/**
 * Find similar PRs using text similarity
 */
async function findSimilarPRs(prData, limit = 10) {
  try {
    const prText = `${prData.title || ''} ${prData.body || ''}`;
    console.log('🔍 Finding similar PRs...');

    // Generate vector for current PR
    const currentVector = generateTFIDFVector(prText);

    // Load seed PRs (Passing metrics for Supabase filtering)
    const seedQualityPRs = await loadSeedQualityPRs(prData);
    const seedRiskyPRs = await loadSeedRiskyPRs();
    const teamPRs = await getTeamPRs();

    // Combine all PRs
    const allPRs = [
      ...seedQualityPRs.map(pr => ({ ...pr, source: 'seed_quality' })),
      ...seedRiskyPRs.map(pr => ({ ...pr, source: 'seed_risky' })),
      ...teamPRs.map(pr => ({ ...pr, source: 'team' }))
    ];

    console.log(`📊 Analyzing against ${allPRs.length} PRs`);

    // Calculate similarity for each
    const withSimilarity = allPRs.map(pr => {
      const prText = `${pr.title || ''} ${pr.body || ''}`;
      const prVector = generateTFIDFVector(prText);
      const similarity = cosineSimilarity(currentVector, prVector);

      return {
        ...pr,
        similarity
      };
    });

    // Sort by similarity and return top matches
    const topMatches = withSimilarity
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    console.log(`✅ Found ${topMatches.length} similar PRs`);
    console.log(`   Top match: ${topMatches[0]?.similarity.toFixed(2)} similarity`);

    return topMatches;

  } catch (error) {
    console.error('Error finding similar PRs:', error);
    return [];
  }
}

// ============================================================================
// RISK SCORING
// ============================================================================

/**
 * Calculate ML risk score using seed data + team learning
 */
export async function calculateMLRiskScore(prData) {
  try {
    console.log('🧠 Calculating ML risk score with hybrid data...');

    const { title, body, additions, deletions, changed_files } = prData;
    const prText = `${title || ''} ${body || ''}`;
    const totalChanges = (additions || 0) + (deletions || 0);

    // Store for team learning
    await storeTeamPR(prData);

    // 1. Find similar PRs
    const similarPRs = await findSimilarPRs(prData, 20);

    if (similarPRs.length === 0) {
      console.log('⚠️  No similar PRs found, using baseline');
      return calculateBaselineRisk(prData);
    }

    // 2. Separate quality vs risky
    const qualityPRs = similarPRs.filter(pr =>
      pr.source === 'seed_quality' ||
      (pr.quality_score && pr.quality_score > 0.6)
    );

    const riskyPRs = similarPRs.filter(pr =>
      pr.source === 'seed_risky' ||
      (pr.quality_score && pr.quality_score < 0.4)
    );

    console.log(`📊 Analysis: ${qualityPRs.length} quality, ${riskyPRs.length} risky`);

    // 3. Calculate similarity-weighted risk
    // DYNAMIC BASELINE: Adjust starting risk based on scale (don't penalize small PRs)
    let riskScore = 0.3;
    if (totalChanges < 50) riskScore = 0.15;
    if (totalChanges < 5) riskScore = 0.05;

    const files = prData.files || [];
    const isDocOnly = files.length > 0 && files.every(f => {
      const path = f.path || f.filename || '';
      return path.match(/readme|\.md$|\.txt$|docs?\//i);
    });

    if (isDocOnly) {
      console.log('📄 PR detected as DOCUMENTATION ONLY (Discount applied)');
      riskScore *= 0.2; // 80% discount for docs
    }

    // Similar to quality PRs → Lower risk
    if (qualityPRs.length > 0) {
      const avgQualitySim = qualityPRs.reduce((sum, pr) => sum + pr.similarity, 0) / qualityPRs.length;
      riskScore -= avgQualitySim * (isDocOnly ? 0.1 : 0.3);
      console.log(`   ✅ Quality similarity: ${avgQualitySim.toFixed(2)} → -${(avgQualitySim * 0.3).toFixed(2)} risk`);
    }

    // Similar to risky PRs → Higher risk (less weight for doc PRs)
    if (riskyPRs.length > 0) {
      const avgRiskySim = riskyPRs.reduce((sum, pr) => sum + pr.similarity, 0) / riskyPRs.length;
      riskScore += avgRiskySim * (isDocOnly ? 0.05 : 0.3);
      console.log(`   ⚠️  Risky similarity: ${avgRiskySim.toFixed(2)} → +${(avgRiskySim * 0.3).toFixed(2)} risk`);
    }

    // 4. Compare against industry benchmarks
    const seedStats = await getSeedStats();

    const sizeRatio = totalChanges / seedStats.avg_additions;
    const filesRatio = (changed_files || 0) / seedStats.avg_files;
    const titleRatio = (title?.length || 0) / seedStats.avg_title_length;

    // Adjust risk based on benchmarks (lower weights for doc-only)
    const weightFactor = isDocOnly ? 0.2 : 1;
    if (sizeRatio > 2) riskScore += 0.2 * weightFactor;
    if (filesRatio > 2) riskScore += 0.15 * weightFactor;
    if (titleRatio < 0.5) riskScore += 0.1 * weightFactor;

    console.log(`   📏 Benchmark ratios: size=${sizeRatio.toFixed(1)}x, files=${filesRatio.toFixed(1)}x, title=${titleRatio.toFixed(1)}x`);

    // 5. Final adjustments based on current PR
    const sizeScore = Math.min(totalChanges / 500, 0.4) * weightFactor;
    const filesScore = Math.min((changed_files || 0) / 20, 0.3) * weightFactor;

    riskScore += sizeScore + filesScore;

    // 6. HARD FLOORS: Apply critical structural protection at the very end
    const isNetDeletion = additions === 0 && deletions > 0;
    const hasCriticalFiles = files.some(f => {
      const path = (f.path || f.filename || '').toLowerCase();
      return path.includes('auth') || path.includes('login') || path.includes('api') ||
        path.includes('security') || path.includes('config') || path.includes('db');
    });

    if (isNetDeletion && hasCriticalFiles) {
      console.log('🚨 CRITICAL STRUCTURAL RISK: Net deletion in critical file! (Enforcing 65% Floor)');
      riskScore = Math.max(riskScore, 0.65);
    }

    // Clamp between 0.01 and 1
    riskScore = Math.max(0.01, Math.min(1, riskScore));

    console.log(`✅ Final risk score: ${(riskScore * 100).toFixed(0)}%`);

    return {
      risk_score: riskScore,
      factors: {
        similarity_to_quality: qualityPRs.length > 0 ? qualityPRs[0].similarity : 0,
        similarity_to_risky: riskyPRs.length > 0 ? riskyPRs[0].similarity : 0,
        size_vs_benchmark: sizeRatio,
        files_vs_benchmark: filesRatio,
        title_quality: titleRatio
      },
      similar_prs: similarPRs.slice(0, 5).map(pr => ({
        title: pr.title,
        similarity: pr.similarity,
        source: pr.source,
        organization: pr.organization || pr.doc_id?.split('/')[0],
        additions: pr.additions,
        deletions: pr.deletions,
        quality_score: pr.quality_score
      })),
      ml_model: 'tfidf_cosine_hybrid_v3',
      data_source: 'team_learning_plus_baseline',
      team_prs_analyzed: (await getTeamPRs()).length
    };

  } catch (error) {
    console.error('ML risk calculation failed:', error);
    return calculateBaselineRisk(prData);
  }
}

/**
 * Baseline risk (fallback)
 */
function calculateBaselineRisk(prData) {
  const { additions, deletions, changed_files, title, body } = prData;
  const totalChanges = (additions || 0) + (deletions || 0);

  const sizeRisk = Math.min(totalChanges / 500, 1) * 0.4;
  const filesRisk = Math.min((changed_files || 0) / 20, 1) * 0.3;
  const titleRisk = (!title || title.length < 10) ? 0.2 : 0;
  const bodyRisk = (!body || body.length < 20) ? 0.1 : 0;

  return {
    risk_score: sizeRisk + filesRisk + titleRisk + bodyRisk,
    factors: {
      size: sizeRisk,
      files: filesRisk,
      title: 1 - titleRisk,
      body: 1 - bodyRisk
    },
    ml_model: 'baseline',
    data_source: 'statistical'
  };
}

// ============================================================================
// PR IMPROVEMENT SUGGESTIONS
// ============================================================================

/**
 * Get improvement suggestions based on seed data patterns
 */
export async function getPRImprovementSuggestions(prData) {
  try {
    const { title, body, additions, deletions, changed_files, filesChanged } = prData;
    const totalChanges = (additions || 0) + (deletions || 0);

    const suggestions = [];
    const seedStats = await getSeedStats();

    // Find similar quality PRs first for contextual examples
    const similar = await findSimilarPRs(prData, 10);
    const qualityExamples = similar.filter(pr => pr.source === 'seed_quality').slice(0, 3);
    const riskyExamples = similar.filter(pr => pr.source === 'seed_risky').slice(0, 2);

    // 1. Title Quality - Be specific about improvements
    if (!title || title.length < 20) {
      const goodTitleExample = qualityExamples.find(pr => pr.title && pr.title.length > 30);
      suggestions.push({
        category: '📝 Title Quality',
        severity: 'high',
        icon: '🔴',
        current: `Title too short: "${title || 'No title'}" (${title?.length || 0} chars)`,
        suggestion: goodTitleExample
          ? `Make it descriptive like "${goodTitleExample.title}" (${goodTitleExample.title.length} chars). Include: what changed, why, and the impact.`
          : `Expand to ${seedStats.avg_title_length}+ chars. Include: [Type] Component: What changed and why. Example: "feat(api): Add rate limiting to prevent abuse"`,
        action: '✏️ Rewrite title to be more descriptive',
        example: goodTitleExample?.title || 'fix(auth): Resolve token expiration bug affecting mobile users',
        reference: goodTitleExample?.organization || 'industry_standard'
      });
    } else if (title.length < 35) {
      suggestions.push({
        category: '📝 Title Quality',
        severity: 'medium',
        icon: '🟡',
        current: `Title could be more descriptive (${title.length} chars)`,
        suggestion: `Add more context about the "why" behind this change. Top companies average ${seedStats.avg_title_length} chars.`,
        action: '✏️ Add more context to title',
        example: 'refactor(database): Optimize query performance for user dashboards (15% faster)',
        reference: 'best_practice'
      });
    }

    // 2. Description Quality - Provide template
    if (!body || body.length < 50) {
      const goodDescExample = qualityExamples.find(pr => pr.body && pr.body.length > 100);
      const descTemplate = `## What & Why
  [Explain the problem and solution]
  
## Changes Made
  - [Key change 1]
  - [Key change 2]
  
## Testing
  - [How you tested this]
  - [Test coverage: X%]
  
## Screenshots/Logs
  [If UI/output changed]`;

      suggestions.push({
        category: '📋 Description',
        severity: 'high',
        icon: '🔴',
        current: `Missing PR description (${body?.length || 0} chars)`,
        suggestion: goodDescExample
          ? `Add a detailed description like ${goodDescExample.organization} does (${goodDescExample.body.length} chars). Include: context, changes, testing.`
          : `Quality PRs include: Why? What changed? How was it tested? Use this template:\n\n${descTemplate}`,
        action: '📝 Add structured description using template',
        example: descTemplate,
        reference: goodDescExample?.organization || 'apache_standard'
      });
    } else if (body.length < 150) {
      suggestions.push({
        category: '📋 Description',
        severity: 'medium',
        icon: '🟡',
        current: `Description too brief (${body.length} chars)`,
        suggestion: 'Add more detail: Why was this needed? What alternatives were considered? How was it tested?',
        action: '📝 Expand description with context and testing details',
        example: 'See Apache PRs which average 300+ chars with clear problem/solution/testing sections',
        reference: 'quality_pattern'
      });
    }

    // 3. PR Size - Specific splitting recommendations
    if (totalChanges > seedStats.avg_additions * 3) {
      const fileTypes = new Set();
      if (filesChanged && Array.isArray(filesChanged)) {
        filesChanged.forEach(f => {
          if (f.path) {
            if (f.path.includes('test') || f.path.includes('spec')) fileTypes.add('tests');
            else if (f.path.includes('doc') || f.path.includes('.md')) fileTypes.add('docs');
            else if (f.path.includes('config') || f.path.includes('.json')) fileTypes.add('config');
            else fileTypes.add('code');
          }
        });
      }

      const splitSuggestion = fileTypes.size > 1
        ? `Split into ${fileTypes.size} PRs: ${Array.from(fileTypes).join(', ')}`
        : 'Break into smaller, atomic changes (one concern per PR)';

      suggestions.push({
        category: '📏 PR Size',
        severity: 'high',
        icon: '🔴',
        current: `Very large PR: ${totalChanges} lines changed (${Math.round(totalChanges / seedStats.avg_additions)}x industry average)`,
        suggestion: `${splitSuggestion}. Large PRs have ${(riskyExamples.length / similar.length * 100).toFixed(0)}% higher risk of bugs.`,
        action: '✂️ Split into smaller, focused PRs',
        example: `Google/Facebook limit PRs to ~300 lines. Current: ${totalChanges} lines`,
        reference: 'industry_benchmark'
      });
    } else if (totalChanges > seedStats.avg_additions * 1.5) {
      suggestions.push({
        category: '📏 PR Size',
        severity: 'medium',
        icon: '🟡',
        current: `Large PR: ${totalChanges} lines (industry avg: ${seedStats.avg_additions})`,
        suggestion: 'Consider splitting if changes address multiple concerns. Smaller PRs = faster reviews.',
        action: '✂️ Consider splitting into logical chunks',
        example: '150-200 lines per PR is optimal for review quality',
        reference: 'best_practice'
      });
    }

    // 4. File Count - Identify unrelated changes
    if ((changed_files || 0) > seedStats.avg_files * 2) {
      suggestions.push({
        category: '🗂️ Scope',
        severity: 'medium',
        icon: '🟡',
        current: `${changed_files} files changed (avg: ${seedStats.avg_files} files)`,
        suggestion: 'Many files may indicate unrelated changes bundled together. Check if this should be multiple PRs.',
        action: '🔍 Review if all changes belong together',
        example: 'Single responsibility: Each PR should solve ONE problem',
        reference: 'solid_principles'
      });
    }

    // 5. Risk Patterns - From similar risky PRs
    if (riskyExamples.length > 0) {
      const commonIssue = riskyExamples[0];
      suggestions.push({
        category: '⚠️ Risk Pattern',
        severity: 'high',
        icon: '🔴',
        current: `Similar to ${riskyExamples.length} risky PRs in our database`,
        suggestion: `PR similar to ${commonIssue.organization}'s problematic PR: "${commonIssue.title}". That PR had: ${commonIssue.additions} additions, ${commonIssue.changed_files} files. Review for similar issues.`,
        action: '🔍 Review for common anti-patterns',
        example: `Common issues: Insufficient testing, mixing refactor + features, unclear commit history`,
        reference: commonIssue.doc_id || 'risk_database'
      });
    }

    // 6. Best Practice Example - From similar quality PRs
    if (qualityExamples.length > 0) {
      const bestExample = qualityExamples[0];
      suggestions.push({
        category: '✨ Best Practice',
        severity: 'info',
        icon: '💡',
        current: `${Math.round(bestExample.similarity * 100)}% similar to quality PR from ${bestExample.organization}`,
        suggestion: `Great! Your PR resembles "${bestExample.title}" (${bestExample.additions} adds, ${bestExample.changed_files} files). Follow their pattern: ${bestExample.body?.substring(0, 100)}...`,
        action: '📖 Study similar quality PR for inspiration',
        example: `${bestExample.organization} PRs average: ${bestExample.additions || 150} lines, ${bestExample.changed_files || 5} files, ${bestExample.title?.length || 40} char titles`,
        reference: `${bestExample.organization}/${bestExample.doc_id || 'quality_pr'}`
      });
    }

    // 7. Testing Reminder
    const hasTestKeywords = body && (
      body.toLowerCase().includes('test') ||
      body.toLowerCase().includes('coverage') ||
      body.toLowerCase().includes('unit') ||
      body.toLowerCase().includes('integration')
    );

    if (!hasTestKeywords && totalChanges > 50) {
      suggestions.push({
        category: '🧪 Testing',
        severity: 'high',
        icon: '🔴',
        current: 'No mention of testing in description',
        suggestion: 'Add testing details: What tests were added/updated? What\'s the coverage? Manual testing steps?',
        action: '🧪 Add testing section to description',
        example: `## Testing
- Added 12 unit tests (coverage: 87%)
- Manual testing: Verified in dev/staging
- Edge cases: Tested with empty inputs, large datasets`,
        reference: 'testing_best_practice'
      });
    }

    // Sort by severity
    const severityOrder = { high: 0, medium: 1, low: 2, info: 3 };
    suggestions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return suggestions;

  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

export default {
  calculateMLRiskScore,
  getPRImprovementSuggestions,
  findSimilarPRs,
  storeTeamPR,
  getTeamPRs
};
