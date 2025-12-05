"""
Generate synthetic training data for Code Risk Radar baseline model.
Creates realistic PR scenarios with ground truth risk labels.
"""

import json
import random
from typing import List, Dict
from datetime import datetime, timedelta


class SyntheticDataGenerator:
    """Generate synthetic PR data for model training"""
    
    def __init__(self, seed: int = 42):
        random.seed(seed)
        self.authors = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace']
        self.repos = ['backend-api', 'frontend-app', 'data-pipeline', 'auth-service']
    
    def generate_dataset(self, n_samples: int = 500) -> List[Dict]:
        """Generate n_samples PR scenarios with labels"""
        dataset = []
        
        # Distribution: 60% low risk, 25% medium, 15% high
        risk_levels = (
            ['low'] * int(n_samples * 0.6) +
            ['medium'] * int(n_samples * 0.25) +
            ['high'] * int(n_samples * 0.15)
        )
        random.shuffle(risk_levels)
        
        for i, risk_level in enumerate(risk_levels):
            pr = self._generate_pr(i + 1, risk_level)
            dataset.append(pr)
        
        return dataset
    
    def _generate_pr(self, pr_id: int, risk_level: str) -> Dict:
        """Generate single PR with specified risk level"""
        # Base parameters by risk level
        if risk_level == 'low':
            lines_range = (10, 100)
            files_range = (1, 3)
            has_tests = random.random() > 0.2
            has_security_issue = False
            breaking_change = False
        elif risk_level == 'medium':
            lines_range = (100, 500)
            files_range = (3, 10)
            has_tests = random.random() > 0.5
            has_security_issue = random.random() > 0.7
            breaking_change = random.random() > 0.8
        else:  # high
            lines_range = (500, 2000)
            files_range = (10, 30)
            has_tests = random.random() > 0.6
            has_security_issue = random.random() > 0.3
            breaking_change = random.random() > 0.5
        
        lines_added = random.randint(*lines_range)
        lines_deleted = random.randint(int(lines_added * 0.3), int(lines_added * 0.8))
        files_changed = random.randint(*files_range)
        
        # Generate file list
        file_types = ['js', 'py', 'java', 'go', 'ts']
        test_files = ['test', 'spec'] if has_tests else []
        
        files = []
        for j in range(files_changed):
            if j < len(test_files):
                files.append(f'test/test_{j}.{random.choice(file_types)}')
            else:
                dir_name = random.choice(['src', 'lib', 'api', 'components'])
                files.append(f'{dir_name}/file_{j}.{random.choice(file_types)}')
        
        # Add security-sensitive files if high risk
        if has_security_issue:
            files.append(random.choice([
                'src/auth/login.js',
                'config/secrets.yaml',
                '.env.production',
                'src/payment/checkout.py'
            ]))
        
        # Generate diff text with risk patterns
        diff_text = self._generate_diff_text(risk_level, has_security_issue, breaking_change)
        
        # PR metadata
        author = random.choice(self.authors)
        repo = random.choice(self.repos)
        created = datetime.now() - timedelta(hours=random.randint(1, 72))
        updated = created + timedelta(hours=random.randint(1, 48))
        
        # Title and description based on risk
        if risk_level == 'high':
            titles = [
                'Refactor authentication system',
                'BREAKING: Update API endpoints',
                'Migrate database schema',
                'Fix critical security vulnerability'
            ]
            desc = 'This is a large change affecting multiple systems. ' + \
                   ('BREAKING CHANGE: API signature modified.' if breaking_change else '')
        elif risk_level == 'medium':
            titles = [
                'Add new feature for user profiles',
                'Update dependencies to latest versions',
                'Refactor payment processing',
                'Fix bug in data validation'
            ]
            desc = 'Medium-sized change with some refactoring.'
        else:
            titles = [
                'Fix typo in documentation',
                'Update button styling',
                'Add logging to debug function',
                'Small bug fix for edge case'
            ]
            desc = 'Small, isolated change with minimal impact.'
        
        # Ground truth labels
        # Risk score: 0-100 (low: 0-30, medium: 30-70, high: 70-100)
        if risk_level == 'low':
            risk_score = random.uniform(5, 30)
        elif risk_level == 'medium':
            risk_score = random.uniform(30, 70)
        else:
            risk_score = random.uniform(70, 95)
        
        return {
            'pullrequest': {
                'id': pr_id,
                'title': random.choice(titles),
                'description': desc,
                'author': {'display_name': author},
                'created_on': created.isoformat() + 'Z',
                'updated_on': updated.isoformat() + 'Z',
                'state': 'OPEN'
            },
            'repository': {
                'slug': repo,
                'name': repo
            },
            'diff_stats': {
                'lines_added': lines_added,
                'lines_deleted': lines_deleted,
                'files': files
            },
            'commit_history': [
                {'hash': f'commit_{pr_id}_{i}'} 
                for i in range(random.randint(1, 10))
            ],
            'diff_text': diff_text,
            'labels': {
                'risk_level': risk_level,
                'risk_score': round(risk_score, 2),
                'has_security_issue': has_security_issue,
                'has_breaking_change': breaking_change,
                'has_tests': has_tests
            }
        }
    
    def _generate_diff_text(self, risk_level: str, has_security: bool, breaking: bool) -> str:
        """Generate realistic diff text with risk patterns"""
        lines = []
        
        # File header
        lines.append('+++ src/main.js')
        lines.append('@@ -10,5 +10,20 @@')
        
        # Add security issues if flagged
        if has_security:
            security_patterns = [
                '+ const password = "hardcoded123";',
                '+ const query = "SELECT * FROM users WHERE id = " + userId;',
                '+ eval(userInput);',
                '+ const apiKey = "sk-1234567890abcdef";'
            ]
            lines.extend(random.sample(security_patterns, k=random.randint(1, 2)))
        
        # Add breaking changes if flagged
        if breaking:
            lines.extend([
                '- export function oldAPI(params) {',
                '+ export function newAPI(differentParams) {',
                '+   // BREAKING CHANGE: Function signature updated'
            ])
        
        # Add complexity patterns for high risk
        if risk_level == 'high':
            lines.extend([
                '+ function complexFunction(a, b, c, d, e) {',
                '+   if (a && b) {',
                '+     if (c || d) {',
                '+       for (let i = 0; i < e; i++) {',
                '+         if (i % 2 === 0) {',
                '+           while (true) {',
                '+             // Nested logic',
                '+           }',
                '+         }',
                '+       }',
                '+     }',
                '+   }',
                '+ }'
            ])
        
        # Add normal code changes
        lines.extend([
            '+ function newFeature() {',
            '+   console.log("New feature added");',
            '+   return true;',
            '+ }',
            '+ ',
            '+ export { newFeature };'
        ])
        
        return '\n'.join(lines)


