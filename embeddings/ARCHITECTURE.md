# Embeddings Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CODE RISK RADAR - EMBEDDINGS FLOW                     │
└─────────────────────────────────────────────────────────────────────────────┘

                                                                                
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Bitbucket PR    │         │   Jira Issue     │         │  Manual Input    │
│  (webhook)       │         │   (webhook)      │         │  (CLI/API)       │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         └────────────────────────────┴────────────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │  Extract Text Content   │
                        │  - Title, description   │
                        │  - Code diffs           │
                        │  - File paths           │
                        │  - Comments             │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Privacy Processing    │
                        │  - Anonymize emails     │
                        │  - Hash API keys        │
                        │  - Remove PII           │
                        │  - Replace IPs/URLs     │
                        └────────────┬────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
        ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐
        │   OpenAI API     │  │  Azure OpenAI │  │ Local (sentence- │
        │  text-embedding- │  │  (Enterprise) │  │  transformers)   │
        │   3-small        │  │               │  │  all-MiniLM-L6   │
        │  $0.02/1M tokens │  │  $0.03/1M     │  │  FREE (on-prem)  │
        │  1536 dims       │  │  1536 dims    │  │  384 dims        │
        └────────┬─────────┘  └───────┬───────┘  └────────┬─────────┘
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │  Vector Embedding       │
                        │  [0.023, -0.145, ...]   │
                        │  (1536 or 384 floats)   │
                        └────────────┬────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
        ┌──────────────────┐  ┌───────────────┐  ┌──────────────────┐
        │  Supabase        │  │  Self-Hosted  │  │  Forge Entities  │
        │  pgvector        │  │  PostgreSQL   │  │  (Fallback)      │
        │  (Production)    │  │  + pgvector   │  │  TF-IDF Only     │
        └────────┬─────────┘  └───────┬───────┘  └────────┬─────────┘
                 │                    │                    │
                 └────────────────────┼────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │     embeddings Table            │
                    │  ┌───────────────────────────┐  │
                    │  │ id (UUID)                 │  │
                    │  │ type (pr/jira_issue)      │  │
                    │  │ source_id (PR-123)        │  │
                    │  │ content (text)            │  │
                    │  │ embedding (vector[1536])  │  │
                    │  │ metadata (JSONB)          │  │
                    │  │ created_at (timestamp)    │  │
                    │  └───────────────────────────┘  │
                    │                                 │
                    │  Indexes:                       │
                    │  - HNSW (vector similarity)     │
                    │  - B-tree (type, source_id)     │
                    │  - GIN (metadata)               │
                    └─────────────────────────────────┘
                                      │
                                      │
                    ┌─────────────────┴─────────────────┐
                    │        QUERY TIME                 │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
                        ┌─────────────────────────┐
                        │  New PR/Issue Arrives   │
                        │  - Generate embedding   │
                        │  - Query similar items  │
                        └────────────┬────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │  Cosine Similarity Search       │
                    │  SELECT * FROM embeddings       │
                    │  ORDER BY embedding <=>         │
                    │    query_embedding              │
                    │  WHERE similarity > 0.75        │
                    │  LIMIT 5                        │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  Results with Metadata          │
                    │  ┌───────────────────────────┐  │
                    │  │ PR-456 (similarity: 0.92) │  │
                    │  │   risk_score: 85          │  │
                    │  │   actual_issues: [bug]    │  │
                    │  │                           │  │
                    │  │ PR-789 (similarity: 0.87) │  │
                    │  │   risk_score: 78          │  │
                    │  │   rollback_required: yes  │  │
                    │  │                           │  │
                    │  │ JIRA-123 (similarity: 0.81)│ │
                    │  │   priority: Critical      │  │
                    │  │   severity: high          │  │
                    │  └───────────────────────────┘  │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  Risk Enhancement               │
                    │  - ML score: 75/100             │
                    │  - Similar high-risk: +10       │
                    │  - Critical incidents: +15      │
                    │  - Final score: 100/100         │
                    │  - Recommendation: REJECT       │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  Display in Forge UI            │
                    │  - Bitbucket PR panel           │
                    │  - Jira issue panel             │
                    │  - Rovo agent chat              │
                    └─────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW SUMMARY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT → Extract Text → Anonymize → Generate Embedding → Store in DB        │
