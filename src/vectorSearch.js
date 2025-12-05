import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize clients
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Store risk embedding in Supabase for vector search
 */
export async function storeRiskEmbedding(risk, prContext) {
  try {
    // Generate embedding for risk
    const embedding = await generateEmbedding(
      `${risk.name} ${risk.description} ${risk.snippet}`
    );
    
    // Store in Supabase
    const { data, error } = await supabase
      .from('risk_embeddings')
      .insert({
        risk_id: risk.id,
        pr_id: prContext.prId,
        repo_slug: prContext.repoSlug,
        risk_type: risk.type,
        severity: risk.severity,
        category: risk.category,
        embedding,
        metadata: {
          name: risk.name,
          description: risk.description,
          snippet: risk.snippet,
          lineNumber: risk.lineNumber
        },
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    return data;
    
  } catch (error) {
    console.error('Failed to store risk embedding:', error);
    throw error;
  }
}

/**
 * Search for similar past risks using vector similarity
 */
export async function searchSimilarRisks(risk, limit = 5) {
  try {
    // Generate embedding for current risk
    const queryEmbedding = await generateEmbedding(
      `${risk.name} ${risk.description} ${risk.snippet}`
    );
    
    // Perform vector similarity search
    const { data, error } = await supabase.rpc('match_risks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit
    });
    
    if (error) throw error;
    
    return data.map(item => ({
      ...item.metadata,
      similarity: item.similarity,
      prId: item.pr_id,
      resolvedAt: item.resolved_at
    }));
    
  } catch (error) {
    console.error('Failed to search similar risks:', error);
    return []; // Fail gracefully
  }
}

/**
 * Generate embedding using OpenAI
 */
async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, 8000) // Limit input length
  });
  
  return response.data[0].embedding;
}

/**
 * Initialize Supabase table (run once during setup)
 */
export async function initializeVectorTable() {
  // SQL to create table with pgvector extension
  const createTableSQL = `
    -- Enable pgvector extension
    CREATE EXTENSION IF NOT EXISTS vector;
    
    -- Create risk embeddings table
    CREATE TABLE IF NOT EXISTS risk_embeddings (
      id BIGSERIAL PRIMARY KEY,
      risk_id TEXT NOT NULL,
      pr_id TEXT NOT NULL,
      repo_slug TEXT NOT NULL,
      risk_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      embedding vector(1536),
      metadata JSONB,
      resolved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
    
    -- Create index for vector similarity search
    CREATE INDEX IF NOT EXISTS risk_embeddings_embedding_idx 
    ON risk_embeddings 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
    
    -- Create function for similarity search
    CREATE OR REPLACE FUNCTION match_risks(
      query_embedding vector(1536),
      match_threshold FLOAT,
      match_count INT
    )
    RETURNS TABLE (
      risk_id TEXT,
      pr_id TEXT,
      repo_slug TEXT,
      risk_type TEXT,
      severity TEXT,
      category TEXT,
      metadata JSONB,
      resolved_at TIMESTAMP,
      similarity FLOAT
    )
    LANGUAGE SQL STABLE
    AS $$
      SELECT
        risk_id,
        pr_id,
        repo_slug,
        risk_type,
        severity,
        category,
        metadata,
        resolved_at,
        1 - (embedding <=> query_embedding) AS similarity
      FROM risk_embeddings
      WHERE 1 - (embedding <=> query_embedding) > match_threshold
      ORDER BY embedding <=> query_embedding
      LIMIT match_count;
    $$;
  `;
  
  console.log('Run this SQL in Supabase SQL editor:');
  console.log(createTableSQL);
}
