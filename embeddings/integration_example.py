"""
Example Integration: Using Embeddings in Code Risk Radar

This file demonstrates how to integrate embeddings and similarity search
into the main Code Risk Radar application.
"""

import os
import sys
from typing import Dict, List, Optional

# Add embeddings directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'embeddings'))

from embeddings.embeddings_client import EmbeddingsClient, EmbeddingConfig
from embeddings.index_to_supabase import SupabaseIndexer
from embeddings.query_similar import SimilaritySearcher


class EnhancedRiskAnalyzer:
    """
    Enhanced risk analyzer that uses embeddings to find similar
    past incidents and PRs.
    """
    
    def __init__(self, use_supabase: bool = True):
        """
        Initialize analyzer.
        
        Args:
            use_supabase: If True, use Supabase. If False, use fallback (Forge only)
        """
        self.use_supabase = use_supabase
        
        if use_supabase:
            # Initialize Supabase-based search
            self.indexer = SupabaseIndexer()
            self.searcher = SimilaritySearcher()
        else:
            # Fallback mode - will be imported in Forge
            self.indexer = None
            self.searcher = None
    
    def analyze_pr_with_history(self, pr_payload: Dict) -> Dict:
        """
        Analyze a PR and augment with historical similarity data.
        
        Args:
            pr_payload: PR data from Bitbucket webhook
        
        Returns:
            Enhanced risk analysis with historical context
        """
        # Run standard ML risk analysis (from existing code)
        from ml.inference import RiskPredictor
        predictor = RiskPredictor()
        ml_result = predictor.predict(pr_payload)
        
        # Add historical similarity analysis
        if self.use_supabase:
            historical_analysis = self._analyze_with_supabase(pr_payload)
        else:
            historical_analysis = self._analyze_with_fallback(pr_payload)
        
        # Combine results
        enhanced_result = {
            "pr_id": pr_payload.get("id"),
            "ml_risk_score": ml_result["risk_score"],
            "ml_confidence": ml_result["confidence"],
            "ml_axes": ml_result["axis_scores"],
            "ml_explanations": ml_result["top_features"],
            
            # Historical context
            "historical_context": historical_analysis,
            
            # Combined risk assessment
            "final_risk_score": self._combine_risk_scores(
                ml_result["risk_score"],
                historical_analysis
            ),
            "recommendation": self._generate_recommendation(
                ml_result,
                historical_analysis
            )
        }
        
        return enhanced_result
    
    def _analyze_with_supabase(self, pr_payload: Dict) -> Dict:
        """Analyze using Supabase vector search."""
        # Find similar PRs
        similar_prs = self.searcher.search_similar_prs(
            pr_payload,
            top_k=5,
            threshold=0.75
        )
        
        # Find related incidents
        related_incidents = self.searcher.find_related_incidents(
            pr_payload,
            top_k=5,
            threshold=0.7,
            days_back=90
        )
        
        # Calculate historical risk metrics
        high_risk_similar = [
            pr for pr in similar_prs
            if pr.get("metadata", {}).get("risk_score", 0) > 75
        ]
        
        critical_incidents = [
            inc for inc in related_incidents
            if inc.get("metadata", {}).get("priority") == "Critical"
        ]
        
        return {
            "similar_prs_count": len(similar_prs),
            "similar_prs": similar_prs,
            "high_risk_similar_count": len(high_risk_similar),
            "related_incidents_count": len(related_incidents),
            "related_incidents": related_incidents,
            "critical_incidents_count": len(critical_incidents),
            "max_similar_risk": max(
                [pr.get("metadata", {}).get("risk_score", 0) for pr in similar_prs],
                default=0
            ),
            "avg_similar_risk": (
                sum(pr.get("metadata", {}).get("risk_score", 0) for pr in similar_prs) / len(similar_prs)
                if similar_prs else 0
            )
        }
    
    def _analyze_with_fallback(self, pr_payload: Dict) -> Dict:
        """Analyze using JavaScript fallback (Forge Entities)."""
        # This would be called from JavaScript in Forge
        # For now, return empty analysis
        return {
            "similar_prs_count": 0,
            "similar_prs": [],
            "high_risk_similar_count": 0,
            "related_incidents_count": 0,
            "related_incidents": [],
            "critical_incidents_count": 0,
            "max_similar_risk": 0,
            "avg_similar_risk": 0,
            "note": "Using fallback mode (TF-IDF)"
        }
    
    def _combine_risk_scores(self, ml_score: float, historical: Dict) -> float:
        """
        Combine ML risk score with historical context.
        
        Formula:
        - Base: ML score (0-100)
        - +10 if >2 high-risk similar PRs found
        - +15 if >2 critical incidents found
        - +5 if avg similar risk > 70
        """
        final_score = ml_score
        
        # Boost for high-risk similar PRs
        if historical["high_risk_similar_count"] > 2:
            final_score += 10
        
        # Boost for critical incidents
        if historical["critical_incidents_count"] > 2:
            final_score += 15
        
        # Boost for high average historical risk
        if historical["avg_similar_risk"] > 70:
            final_score += 5
        
        return min(100, final_score)  # Cap at 100
    
    def _generate_recommendation(self, ml_result: Dict, historical: Dict) -> str:
        """Generate human-readable recommendation."""
        ml_risk = ml_result["risk_score"]
        final_risk = self._combine_risk_scores(ml_risk, historical)
        
        recommendations = []
        
        # ML-based recommendations
        if ml_risk > 80:
            recommendations.append("⚠️ ML model detected high risk")
        
        # Historical recommendations
        if historical["high_risk_similar_count"] > 0:
            recommendations.append(
                f"⚠️ Found {historical['high_risk_similar_count']} similar high-risk PRs"
            )
        
        if historical["critical_incidents_count"] > 0:
            recommendations.append(
                f"🚨 Found {historical['critical_incidents_count']} related critical incidents"
            )
        
        if historical["similar_prs_count"] > 5:
            recommendations.append(
                "💡 This type of change has been made frequently - review patterns"
            )
        
        # Overall recommendation
        if final_risk > 85:
            overall = "❌ REJECT or request extensive review before approval"
        elif final_risk > 70:
            overall = "⚠️ CAUTION - requires senior developer review"
        elif final_risk > 50:
            overall = "✓ APPROVE with standard review"
        else:
            overall = "✅ LOW RISK - safe to approve"
        
        return f"{overall}\n\n" + "\n".join(recommendations)
    
    def index_pr_after_merge(self, pr_payload: Dict, actual_outcome: Dict):
        """
        Index a PR after it's been merged and outcomes are known.
        
        Args:
            pr_payload: Original PR data
            actual_outcome: Post-merge data (bugs found, rollbacks, etc.)
        """
        if not self.use_supabase:
            return  # Skip if not using Supabase
        
        # Enhance metadata with actual outcome
        metadata = {
            "risk_score": pr_payload.get("risk_score", 0),
            "repository": pr_payload.get("repository", {}).get("full_name", ""),
            "author": pr_payload.get("author", {}).get("display_name", ""),
            "merged_at": actual_outcome.get("merged_at"),
            "actual_issues_found": actual_outcome.get("issues_found", []),
            "rollback_required": actual_outcome.get("rollback_required", False),
            "resolution_time_hours": actual_outcome.get("resolution_time_hours", 0),
            "severity": actual_outcome.get("severity", "low")
        }
        
        # Index to Supabase
        self.indexer.index_pr(pr_payload, metadata=metadata)
    
    def index_jira_issue(self, issue_data: Dict):
        """
        Index a Jira issue (bug, incident, etc.) for future similarity search.
        
        Args:
            issue_data: Jira issue data
        """
        if not self.use_supabase:
            return
        
        self.indexer.index_jira_issue(issue_data)


