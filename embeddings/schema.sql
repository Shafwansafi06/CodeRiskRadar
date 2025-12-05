-- Supabase pgvector schema for embeddings
-- Run this in your Supabase SQL editor

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('pr', 'jira_issue', 'commit', 'incident')),
    source_id TEXT NOT NULL, -- PR ID, Jira issue key, etc.
    content TEXT NOT NULL, -- Original text that was embedded
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    metadata JSONB NOT NULL DEFAULT '{}', -- Flexible metadata storage
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(type);
CREATE INDEX IF NOT EXISTS idx_embeddings_source_id ON embeddings(source_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON embeddings(created_at DESC);

-- Create vector similarity search index (HNSW for fast approximate search)
-- This dramatically speeds up similarity queries
CREATE INDEX IF NOT EXISTS idx_embeddings_vector 
ON embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Alternative: IVFFlat index (faster build time, slightly slower queries)
-- CREATE INDEX IF NOT EXISTS idx_embeddings_vector_ivf 
-- ON embeddings 
-- USING ivfflat (embedding vector_cosine_ops)
-- WITH (lists = 100);

-- Create function for automatic updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function for similarity search (returns top-k with scores)
CREATE OR REPLACE FUNCTION search_similar_embeddings(
    query_embedding vector(1536),
    match_type TEXT DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    source_id TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.type,
        e.source_id,
        e.content,
        e.metadata,
        1 - (e.embedding <=> query_embedding) AS similarity,
        e.created_at
    FROM embeddings e
    WHERE (match_type IS NULL OR e.type = match_type)
      AND (1 - (e.embedding <=> query_embedding)) >= match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create materialized view for commonly accessed metadata
CREATE MATERIALIZED VIEW IF NOT EXISTS embeddings_summary AS
SELECT
    type,
    COUNT(*) AS total_count,
    AVG(CHAR_LENGTH(content)) AS avg_content_length,
    MAX(created_at) AS last_updated
FROM embeddings
GROUP BY type;

-- Refresh materialized view (run periodically)
CREATE OR REPLACE FUNCTION refresh_embeddings_summary()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW embeddings_summary;
END;
$$;

-- Create Row Level Security (RLS) policies
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read all embeddings
CREATE POLICY "Allow authenticated users to read embeddings"
ON embeddings
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow service role to insert/update/delete
CREATE POLICY "Allow service role full access"
ON embeddings
FOR ALL
TO service_role
USING (true);

-- Optional: Policy to restrict access by workspace/team
-- Assumes metadata contains {"team_id": "xyz"}
-- CREATE POLICY "Users can only see their team's embeddings"
-- ON embeddings
-- FOR SELECT
-- TO authenticated
-- USING (
--     auth.jwt() ->> 'team_id' = metadata ->> 'team_id'
-- );

-- Create indexes on commonly queried metadata fields
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_risk_score 
ON embeddings ((metadata->>'risk_score'));

CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_team_id 
ON embeddings ((metadata->>'team_id'));

CREATE INDEX IF NOT EXISTS idx_embeddings_metadata_repository 
ON embeddings ((metadata->>'repository'));

-- Composite index for filtered similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_type_created 
ON embeddings(type, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE embeddings IS 'Stores vector embeddings for PRs, Jira issues, and other code artifacts';
COMMENT ON COLUMN embeddings.type IS 'Type of entity: pr, jira_issue, commit, incident';
COMMENT ON COLUMN embeddings.source_id IS 'External identifier (PR #123, JIRA-456, etc.)';
COMMENT ON COLUMN embeddings.content IS 'Original text that was embedded (for display)';
COMMENT ON COLUMN embeddings.embedding IS 'Vector embedding (1536 dimensions for text-embedding-3-small)';
COMMENT ON COLUMN embeddings.metadata IS 'Flexible JSON metadata: {risk_score, repository, team_id, author, link, etc.}';

-- Example metadata structure
COMMENT ON COLUMN embeddings.metadata IS '
Example metadata:
{
  "risk_score": 78.5,
  "repository": "myorg/myrepo",
  "team_id": "team-123",
  "author": "john.doe@example.com",
  "link": "https://bitbucket.org/myorg/myrepo/pull-requests/123",
  "files_changed": 5,
  "lines_added": 250,
  "lines_deleted": 100,
  "labels": ["security", "high-priority"],
  "resolution": "merged",
  "actual_issues_found": ["bug", "performance_issue"]
}
';

-- Performance tuning settings (add to postgresql.conf or set in Supabase dashboard)
-- shared_preload_libraries = 'vector'
-- maintenance_work_mem = '1GB'  -- For faster index builds
-- max_parallel_workers_per_gather = 4  -- For parallel queries

-- Vacuum and analyze for optimal query performance
VACUUM ANALYZE embeddings;

-- Example queries

-- 1. Insert a PR embedding
/*
INSERT INTO embeddings (type, source_id, content, embedding, metadata)
VALUES (
    'pr',
    'PR-123',
    'Fix SQL injection in auth module...',
    '[0.1, 0.2, ..., 0.9]'::vector(1536),
    '{
        "risk_score": 85.5,
        "repository": "myorg/backend",
        "link": "https://bitbucket.org/myorg/backend/pull-requests/123",
        "author": "john.doe@example.com",
        "files_changed": 3
    }'::jsonb
);
*/

-- 2. Find similar PRs (using function)
/*
SELECT * FROM search_similar_embeddings(
    '[0.1, 0.2, ..., 0.9]'::vector(1536),  -- Query embedding
    'pr',           -- Filter by type
    0.7,            -- Minimum similarity threshold
    5               -- Top 5 results
);
*/

-- 3. Find similar incidents (direct query)
/*
SELECT
    source_id,
    metadata->>'link' AS link,
    metadata->>'risk_score' AS risk_score,
    1 - (embedding <=> '[0.1, 0.2, ..., 0.9]'::vector(1536)) AS similarity,
    created_at
FROM embeddings
WHERE type = 'jira_issue'
  AND (1 - (embedding <=> '[0.1, 0.2, ..., 0.9]'::vector(1536))) >= 0.75
ORDER BY embedding <=> '[0.1, 0.2, ..., 0.9]'::vector(1536)
LIMIT 10;
*/

-- 4. Get statistics
/*
SELECT 
    type,
    COUNT(*) AS count,
    AVG(CHAR_LENGTH(content)) AS avg_content_length,
    MAX(created_at) AS latest
FROM embeddings
GROUP BY type;
*/

-- 5. Delete old embeddings (cleanup)
/*
DELETE FROM embeddings
WHERE created_at < NOW() - INTERVAL '90 days'
  AND type = 'pr';
*/

-- 6. Upsert pattern (update if exists, insert if not)
/*
INSERT INTO embeddings (id, type, source_id, content, embedding, metadata)
VALUES (
    'some-uuid',
    'pr',
    'PR-123',
    'Updated content...',
    '[0.1, 0.2, ...]'::vector(1536),
    '{"risk_score": 90}'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
*/
