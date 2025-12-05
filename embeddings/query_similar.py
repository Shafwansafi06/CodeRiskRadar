"""
Query Similar Embeddings - Find top-k similar PRs, issues, or incidents.

Usage:
    python query_similar.py --content "..." --type pr --top-k 5
    
Or import and use programmatically:
    from query_similar import SimilaritySearcher
    searcher = SimilaritySearcher()
    results = searcher.search_similar_prs(pr_payload, top_k=5)
"""

import os
import sys
import json
import argparse
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timedelta
import numpy as np
from supabase import create_client, Client
from embeddings_client import (
    EmbeddingsClient, EmbeddingConfig, 
    extract_pr_text, extract_jira_text
)


class SimilaritySearcher:
    """Search for similar embeddings in Supabase pgvector."""
    
    def __init__(self,
                 supabase_url: Optional[str] = None,
                 supabase_key: Optional[str] = None,
                 embeddings_client: Optional[EmbeddingsClient] = None):
        """
        Initialize Supabase client and embeddings generator.
        
        Args:
            supabase_url: Supabase project URL (or from SUPABASE_URL env var)
            supabase_key: Supabase service/anon key (or from SUPABASE_KEY env var)
            embeddings_client: Optional pre-configured embeddings client
        """
        self.supabase_url = supabase_url or os.getenv("SUPABASE_URL")
        # Try service key first, fall back to anon key
        self.supabase_key = (
            supabase_key or 
            os.getenv("SUPABASE_SERVICE_KEY") or 
            os.getenv("SUPABASE_KEY")
        )
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError(
                "Supabase credentials not found. Set SUPABASE_URL and "
                "SUPABASE_KEY (or SUPABASE_SERVICE_KEY) environment variables."
            )
        
        self.client: Client = create_client(self.supabase_url, self.supabase_key)
        
        # Initialize embeddings client
        self.embeddings_client = embeddings_client or EmbeddingsClient(
            EmbeddingConfig(
                provider="openai",
                model="text-embedding-3-small",
                anonymize_code=True,
                hash_sensitive_data=True
            )
        )
    
    def search(self,
               query_embedding: np.ndarray,
               match_type: Optional[str] = None,
               match_threshold: float = 0.7,
               match_count: int = 5,
               filters: Optional[Dict[str, Any]] = None) -> List[Dict]:
        """
        Search for similar embeddings.
        
        Args:
            query_embedding: Query vector
            match_type: Filter by type ('pr', 'jira_issue', etc.) or None for all
            match_threshold: Minimum similarity score (0-1)
            match_count: Number of results to return
            filters: Additional filters on metadata (e.g., {"repository": "myorg/myrepo"})
        
        Returns:
            List of similar items with scores and metadata
        """
        # Convert embedding to list for JSON
        query_list = query_embedding.tolist()
        
        # Call Supabase RPC function
        try:
            result = self.client.rpc(
                "search_similar_embeddings",
                {
                    "query_embedding": query_list,
                    "match_type": match_type,
                    "match_threshold": match_threshold,
                    "match_count": match_count
                }
            ).execute()
            
            similar_items = result.data or []
            
            # Apply additional filters if provided
            if filters:
                similar_items = self._apply_metadata_filters(similar_items, filters)
            
            return similar_items
        
        except Exception as e:
            print(f"Error searching embeddings: {e}")
            # Try fallback query if RPC fails
            return self._search_fallback(
                query_list, match_type, match_threshold, match_count, filters
            )
    
    def _search_fallback(self,
                        query_list: List[float],
                        match_type: Optional[str],
                        match_threshold: float,
                        match_count: int,
                        filters: Optional[Dict]) -> List[Dict]:
        """
        Fallback search using direct SQL query if RPC function not available.
        """
        query = self.client.table("embeddings").select("*")
        
        if match_type:
            query = query.eq("type", match_type)
        
        # Execute query and compute similarities in Python
        result = query.limit(1000).execute()  # Get a large batch
        
        if not result.data:
            return []
        
        # Compute similarities
        items_with_scores = []
        query_array = np.array(query_list)
        
        for item in result.data:
            item_embedding = np.array(item["embedding"])
            # Cosine similarity
            similarity = np.dot(query_array, item_embedding) / (
                np.linalg.norm(query_array) * np.linalg.norm(item_embedding)
            )
            
            if similarity >= match_threshold:
                items_with_scores.append({
                    **item,
                    "similarity": float(similarity)
                })
        
        # Sort by similarity
        items_with_scores.sort(key=lambda x: x["similarity"], reverse=True)
        
        # Apply filters
        if filters:
            items_with_scores = self._apply_metadata_filters(items_with_scores, filters)
        
        return items_with_scores[:match_count]
    
    def _apply_metadata_filters(self, items: List[Dict], filters: Dict) -> List[Dict]:
        """Filter items by metadata fields."""
        filtered = []
        
        for item in items:
            metadata = item.get("metadata", {})
            matches = all(
                metadata.get(key) == value
                for key, value in filters.items()
            )
            if matches:
                filtered.append(item)
        
        return filtered
    
    def search_by_text(self,
                      query_text: str,
                      match_type: Optional[str] = None,
                      match_threshold: float = 0.7,
                      match_count: int = 5,
                      filters: Optional[Dict[str, Any]] = None) -> List[Dict]:
        """
        Search for similar embeddings by text query.
        
        Args:
            query_text: Text to search for
            match_type: Filter by type or None
            match_threshold: Minimum similarity
            match_count: Number of results
            filters: Metadata filters
        
        Returns:
            List of similar items
        """
        # Generate embedding for query
        query_embedding = self.embeddings_client.embed_single(query_text)
        
        return self.search(
            query_embedding,
            match_type=match_type,
            match_threshold=match_threshold,
            match_count=match_count,
            filters=filters
        )
    
    def search_similar_prs(self,
                          pr_payload: Dict,
                          top_k: int = 5,
                          threshold: float = 0.75,
                          same_repo_only: bool = False) -> List[Dict]:
        """
        Find similar PRs to a given PR.
        
        Args:
            pr_payload: PR data from Bitbucket webhook
            top_k: Number of similar PRs to return
            threshold: Minimum similarity score
            same_repo_only: Only search within same repository
        
        Returns:
            List of similar PRs with metadata and scores
        """
        # Extract text and generate embedding
        content = extract_pr_text(pr_payload)
        query_embedding = self.embeddings_client.embed_single(content)
        
        # Build filters
        filters = None
        if same_repo_only:
            repo_name = pr_payload.get("repository", {}).get("full_name", "")
            if repo_name:
                filters = {"repository": repo_name}
        
        return self.search(
            query_embedding,
            match_type="pr",
            match_threshold=threshold,
            match_count=top_k,
            filters=filters
        )
    
    def search_similar_issues(self,
                             issue_data: Dict,
                             top_k: int = 5,
                             threshold: float = 0.75) -> List[Dict]:
        """
        Find similar Jira issues to a given issue.
        
        Args:
            issue_data: Jira issue data
            top_k: Number of similar issues to return
            threshold: Minimum similarity score
        
        Returns:
            List of similar issues with metadata and scores
        """
        content = extract_jira_text(issue_data)
        query_embedding = self.embeddings_client.embed_single(content)
        
        return self.search(
            query_embedding,
            match_type="jira_issue",
            match_threshold=threshold,
            match_count=top_k
        )
    
    def find_related_incidents(self,
                              pr_payload: Dict,
                              top_k: int = 5,
                              threshold: float = 0.7,
                              days_back: int = 90) -> List[Dict]:
        """
        Find historical incidents (Jira issues) related to a PR.
        
        Args:
            pr_payload: PR data
            top_k: Number of incidents to return
            threshold: Minimum similarity
            days_back: Only search incidents from last N days
        
        Returns:
            List of related incidents with context
        """
        content = extract_pr_text(pr_payload)
        query_embedding = self.embeddings_client.embed_single(content)
        
        # Search Jira issues
        similar_issues = self.search(
            query_embedding,
            match_type="jira_issue",
            match_threshold=threshold,
            match_count=top_k * 2  # Get more candidates for filtering
        )
        
        # Filter by date if specified
        if days_back:
            cutoff = datetime.now() - timedelta(days=days_back)
            similar_issues = [
                issue for issue in similar_issues
                if datetime.fromisoformat(
                    issue.get("created_at", "").replace("Z", "+00:00")
                ) >= cutoff
            ]
        
        return similar_issues[:top_k]
    
    def format_results(self, results: List[Dict], include_content: bool = False) -> str:
        """
        Format search results for display.
        
        Args:
            results: List of search results
            include_content: Whether to include full content
        
        Returns:
            Formatted string
        """
        if not results:
            return "No similar items found."
        
        output = []
        output.append(f"\n=== Found {len(results)} Similar Items ===\n")
        
        for i, item in enumerate(results, 1):
            metadata = item.get("metadata", {})
            similarity = item.get("similarity", 0)
            
            output.append(f"{i}. {item['source_id']} (similarity: {similarity:.2%})")
            output.append(f"   Type: {item['type']}")
            
            if "link" in metadata:
                output.append(f"   Link: {metadata['link']}")
            
            if "risk_score" in metadata:
                output.append(f"   Risk Score: {metadata['risk_score']}")
            
            if "summary" in metadata:
                output.append(f"   Summary: {metadata['summary']}")
            
            if "title" in metadata:
                output.append(f"   Title: {metadata['title']}")
            
            if include_content:
                content = item.get("content", "")[:200]
                output.append(f"   Content: {content}...")
            
            output.append("")  # Blank line
        
        return "\n".join(output)
    
    def get_recommendations(self, pr_payload: Dict) -> Dict:
        """
        Get comprehensive recommendations based on similar PRs and incidents.
        
        Args:
            pr_payload: PR data
        
        Returns:
            Dict with similar PRs, related incidents, and risk assessment
        """
        # Find similar PRs
        similar_prs = self.search_similar_prs(pr_payload, top_k=5, threshold=0.75)
        
        # Find related incidents
        related_incidents = self.find_related_incidents(pr_payload, top_k=5, threshold=0.7)
        
        # Calculate aggregate risk from historical data
        incident_count = len([
            inc for inc in related_incidents 
            if inc.get("similarity", 0) > 0.8
        ])
        
        high_risk_prs = [
            pr for pr in similar_prs
            if pr.get("metadata", {}).get("risk_score", 0) > 75
        ]
        
        risk_factors = []
        if incident_count > 0:
            risk_factors.append(
                f"{incident_count} similar incident(s) found in past 90 days"
            )
        
        if high_risk_prs:
            risk_factors.append(
                f"{len(high_risk_prs)} similar high-risk PR(s) found"
            )
        
        return {
            "similar_prs": similar_prs,
            "related_incidents": related_incidents,
            "risk_factors": risk_factors,
            "recommendation": (
                "High risk - review carefully" if risk_factors 
                else "Low risk based on historical data"
            )
        }


