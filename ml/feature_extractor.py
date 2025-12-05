"""
Feature Extractor for Code Risk Radar
Extracts interpretable features from Bitbucket PR payloads for risk scoring.

Features are organized into 6 risk axes:
1. Complexity: Lines changed, files modified, cyclomatic complexity estimates
2. Bug Probability: Historical bug patterns, test coverage changes
3. Security: Sensitive file types, authentication code, dangerous patterns
4. Coupling: Cross-module changes, dependency graph impact
5. Volatility: Commit frequency, author experience, review time
6. Change Surface: Public API changes, breaking change indicators
"""

import json
import re
from typing import Dict, List, Any
from datetime import datetime
import hashlib


class PRFeatureExtractor:
    """Extract risk-relevant features from Bitbucket PR payloads"""
    
    # Sensitive file patterns for security axis
    SENSITIVE_PATTERNS = [
        r'auth|login|password|secret|token|key|credential',
        r'payment|billing|transaction',
        r'admin|sudo|privilege',
        r'\.env|config\.json|settings\.py'
    ]
    
    # High-risk file extensions
    HIGH_RISK_EXTENSIONS = {
        '.sql', '.sh', '.bat', '.ps1', '.yaml', '.yml', 
        'Dockerfile', 'docker-compose'
    }
    
    # Breaking change indicators
    BREAKING_PATTERNS = [
        r'BREAKING\s*CHANGE',
        r'deprecated',
        r'removed.*function',
        r'changed.*signature'
    ]
    
    def __init__(self):
        self.feature_names = self._get_feature_names()
    
    def extract_features(self, pr_payload: Dict[str, Any]) -> Dict[str, float]:
        """
        Extract all features from PR payload.
        
        Args:
            pr_payload: Bitbucket PR webhook payload or custom format
                Expected keys: pullrequest, repository, diff_stats, commit_history
        
        Returns:
            Dictionary of feature_name -> numeric_value
        """
        features = {}
        
        # Parse PR data
        pr = pr_payload.get('pullrequest', {})
        repo = pr_payload.get('repository', {})
        diff_stats = pr_payload.get('diff_stats', {})
        commits = pr_payload.get('commit_history', [])
        diff_text = pr_payload.get('diff_text', '')
        
        # AXIS 1: COMPLEXITY
        features.update(self._extract_complexity_features(pr, diff_stats, diff_text))
        
        # AXIS 2: BUG PROBABILITY
        features.update(self._extract_bug_probability_features(pr, diff_text, commits))
        
        # AXIS 3: SECURITY
        features.update(self._extract_security_features(pr, diff_stats, diff_text))
        
        # AXIS 4: COUPLING
        features.update(self._extract_coupling_features(diff_stats, diff_text))
        
        # AXIS 5: VOLATILITY
        features.update(self._extract_volatility_features(pr, repo, commits))
        
        # AXIS 6: CHANGE SURFACE
        features.update(self._extract_change_surface_features(pr, diff_text))
        
        return features
    
    def _extract_complexity_features(self, pr: Dict, diff_stats: Dict, diff_text: str) -> Dict[str, float]:
        """Axis 1: Code complexity indicators"""
        files_changed = len(diff_stats.get('files', []))
        lines_added = diff_stats.get('lines_added', 0)
        lines_deleted = diff_stats.get('lines_deleted', 0)
        total_lines_changed = lines_added + lines_deleted
        
        # Estimate cyclomatic complexity from diff
        complexity_keywords = len(re.findall(
            r'\b(if|else|elif|for|while|switch|case|catch|&&|\|\|)\b',
            diff_text, re.IGNORECASE
        ))
        
        # Nesting depth estimate (count indentation levels in added lines)
        added_lines = [l for l in diff_text.split('\n') if l.startswith('+')]
        max_indent = max([len(l) - len(l.lstrip()) for l in added_lines if l.strip()], default=0)
        
        return {
            'complexity_files_changed': float(files_changed),
            'complexity_lines_added': float(lines_added),
            'complexity_lines_deleted': float(lines_deleted),
            'complexity_total_lines': float(total_lines_changed),
            'complexity_churn_ratio': float(lines_deleted / max(lines_added, 1)),
            'complexity_keywords_count': float(complexity_keywords),
            'complexity_max_indent': float(max_indent / 4),  # Normalize by typical indent
            'complexity_avg_lines_per_file': float(total_lines_changed / max(files_changed, 1))
        }
    
    def _extract_bug_probability_features(self, pr: Dict, diff_text: str, commits: List) -> Dict[str, float]:
        """Axis 2: Historical bug indicators"""
        # Check for bug-fix keywords in title/description
        pr_title = pr.get('title', '').lower()
        pr_desc = pr.get('description', '').lower()
        combined_text = pr_title + ' ' + pr_desc
        
        bug_keywords = ['fix', 'bug', 'issue', 'error', 'crash', 'fail']
        bug_mentions = sum(1 for kw in bug_keywords if kw in combined_text)
        
        # Test file changes
        test_files = len([f for f in diff_text.split('\n') 
                         if 'test' in f.lower() and (f.startswith('+++') or f.startswith('---'))])
        
        # Null/undefined checks (defensive programming = higher bug risk perception)
        null_checks = len(re.findall(r'(!=|==)\s*(null|undefined|None)', diff_text))
        
        # Exception handling added
        exception_handling = len(re.findall(r'\b(try|catch|except|raise|throw)\b', diff_text))
        
        # Code smells: long methods (estimate from diff chunks)
        long_method_count = len(re.findall(r'^\+.*function.*\{[\s\S]{500,}?\}', diff_text, re.MULTILINE))
        
        return {
            'bug_fix_keywords': float(bug_mentions),
            'bug_test_files_changed': float(test_files),
            'bug_null_checks': float(null_checks),
            'bug_exception_handling': float(exception_handling),
            'bug_long_methods': float(long_method_count),
            'bug_commit_count': float(len(commits)),
            'bug_has_tests': 1.0 if test_files > 0 else 0.0
        }
    
    def _extract_security_features(self, pr: Dict, diff_stats: Dict, diff_text: str) -> Dict[str, float]:
        """Axis 3: Security risk indicators"""
        files = diff_stats.get('files', [])
        
        # Sensitive file modifications
        sensitive_files = sum(1 for f in files 
                            if any(re.search(pattern, f, re.IGNORECASE) 
                                  for pattern in self.SENSITIVE_PATTERNS))
        
        # High-risk file extensions
        risky_extensions = sum(1 for f in files 
                              if any(f.endswith(ext) for ext in self.HIGH_RISK_EXTENSIONS))
        
        # Security patterns in diff
        sql_injection_risk = len(re.findall(r'execute\s*\(.*?\+', diff_text, re.IGNORECASE))
        hardcoded_secrets = len(re.findall(r'(password|secret|api[_-]?key)\s*=\s*["\'][^"\']+["\']', diff_text, re.IGNORECASE))
        eval_usage = len(re.findall(r'\beval\s*\(', diff_text))
        
        # Authentication/authorization changes
        auth_changes = len(re.findall(r'\b(auth|login|permission|role|access)\b', diff_text, re.IGNORECASE))
        
        # Crypto/encryption modifications
        crypto_changes = len(re.findall(r'\b(encrypt|decrypt|hash|cipher|ssl|tls)\b', diff_text, re.IGNORECASE))
        
        return {
            'security_sensitive_files': float(sensitive_files),
            'security_risky_extensions': float(risky_extensions),
            'security_sql_injection_risk': float(sql_injection_risk),
            'security_hardcoded_secrets': float(hardcoded_secrets),
            'security_eval_usage': float(eval_usage),
            'security_auth_changes': float(auth_changes),
            'security_crypto_changes': float(crypto_changes)
        }
    
    def _extract_coupling_features(self, diff_stats: Dict, diff_text: str) -> Dict[str, float]:
        """Axis 4: Module coupling and dependency impact"""
        files = diff_stats.get('files', [])
        
        # Cross-directory changes (high coupling indicator)
        unique_dirs = len(set(f.split('/')[0] for f in files if '/' in f))
        
        # Import/require statement changes
        import_changes = len(re.findall(r'^[+\-]\s*(import|from|require|include)', diff_text, re.MULTILINE))
        
        # Dependency file changes
        dep_files = sum(1 for f in files if any(dep in f.lower() 
                       for dep in ['package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 'go.mod']))
        
        # Interface/API changes
        interface_changes = len(re.findall(r'\b(interface|abstract|protocol|trait)\b', diff_text))
        
        # Public method signature changes
        public_method_changes = len(re.findall(r'^[+\-].*\b(public|export)\s+.*function', diff_text, re.MULTILINE))
        
        return {
            'coupling_unique_dirs': float(unique_dirs),
            'coupling_import_changes': float(import_changes),
            'coupling_dep_files': float(dep_files),
            'coupling_interface_changes': float(interface_changes),
            'coupling_public_method_changes': float(public_method_changes),
            'coupling_cross_module_ratio': float(unique_dirs / max(len(files), 1))
        }
    
    def _extract_volatility_features(self, pr: Dict, repo: Dict, commits: List) -> Dict[str, float]:
        """Axis 5: Change velocity and stability indicators"""
        # PR metadata
        created_at = pr.get('created_on', '')
        updated_at = pr.get('updated_on', '')
        
        # Time to first review (if available)
        review_time_hours = 0
        if created_at and updated_at:
            try:
                created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                updated = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
                review_time_hours = (updated - created).total_seconds() / 3600
            except:
                pass
        
        # Author experience (simplified - would use real historical data in production)
        author = pr.get('author', {})
        author_name = author.get('display_name', 'unknown')
        # Hash author name to get pseudo-experience score (0-10)
        author_hash = int(hashlib.md5(author_name.encode()).hexdigest(), 16)
        author_experience = (author_hash % 10) + 1
        
        # Commit frequency
        commit_count = len(commits)
        
        # PR size (small PRs = lower volatility risk)
        pr_size_score = min(commit_count / 10.0, 5.0)  # Cap at 5
        
        return {
            'volatility_commit_count': float(commit_count),
            'volatility_review_time_hours': float(review_time_hours),
            'volatility_author_experience': float(author_experience),
            'volatility_pr_size_score': float(pr_size_score),
            'volatility_is_rush_job': 1.0 if review_time_hours < 2 else 0.0
        }
    
    def _extract_change_surface_features(self, pr: Dict, diff_text: str) -> Dict[str, float]:
        """Axis 6: Public API and breaking change indicators"""
        # Breaking change keywords
        breaking_mentions = sum(1 for pattern in self.BREAKING_PATTERNS 
                               if re.search(pattern, pr.get('description', ''), re.IGNORECASE))
        
        # Public API surface changes
        public_changes = len(re.findall(r'\b(public|export|exposed|api)\b', diff_text, re.IGNORECASE))
        
        # Removed functions/classes
        removals = len(re.findall(r'^-\s*(function|class|def|interface)', diff_text, re.MULTILINE))
        
        # Major version bump in dependency files
        major_version_bump = len(re.findall(r'["\'].*?:.*?["\']\s*["\'](\d+)\.0\.0["\']', diff_text))
        
        # Documentation changes (README, docs/)
        doc_changes = len(re.findall(r'(readme|docs?/)', diff_text, re.IGNORECASE))
        
        return {
            'surface_breaking_mentions': float(breaking_mentions),
            'surface_public_changes': float(public_changes),
            'surface_removals': float(removals),
            'surface_major_version_bump': float(major_version_bump),
            'surface_doc_changes': float(doc_changes),
            'surface_has_breaking': 1.0 if breaking_mentions > 0 else 0.0
        }
    
    def _get_feature_names(self) -> List[str]:
        """Return ordered list of all feature names"""
        return [
            # Complexity (8)
            'complexity_files_changed', 'complexity_lines_added', 'complexity_lines_deleted',
            'complexity_total_lines', 'complexity_churn_ratio', 'complexity_keywords_count',
            'complexity_max_indent', 'complexity_avg_lines_per_file',
            # Bug Probability (7)
            'bug_fix_keywords', 'bug_test_files_changed', 'bug_null_checks',
            'bug_exception_handling', 'bug_long_methods', 'bug_commit_count', 'bug_has_tests',
            # Security (7)
            'security_sensitive_files', 'security_risky_extensions', 'security_sql_injection_risk',
            'security_hardcoded_secrets', 'security_eval_usage', 'security_auth_changes',
            'security_crypto_changes',
            # Coupling (6)
            'coupling_unique_dirs', 'coupling_import_changes', 'coupling_dep_files',
            'coupling_interface_changes', 'coupling_public_method_changes', 'coupling_cross_module_ratio',
            # Volatility (5)
            'volatility_commit_count', 'volatility_review_time_hours', 'volatility_author_experience',
            'volatility_pr_size_score', 'volatility_is_rush_job',
            # Change Surface (6)
            'surface_breaking_mentions', 'surface_public_changes', 'surface_removals',
            'surface_major_version_bump', 'surface_doc_changes', 'surface_has_breaking'
        ]
    
    def extract_axis_scores(self, features: Dict[str, float]) -> Dict[str, float]:
        """
        Aggregate features into 6 axis scores (0-100 scale)
        Uses simple weighted averaging for interpretability
        """
        axis_weights = {
            'complexity': [
                ('complexity_total_lines', 0.3, 500),  # (feature, weight, normalization_factor)
                ('complexity_files_changed', 0.25, 20),
                ('complexity_keywords_count', 0.2, 50),
                ('complexity_max_indent', 0.15, 10),
                ('complexity_churn_ratio', 0.1, 2)
            ],
            'bug_probability': [
                ('bug_fix_keywords', 0.3, 5),
                ('bug_long_methods', 0.25, 3),
                ('bug_has_tests', -0.2, 1),  # Negative = good
                ('bug_exception_handling', 0.15, 10),
                ('bug_commit_count', 0.1, 10)
            ],
            'security': [
                ('security_hardcoded_secrets', 0.35, 3),
                ('security_sql_injection_risk', 0.25, 3),
                ('security_eval_usage', 0.2, 2),
                ('security_sensitive_files', 0.15, 5),
                ('security_auth_changes', 0.05, 10)
            ],
            'coupling': [
                ('coupling_dep_files', 0.3, 2),
                ('coupling_cross_module_ratio', 0.25, 1),
                ('coupling_import_changes', 0.2, 15),
                ('coupling_public_method_changes', 0.15, 5),
                ('coupling_interface_changes', 0.1, 5)
            ],
            'volatility': [
                ('volatility_pr_size_score', 0.3, 5),
                ('volatility_is_rush_job', 0.25, 1),
                ('volatility_author_experience', -0.2, 10),  # Negative = good
                ('volatility_commit_count', 0.15, 10),
                ('volatility_review_time_hours', -0.1, 24)
            ],
            'change_surface': [
                ('surface_breaking_mentions', 0.35, 2),
                ('surface_removals', 0.25, 5),
                ('surface_public_changes', 0.2, 10),
                ('surface_major_version_bump', 0.15, 2),
                ('surface_has_breaking', 0.05, 1)
            ]
        }
        
        axis_scores = {}
        for axis_name, weighted_features in axis_weights.items():
            score = 0.0
            total_weight = sum(abs(w) for _, w, _ in weighted_features)
            
            for feat_name, weight, norm_factor in weighted_features:
                feat_value = features.get(feat_name, 0)
                normalized = min(feat_value / norm_factor, 1.0) if norm_factor > 0 else feat_value
                score += (normalized * weight / total_weight) * 100
            
            axis_scores[axis_name] = max(0, min(100, score))  # Clamp to [0, 100]
        
        return axis_scores


# Example usage
if __name__ == '__main__':
    # Test with sample PR payload
    sample_pr = {
        'pullrequest': {
            'id': 123,
            'title': 'Fix authentication bug in login flow',
            'description': 'This PR fixes a critical security issue',
            'author': {'display_name': 'John Doe'},
            'created_on': '2025-12-05T10:00:00Z',
            'updated_on': '2025-12-05T14:00:00Z'
        },
        'repository': {'slug': 'my-repo'},
        'diff_stats': {
            'lines_added': 150,
            'lines_deleted': 80,
            'files': ['src/auth/login.js', 'src/auth/session.js', 'test/auth.test.js']
        },
        'commit_history': [{'hash': 'abc123'}, {'hash': 'def456'}],
        'diff_text': '''
+++ src/auth/login.js
+ function login(username, password) {
+   if (username && password) {
+     const query = "SELECT * FROM users WHERE username = '" + username + "'";
+     db.execute(query);
+   }
+ }
'''
    }
    
    extractor = PRFeatureExtractor()
    features = extractor.extract_features(sample_pr)
    axis_scores = extractor.extract_axis_scores(features)
    
    print("Extracted Features:")
    for k, v in sorted(features.items()):
        print(f"  {k}: {v:.2f}")
    
    print("\nAxis Scores (0-100):")
    for axis, score in axis_scores.items():
        print(f"  {axis}: {score:.1f}")
