# Privacy & Security Considerations for Embeddings

## Overview

When implementing embeddings and vector search for code and issues, you're potentially sending sensitive data (proprietary code, internal documentation, security vulnerabilities) to third-party APIs. This document outlines privacy risks and mitigation strategies.

---

## Risk Assessment

### What Gets Embedded?

1. **PR Diffs**: Actual source code changes
2. **Jira Issues**: Bug reports, security vulnerabilities, internal discussions
3. **Commit Messages**: May contain sensitive information
4. **File Paths**: Can reveal internal project structure

### Potential Exposure

- **API Providers** (OpenAI, Azure): Your data passes through their servers
- **Supabase**: Stores embeddings and metadata (but you control the instance)
- **Network Transit**: Data transmitted over internet (HTTPS mitigates but not eliminates risk)

---

## Privacy-Preserving Strategies

### Option 1: Data Anonymization (Implemented)

**What it does**: Replace sensitive identifiers before embedding

**In `embeddings_client.py`**:
```python
config = EmbeddingConfig(
    anonymize_code=True,        # Replace emails, IPs, URLs
    hash_sensitive_data=True     # Hash secrets, tokens
)
```

**Anonymization rules**:
- Emails → `EMAIL_PLACEHOLDER`
- IP addresses → `IP_PLACEHOLDER`
- API keys/tokens → `API_KEY_PLACEHOLDER`
- URLs → `URL_PLACEHOLDER`
- Passwords/secrets → `HASHED_<hash>` (SHA-256)

**Limitations**:
- Code logic still visible
- May reduce embedding quality
- Not foolproof for all sensitive patterns

---

### Option 2: Local Embeddings (Recommended for Sensitive Data)

**What it does**: Generate embeddings on your own infrastructure (no API calls)

**Setup**:
```bash
pip install sentence-transformers torch
```

**In `embeddings_client.py`**:
```python
config = EmbeddingConfig(
    provider="local",
    model="all-MiniLM-L6-v2",  # 384 dimensions, runs on CPU
    dimension=384
)
client = EmbeddingsClient(config)
embedding = client.embed_single(text)  # Runs locally
```

**Pros**:
✅ Complete data privacy (never leaves your network)
✅ No per-token costs
✅ Works offline
✅ Consistent performance

**Cons**:
❌ Requires GPU/CPU resources
❌ Slightly lower quality than OpenAI (but still good)
❌ Larger model files (~100MB)

**Recommended Models**:
- `all-MiniLM-L6-v2`: 384 dims, fast, good quality
- `all-mpnet-base-v2`: 768 dims, better quality, slower
- `paraphrase-multilingual-MiniLM-L12-v2`: For non-English code comments

---

### Option 3: Azure OpenAI (Enterprise)

**What it does**: Use Azure OpenAI with data residency guarantees

**Setup**:
```bash
export AZURE_OPENAI_API_KEY="your-key"
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com/"
export AZURE_OPENAI_API_VERSION="2023-05-15"
```

**In `embeddings_client.py`**:
```python
config = EmbeddingConfig(
    provider="azure",
    model="text-embedding-3-small"  # Deployed model name
)
```

**Pros**:
✅ Microsoft's enterprise SLAs
✅ Data stays in your Azure region
✅ GDPR/HIPAA compliant options
✅ Same quality as OpenAI

**Cons**:
❌ More expensive than OpenAI direct
❌ Requires Azure subscription
❌ More complex setup

---

### Option 4: Self-Hosted Vector Database

**What it does**: Run pgvector on your own Postgres instance

**Instead of Supabase**:
```bash
# Docker Compose
docker run -d \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -v pgdata:/var/lib/postgresql/data \
  pgvector/pgvector:latest
```

**Update connection string**:
```python
# In index_to_supabase.py
supabase_url = "postgresql://localhost:5432/mydb"
```

**Pros**:
✅ Complete control over data
✅ No third-party database access
✅ Can run on-premises

**Cons**:
❌ You manage backups, scaling, security
❌ More operational overhead

---

## Access Control Best Practices

