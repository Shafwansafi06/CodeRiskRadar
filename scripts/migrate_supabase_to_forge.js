/**
 * Migration Script: Supabase → Forge Storage
 * 
 * This script fetches 5K quality PRs from Supabase and stores them
 * in Forge storage for offline ML analysis.
 * 
 * Run once during setup: node scripts/migrate_supabase_to_forge.js
 */

const SUPABASE_URL = 'https://gbesjxveinhjnfnlushe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdiZXNqeHZlaW5oam5mbmx1c2hlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTUyOTM5MSwiZXhwIjoyMDgxMTA1MzkxfQ.kL81VWhJu9LhaGZoLuMxqLb6hNcilwo5ruQ64Fdzs8Y';

async function fetchFromSupabase(endpoint) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Supabase fetch failed: ${response.status}`);
  }
  
  return await response.json();
}

async function migratePRData() {
  console.log('🚀 Starting Supabase → Forge Storage Migration...\n');
  
  try {
    // 1. Fetch PRs with quality metrics
    console.log('📊 Fetching quality PRs...');
    const prs = await fetchFromSupabase('prs?select=*&limit=1000&order=created_at.desc');
    console.log(`✅ Fetched ${prs.length} PRs`);
    
    // 2. Fetch embeddings
    console.log('\n🧠 Fetching embeddings...');
    const embeddings = await fetchFromSupabase('embeddings?select=*&limit=1000');
    console.log(`✅ Fetched ${embeddings.length} embeddings`);
    
    // 3. Process and structure data for Forge storage
    console.log('\n🔄 Processing data...');
    
    const seedData = {
      version: '1.0.0',
      migrated_at: new Date().toISOString(),
      total_prs: prs.length,
      total_embeddings: embeddings.length,
      
      // Quality PRs (small, well-documented, successful)
      quality_prs: prs.filter(pr => 
        (pr.additions || 0) + (pr.deletions || 0) < 1000 &&
        (pr.changed_files || 0) < 20 &&
        pr.title && pr.title.length > 20 &&
        pr.body && pr.body.length > 50
      ).map(pr => ({
        id: pr.id,
        doc_id: pr.doc_id,
        title: pr.title,
        body: pr.body,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        labels: pr.labels,
        organization: pr.doc_id ? pr.doc_id.split('/')[0] : 'unknown',
        quality_score: calculateQualityScore(pr)
      })),
      
      // Risky PRs (large, poorly documented)
      risky_prs: prs.filter(pr =>
        (pr.additions || 0) + (pr.deletions || 0) > 2000 ||
        (pr.changed_files || 0) > 50 ||
        !pr.title || pr.title.length < 10
      ).map(pr => ({
        id: pr.id,
        doc_id: pr.doc_id,
        title: pr.title,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        quality_score: calculateQualityScore(pr)
      })),
      
      // Embeddings index (simplified - top 100)
      embeddings_index: embeddings.slice(0, 100).map(e => ({
        pr_id: e.pr_id,
        content: e.content,
        section: e.section,
        // Store only first 384 dims to save space
        embedding: e.embedding ? e.embedding.slice(0, 384) : []
      })),
      
      // Metadata
      organizations: [...new Set(prs.map(pr => pr.doc_id ? pr.doc_id.split('/')[0] : 'unknown'))],
      
      // Statistics
      stats: {
        avg_additions: Math.round(prs.reduce((sum, pr) => sum + (pr.additions || 0), 0) / prs.length),
        avg_deletions: Math.round(prs.reduce((sum, pr) => sum + (pr.deletions || 0), 0) / prs.length),
        avg_files: Math.round(prs.reduce((sum, pr) => sum + (pr.changed_files || 0), 0) / prs.length),
        avg_title_length: Math.round(prs.reduce((sum, pr) => sum + (pr.title?.length || 0), 0) / prs.length)
      }
    };
    
    console.log(`\n✅ Processed:`);
    console.log(`   - ${seedData.quality_prs.length} quality PRs`);
    console.log(`   - ${seedData.risky_prs.length} risky PRs`);
    console.log(`   - ${seedData.embeddings_index.length} embeddings`);
    console.log(`   - ${seedData.organizations.length} organizations`);
    
    // 4. Save to JSON files (to be loaded into Forge storage)
    const fs = require('fs');
    const path = require('path');
    
    const outputDir = path.join(__dirname, '../seed-data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Split into chunks to avoid size limits
    const chunkSize = 200;
    
    // Quality PRs in chunks
    const qualityChunks = Math.ceil(seedData.quality_prs.length / chunkSize);
    for (let i = 0; i < qualityChunks; i++) {
      const chunk = seedData.quality_prs.slice(i * chunkSize, (i + 1) * chunkSize);
      fs.writeFileSync(
        path.join(outputDir, `quality_prs_${i + 1}.json`),
        JSON.stringify(chunk, null, 2)
      );
    }
    
    // Risky PRs
    fs.writeFileSync(
      path.join(outputDir, 'risky_prs.json'),
      JSON.stringify(seedData.risky_prs, null, 2)
    );
    
    // Embeddings
    fs.writeFileSync(
      path.join(outputDir, 'embeddings.json'),
      JSON.stringify(seedData.embeddings_index, null, 2)
    );
    
    // Metadata
    fs.writeFileSync(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify({
        version: seedData.version,
        migrated_at: seedData.migrated_at,
        total_prs: seedData.total_prs,
        organizations: seedData.organizations,
        stats: seedData.stats
      }, null, 2)
    );
    
    console.log(`\n💾 Saved seed data to: ${outputDir}/`);
    console.log(`\n✅ Migration complete!`);
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Run: node scripts/load_seed_data_to_forge.js`);
    console.log(`   2. Deploy app: forge deploy`);
    console.log(`   3. App will use seed data + learn from team PRs`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

function calculateQualityScore(pr) {
  let score = 0.5; // Start neutral
  
  const totalChanges = (pr.additions || 0) + (pr.deletions || 0);
  const fileCount = pr.changed_files || 0;
  
  // Size scoring
  if (totalChanges < 100) score += 0.2;
  else if (totalChanges > 1000) score -= 0.2;
  
  // File count scoring
  if (fileCount < 10) score += 0.1;
  else if (fileCount > 30) score -= 0.1;
  
  // Documentation scoring
  if (pr.title && pr.title.length > 30) score += 0.1;
  if (pr.body && pr.body.length > 100) score += 0.1;
  
  return Math.max(0, Math.min(1, score));
}

// Run migration
migratePRData();