│                                                                              │
│  QUERY → Generate Embedding → Search Similar (cosine) → Rank Results        │
│                                                                              │
│  OUTPUT → Combine with ML → Generate Recommendation → Display in UI         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERFORMANCE CHARACTERISTICS                          │
├───────────────────┬──────────────┬──────────────┬──────────────────────────┤
│ Component         │ Latency      │ Cost         │ Scale                    │
├───────────────────┼──────────────┼──────────────┼──────────────────────────┤
│ Embedding (API)   │ 100ms        │ $0.02/1M tok │ 3000 req/min             │
│ Embedding (Local) │ 50ms         │ $0 (hw only) │ Unlimited                │
│ Index (1 item)    │ 200ms        │ $0           │ 1000s/sec                │
│ Search (HNSW)     │ <50ms        │ $0           │ Millions of items        │
│ Search (No index) │ ~10s         │ $0           │ Up to 10K items          │
└───────────────────┴──────────────┴──────────────┴──────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEPLOYMENT OPTIONS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Option 1: Cloud (OpenAI + Supabase)                                        │
│  ├─ Setup: 5 minutes                                                        │
│  ├─ Cost: ~$30/mo for 10K items                                             │
│  ├─ Privacy: Medium (anonymization)                                         │
│  └─ Best for: Production, large scale                                       │
│                                                                              │
│  Option 2: Hybrid (Azure OpenAI + Self-hosted DB)                           │
│  ├─ Setup: 1 hour                                                           │
│  ├─ Cost: ~$50/mo + infrastructure                                          │
│  ├─ Privacy: High (data residency)                                          │
│  └─ Best for: Enterprise, compliance                                        │
│                                                                              │
│  Option 3: On-Premises (Local embeddings + PostgreSQL)                      │
│  ├─ Setup: 2 hours                                                          │
│  ├─ Cost: Hardware only                                                     │
│  ├─ Privacy: Highest (no external calls)                                    │
│  └─ Best for: Sensitive data, air-gapped                                    │
│                                                                              │
│  Option 4: Forge Fallback (TF-IDF + Entities)                               │
│  ├─ Setup: Instant (no dependencies)                                        │
│  ├─ Cost: $0                                                                │
│  ├─ Privacy: High (stays in Atlassian)                                      │
│  └─ Best for: MVP, <1000 items, no external services                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION POINTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Webhook Handler (src/index.js)                                          │
│     └─> Extract PR → Call embeddings API → Store + Search                  │
│                                                                              │
│  2. Risk Analyzer (src/riskAnalyzer.js)                                     │
│     └─> ML prediction → Similarity search → Combine scores                 │
│                                                                              │
│  3. Rovo Agent (src/rovoAgent.js)                                           │
│     └─> User asks "Similar PRs?" → Query embeddings → Format response      │
│                                                                              │
│  4. Post-Merge Hook (src/index.js)                                          │
│     └─> PR merged → Index with actual outcome → Update training data       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Metrics

**Accuracy**:
- Semantic similarity: Finds truly related items (not just keyword matches)
- Typical precision@5: 80-90% for similar PRs
- Typical recall@5: 60-70% for related incidents

**Performance**:
- Embedding generation: 100ms (OpenAI) or 50ms (local)
- Index operation: 200ms (including embedding + DB write)
- Similarity search: <50ms for 100K items (with HNSW index)

**Storage**:
- ~2KB per embedding (1536 floats * 4 bytes + metadata)
- 1GB = ~500,000 embeddings

**Costs** (OpenAI + Supabase Pro):
- 1,000 PRs indexed: $0.04 + $0 = **$0.04**
- 10,000 PRs indexed: $0.40 + $25/mo = **$25.40/mo**
- 100,000 PRs indexed: $4.00 + $25/mo = **$29/mo**

**Alternatives**:
- Local embeddings: $0 (hardware only)
- Forge fallback: $0 (lower accuracy, <1000 items)