def main():
    """Generate and save synthetic dataset"""
    generator = SyntheticDataGenerator(seed=42)
    
    # Generate training set (400 samples)
    print("Generating training data...")
    train_data = generator.generate_dataset(n_samples=400)
    
    # Generate validation set (100 samples)
    print("Generating validation data...")
    generator_val = SyntheticDataGenerator(seed=123)
    val_data = generator_val.generate_dataset(n_samples=100)
    
    # Save to JSON
    with open('ml/data/train_data.json', 'w') as f:
        json.dump(train_data, f, indent=2)
    
    with open('ml/data/val_data.json', 'w') as f:
        json.dump(val_data, f, indent=2)
    
    print(f"\nGenerated {len(train_data)} training samples")
    print(f"Generated {len(val_data)} validation samples")
    
    # Print distribution
    train_dist = {
        'low': sum(1 for d in train_data if d['labels']['risk_level'] == 'low'),
        'medium': sum(1 for d in train_data if d['labels']['risk_level'] == 'medium'),
        'high': sum(1 for d in train_data if d['labels']['risk_level'] == 'high')
    }
    print(f"\nTraining distribution: {train_dist}")
    print("\nSample saved to ml/data/")


if __name__ == '__main__':
    import os
    os.makedirs('ml/data', exist_ok=True)
    main()
