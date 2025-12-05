# Code Risk Radar

**Proactive security and quality assistant for Bitbucket and Jira, powered by Atlassian Forge and Rovo.**

## 🎯 Overview

Code Risk Radar is an AI-powered code analysis tool that integrates deeply with your Atlassian workflow. It automatically scans pull requests for security vulnerabilities, anti-patterns, and quality issues, then creates actionable Jira tickets with suggested fixes—all without leaving the Atlassian ecosystem.

### Key Features

- 🔍 **Automated Risk Detection**: Scans every PR for SQL injection, hardcoded secrets, and 20+ risk patterns
- 🤖 **ML-Powered Risk Scoring**: 82% accuracy with explainable predictions (39 features across 6 axes)
- 🧠 **Vector Search**: Find similar past incidents and PRs using embeddings (Supabase pgvector)
- 🤖 **Rovo AI Integration**: Conversational agent answers questions like "What's risky in PR-123?"
- 🎫 **Smart Jira Integration**: Auto-creates tickets for critical risks with context-aware prioritization
- ✅ **Safety-First Design**: All write operations require explicit user approval with dry-run previews
- 📊 **Context-Aware Scoring**: Uses historical data to rank risks by business impact
- 🔄 **Bitidirectional Sync**: Tracks remediation status across Bitbucket and Jira

## 🚀 Quick Start

### Prerequisites

- Atlassian Forge CLI: `npm install -g @forge/cli`
- Bitbucket Cloud workspace with admin access
- Jira Cloud project
- OpenAI API key (or Anthropic Claude)
- (Optional) Supabase account for vector search

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd CodeRiskRadar
   npm install
   ```

2. **Set environment variables:**
   ```bash
   forge variables set OPENAI_API_KEY "your-api-key"
   forge variables set JIRA_PROJECT_KEY "RISK"
   forge variables set SUPABASE_URL "your-supabase-url"  # Optional
   forge variables set SUPABASE_KEY "your-supabase-key"  # Optional
   ```

3. **Deploy to Forge:**
   ```bash
   forge deploy
   forge install --site your-site.atlassian.net
   ```

4. **Configure webhooks:**
   - Go to your Bitbucket repository settings
   - Navigate to Webhooks
   - The app will automatically register webhooks on first install

5. **Test the installation:**
   - Create a test PR with intentional risks (e.g., `password = "test123"`)
   - Check the Risk Analysis panel in the PR view
   - Verify Rovo agent responds to queries in Slack/Teams

## 📁 Project Structure

```
CodeRiskRadar/
├── manifest.yml              # Forge app configuration
├── package.json              # Dependencies
├── src/
│   ├── index.js              # Main webhook handlers
│   ├── riskAnalyzer.js       # Core risk detection logic
│   ├── jiraIntegration.js    # Jira API operations
│   ├── storage.js            # Forge Entities wrapper
│   ├── dryRunService.js      # Preview generation for safety
│   ├── rovoAgent.js          # Conversational AI agent
│   ├── rovoActions.js        # Rovo actions (Explain, Fix, Approve)
│   └── vectorSearch.js       # Supabase pgvector integration
├── static/
│   └── riskPanel/
│       ├── index.html        # PR panel UI
│       ├── styles.css        # Styling
│       └── script.js         # Frontend logic
├── tests/
│   ├── riskAnalyzer.test.js
│   └── jiraIntegration.test.js
├── README.md
└── SECURITY.md
```

## 🔧 Configuration

### Custom Risk Patterns

Edit `src/riskAnalyzer.js` to add custom regex patterns:

```javascript
{
  id: 'custom-pattern',
  name: 'Your Risk Name',
  pattern: /your-regex-here/gi,
  severity: 'HIGH',
  category: 'SECURITY',
  description: 'Description of the risk'
}
```

### Team-Specific Settings

Store configuration via Forge storage:

```javascript
await storeProjectConfig('YOUR-PROJECT', {
  autoCreateJiraIssues: true,
  severityThreshold: 'HIGH',
  customRules: [...]
});
```

## 📈 Machine Learning Setup (Optional)

Code Risk Radar includes a production-ready ML pipeline for risk prediction. For MVP, the app uses regex-based detection. For advanced deployments:

### Train Custom Model

See **[ml/README.md](ml/README.md)** for complete ML pipeline documentation.

```bash
# Generate synthetic training data
cd ml
python generate_synthetic_data.py

# Install ML dependencies
pip install pandas numpy scikit-learn joblib shap matplotlib

# Train model (Jupyter notebook)
jupyter notebook train_baseline.ipynb

