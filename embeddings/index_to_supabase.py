"""
Index Embeddings to Supabase - Upsert embeddings and metadata to pgvector.

Usage:
    python index_to_supabase.py --type pr --source-id PR-123 --content "..." [--metadata-file metadata.json]
    
Or import and use programmatically:
    from index_to_supabase import SupabaseIndexer
    indexer = SupabaseIndexer()
    indexer.index_pr(pr_payload, embedding)
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Optional, Any
from datetime import datetime
import numpy as np
from supabase import create_client, Client
from embeddings_client import EmbeddingsClient, EmbeddingConfig, extract_pr_text, extract_jira_text


class SupabaseIndexer:
    """Index embeddings and metadata to Supabase pgvector."""
    
    def __init__(self, 
                 supabase_url: Optional[str] = None,
                 supabase_key: Optional[str] = None,
                 embeddings_client: Optional[EmbeddingsClient] = None):
        """
        Initialize Supabase client.
        
        Args:
            supabase_url: Supabase project URL (or from SUPABASE_URL env var)
            supabase_key: Supabase service role key (or from SUPABASE_SERVICE_KEY env var)
            embeddings_client: Optional pre-configured embeddings client
        """
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        self.supabase_key = supabase_key or os.getenv("SUPABASE_SERVICE_KEY")
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "Supabase credentials not found. Set SUPABASE_URL and "
                "SUPABASE_SERVICE_KEY environment variables."
            )
        
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Initialize embeddings client if not provided
        self.embeddings_client = embeddings_client or EmbeddingsClient(
            EmbeddingConfig(
                provider="openai",
                model="text-embedding-3-small",
                anonymize_code=True,
                hash_sensitive_data=True
            )
        )
    
    def upsert_embedding(self,
                        embedding_type: str,
                        source_id: str,
                        content: str,
                        embedding: np.ndarray,
                        metadata: Optional[Dict[str, Any]] = None,
                        embedding_id: Optional[str] = None) -> Dict:
        """
        Upsert an embedding to Supabase.
        
        Args:
            embedding_type: Type of entity ('pr', 'jira_issue', 'commit', 'incident')
            source_id: External identifier (e.g., 'PR-123', 'JIRA-456')
            content: Original text (for display/reference)
            embedding: Vector embedding as numpy array
            metadata: Additional metadata as dict
            embedding_id: Optional UUID for upsert (generates new if None)
        
        Returns:
            Inserted/updated record
        """
        # Convert embedding to list for JSON serialization
        embedding_list = embedding.tolist()
        
        # Prepare record
        record = {
            "type": embedding_type,
            "source_id": source_id,
            "content": content,
            "embedding": embedding_list,
            "metadata": metadata or {}
        }
        
        if embedding_id:
            record["id"] = embedding_id
        
        # Upsert (insert or update if exists)
        try:
            result = self.client.table("embeddings").upsert(record).execute()
            
            if result.data:
                print(f"✓ Indexed {embedding_type} {source_id}")
                return result.data[0]
            else:
                raise Exception("No data returned from upsert")
        
        except Exception as e:
            print(f"✗ Failed to index {embedding_type} {source_id}: {e}")
            raise
    
    def index_pr(self, pr_payload: Dict, metadata: Optional[Dict] = None) -> Dict:
        """
        Generate embedding for a PR and index it.
        
        Args:
            pr_payload: PR data from Bitbucket webhook
            metadata: Additional metadata to store
        
        Returns:
            Inserted record
        """
        # Extract text
        content = extract_pr_text(pr_payload)
        
        # Generate embedding
        embedding = self.embeddings_client.embed_single(content)
        
        # Build metadata
        pr_metadata = {
            "repository": pr_payload.get("repository", {}).get("full_name", ""),
            "link": pr_payload.get("links", {}).get("html", {}).get("href", ""),
            "author": pr_payload.get("author", {}).get("display_name", ""),
            "title": pr_payload.get("title", ""),
            "created_date": pr_payload.get("created_on", ""),
            "files_changed": len(pr_payload.get("files", [])),
            "state": pr_payload.get("state", ""),
        }
        
        # Add risk score if available
        if "risk_score" in pr_payload:
            pr_metadata["risk_score"] = pr_payload["risk_score"]
        
        # Merge with additional metadata
        if metadata:
            pr_metadata.update(metadata)
        
        # Generate source_id
        repo = pr_payload.get("repository", {}).get("name", "unknown")
        pr_id = pr_payload.get("id") or pr_payload.get("pr_id", "unknown")
        source_id = f"{repo}/PR-{pr_id}"
        
        # Truncate content for storage (store first 5000 chars)
        content_truncated = content[:5000]
        if len(content) > 5000:
            content_truncated += "\n... (truncated)"
        
        return self.upsert_embedding(
            embedding_type="pr",
            source_id=source_id,
            content=content_truncated,
            embedding=embedding,
            metadata=pr_metadata
        )
    
    def index_jira_issue(self, issue_data: Dict, metadata: Optional[Dict] = None) -> Dict:
        """
        Generate embedding for a Jira issue and index it.
        
        Args:
            issue_data: Jira issue data
            metadata: Additional metadata to store
        
        Returns:
            Inserted record
        """
        # Extract text
        content = extract_jira_text(issue_data)
        
        # Generate embedding
        embedding = self.embeddings_client.embed_single(content)
        
        # Build metadata
        fields = issue_data.get("fields", {})
        issue_metadata = {
            "issue_key": issue_data.get("key", ""),
            "issue_type": fields.get("issuetype", {}).get("name", ""),
            "priority": fields.get("priority", {}).get("name", ""),
            "status": fields.get("status", {}).get("name", ""),
            "link": issue_data.get("self", ""),
            "summary": fields.get("summary", ""),
            "created": fields.get("created", ""),
            "resolved": fields.get("resolutiondate"),
            "labels": fields.get("labels", []),
        }
        
        # Add custom fields if available
        if "customfield_10000" in fields:  # Example: risk rating
            issue_metadata["risk_rating"] = fields["customfield_10000"]
        
        # Merge with additional metadata
        if metadata:
            issue_metadata.update(metadata)
        
        source_id = issue_data.get("key", "UNKNOWN")
        
        # Truncate content
        content_truncated = content[:5000]
        if len(content) > 5000:
            content_truncated += "\n... (truncated)"
        
        return self.upsert_embedding(
            embedding_type="jira_issue",
            source_id=source_id,
            content=content_truncated,
            embedding=embedding,
            metadata=issue_metadata
        )
    
    def index_batch(self, items: List[Dict], item_type: str) -> List[Dict]:
        """
        Index multiple items in batch.
        
        Args:
            items: List of PR payloads or Jira issues
            item_type: 'pr' or 'jira_issue'
        
        Returns:
            List of inserted records
        """
        results = []
        
        for i, item in enumerate(items):
            print(f"Processing {i + 1}/{len(items)}...")
            try:
                if item_type == "pr":
                    result = self.index_pr(item)
                elif item_type == "jira_issue":
                    result = self.index_jira_issue(item)
                else:
                    raise ValueError(f"Unknown item type: {item_type}")
                
                results.append(result)
            
            except Exception as e:
                print(f"Error processing item {i + 1}: {e}")
                continue
        
        return results
    
    def check_if_exists(self, source_id: str) -> Optional[Dict]:
        """Check if an embedding already exists for a source_id."""
        result = self.client.table("embeddings")\
            .select("*")\
            .eq("source_id", source_id)\
            .limit(1)\
            .execute()
        
        if result.data:
            return result.data[0]
        return None
    
    def delete_embedding(self, source_id: str) -> bool:
        """Delete an embedding by source_id."""
        try:
            self.client.table("embeddings")\
                .delete()\
                .eq("source_id", source_id)\
                .execute()
            print(f"✓ Deleted embedding for {source_id}")
            return True
        except Exception as e:
            print(f"✗ Failed to delete {source_id}: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Get statistics about indexed embeddings."""
        result = self.client.table("embeddings")\
            .select("type", count="exact")\
            .execute()
        
        type_counts = {}
        if result.data:
            for row in result.data:
                type_counts[row["type"]] = type_counts.get(row["type"], 0) + 1
        
        return {
            "total": result.count or 0,
            "by_type": type_counts
        }


