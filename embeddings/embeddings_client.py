"""
Embeddings Client - Generate embeddings for PR diffs and Jira issue text.

Supports multiple providers:
- OpenAI (text-embedding-3-small, text-embedding-3-large)
- Azure OpenAI (for enterprise deployments)
- Local models (sentence-transformers for privacy-sensitive data)

Features:
- Automatic chunking for long texts (>8k tokens)
- Rate limiting and retry with exponential backoff
- Batch processing for efficiency
- Privacy-preserving options
"""

import os
import time
import hashlib
from typing import List, Dict, Optional, Literal
from dataclasses import dataclass
import tiktoken
import openai
from openai import OpenAI, AzureOpenAI
import numpy as np

# Optional: Local embeddings for privacy
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False


@dataclass
class EmbeddingConfig:
    """Configuration for embeddings generation."""
    provider: Literal["openai", "azure", "local"] = "openai"
    model: str = "text-embedding-3-small"  # 1536 dimensions, $0.02/1M tokens
    max_tokens: int = 8191  # Max context for text-embedding-3-small
    batch_size: int = 100  # OpenAI allows up to 2048 in a batch
    rate_limit_rpm: int = 3000  # Requests per minute
    dimension: int = 1536  # Output dimension
    
    # Privacy options
    anonymize_code: bool = False  # Replace identifiers with placeholders
    hash_sensitive_data: bool = False  # Hash secrets before embedding


class RateLimiter:
    """Simple token bucket rate limiter."""
    
    def __init__(self, requests_per_minute: int):
        self.rpm = requests_per_minute
        self.tokens = requests_per_minute
        self.last_update = time.time()
        self.min_interval = 60.0 / requests_per_minute
    
    def wait_if_needed(self):
        """Block until a token is available."""
        now = time.time()
        time_passed = now - self.last_update
        self.tokens = min(self.rpm, self.tokens + time_passed * (self.rpm / 60.0))
        self.last_update = now
        
        if self.tokens < 1:
            sleep_time = self.min_interval
            time.sleep(sleep_time)
            self.tokens = 1
        
        self.tokens -= 1


