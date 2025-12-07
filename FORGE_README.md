# 🛡️ Code Risk Radar - Forge App

Complete Atlassian Forge application with React Custom UI for AI-powered code risk analysis in pull requests.

---

## 🎯 What's Inside

This repository contains a **production-ready Atlassian Forge app** that integrates:

### Backend (Forge + Rovo)
- **2 Rovo Agents**
  - 🔍 **Risk Analyst**: Analyzes code for security, performance, maintainability risks
  - 📚 **Historian**: Retrieves similar past incidents from vector database
  
- **3 Rovo Actions**
  - 📋 **Create Jira Task**: Auto-creates tickets for identified risks
  - 💬 **Post PR Comment**: Posts analysis as PR comment
  - 🔧 **Create Fix Branch/PR**: (Manual confirmation required)

- **4 Bridge Functions**
  - Connect React UI to Forge backend
  - Handle PR context extraction
  - Cache results for performance

### Frontend (React Custom UI)
- **6 React Components**
  - 📊 **Radar Chart**: D3.js visualization of risk factors
  - 📝 **Risk Breakdown**: Expandable list of recommended actions
  - 🕰️ **Similar Incidents**: Historical context from Historian agent
  - 🎛️ **Actions Panel**: Buttons to trigger Jira/PR actions
  - ✅ **Confirmation Modal**: Preview-then-confirm for write operations
  
- **Features**
  - ♿ Full accessibility (WCAG 2.1 AA)
  - 📱 Responsive design
  - 🎨 Atlassian Design System styling
  - 🔄 Auto-refresh with caching
  - 🧪 Mock data for local development

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Linux/Mac
./scripts/setup-forge.sh

# Windows
scripts\setup-forge.bat
```

This script will:
1. Check prerequisites (Node.js, Forge CLI)
2. Install dependencies
3. Build frontend
4. Configure environment variables
5. Deploy to Forge
6. Install to your workspace

### Option 2: Manual Setup

```bash
# 1. Install Forge CLI
npm install -g @forge/cli

# 2. Login to Forge
forge login

# 3. Copy configuration
cp manifest.forge.yml manifest.yml
cp package.forge.json package.json

# 4. Install dependencies
npm install
cd frontend && npm install && cd ..

# 5. Build frontend
npm run build:frontend

# 6. Deploy
forge deploy

# 7. Install to workspace
forge install
```

---

## 📁 Project Structure

```
CodeRiskRadar/
├── src/
│   ├── rovo/                    # Rovo agent adapters
│   │   ├── riskAgent.js         # Risk Analyst agent
│   │   └── historianAgent.js    # Historian agent
│   ├── actions/                 # Rovo action handlers
│   │   ├── createJiraTask.js    # Jira task creation
│   │   ├── postPRComment.js     # PR comment posting
│   │   └── createFixBranchPR.js # Fix branch creation
│   └── bridge/                  # Forge Custom UI bridges
│       ├── getRiskAnalysis.js   # Main analysis endpoint
│       ├── createJiraTask.js    # Jira action bridge
│       ├── postPRComment.js     # PR comment bridge
│       └── getSimilarIncidents.js
│
├── frontend/                    # React Custom UI
│   ├── src/
│   │   ├── App.jsx              # Main app component
│   │   ├── api.js               # Forge API bridge
│   │   ├── components/          # React components
│   │   │   ├── Radar.jsx        # D3 radar chart
│   │   │   ├── RiskBreakdown.jsx
│   │   │   ├── SimilarIncidents.jsx
│   │   │   ├── ActionsPanel.jsx
│   │   │   └── ConfirmationModal.jsx
│   │   ├── styles.css           # Atlassian-style CSS
│   │   └── index.jsx            # React entry point
│   ├── public/
│   │   └── index.html
│   ├── scripts/
│   │   └── sample_prs.json      # Mock data
│   ├── package.json
│   ├── webpack.config.js
│   ├── README.md
│   └── INTEGRATION_GUIDE.md
│
├── tests/                       # Test suite
│   └── rovo-integration.test.js
│
├── docs/                        # Documentation
│   ├── rovo/                    # Rovo-specific docs
│   └── forge/                   # Forge-specific docs
│
├── scripts/
│   ├── setup-forge.sh           # Linux/Mac setup
│   └── setup-forge.bat          # Windows setup
│
├── manifest.forge.yml           # Forge manifest template
├── package.forge.json           # Package.json template
├── FORGE_DEPLOYMENT.md          # Deployment guide
└── README.md                    # This file
```

---

## 🎨 Frontend Development

### Local Development (Mock Data)

```bash
cd frontend
npm start
```

Opens on `http://localhost:3000` with mock data.