def main():
    """CLI for indexing embeddings."""
    parser = argparse.ArgumentParser(description="Index embeddings to Supabase")
    parser.add_argument("--type", required=True, 
                       choices=["pr", "jira_issue", "commit", "incident"],
                       help="Type of entity to index")
    parser.add_argument("--source-id", required=True, 
                       help="Source identifier (PR-123, JIRA-456, etc.)")
    parser.add_argument("--content", required=True,
                       help="Content to embed (or path to file with @)")
    parser.add_argument("--metadata", type=str,
                       help="Metadata as JSON string or @file.json")
    parser.add_argument("--batch", type=str,
                       help="Path to JSON file with batch of items")
    parser.add_argument("--stats", action="store_true",
                       help="Show statistics about indexed embeddings")
    
    args = parser.parse_args()
    
    # Initialize indexer
    indexer = SupabaseIndexer()
    
    # Show stats if requested
    if args.stats:
        stats = indexer.get_stats()
        print("\n=== Embedding Statistics ===")
        print(f"Total embeddings: {stats['total']}")
        print("\nBy type:")
        for type_name, count in stats['by_type'].items():
            print(f"  {type_name}: {count}")
        return
    
    # Batch processing
    if args.batch:
        with open(args.batch, 'r') as f:
            items = json.load(f)
        
        if not isinstance(items, list):
            items = [items]
        
        results = indexer.index_batch(items, args.type)
        print(f"\n✓ Indexed {len(results)}/{len(items)} items")
        return
    
    # Load content
    content = args.content
    if content.startswith("@"):
        with open(content[1:], 'r') as f:
            content = f.read()
    
    # Load metadata
    metadata = {}
    if args.metadata:
        metadata_str = args.metadata
        if metadata_str.startswith("@"):
            with open(metadata_str[1:], 'r') as f:
                metadata = json.load(f)
        else:
            metadata = json.loads(metadata_str)
    
    # Generate embedding
    embedding = indexer.embeddings_client.embed_single(content)
    
    # Index
    result = indexer.upsert_embedding(
        embedding_type=args.type,
        source_id=args.source_id,
        content=content[:5000],  # Truncate
        embedding=embedding,
        metadata=metadata
    )
    
    print(f"\n✓ Successfully indexed {args.type} {args.source_id}")
    print(f"  ID: {result['id']}")
    print(f"  Created: {result['created_at']}")


if __name__ == "__main__":
    """
    Environment Variables Required:
    - SUPABASE_URL: Your Supabase project URL
    - SUPABASE_SERVICE_KEY: Service role key (not anon key!)
    - OPENAI_API_KEY: For generating embeddings
    
    Examples:
    
    1. Index a single PR:
    python index_to_supabase.py \
        --type pr \
        --source-id myrepo/PR-123 \
        --content @pr_content.txt \
        --metadata '{"risk_score": 85, "repository": "myorg/myrepo"}'
    
    2. Index from JSON file:
    python index_to_supabase.py \
        --type pr \
        --batch prs_to_index.json
    
    3. Show statistics:
    python index_to_supabase.py --stats
    
    4. Programmatic usage:
    from index_to_supabase import SupabaseIndexer
    
    indexer = SupabaseIndexer()
    indexer.index_pr(pr_payload, metadata={"risk_score": 85})
    """
    main()
