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

// ============================================================================
// SEED DATA ACCESS
// ============================================================================

/**
 * Initialize seed data from embedded JSON (runs once automatically)
 */
async function initializeSeedData() {
  try {
    // Check if already initialized
    const metadata = await storage.get('seed_metadata');
    if (metadata) {
      console.log('✅ Seed data already initialized');
      return true;
    }
    
    console.log('🌱 First run - initializing seed data...');
    
    // Import seed data from JSON files
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const seedDataPath = path.join(__dirname, '../../seed-data');
    
    // Load metadata
    const metadataContent = fs.readFileSync(path.join(seedDataPath, 'metadata.json'), 'utf-8');
    const seedMetadata = JSON.parse(metadataContent);
    await storage.set('seed_metadata', seedMetadata);
    console.log(`✅ Loaded metadata: ${seedMetadata.organizations.length} orgs`);
    
    // Load quality PRs (chunked)
    const qualityFiles = fs.readdirSync(seedDataPath)
      .filter(f => f.startsWith('quality_prs_'))
      .sort();
    
    let totalQuality = 0;
    for (let i = 0; i < qualityFiles.length; i++) {
      const filePath = path.join(seedDataPath, qualityFiles[i]);
      const qualityPRs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      await storage.set(`seed_quality_prs_${i + 1}`, qualityPRs);
      totalQuality += qualityPRs.length;
    }
    await storage.set('seed_quality_prs_count', qualityFiles.length);
    console.log(`✅ Loaded ${totalQuality} quality PRs in ${qualityFiles.length} chunks`);
    
    // Load risky PRs
    const riskyContent = fs.readFileSync(path.join(seedDataPath, 'risky_prs.json'), 'utf-8');
    const riskyPRs = JSON.parse(riskyContent);
    await storage.set('seed_risky_prs', riskyPRs);
    console.log(`✅ Loaded ${riskyPRs.length} risky PRs`);
    
    // Load embeddings
    const embeddingsContent = fs.readFileSync(path.join(seedDataPath, 'embeddings.json'), 'utf-8');
    const embeddings = JSON.parse(embeddingsContent);
    await storage.set('seed_embeddings', embeddings);
    console.log(`✅ Loaded ${embeddings.length} embeddings`);
    
    // Initialize team learning
    await storage.set('team_prs', []);
    await storage.set('team_pr_outcomes', {});
    console.log('✅ Initialized team learning storage');
    
    console.log('🎉 Seed data initialization complete!');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize seed data:', error);
    return false;
  }
}

/**
 * Load all seed quality PRs (from migrated Supabase data)
 */
async function loadSeedQualityPRs() {
  try {
    // Auto-initialize on first run
    await initializeSeedData();
    
    const chunkCount = await storage.get('seed_quality_prs_count') || 0;
    if (chunkCount === 0) {
      console.log('⚠️  No seed data found even after initialization');
      return [];
    }
    
    const allPRs = [];
    for (let i = 1; i <= chunkCount; i++) {
      const chunk = await storage.get(`seed_quality_prs_${i}`) || [];
      allPRs.push(...chunk);
    }
    
    console.log(`✅ Loaded ${allPRs.length} seed quality PRs`);
    return allPRs;
  } catch (error) {
    console.error('Error loading seed PRs:', error);
    return [];
  }
}

/**
 * Load seed risky PRs
 */
async function loadSeedRiskyPRs() {
  try {
    const riskyPRs = await storage.get('seed_risky_prs') || [];
    console.log(`✅ Loaded ${riskyPRs.length} seed risky PRs`);
    return riskyPRs;
  } catch (error) {
    console.error('Error loading risky PRs:', error);
    return [];
  }
}

/**
 * Load seed embeddings
 */
async function loadSeedEmbeddings() {
  try {
    const embeddings = await storage.get('seed_embeddings') || [];
    console.log(`✅ Loaded ${embeddings.length} seed embeddings`);
    return embeddings;
  } catch (error) {
    console.error('Error loading embeddings:', error);
    return [];
  }
}

/**
 * Get seed statistics (industry benchmarks)
 */