### Live Development (Forge Tunnel)

```bash
# Terminal 1: Start tunnel
forge tunnel

# Terminal 2: Watch frontend changes
cd frontend
npm run build -- --watch
```

Test in real PRs without redeploying.

---

## 🔧 Configuration

### Environment Variables

Set via Forge CLI:

```bash
# GitHub token for PR comments
forge variables set GITHUB_TOKEN ghp_your_token

# Supabase for embeddings (optional)
forge variables set SUPABASE_URL https://your-project.supabase.co
forge variables set SUPABASE_KEY your_anon_key
```

### Manifest Configuration

Edit `manifest.yml`:

- **Platform**: Choose Bitbucket or GitHub
- **Permissions**: Add required scopes
- **External Domains**: Whitelist API endpoints

---

## 🧪 Testing

### Run Test Suite

```bash
npm test
```

### Test in Tunnel

```bash
forge tunnel
# Open PR in repository
# Check PR sidebar for "Code Risk Radar"
```

### View Logs

```bash
forge logs
forge logs --function get-risk-analysis-fn
```

---

## 📦 Deployment

### Development Environment

```bash
npm run build:frontend
forge deploy
forge install
```

### Production Environment

```bash
# Create production environment
forge environment create production

# Deploy to production
npm run deploy:production

# Install to production sites
forge install --environment production
```

---

## 🔒 Security Features

### 1. Dry-Run Pattern
All write operations (Jira task, PR comment) require:
1. **Preview** (dry-run with `confirm=false`)
2. **User Review** in confirmation modal
3. **Explicit Confirmation** to execute

### 2. Input Validation
- All inputs sanitized before processing
- Evidence code limited to prevent injection
- PR context validated before analysis

### 3. Rate Limiting
- Cached results (30-minute TTL)
- Prevents excessive agent invocations
- Storage-based caching with Forge storage

### 4. Permissions
- Minimal required scopes
- Read-only by default
- Write operations gated behind confirmation

---

## 📊 Architecture

```
┌─────────────────────────────────────────┐
│         PR Sidebar (Forge UI)            │
│                                          │
│  ┌────────────────────────────────┐    │
│  │   React Custom UI (frontend/)   │    │
│  │   • Radar chart (D3.js)         │    │
│  │   • Risk breakdown              │    │
│  │   • Similar incidents           │    │
│  │   • Actions panel               │    │
│  └────────────────────────────────┘    │
│              ↕ @forge/bridge             │
│  ┌────────────────────────────────┐    │
│  │   Bridge Functions (src/bridge/)│    │
│  │   • getRiskAnalysis            │    │
│  │   • createJiraTask             │    │
│  │   • postPRComment              │    │
│  └────────────────────────────────┘    │
│              ↕ Rovo API                  │
│  ┌────────────────────────────────┐    │
│  │   Rovo Agents & Actions         │    │
│  │   • Risk Analyst agent          │    │
│  │   • Historian agent             │    │
│  │   • Action handlers             │    │
│  └────────────────────────────────┘    │
│              ↕                           │
│  External APIs (Jira, GitHub, Supabase) │
└─────────────────────────────────────────┘
```

---

## 🎯 Usage