# Example usage
if __name__ == "__main__":
    """
    Example: Analyze a PR with historical context
    """
    
    # Initialize analyzer (with Supabase)
    analyzer = EnhancedRiskAnalyzer(use_supabase=True)
    
    # Example PR payload
    pr_payload = {
        "id": 123,
        "title": "Fix SQL injection in auth module",
        "description": "Replaced string concatenation with parameterized queries",
        "repository": {
            "name": "backend",
            "full_name": "myorg/backend"
        },
        "author": {
            "display_name": "John Doe"
        },
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
    
    # Analyze with historical context
    result = analyzer.analyze_pr_with_history(pr_payload)
    
    print("=" * 60)
    print("ENHANCED PR RISK ANALYSIS")
    print("=" * 60)
    
    print(f"\nPR: {pr_payload['title']}")
    print(f"Repository: {pr_payload['repository']['full_name']}")
    
    print(f"\n📊 ML Risk Score: {result['ml_risk_score']:.1f}/100")
    print(f"📈 Final Risk Score: {result['final_risk_score']:.1f}/100")
    
    print("\n🔍 Historical Context:")
    hist = result['historical_context']
    print(f"  • Similar PRs found: {hist['similar_prs_count']}")
    print(f"  • High-risk similar PRs: {hist['high_risk_similar_count']}")
    print(f"  • Related incidents: {hist['related_incidents_count']}")
    print(f"  • Critical incidents: {hist['critical_incidents_count']}")
    
    if hist['similar_prs']:
        print("\n  Top Similar PRs:")
        for i, pr in enumerate(hist['similar_prs'][:3], 1):
            print(f"    {i}. {pr['source_id']} (similarity: {pr['similarity']:.2%})")
            print(f"       Risk: {pr['metadata'].get('risk_score', 'N/A')}")
    
    if hist['related_incidents']:
        print("\n  Related Incidents:")
        for i, inc in enumerate(hist['related_incidents'][:3], 1):
            print(f"    {i}. {inc['source_id']} (similarity: {inc['similarity']:.2%})")
            print(f"       {inc['metadata'].get('summary', 'N/A')}")
    
    print("\n💡 Recommendation:")
    print(result['recommendation'])
    
    print("\n" + "=" * 60)
    
    # After PR is merged, index it with actual outcome
    # (This would be triggered by a webhook or scheduled job)
    """
    actual_outcome = {
        "merged_at": "2025-12-05T10:30:00Z",
        "issues_found": ["bug"],
        "rollback_required": False,
        "resolution_time_hours": 2,
        "severity": "medium"
    }
    
    analyzer.index_pr_after_merge(pr_payload, actual_outcome)
    """
