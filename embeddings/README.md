# Embeddings & Vector Search for Code Risk Radar

Complete implementation of semantic similarity search for PRs and Jira issues using embeddings and vector databases.

## 📁 Files Overview

| File | Purpose | Lines | Dependencies |
|------|---------|-------|--------------|
| `embeddings_client.py` | Generate embeddings with OpenAI/Azure/Local | 450 | openai, tiktoken, sentence-transformers |
| `index_to_supabase.py` | Index embeddings to pgvector | 300 | supabase, embeddings_client |
| `query_similar.py` | Search similar items, get recommendations | 400 | supabase, embeddings_client |
| `fallback_similarity.js` | TF-IDF fallback for Forge | 400 | None (pure JS) |
| `schema.sql` | Supabase pgvector schema | 200 | PostgreSQL + pgvector |
| `PRIVACY.md` | Security & privacy guidelines | - | - |

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd embeddings
pip install -r requirements.txt
```

**Core dependencies**:
- `openai`: For embeddings API
- `supabase`: For vector database
- `tiktoken`: Token counting
- `numpy`: Vector operations

**Optional**:
- `sentence-transformers`: For local embeddings (privacy-sensitive)

### 2. Setup Environment Variables

```bash
# Create .env file
cat > .env << EOF
# OpenAI (for embeddings)
OPENAI_API_KEY=sk-your-api-key-here

# Supabase (for vector storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# Optional: Azure OpenAI (enterprise)
# AZURE_OPENAI_API_KEY=your-azure-key
# AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
# AZURE_OPENAI_API_VERSION=2023-05-15
EOF

# Load environment variables
source .env
```

### 3. Setup Supabase Database

```bash
# Login to Supabase dashboard: https://app.supabase.com
# Go to SQL Editor
# Copy and paste schema.sql
# Click "Run"
```

Or via CLI:
```bash
supabase db push --file schema.sql
```

### 4. Test Embeddings Generation

```python
from embeddings_client import EmbeddingsClient, EmbeddingConfig

# Initialize client
config = EmbeddingConfig(
    provider="openai",
    model="text-embedding-3-small",
    anonymize_code=True,  # Enable privacy protection
    hash_sensitive_data=True
)
client = EmbeddingsClient(config)

# Test with sample text
text = "Fix SQL injection vulnerability in authentication"
embedding = client.embed_single(text)
print(f"Generated embedding with {len(embedding)} dimensions")
```

### 5. Index Your First PR

```python
from index_to_supabase import SupabaseIndexer

indexer = SupabaseIndexer()

pr_payload = {
    "id": 123,
    "title": "Fix authentication bug",
    "description": "Replaced hardcoded credentials with environment variables",
    "repository": {"name": "backend", "full_name": "myorg/backend"},
    "files": [{"path": "src/auth/login.py"}],
    "diff": "- password = 'admin123'\n+ password = os.getenv('DB_PASSWORD')"
}

result = indexer.index_pr(pr_payload, metadata={"risk_score": 65})
print(f"✓ Indexed PR: {result['id']}")
```

### 6. Search for Similar PRs

```python
from query_similar import SimilaritySearcher

searcher = SimilaritySearcher()

# Find similar PRs
similar_prs = searcher.search_similar_prs(
    pr_payload,
    top_k=5,
    threshold=0.75  # 75% similarity minimum
)

for pr in similar_prs:
    print(f"- {pr['source_id']} (similarity: {pr['similarity']:.2%})")
    print(f"  Risk: {pr['metadata'].get('risk_score', 'N/A')}")
    print(f"  Link: {pr['metadata'].get('link', 'N/A')}")
```

---

## 📖 Detailed Usage

### Generating Embeddings

#### OpenAI (Default)

```python
from embeddings_client import EmbeddingsClient, EmbeddingConfig

config = EmbeddingConfig(
    provider="openai",
    model="text-embedding-3-small",  # 1536 dims, $0.02/1M tokens
    max_tokens=8191,
    batch_size=100,
    rate_limit_rpm=3000
)
client = EmbeddingsClient(config)

# Single embedding
embedding = client.embed_single("Your text here")

