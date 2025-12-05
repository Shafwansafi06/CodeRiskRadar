# Embeddings Quick Reference Card

## 🚀 Quick Commands

### Setup (One-Time)
```bash
cd embeddings
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
# Run schema.sql in Supabase SQL editor
```

### Generate Embeddings
```python
from embeddings_client import EmbeddingsClient, EmbeddingConfig

# OpenAI (default)
client = EmbeddingsClient(EmbeddingConfig(anonymize_code=True))
embedding = client.embed_single("Your text here")

# Local (privacy)
client = EmbeddingsClient(EmbeddingConfig(provider="local", model="all-MiniLM-L6-v2"))
embedding = client.embed_single("Your text here")
```

### Index Items
```python
from index_to_supabase import SupabaseIndexer

indexer = SupabaseIndexer()

# Index a PR
indexer.index_pr(pr_payload, metadata={"risk_score": 85})

# Index a Jira issue
indexer.index_jira_issue(issue_data)

# Batch index
indexer.index_batch(items, item_type="pr")
```

### Search Similar Items
```python
from query_similar import SimilaritySearcher

searcher = SimilaritySearcher()

# Search by text
results = searcher.search_by_text("SQL injection bug", match_type="pr", top_k=5)

# Search similar PRs
similar_prs = searcher.search_similar_prs(pr_payload, top_k=5, threshold=0.75)

# Find related incidents
incidents = searcher.find_related_incidents(pr_payload, top_k=5, days_back=90)

# Get recommendations
recommendations = searcher.get_recommendations(pr_payload)
```

### CLI Usage
```bash
# Index a PR
python index_to_supabase.py --type pr --source-id "myrepo/PR-123" --content @pr.txt --metadata '{"risk_score":85}'

# Search
python query_similar.py --content "authentication bug" --type pr --top-k 5 --threshold 0.75

# Statistics
python index_to_supabase.py --stats
```

### Forge Fallback (JavaScript)
```javascript
import { fallbackSearcher } from './embeddings/fallback_similarity';

// Index
await fallbackSearcher.indexItem('pr', 'PR-123', prPayload, {risk_score: 85});

// Search
const results = await fallbackSearcher.searchSimilarPRs(prPayload, {topK: 5, threshold: 0.3});

// Statistics
const stats = await fallbackSearcher.getStats();
```

## 📊 Cost Calculator

| Items | OpenAI Cost | Supabase Storage | Search Speed |
|-------|-------------|------------------|--------------|
| 1K | $0.04 | 2MB | <10ms |
| 10K | $0.40 | 20MB | <20ms |
| 100K | $4.00 | 200MB | <50ms |
| 1M | $40.00 | 2GB | <100ms |

## 🔐 Privacy Levels

```python
# Low (open source)
EmbeddingConfig(provider="openai", anonymize_code=False)

# Medium (internal)
EmbeddingConfig(provider="openai", anonymize_code=True, hash_sensitive_data=True)

# High (sensitive)
EmbeddingConfig(provider="local", model="all-MiniLM-L6-v2", anonymize_code=True)
```

## 🎯 Common Patterns

### Pattern 1: Index on PR Merge
```python
# After PR is merged
indexer.index_pr(pr_payload, metadata={
    "risk_score": predicted_score,
    "actual_issues": ["bug", "security_issue"],
    "resolution_time_hours": 4
})
```

### Pattern 2: Pre-Merge Risk Check
```python
# Before approving PR
similar_prs = searcher.search_similar_prs(pr_payload)
high_risk_count = sum(1 for pr in similar_prs if pr['metadata']['risk_score'] > 75)

if high_risk_count > 2:
    print("⚠️ Warning: Multiple similar high-risk PRs found")
```

### Pattern 3: Incident Correlation
```python
# When Jira bug is created
indexer.index_jira_issue(issue_data)

# Find related PRs
related_prs = searcher.search_by_text(
    issue_data['fields']['description'],
    match_type='pr',
    top_k=5
)
print(f"This bug may be related to: {[pr['source_id'] for pr in related_prs]}")
```

## 🐛 Quick Fixes

| Error | Solution |
|-------|----------|
| `Import 'openai' not found` | `pip install openai tiktoken` |
| `OPENAI_API_KEY not set` | `export OPENAI_API_KEY="sk-..."` |
| `Supabase connection failed` | Check `.env` has correct `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` |
| `Rate limit exceeded` | Lower `rate_limit_rpm` in `EmbeddingConfig` |
| `Slow queries` | Run `REINDEX INDEX idx_embeddings_vector;` in Supabase |
| `sentence-transformers not found` | `pip install sentence-transformers torch` (only for local embeddings) |

## 📚 File Reference

| File | Purpose | Import |
|------|---------|--------|
| `embeddings_client.py` | Generate embeddings | `from embeddings_client import EmbeddingsClient` |
| `index_to_supabase.py` | Index to database | `from index_to_supabase import SupabaseIndexer` |
| `query_similar.py` | Search & retrieve | `from query_similar import SimilaritySearcher` |
| `fallback_similarity.js` | Forge fallback | `import { fallbackSearcher } from './embeddings/fallback_similarity'` |
| `integration_example.py` | Full integration | `from embeddings.integration_example import EnhancedRiskAnalyzer` |

## 🔗 Quick Links

- **Full Docs**: [embeddings/README.md](README.md)
- **Privacy Guide**: [embeddings/PRIVACY.md](PRIVACY.md)
- **Database Schema**: [embeddings/schema.sql](schema.sql)
- **Complete Guide**: [EMBEDDINGS_COMPLETE.md](../EMBEDDINGS_COMPLETE.md)

## ⚡ One-Liner Tests

```bash
# Test OpenAI connection
python -c "from embeddings_client import EmbeddingsClient; print(EmbeddingsClient().embed_single('test').shape)"

# Test Supabase connection
python -c "from index_to_supabase import SupabaseIndexer; print(SupabaseIndexer().get_stats())"

# Test search
python -c "from query_similar import SimilaritySearcher; print(len(SimilaritySearcher().search_by_text('bug', top_k=3)))"
```

## 🎉 Next Steps

1. ✅ Run setup commands above
2. ✅ Test with example PR
3. ✅ Index historical data
4. ✅ Integrate with ML pipeline
5. ✅ Deploy to production

---

**Need help?** See [embeddings/README.md](README.md) for detailed documentation.