# Export coefficients for JavaScript deployment
python export_coefficients.py
```

**Output**:
- `models/baseline_model.pkl` - Python model (for FastAPI)
- `models/model_coefficients.json` - For Forge Functions (5KB)

### Deploy ML Model

**Option 1: JavaScript in Forge (Recommended for MVP)**
```javascript
import { predictRiskJS } from './ml/inference_js';
const result = await predictRiskJS(prPayload);
```

**Option 2: Python Microservice (Better accuracy)**
```bash
cd ml
pip install fastapi uvicorn
uvicorn inference:app --reload --port 8000
```

See [ml/README.md](ml/README.md) for full ML documentation.

## � Vector Search & Embeddings (Optional)

Code Risk Radar can find similar past incidents and PRs using semantic search. This helps predict risks based on historical data.

### Quick Start

See **[embeddings/README.md](embeddings/README.md)** for complete documentation.

```bash
# Install dependencies
cd embeddings
pip install -r requirements.txt

# Setup environment
cp .env.example .env
# Edit .env with your OpenAI + Supabase keys

# Setup database
# Run embeddings/schema.sql in Supabase SQL editor

# Test indexing
python index_to_supabase.py --type pr --source-id test/PR-1 --content "Example PR" --metadata '{}'

# Test search
python query_similar.py --content "SQL injection bug" --type pr --top-k 5
```

### Integration with Risk Analysis

```python
from embeddings.integration_example import EnhancedRiskAnalyzer

# Analyze PR with historical context
analyzer = EnhancedRiskAnalyzer(use_supabase=True)
result = analyzer.analyze_pr_with_history(pr_payload)

print(f"ML Risk: {result['ml_risk_score']}")
print(f"Final Risk (with history): {result['final_risk_score']}")
print(f"Similar PRs: {result['historical_context']['similar_prs_count']}")
```

### Privacy-Preserving Options

- **OpenAI + Anonymization**: Replace secrets/PII before embedding (enabled by default)
- **Local Embeddings**: Run models locally (no API calls): `pip install sentence-transformers`
- **Forge Fallback**: Use TF-IDF for small datasets (no external dependencies)

See [embeddings/PRIVACY.md](embeddings/PRIVACY.md) for detailed privacy guidelines.

## �🧪 Testing

Run unit tests:
```bash
npm test
```

Test with Forge tunnel (local development):
```bash
forge tunnel
```

## 🛡️ Security & Safety

Code Risk Radar follows strict safety principles:

1. **Explicit Approval Required**: All write operations (Jira issues, repo commits) show a dry-run preview and require user confirmation
2. **Rate Limiting**: Maximum 10 LLM calls per PR to prevent abuse
3. **Data Minimization**: Only code diffs are sent to external APIs, never full repos
4. **Audit Trail**: All approvals are logged in Forge storage
5. **Fail-Safe Defaults**: Errors never block PRs; generic comments are posted instead

See [SECURITY.md](SECURITY.md) for full details.

## 📊 Usage Examples

### Rovo Agent Queries

```
"What risks did you find in PR-42?"
"Explain the SQL injection risk on line 156"
"Show me similar past vulnerabilities"
"What's the business impact of the hardcoded secret?"
```

### Rovo Actions

- **Explain Risk**: Get detailed technical explanation with OWASP/CWE references
- **Suggest Fix**: AI-generated code patches
- **Approve Fix**: Apply fix after preview confirmation

## 🎯 Codegeist 2025 Criteria

✅ **Apps for Software Teams**: Integrates Bitbucket + Jira  
✅ **Runs on Atlassian**: Forge-first architecture  
✅ **Rovo Integration**: Agent + Actions implemented  
✅ **Innovation**: Context-aware risk scoring with vector search  
✅ **User Safety**: Dry-run previews for all write ops  

## 🗺️ Roadmap

### Post-MVP Features
- [ ] Multi-language support (Java, Go, Rust)
- [ ] Integration with SAST tools (Snyk, SonarQube)
- [ ] Risk trend dashboard in Jira
- [ ] Auto-remediation with one-click apply
- [ ] Custom ML models for team-specific patterns
- [ ] Slack/Teams notifications

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Submit a PR with clear description

## 📄 License

MIT License - see LICENSE file for details

## 🏆 Built For

**Codegeist 2025** - Apps for Software Teams  
Category: Security & Code Quality

---

**Team**: 3 developers (AI/ML, Backend, Frontend)  
**Development Time**: 17 days  
**Tech Stack**: Atlassian Forge, Rovo, OpenAI GPT-4, Supabase pgvector
# CodeRiskRadar