# Batch embeddings (more efficient)
texts = ["Text 1", "Text 2", "Text 3"]
embeddings = client.embed_batch(texts)
```

#### Local Embeddings (Privacy-Sensitive)

```python
config = EmbeddingConfig(
    provider="local",
    model="all-MiniLM-L6-v2",  # 384 dims, runs on CPU
    dimension=384
)
client = EmbeddingsClient(config)

embedding = client.embed_single("Your text here")
# No API calls - everything runs locally!
```

#### Azure OpenAI (Enterprise)

```python
config = EmbeddingConfig(
    provider="azure",
    model="text-embedding-3-small"  # Your deployed model name
)
client = EmbeddingsClient(config)

embedding = client.embed_single("Your text here")
```

### Indexing to Supabase

#### Index a PR

```python
from index_to_supabase import SupabaseIndexer

indexer = SupabaseIndexer()

# From webhook payload
result = indexer.index_pr(pr_payload, metadata={
    "risk_score": 85,
    "team_id": "team-backend",
    "priority": "high"
})

# Or with custom content
indexer.upsert_embedding(
    embedding_type="pr",
    source_id="myrepo/PR-456",
    content="Custom content to index",
    embedding=embedding_vector,
    metadata={"custom": "metadata"}
)
```

#### Index a Jira Issue

```python
issue_data = {
    "key": "PROJ-123",
    "fields": {
        "summary": "Production database connection timeout",
        "description": "Users unable to login due to DB timeouts",
        "issuetype": {"name": "Bug"},
        "priority": {"name": "Critical"}
    }
}

result = indexer.index_jira_issue(issue_data, metadata={
    "severity": "critical",
    "affected_users": 150
})
```

#### Batch Indexing

```python
# Index multiple PRs
prs = [pr1_payload, pr2_payload, pr3_payload]
results = indexer.index_batch(prs, item_type="pr")
print(f"Indexed {len(results)} PRs")
```

### Searching for Similar Items

#### Search by Text

```python
from query_similar import SimilaritySearcher

searcher = SimilaritySearcher()

# Search all types
results = searcher.search_by_text(
    "SQL injection vulnerability",
    threshold=0.7,
    top_k=5
)

# Filter by type
pr_results = searcher.search_by_text(
    "authentication bug",
    match_type="pr",
    threshold=0.75,
    top_k=5
)
```

#### Search with Metadata Filters

```python
# Only search within specific repository
results = searcher.search_by_text(
    "memory leak",
    match_type="pr",
    filters={"repository": "myorg/backend"}
)

# Filter by team
results = searcher.search_by_text(
    "deployment issue",
    filters={"team_id": "team-devops"}
)
```

#### Get Comprehensive Recommendations

```python
recommendations = searcher.get_recommendations(pr_payload)

print(f"Recommendation: {recommendations['recommendation']}")
print(f"\nRisk Factors:")
for factor in recommendations['risk_factors']:
    print(f"  • {factor}")

print(f"\nSimilar PRs: {len(recommendations['similar_prs'])}")
print(f"Related Incidents: {len(recommendations['related_incidents'])}")
```

#### Find Related Incidents

```python
# Find Jira issues related to a PR
incidents = searcher.find_related_incidents(
    pr_payload,
    top_k=5,
    threshold=0.7,
    days_back=90  # Last 90 days only
)

for incident in incidents:
    print(f"- {incident['source_id']} ({incident['similarity']:.2%})")
    print(f"  {incident['metadata']['summary']}")
```

---

## 🔧 CLI Usage

### Index Items

```bash
# Index a single PR
python index_to_supabase.py \
    --type pr \
    --source-id myrepo/PR-123 \
    --content @pr_content.txt \
    --metadata '{"risk_score": 85}'

# Batch index from JSON
python index_to_supabase.py \
    --type pr \
    --batch prs_to_index.json

# Show statistics
python index_to_supabase.py --stats
```

### Search Similar Items

```bash
# Search by text
python query_similar.py \
    --content "SQL injection vulnerability" \
    --type pr \
    --top-k 5 \
    --threshold 0.75

# Search from file
python query_similar.py \
    --content @pr_description.txt \
    --show-content

# Get PR recommendations
python query_similar.py \
    --pr-payload pr_data.json