### In Pull Requests

1. **Open PR** in Bitbucket/GitHub
2. **View sidebar** "Code Risk Radar" appears automatically
3. **Review analysis**:
   - Risk level banner
   - Radar chart of risk factors
   - Recommended actions with evidence
   - Similar past incidents
4. **Take action**:
   - Click "Create Jira Task" → Preview → Confirm
   - Click "Post PR Comment" → Preview → Confirm
5. **Refresh** if PR updated

### Via Rovo Chat

```
@Risk Analyst analyze the changes in PR #123
```

```
@Code Historian find incidents similar to SQL injection in auth code
```

---

## 🐛 Troubleshooting

### App Not Appearing in PR

1. Check installation: `forge install --list`
2. Verify manifest: `forge lint`
3. Re-install: `forge install --upgrade`

### Frontend Not Loading

1. Build frontend: `npm run build:frontend`
2. Check `frontend/build/` exists
3. Re-deploy: `forge deploy`

### Function Errors

1. View logs: `forge logs`
2. Check handler paths in manifest
3. Verify exports in bridge files

### Permission Errors

1. Add scopes to manifest
2. Re-deploy: `forge deploy`
3. Upgrade installation: `forge install --upgrade`

See **FORGE_DEPLOYMENT.md** for comprehensive troubleshooting.

---

## 📚 Documentation

- **[FORGE_DEPLOYMENT.md](FORGE_DEPLOYMENT.md)**: Complete deployment guide
- **[frontend/INTEGRATION_GUIDE.md](frontend/INTEGRATION_GUIDE.md)**: Frontend integration
- **[frontend/README.md](frontend/README.md)**: Frontend development guide
- **[docs/rovo/](docs/rovo/)**: Rovo agent documentation
- **[Forge Documentation](https://developer.atlassian.com/platform/forge/)**

---

## 🚀 What's Next?

### Immediate Next Steps
1. **Deploy**: Run `./scripts/setup-forge.sh`
2. **Test**: Open a PR and check the sidebar
3. **Customize**: Tune Rovo prompts for your needs

### Enhancements
- 📈 **Analytics**: Track risk trends over time
- 🤖 **Auto-fix**: Generate code fixes automatically
- 🔔 **Notifications**: Slack/email alerts for critical risks
- 📊 **Dashboards**: Team-wide risk metrics
- 🧠 **ML Training**: Retrain on your incidents

### Marketplace
- Polish UI/UX
- Add demo video
- Submit to Atlassian Marketplace

---

## 🤝 Contributing

This is a complete reference implementation. Feel free to:
- Fork and customize for your needs
- Submit issues for bugs
- Propose enhancements
- Share your modifications

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

Built with:
- **Atlassian Forge** - Platform
- **Rovo** - AI agents and actions
- **React** - UI framework
- **D3.js** - Visualization
- **Supabase** - Vector database (optional)

---

## 📞 Support

- **Documentation**: See docs/ directory
- **Issues**: GitHub Issues
- **Forge Community**: https://community.developer.atlassian.com/
- **Forge Docs**: https://developer.atlassian.com/platform/forge/

---

## ✅ Pre-Launch Checklist

- [ ] Forge CLI installed and authenticated
- [ ] Node.js 18+ installed
- [ ] Dependencies installed (`npm install`)
- [ ] Frontend built (`npm run build:frontend`)
- [ ] Environment variables configured
- [ ] Manifest updated with correct app ID
- [ ] Deployed to Forge (`forge deploy`)
- [ ] Installed to workspace (`forge install`)
- [ ] Tested in real PR
- [ ] Error handling verified
- [ ] Logs reviewed (`forge logs`)

---

## 🎉 Ready to Launch!

Run the setup script and start analyzing code risks in minutes:

```bash
./scripts/setup-forge.sh
```

**Questions?** Check FORGE_DEPLOYMENT.md or the Forge documentation.

**Happy coding! 🚀**