async function getSeedStats() {
  try {
    const metadata = await storage.get('seed_metadata') || {};
    return metadata.stats || {
      avg_additions: 150,
      avg_deletions: 50,
      avg_files: 8,
      avg_title_length: 35
    };
  } catch (error) {
    return {
      avg_additions: 150,
      avg_deletions: 50,
      avg_files: 8,
      avg_title_length: 35
    };
  }
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
async function findSimilarPRs(prText, limit = 10) {
  try {
    console.log('🔍 Finding similar PRs...');
    
    // Generate vector for current PR
    const currentVector = generateTFIDFVector(prText);
    
    // Load seed PRs
    const seedQualityPRs = await loadSeedQualityPRs();
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
    const similarPRs = await findSimilarPRs(prText, 20);
    
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
    let riskScore = 0.5; // Start neutral
    
    // Similar to quality PRs → Lower risk
    if (qualityPRs.length > 0) {
      const avgQualitySim = qualityPRs.reduce((sum, pr) => sum + pr.similarity, 0) / qualityPRs.length;
      riskScore -= avgQualitySim * 0.3;
      console.log(`   ✅ Quality similarity: ${avgQualitySim.toFixed(2)} → -${(avgQualitySim * 0.3).toFixed(2)} risk`);
    }
    
    // Similar to risky PRs → Higher risk
    if (riskyPRs.length > 0) {
      const avgRiskySim = riskyPRs.reduce((sum, pr) => sum + pr.similarity, 0) / riskyPRs.length;
      riskScore += avgRiskySim * 0.3;
      console.log(`   ⚠️  Risky similarity: ${avgRiskySim.toFixed(2)} → +${(avgRiskySim * 0.3).toFixed(2)} risk`);
    }
    
    // 4. Compare against industry benchmarks
    const seedStats = await getSeedStats();
    
    const sizeRatio = totalChanges / seedStats.avg_additions;
    const filesRatio = (changed_files || 0) / seedStats.avg_files;
    const titleRatio = (title?.length || 0) / seedStats.avg_title_length;
    
    // Adjust risk based on benchmarks
    if (sizeRatio > 2) riskScore += 0.2; // Much larger than avg
    if (filesRatio > 2) riskScore += 0.15; // Many more files
    if (titleRatio < 0.5) riskScore += 0.1; // Short title
    
    console.log(`   📏 Benchmark ratios: size=${sizeRatio.toFixed(1)}x, files=${filesRatio.toFixed(1)}x, title=${titleRatio.toFixed(1)}x`);
    
    // 5. Final adjustments based on current PR
    const sizeScore = Math.min(totalChanges / 1000, 0.3);
    const filesScore = Math.min((changed_files || 0) / 50, 0.2);
    
    riskScore += sizeScore + filesScore;
    
    // Clamp between 0 and 1
    riskScore = Math.max(0, Math.min(1, riskScore));
    
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
      data_source: 'seed_data_plus_team_learning',
      seed_prs_analyzed: seedQualityPRs.length + seedRiskyPRs.length,
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
    const { title, body, additions, deletions, changed_files } = prData;
    const totalChanges = (additions || 0) + (deletions || 0);
    
    const suggestions = [];
    const seedStats = await getSeedStats();
    
    // Title quality
    if (!title || title.length < 20) {
      suggestions.push({
        category: 'Title',
        severity: 'high',
        current: `Short title (${title?.length || 0} chars)`,
        suggestion: `Industry standard: ${seedStats.avg_title_length}+ chars. Be descriptive about what changed and why.`,
        reference: 'seed_data_analysis'
      });
    }
    
    // PR size
    if (totalChanges > seedStats.avg_additions * 2) {
      suggestions.push({
        category: 'Size',
        severity: 'medium',
        current: `Large PR: ${totalChanges} lines`,
        suggestion: `Industry average: ${seedStats.avg_additions} lines. Consider splitting into smaller, focused PRs.`,
        reference: 'seed_data_benchmarks'
      });
    }
    
    // Description
    if (!body || body.length < 50) {
      suggestions.push({
        category: 'Description',
        severity: 'high',
        current: `Missing/short description (${body?.length || 0} chars)`,
        suggestion: 'Quality PRs from top companies include: Why? What? How was it tested? Consider adding these sections.',
        reference: 'seed_data_patterns'
      });
    }
    
    // File count
    if ((changed_files || 0) > seedStats.avg_files * 2) {
      suggestions.push({
        category: 'Scope',
        severity: 'medium',
        current: `${changed_files} files changed`,
        suggestion: `Industry average: ${seedStats.avg_files} files. Too many files may indicate multiple unrelated changes.`,
        reference: 'seed_data_benchmarks'
      });
    }
    
    // Find similar quality PRs for examples
    const prText = `${title || ''} ${body || ''}`;
    const similar = await findSimilarPRs(prText, 5);
    const qualityExample = similar.find(pr => pr.source === 'seed_quality');
    
    if (qualityExample) {
      suggestions.push({
        category: 'Best Practice',
        severity: 'info',
        current: 'Learning from similar PRs',
        suggestion: `Similar quality PR from ${qualityExample.organization}: "${qualityExample.title}" had ${qualityExample.additions} additions, ${qualityExample.changed_files} files. Follow similar patterns.`,
        reference: qualityExample.doc_id || 'seed_data'
      });
    }
    
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