```

---

## 🔄 Forge Integration

### Using Fallback Mode (No Supabase)

For Forge Functions (JavaScript only), use the TF-IDF fallback:

```javascript
// src/similaritySearch.js
import { fallbackSearcher } from './embeddings/fallback_similarity';

// Index a PR when created
export async function onPRCreated(prPayload) {
    await fallbackSearcher.indexItem('pr', `PR-${prPayload.id}`, prPayload, {
        risk_score: 85,
        repository: prPayload.repository.full_name
    });
}

// Find similar PRs
export async function findSimilar(prPayload) {
    const similarPRs = await fallbackSearcher.searchSimilarPRs(prPayload, {
        topK: 5,
        threshold: 0.3  // Lower threshold for TF-IDF
    });
    
    return similarPRs;
}

// Find related incidents
export async function getIncidents(prPayload) {
    const incidents = await fallbackSearcher.findRelatedIncidents(prPayload, {
        topK: 5,
        daysBack: 90
    });
    
    return incidents;
}
```

### Hybrid Approach (Best of Both)

Use Supabase for production, fallback for development:

```javascript
// src/vectorSearch.js
import { storage } from '@forge/api';
import { fallbackSearcher } from './embeddings/fallback_similarity';

const USE_SUPABASE = process.env.SUPABASE_URL ? true : false;

export async function searchSimilar(prPayload) {
    if (USE_SUPABASE) {
        // Call Python API endpoint
        const response = await fetch(process.env.EMBEDDINGS_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pr_payload: prPayload })
        });
        return await response.json();
    } else {
        // Use local fallback
        return await fallbackSearcher.searchSimilarPRs(prPayload);
    }
}
```

---

## 📊 Performance & Costs

### OpenAI Embeddings

| Model | Dimensions | Cost | Use Case |
|-------|------------|------|----------|
| text-embedding-3-small | 1536 | $0.02/1M tokens | General purpose (recommended) |
| text-embedding-3-large | 3072 | $0.13/1M tokens | Higher accuracy |
| text-embedding-ada-002 | 1536 | $0.10/1M tokens | Legacy |

**Example costs**:
- 1000 PRs (avg 2000 tokens each) = 2M tokens = **$0.04**
- 10,000 PRs = **$0.40**
- 100,000 PRs = **$4.00**

### Local Embeddings

| Model | Dimensions | Speed (CPU) | Quality |
|-------|------------|-------------|---------|
| all-MiniLM-L6-v2 | 384 | ~50ms/doc | Good |
| all-mpnet-base-v2 | 768 | ~100ms/doc | Better |
| sentence-t5-base | 768 | ~150ms/doc | Best |

**Costs**: $0 (hardware only)

### Supabase pgvector

- **Free tier**: 500MB database, 2GB bandwidth
- **Pro tier**: $25/mo (8GB database, 50GB bandwidth)
- **Estimated storage**: ~2KB per embedding → 250,000 embeddings per GB

### Query Performance

| Dataset Size | HNSW Index | IVFFlat Index | No Index |
|--------------|------------|---------------|----------|
| 1K items | <10ms | <20ms | <100ms |
| 10K items | <20ms | <50ms | ~1s |
| 100K items | <50ms | ~200ms | ~10s |

**Recommendation**: Use HNSW index (already in schema.sql)

---

## 🔐 Privacy & Security

See **[PRIVACY.md](./PRIVACY.md)** for detailed guidelines.

### Quick Security Checklist

- ✅ Enable `anonymize_code=True` in `EmbeddingConfig`
- ✅ Enable `hash_sensitive_data=True`
- ✅ Use environment variables for API keys (never commit)
- ✅ Enable Row-Level Security in Supabase (see schema.sql)
- ✅ Consider local embeddings for sensitive data
- ✅ Audit log all embedding requests
- ✅ Implement data retention policies

### Privacy Levels

| Level | Configuration | Use Case |
|-------|---------------|----------|
| **Low** | OpenAI + no anonymization | Open source projects |
| **Medium** | OpenAI + anonymization | Internal tools |
| **High** | Local embeddings + self-hosted DB | Financial, healthcare |

---

## 🧪 Testing

```python
# Test embeddings generation
python -c "
from embeddings_client import EmbeddingsClient, EmbeddingConfig

