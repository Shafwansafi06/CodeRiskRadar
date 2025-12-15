/**
 * Load Seed Data into Forge Storage
 * 
 * This script loads pre-migrated Supabase data into Forge storage
 * so the app can work offline without external egress.
 * 
 * Run: forge install --upgrade && node scripts/load_seed_data_to_forge.js
 */

import api, { storage } from '@forge/api';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

async function loadSeedData() {
  console.log('🌱 Loading seed data into Forge storage...\n');
  
  try {
    const seedDir = join(process.cwd(), 'seed-data');
    
    // 1. Load metadata
    console.log('📋 Loading metadata...');
    const metadata = JSON.parse(readFileSync(join(seedDir, 'metadata.json'), 'utf8'));
    await storage.set('seed_metadata', metadata);
    console.log('✅ Metadata loaded');
    
    // 2. Load quality PRs (in chunks)
    console.log('\n📊 Loading quality PRs...');
    const qualityFiles = readdirSync(seedDir).filter(f => f.startsWith('quality_prs_'));
    let totalQualityPRs = 0;
    
    for (const file of qualityFiles) {
      const chunk = JSON.parse(readFileSync(join(seedDir, file), 'utf8'));
      const chunkNum = file.match(/quality_prs_(\d+)\.json/)[1];
      await storage.set(`seed_quality_prs_${chunkNum}`, chunk);
      totalQualityPRs += chunk.length;
      console.log(`   ✅ Chunk ${chunkNum}: ${chunk.length} PRs`);
    }
    
    await storage.set('seed_quality_prs_count', qualityFiles.length);
    console.log(`✅ Total quality PRs: ${totalQualityPRs}`);
    
    // 3. Load risky PRs
    console.log('\n⚠️  Loading risky PRs...');
    const riskyPRs = JSON.parse(readFileSync(join(seedDir, 'risky_prs.json'), 'utf8'));
    await storage.set('seed_risky_prs', riskyPRs);
    console.log(`✅ Loaded ${riskyPRs.length} risky PRs`);
    
    // 4. Load embeddings
    console.log('\n🧠 Loading embeddings...');
    const embeddings = JSON.parse(readFileSync(join(seedDir, 'embeddings.json'), 'utf8'));
    await storage.set('seed_embeddings', embeddings);
    console.log(`✅ Loaded ${embeddings.length} embeddings`);
    
    // 5. Initialize team learning storage
    console.log('\n🎓 Initializing team learning storage...');
    await storage.set('team_prs', []);
    await storage.set('team_pr_outcomes', {});
    console.log('✅ Team learning initialized');
    
    console.log('\n✅ Seed data loaded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Quality PRs: ${totalQualityPRs}`);
    console.log(`   - Risky PRs: ${riskyPRs.length}`);
    console.log(`   - Embeddings: ${embeddings.length}`);
    console.log(`   - Organizations: ${metadata.organizations.length}`);
    console.log(`\n🎉 App is now ready to analyze PRs!`);
    
  } catch (error) {
    console.error('❌ Failed to load seed data:', error);
    process.exit(1);
  }
}

loadSeedData();