### 1. Use Service Accounts

```python
# NEVER commit these to git
OPENAI_API_KEY="sk-..."          # Read from env vars only
SUPABASE_SERVICE_KEY="..."       # Use service role, not anon key
```

### 2. Row-Level Security (RLS) in Supabase

```sql
-- In schema.sql
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Users can only see their team's embeddings
CREATE POLICY "Team isolation"
ON embeddings
FOR SELECT
TO authenticated
USING (
    auth.jwt() ->> 'team_id' = metadata ->> 'team_id'
);
```

### 3. Metadata Filtering

```python
# Don't embed sensitive metadata, store separately
metadata = {
    "risk_score": 85,
    "repository": "myorg/myrepo",
    "team_id": "team-123",
    # ❌ Don't include: passwords, tokens, PII
}
```

### 4. Audit Logging

```python
# Log all embedding requests
import logging

logging.info(f"Embedding requested: type={type}, source={source_id}, user={user_id}")
```

---

## Compliance Considerations

### GDPR (EU)

- **Right to erasure**: Implement deletion of embeddings
  ```python
  indexer.delete_embedding(source_id)
  ```
- **Data minimization**: Only embed necessary data
- **Consent**: Inform users their code is being embedded

### HIPAA (Healthcare)

- **Use Azure OpenAI** with BAA (Business Associate Agreement)
- **Encrypt at rest**: Supabase supports encryption
- **Audit trails**: Log all access

### SOC 2 (SaaS)

- **Access controls**: RLS policies
- **Encryption in transit**: HTTPS/TLS
- **Vendor management**: Review OpenAI/Supabase SOC 2 reports

---

## Recommended Configuration by Sensitivity

### Low Sensitivity (Open Source Projects)
```python
EmbeddingConfig(
    provider="openai",
    model="text-embedding-3-small",
    anonymize_code=False,
    hash_sensitive_data=False
)
```

### Medium Sensitivity (Internal Tools)
```python
EmbeddingConfig(
    provider="openai",
    model="text-embedding-3-small",
    anonymize_code=True,      # ✓ Anonymize
    hash_sensitive_data=True   # ✓ Hash secrets
)
```

### High Sensitivity (Financial, Healthcare)
```python
EmbeddingConfig(
    provider="local",                    # ✓ Local models
    model="all-MiniLM-L6-v2",
    anonymize_code=True,
    hash_sensitive_data=True
)
# + Self-hosted pgvector
# + Network isolation
```

---

## Testing Privacy Measures

```python
# Test that secrets are anonymized
client = EmbeddingsClient(EmbeddingConfig(
    anonymize_code=True,
    hash_sensitive_data=True
))

text = "API_KEY=sk-1234567890abcdef password=secret123"
processed = client.preprocess_text(text)

assert "sk-1234567890abcdef" not in processed
assert "secret123" not in processed
print(processed)  # Should show placeholders/hashes
```

---

## Fallback Mode (Forge Entities)

The JavaScript fallback (`fallback_similarity.js`) stores everything in Forge Entities:

**Privacy benefits**:
- ✅ Data stays in Atlassian's infrastructure
- ✅ No external API calls
- ✅ Subject to Atlassian's security policies

**Limitations**:
- Lower quality similarity search (TF-IDF vs embeddings)
- Not suitable for large datasets (>1000 items)

---

## Summary

| Strategy | Privacy | Quality | Cost | Complexity |
|----------|---------|---------|------|------------|
| OpenAI + Anonymization | Medium | High | $$ | Low |
| Local Embeddings | High | Medium | $ | Medium |
| Azure OpenAI | High | High | $$$ | Medium |
| Fallback (TF-IDF) | High | Low | $ | Low |

**Recommendation**:
- **MVP**: OpenAI + anonymization + Supabase
- **Production**: Local embeddings + self-hosted pgvector
- **Enterprise**: Azure OpenAI + Azure Postgres

---

## Questions?

- See `embeddings_client.py` for implementation details
- See `schema.sql` for RLS policies
- Contact your security team for compliance requirements