client = EmbeddingsClient(EmbeddingConfig(anonymize_code=True))
text = 'API_KEY=sk-1234567890 email@example.com'
processed = client.preprocess_text(text)
print(f'Anonymized: {processed}')

embedding = client.embed_single('Test text')
print(f'Embedding shape: {embedding.shape}')
"

# Test indexing
python -c "
from index_to_supabase import SupabaseIndexer

indexer = SupabaseIndexer()
stats = indexer.get_stats()
print(f'Total embeddings: {stats[\"total\"]}')
"

# Test search
python -c "
from query_similar import SimilaritySearcher

searcher = SimilaritySearcher()
results = searcher.search_by_text('authentication bug', top_k=3)
print(f'Found {len(results)} similar items')
"
```

---

## 🐛 Troubleshooting

### "Import 'supabase' could not be resolved"

```bash
pip install supabase
```

### "OPENAI_API_KEY not set"

```bash
export OPENAI_API_KEY="sk-your-key-here"
```

Or create `.env` file and use `python-dotenv`:
```python
from dotenv import load_dotenv
load_dotenv()
```

### "No module named 'sentence_transformers'"

Only needed for local embeddings:
```bash
pip install sentence-transformers torch
```

### "Rate limit exceeded"

Adjust rate limiting:
```python
config = EmbeddingConfig(
    rate_limit_rpm=500  # Lower if hitting limits
)
```

### Supabase RPC function not found

Make sure you ran `schema.sql` in Supabase SQL editor. The function `search_similar_embeddings` must exist.

### Slow search queries

1. Verify HNSW index exists:
   ```sql
   SELECT * FROM pg_indexes WHERE tablename = 'embeddings';
   ```

2. Rebuild index:
   ```sql
   REINDEX INDEX idx_embeddings_vector;
   ```

3. Analyze table:
   ```sql
   VACUUM ANALYZE embeddings;
   ```

---

## 📈 Advanced Usage

### Custom Preprocessing

```python
from embeddings_client import EmbeddingsClient

class CustomClient(EmbeddingsClient):
    def preprocess_text(self, text):
        # Custom anonymization
        text = super().preprocess_text(text)
        # Add your own rules
        text = text.replace("INTERNAL_API", "API_PLACEHOLDER")
        return text

client = CustomClient()
```

### Weighted Search

```python
# Boost recent items
from datetime import datetime, timedelta

def search_with_recency_boost(searcher, query_text, top_k=5):
    results = searcher.search_by_text(query_text, top_k=top_k * 2)
    
    now = datetime.now()
    for result in results:
        created = datetime.fromisoformat(result['created_at'].replace('Z', '+00:00'))
        days_old = (now - created).days
        
        # Boost score by recency (decay over 90 days)
        recency_boost = max(0, 1 - (days_old / 90)) * 0.2
        result['similarity'] += recency_boost
    
    # Re-sort and limit
    results.sort(key=lambda x: x['similarity'], reverse=True)
    return results[:top_k]
```

### Multi-Repository Search

```python
# Search across multiple repos with different weights
results_backend = searcher.search_by_text(
    "auth bug",
    filters={"repository": "myorg/backend"}
)

results_frontend = searcher.search_by_text(
    "auth bug",
    filters={"repository": "myorg/frontend"}
)

# Combine and deduplicate
all_results = results_backend + results_frontend
all_results.sort(key=lambda x: x['similarity'], reverse=True)
```

---

## 🚀 Next Steps

1. **MVP**: Start with OpenAI + Supabase, use anonymization
2. **Production**: Evaluate local embeddings for privacy
3. **Scale**: Add batch processing, caching, A/B testing
4. **Optimize**: Fine-tune similarity thresholds, add domain-specific preprocessing

---

## 📚 References

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Supabase pgvector Docs](https://supabase.com/docs/guides/ai/vector-indexes)
- [sentence-transformers Docs](https://www.sbert.net/)
- [Privacy Best Practices](./PRIVACY.md)

---

## Questions?

- See individual file docstrings for detailed API documentation
- Check `PRIVACY.md` for security guidelines
- Run with `--help` for CLI options
