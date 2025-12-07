# 🚀 Code Risk Radar - Quick Start Card

## One-Command Deployment

```bash
./scripts/setup-forge.sh
```

That's it! This will deploy your complete Forge app in ~5 minutes.

---

## 📁 What Was Built

### Backend (Forge + Rovo)
```
src/
├── bridge/           # 4 bridge functions (Forge ↔ UI)
├── rovo/             # 2 Rovo agents
└── actions/          # 3 Rovo actions
```

### Frontend (React)
```
frontend/
├── src/
│   ├── components/   # 6 React components
│   ├── App.jsx       # Main app
│   ├── api.js        # Forge bridge
│   └── styles.css    # Complete styling
├── public/           # HTML template
└── scripts/          # Mock data
```

---

## 🎯 Key Files

| File | Purpose |
|------|---------|
| `manifest.forge.yml` | Forge app configuration |
| `package.forge.json` | Dependencies |
| `FORGE_DEPLOYMENT.md` | Complete deployment guide |
| `FORGE_README.md` | Full documentation |
| `frontend/INTEGRATION_GUIDE.md` | Frontend setup |

---

## ⚡ Common Commands

```bash
# Setup & Deploy
./scripts/setup-forge.sh       # Automated setup
forge deploy                   # Manual deploy
forge install                  # Install to workspace

# Development
forge tunnel                   # Live development
forge logs                     # View logs
cd frontend && npm start       # Local UI dev (mock data)

# Testing
forge lint                     # Check manifest
forge install --list           # List installations
forge logs --function get-risk-analysis-fn

# Updates
npm run build:frontend         # Rebuild UI
forge deploy                   # Deploy changes
forge install --upgrade        # Update permissions
```

---

## 🔧 Configuration

### Environment Variables
```bash
forge variables set GITHUB_TOKEN ghp_your_token
forge variables set SUPABASE_URL https://your-project.supabase.co
forge variables set SUPABASE_KEY your_key
```

### Choose Platform
Edit `manifest.yml`:
- **Bitbucket**: Use `bitbucket:pullRequestSidebar`
- **GitHub**: Use `github:pullRequestPanel`

---

## 🧪 Testing Flow

1. **Deploy**: `forge deploy`
2. **Install**: `forge install`
3. **Open PR**: Create test PR in repository
4. **Check sidebar**: Look for "Code Risk Radar"
5. **Verify**:
   - Risk analysis loads
   - Radar chart renders
   - Actions work with confirmation
6. **View logs**: `forge logs`

---

## 📊 Architecture Overview

```
PR Sidebar
    ↓
React Custom UI (frontend/)
    ↓ @forge/bridge
Bridge Functions (src/bridge/)
    ↓ Rovo API
Agents & Actions (src/rovo/ + src/actions/)
    ↓
External APIs (Jira, GitHub, Supabase)
```

---

## 🎨 Components

1. **Radar.jsx** - D3 visualization of risk factors
2. **RiskBreakdown.jsx** - Expandable actions list
3. **SimilarIncidents.jsx** - Historical context
4. **ActionsPanel.jsx** - Jira/PR action buttons
5. **ConfirmationModal.jsx** - Preview before write
6. **App.jsx** - Orchestrates everything

---

## 🔒 Safety Features

✅ **Dry-run pattern** - Preview before any write  
✅ **Confirmation modal** - User must explicitly confirm  
✅ **Input validation** - All inputs sanitized  
✅ **Caching** - 30-minute TTL reduces load  
✅ **Error handling** - Graceful degradation everywhere  

---

## 📚 Documentation Index

| Doc | Description |
|-----|-------------|
| **FORGE_DEPLOYMENT.md** | Step-by-step deployment guide |
| **FORGE_README.md** | Complete app documentation |
| **FORGE_DELIVERY.md** | Delivery summary & checklist |
| **frontend/INTEGRATION_GUIDE.md** | Frontend integration |
| **frontend/README.md** | Frontend development |
| **ROVO_QUICK_REFERENCE.md** | Rovo API reference |
| **TROUBLESHOOTING.md** | Common issues & solutions |

---

## ✅ Pre-Deploy Checklist

- [ ] Forge CLI installed: `npm install -g @forge/cli`
- [ ] Logged in: `forge login`
- [ ] Node.js 18+: `node -v`
- [ ] Dependencies installed: `npm install`
- [ ] Frontend built: `npm run build:frontend`
- [ ] Manifest configured: Edit app ID in `manifest.yml`

---

## 🐛 Quick Troubleshooting

**App not appearing?**
```bash
forge install --list    # Check if installed
forge lint              # Check manifest syntax
forge install --upgrade # Re-install
```

**Frontend not loading?**
```bash
npm run build:frontend  # Rebuild
ls frontend/build/      # Verify build exists
forge deploy            # Re-deploy
```

**Function errors?**
```bash
forge logs              # View errors
forge logs --function get-risk-analysis-fn
```

---

## 🎉 Success!

Once deployed, your PR sidebar will show:

🛡️ **Code Risk Radar**
- 📊 Risk level banner
- 🕸️ Radar chart of factors
- 📝 Recommended actions
- 🕰️ Similar past incidents
- 🎛️ Action buttons (Jira, PR comment)

---

## 🚀 Deploy Now

```bash
./scripts/setup-forge.sh
```

**That's it!** Your Forge app will be live in ~5 minutes.

---

## 📞 Need Help?

1. Check **FORGE_DEPLOYMENT.md** for detailed steps
2. Run `forge logs` to see errors
3. Visit https://community.developer.atlassian.com/

---

**Built with ❤️ using Atlassian Forge, Rovo, React, and D3.js**

🛡️ **Code Risk Radar** - Analyze smarter, code safer.