class EmbeddingsClient:
    """Generate embeddings with chunking and rate limiting."""
    
    def __init__(self, config: Optional[EmbeddingConfig] = None):
        self.config = config or EmbeddingConfig()
        self.rate_limiter = RateLimiter(self.config.rate_limit_rpm)
        
        # Initialize provider
        if self.config.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            self.client = OpenAI(api_key=api_key)
        
        elif self.config.provider == "azure":
            api_key = os.getenv("AZURE_OPENAI_API_KEY")
            endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
            api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2023-05-15")
            if not api_key or not endpoint:
                raise ValueError("Azure OpenAI credentials not set")
            self.client = AzureOpenAI(
                api_key=api_key,
                azure_endpoint=endpoint,
                api_version=api_version
            )
        
        elif self.config.provider == "local":
            if not HAS_SENTENCE_TRANSFORMERS:
                raise ImportError(
                    "sentence-transformers not installed. "
                    "Run: pip install sentence-transformers"
                )
            # Use local model for privacy-sensitive deployments
            self.client = SentenceTransformer(
                self.config.model or 'all-MiniLM-L6-v2'
            )
        
        else:
            raise ValueError(f"Unknown provider: {self.config.provider}")
        
        # Tokenizer for chunking
        try:
            self.tokenizer = tiktoken.encoding_for_model(self.config.model)
        except KeyError:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
    
    def count_tokens(self, text: str) -> int:
        """Count tokens in text."""
        return len(self.tokenizer.encode(text))
    
    def chunk_text(self, text: str, max_tokens: int) -> List[str]:
        """
        Split text into chunks that fit within token limit.
        Tries to split on natural boundaries (newlines, sentences).
        """
        tokens = self.tokenizer.encode(text)
        
        if len(tokens) <= max_tokens:
            return [text]
        
        chunks = []
        current_chunk = []
        
        # Split by lines first
        lines = text.split('\n')
        
        for line in lines:
            line_tokens = self.tokenizer.encode(line)
            
            if len(current_chunk) + len(line_tokens) > max_tokens:
                if current_chunk:
                    chunk_text = self.tokenizer.decode(current_chunk)
                    chunks.append(chunk_text)
                    current_chunk = []
                
                # If single line is too long, force split
                if len(line_tokens) > max_tokens:
                    for i in range(0, len(line_tokens), max_tokens):
                        sub_chunk = line_tokens[i:i + max_tokens]
                        chunks.append(self.tokenizer.decode(sub_chunk))
                else:
                    current_chunk = line_tokens
            else:
                current_chunk.extend(line_tokens)
                current_chunk.append(self.tokenizer.encode('\n')[0])
        
        if current_chunk:
            chunks.append(self.tokenizer.decode(current_chunk))
        
        return chunks
    
    def anonymize_code(self, text: str) -> str:
        """
        Replace potentially sensitive identifiers with placeholders.
        Basic implementation - customize for your use case.
        """
        import re
        
        # Replace email addresses
        text = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 
                     'EMAIL_PLACEHOLDER', text)
        
        # Replace IP addresses
        text = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', 'IP_PLACEHOLDER', text)
        
        # Replace API keys (common patterns)
        text = re.sub(r'["\']?(?:api[_-]?key|token|secret)["\']?\s*[:=]\s*["\']?[\w\-]{20,}["\']?',
                     'API_KEY_PLACEHOLDER', text, flags=re.IGNORECASE)
        
        # Replace URLs
        text = re.sub(r'https?://[^\s]+', 'URL_PLACEHOLDER', text)
        
        return text
    
    def hash_sensitive_content(self, text: str) -> str:
        """Hash portions of text that might contain secrets."""
        import re
        
        def hash_match(match):
            hashed = hashlib.sha256(match.group(0).encode()).hexdigest()[:16]
            return f"HASHED_{hashed}"
        
        # Hash potential secrets
        text = re.sub(
            r'["\']?(?:password|secret|token|key)["\']?\s*[:=]\s*["\']?[\w\-]{8,}["\']?',
            hash_match, text, flags=re.IGNORECASE
        )
        
        return text
    
    def preprocess_text(self, text: str) -> str:
        """Apply privacy-preserving preprocessing."""
        if self.config.anonymize_code:
            text = self.anonymize_code(text)
        
        if self.config.hash_sensitive_data:
            text = self.hash_sensitive_content(text)
        
        return text
    
    def embed_single(self, text: str) -> np.ndarray:
        """Generate embedding for a single text (handles chunking internally)."""
        text = self.preprocess_text(text)
        
        # Check if chunking needed
        token_count = self.count_tokens(text)
        
        if token_count <= self.config.max_tokens:
            return self._embed_chunk(text)
        
        # Split and embed chunks, then average
        chunks = self.chunk_text(text, self.config.max_tokens)
        embeddings = [self._embed_chunk(chunk) for chunk in chunks]
        
        # Average pooling
        avg_embedding = np.mean(embeddings, axis=0)
        # Normalize
        return avg_embedding / np.linalg.norm(avg_embedding)
    
    def _embed_chunk(self, text: str) -> np.ndarray:
        """Generate embedding for a single chunk (no chunking)."""
        self.rate_limiter.wait_if_needed()
        
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                if self.config.provider in ["openai", "azure"]:
                    response = self.client.embeddings.create(
                        input=text,
                        model=self.config.model
                    )
                    embedding = response.data[0].embedding
                    return np.array(embedding, dtype=np.float32)
                
                elif self.config.provider == "local":
                    embedding = self.client.encode(text, convert_to_numpy=True)
                    return embedding.astype(np.float32)
            
            except openai.RateLimitError as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)
                    print(f"Rate limited, waiting {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise
            
            except Exception as e:
                print(f"Error generating embedding (attempt {attempt + 1}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                else:
                    raise
        
        raise RuntimeError("Failed to generate embedding after retries")
    
    def embed_batch(self, texts: List[str]) -> List[np.ndarray]:
        """
        Generate embeddings for multiple texts in batches.
        More efficient than calling embed_single repeatedly.
        """
        embeddings = []
        
        # Process in batches
        for i in range(0, len(texts), self.config.batch_size):
            batch = texts[i:i + self.config.batch_size]
            
            # Preprocess all texts
            processed_batch = [self.preprocess_text(t) for t in batch]
            
            # Check if any need chunking
            needs_chunking = any(
                self.count_tokens(t) > self.config.max_tokens 
                for t in processed_batch
            )
            
            if needs_chunking:
                # Fall back to individual processing for simplicity
                batch_embeddings = [self.embed_single(t) for t in batch]
            else:
                # Batch API call
                batch_embeddings = self._embed_batch_api(processed_batch)
            
            embeddings.extend(batch_embeddings)
        
        return embeddings
    
    def _embed_batch_api(self, texts: List[str]) -> List[np.ndarray]:
        """Generate embeddings using batch API."""
        self.rate_limiter.wait_if_needed()
        
        if self.config.provider in ["openai", "azure"]:
            response = self.client.embeddings.create(
                input=texts,
                model=self.config.model
            )
            embeddings = [
                np.array(item.embedding, dtype=np.float32) 
                for item in response.data
            ]
            return embeddings
        
        elif self.config.provider == "local":
            embeddings = self.client.encode(texts, convert_to_numpy=True)
            return [emb.astype(np.float32) for emb in embeddings]
        
        raise ValueError(f"Unknown provider: {self.config.provider}")


def extract_pr_text(pr_payload: Dict) -> str:
    """Extract relevant text from PR payload for embedding."""
    parts = []
    
    # Title and description
    if 'title' in pr_payload:
        parts.append(f"Title: {pr_payload['title']}")
    
    if 'description' in pr_payload:
        parts.append(f"Description: {pr_payload['description']}")
    
    # File changes (paths only for privacy)
    if 'files' in pr_payload:
        file_paths = [f.get('path', '') for f in pr_payload['files']]
        parts.append(f"Changed files: {', '.join(file_paths[:20])}")  # Limit length
    
    # Diff (truncate if too long)
    if 'diff' in pr_payload:
        diff = pr_payload['diff']
        if len(diff) > 50000:  # ~12k tokens
            diff = diff[:50000] + "\n... (truncated)"
        parts.append(f"Diff:\n{diff}")
    
    return "\n\n".join(parts)


def extract_jira_text(issue_data: Dict) -> str:
    """Extract relevant text from Jira issue for embedding."""
    parts = []
    
    # Key and summary
    if 'key' in issue_data:
        parts.append(f"Issue: {issue_data['key']}")
    
    if 'fields' in issue_data:
        fields = issue_data['fields']
        
        if 'summary' in fields:
            parts.append(f"Summary: {fields['summary']}")
        
        if 'description' in fields:
            parts.append(f"Description: {fields['description']}")
        
        if 'labels' in fields:
            parts.append(f"Labels: {', '.join(fields['labels'])}")
        
        # Comments (last 5 for context)
        if 'comment' in fields and 'comments' in fields['comment']:
            comments = fields['comment']['comments'][-5:]
            comment_texts = [c.get('body', '') for c in comments]
            parts.append(f"Recent comments:\n" + "\n".join(comment_texts))
    
    return "\n\n".join(parts)


# Example usage
if __name__ == "__main__":
    """
    Environment Variables Required:
    - OPENAI_API_KEY: Your OpenAI API key
    
    For Azure:
    - AZURE_OPENAI_API_KEY
    - AZURE_OPENAI_ENDPOINT
    - AZURE_OPENAI_API_VERSION (optional)
    
    For local (no API key needed):
    - pip install sentence-transformers
    """
    
    # Example 1: OpenAI embeddings
    config = EmbeddingConfig(
        provider="openai",
        model="text-embedding-3-small",
        anonymize_code=True,  # Enable privacy protection
        hash_sensitive_data=True
    )
    client = EmbeddingsClient(config)
    
    # Example PR payload
    pr_payload = {
        "title": "Fix SQL injection vulnerability in auth module",
        "description": "Replaced string concatenation with parameterized queries",
        "files": [
            {"path": "src/auth/login.py"},
            {"path": "src/auth/register.py"}
        ],
        "diff": """
diff --git a/src/auth/login.py b/src/auth/login.py
- query = "SELECT * FROM users WHERE email = '" + email + "'"
+ query = "SELECT * FROM users WHERE email = %s"
+ cursor.execute(query, (email,))
"""
    }
    
    text = extract_pr_text(pr_payload)
    print(f"Text length: {len(text)} chars, {client.count_tokens(text)} tokens")
    
    embedding = client.embed_single(text)
    print(f"Embedding shape: {embedding.shape}")
    print(f"Embedding (first 10 dims): {embedding[:10]}")
    
    # Example 2: Local embeddings (privacy-sensitive)
    # config_local = EmbeddingConfig(
    #     provider="local",
    #     model="all-MiniLM-L6-v2",  # 384 dimensions, runs locally
    #     dimension=384
    # )
    # client_local = EmbeddingsClient(config_local)
    # embedding_local = client_local.embed_single(text)
    
    # Example 3: Batch processing
    texts = [
        "Fix authentication bug in login flow",
        "Add unit tests for payment module",
        "Refactor database connection pooling"
    ]
    embeddings = client.embed_batch(texts)
    print(f"Generated {len(embeddings)} embeddings")