def main():
    """CLI for searching similar embeddings."""
    parser = argparse.ArgumentParser(description="Search similar embeddings")
    parser.add_argument("--content", required=True,
                       help="Content to search for (or @file.txt)")
    parser.add_argument("--type", 
                       choices=["pr", "jira_issue", "commit", "incident"],
                       help="Filter by type")
    parser.add_argument("--top-k", type=int, default=5,
                       help="Number of results (default: 5)")
    parser.add_argument("--threshold", type=float, default=0.7,
                       help="Minimum similarity threshold (default: 0.7)")
    parser.add_argument("--filters", type=str,
                       help="Metadata filters as JSON")
    parser.add_argument("--show-content", action="store_true",
                       help="Show full content in results")
    parser.add_argument("--pr-payload", type=str,
                       help="Path to PR payload JSON for recommendations")
    
    args = parser.parse_args()
    
    # Initialize searcher
    searcher = SimilaritySearcher()
    
    # Handle PR recommendations
    if args.pr_payload:
        with open(args.pr_payload, 'r') as f:
            pr_payload = json.load(f)
        
        recommendations = searcher.get_recommendations(pr_payload)
        
        print("\n=== PR Risk Assessment ===")
        print(f"\nRecommendation: {recommendations['recommendation']}")
        
        if recommendations['risk_factors']:
            print("\nRisk Factors:")
            for factor in recommendations['risk_factors']:
                print(f"  • {factor}")
        
        print(searcher.format_results(
            recommendations['similar_prs'], 
            include_content=args.show_content
        ))
        
        if recommendations['related_incidents']:
            print("\n=== Related Incidents ===")
            print(searcher.format_results(
                recommendations['related_incidents'],
                include_content=args.show_content
            ))
        
        return
    
    # Load content
    content = args.content
    if content.startswith("@"):
        with open(content[1:], 'r') as f:
            content = f.read()
    
    # Parse filters
    filters = None
    if args.filters:
        filters = json.loads(args.filters)
    
    # Search
    results = searcher.search_by_text(
        content,
        match_type=args.type,
        match_threshold=args.threshold,
        match_count=args.top_k,
        filters=filters
    )
    
    # Display results
    print(searcher.format_results(results, include_content=args.show_content))


if __name__ == "__main__":
    """
    Environment Variables Required:
    - SUPABASE_URL: Your Supabase project URL
    - SUPABASE_KEY: Supabase anon or service key
    - OPENAI_API_KEY: For generating query embeddings
    
    Examples:
    
    1. Search by text:
    python query_similar.py \
        --content "SQL injection vulnerability in auth module" \
        --type pr \
        --top-k 5 \
        --threshold 0.75
    
    2. Search from file:
    python query_similar.py \
        --content @pr_description.txt \
        --type jira_issue \
        --show-content
    
    3. Get PR recommendations:
    python query_similar.py \
        --pr-payload pr_data.json
    
    4. Filter by repository:
    python query_similar.py \
        --content "Authentication bug" \
        --type pr \
        --filters '{"repository": "myorg/backend"}'
    
    5. Programmatic usage:
    from query_similar import SimilaritySearcher
    
    searcher = SimilaritySearcher()
    results = searcher.search_similar_prs(pr_payload, top_k=5)
    recommendations = searcher.get_recommendations(pr_payload)
    """
    main()
