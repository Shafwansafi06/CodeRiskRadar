/**
 * Seed Data Loader - Forge Resolver
 * 
 * Run this ONCE after deployment to populate seed data:
 * forge invoke loadSeedData
 * 
 * This loads the JSON seed data files into Forge storage
 */

import Resolver from '@forge/resolver';
import { storage } from '@forge/api';
import fs from 'fs';
import path from 'path';

const resolver = new Resolver();

resolver.define('loadSeedData', async (req) => {
  console.log('🌱 Loading seed data into Forge storage...');
  
  try {
    const seedDataPath = path.join(__dirname, '../../seed-data');
    
    // 1. Load metadata
    console.log('📋 Loading metadata...');
    const metadata = JSON.parse(
      fs.readFileSync(path.join(seedDataPath, 'metadata.json'), 'utf-8')
    );
    await storage.set('seed_metadata', metadata);
    console.log(`✅ Stored metadata: ${metadata.organizations.length} orgs, ${metadata.stats.total_prs} PRs`);
    
    // 2. Load quality PRs (chunked)
    console.log('📦 Loading quality PRs...');
    const qualityFiles = fs.readdirSync(seedDataPath)
      .filter(f => f.startsWith('quality_prs_'))
      .sort();
    
    let totalQuality = 0;
    for (let i = 0; i < qualityFiles.length; i++) {
      const filePath = path.join(seedDataPath, qualityFiles[i]);
      const qualityPRs = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      await storage.set(`seed_quality_prs_${i + 1}`, qualityPRs);
      totalQuality += qualityPRs.length;
      console.log(`   ✅ Chunk ${i + 1}: ${qualityPRs.length} PRs`);
    }
    await storage.set('seed_quality_prs_count', qualityFiles.length);
    console.log(`✅ Stored ${totalQuality} quality PRs in ${qualityFiles.length} chunks`);
    
    // 3. Load risky PRs
    console.log('⚠️  Loading risky PRs...');
    const riskyPRs = JSON.parse(
      fs.readFileSync(path.join(seedDataPath, 'risky_prs.json'), 'utf-8')
    );
    await storage.set('seed_risky_prs', riskyPRs);
    console.log(`✅ Stored ${riskyPRs.length} risky PRs`);
    
    // 4. Load embeddings
    console.log('🧠 Loading embeddings...');
    const embeddings = JSON.parse(
      fs.readFileSync(path.join(seedDataPath, 'embeddings.json'), 'utf-8')
    );
    await storage.set('seed_embeddings', embeddings);
    console.log(`✅ Stored ${embeddings.length} embeddings`);
    
    // 5. Initialize team learning storage
    console.log('🎓 Initializing team learning...');
    const existingTeamPRs = await storage.get('team_prs');
    if (!existingTeamPRs) {
      await storage.set('team_prs', []);
      await storage.set('team_pr_outcomes', {});
      console.log('✅ Initialized empty team learning storage');
    } else {
      console.log(`📊 Found ${existingTeamPRs.length} existing team PRs`);
    }
    
    return {
      success: true,
      loaded: {
        metadata: metadata,
        quality_prs: totalQuality,
        risky_prs: riskyPRs.length,
        embeddings: embeddings.length,
        chunks: qualityFiles.length
      },
      message: '✅ Seed data loaded successfully! App ready for new teams.'
    };
    
  } catch (error) {
    console.error('❌ Failed to load seed data:', error);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
});

export const loadSeedDataHandler = resolver.getDefinitions();
