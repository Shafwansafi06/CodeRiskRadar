# 🚀 Forge App Deployment Guide

Complete step-by-step guide to deploy Code Risk Radar as an Atlassian Forge app.

---

## 📋 Prerequisites

### 1. Install Forge CLI

```bash
npm install -g @forge/cli
```

### 2. Verify Installation

```bash
forge --version
# Should show version 6.0.0 or higher
```

### 3. Login to Forge

```bash
forge login
```

This opens a browser for Atlassian authentication.

### 4. Verify Login

```bash
forge whoami
```

---

## 🏗️ Project Setup

### Step 1: Copy Forge Configuration

```bash
# Copy Forge manifest
cp manifest.forge.yml manifest.yml

# Copy Forge package.json
cp package.forge.json package.json
```

### Step 2: Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 3: Configure Environment

Create `.env` file in project root:

```bash
# GitHub Token (for PR comments)
GITHUB_TOKEN=ghp_your_github_token_here

# Supabase Configuration (optional for embeddings)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key
```

**Note:** Environment variables must be set as Forge variables:

```bash
forge variables set GITHUB_TOKEN ghp_your_token
forge variables set SUPABASE_URL https://your-project.supabase.co
forge variables set SUPABASE_KEY your_key
```

---

## 🔧 Update Manifest Configuration

### 1. Update App ID

Edit `manifest.yml`:

```yaml
app:
  id: ari:cloud:ecosystem::app/YOUR_APP_ID  # Get from Forge console
```

### 2. Choose Platform (Bitbucket or GitHub)

**For Bitbucket (default):**
```yaml
bitbucket:pullRequestSidebar:
  - key: risk-radar-sidebar
    # ... configuration
```

**For GitHub:**
```yaml
# Comment out bitbucket section
# Uncomment github section:
github:pullRequestPanel:
  - key: risk-radar-panel
    # ... configuration
```

### 3. Update Permissions

If using GitHub, uncomment GitHub permissions in `manifest.yml`:

```yaml
permissions:
  scopes:
    - read:repository:github
    - read:pullrequest:github
    - write:pullrequest:github
```

---

## 🏗️ Build Frontend

```bash
npm run build:frontend
```

This compiles the React app into `frontend/build/`.

**Verify build:**
```bash
ls -la frontend/build/
# Should see: index.html, static/js/, static/css/
```

---

## 📦 Deploy to Forge

### Step 1: Create the App

```bash
forge create
```

Follow prompts:
- **App name:** Code Risk Radar
- **Category:** Developer tools
- **Template:** Custom UI

### Step 2: Deploy Development Version

```bash
forge deploy
```

This uploads your code to Forge's development environment.

**Expected output:**
```
✔ Deploying your app
✔ App deployed
✔ Functions compiled
✔ Static resources uploaded
```

### Step 3: Install to Workspace

```bash
forge install
```

Follow prompts:
- **Product:** Bitbucket (or GitHub)
- **Site:** Select your Atlassian site

**Expected output:**
```
✔ App installed
✔ Installed to: https://your-site.atlassian.net
```

---

## 🧪 Testing

### 1. Local Development with Tunnel

```bash
# Terminal 1: Start tunnel
forge tunnel

# Terminal 2: Watch frontend changes
cd frontend
npm run build -- --watch
```

**Tunnel allows live testing without redeployment.**

### 2. Open a Test PR

1. Go to your Bitbucket/GitHub repository
2. Create a test PR with some code changes
3. Look for "Code Risk Radar" in the PR sidebar

### 3. Check Logs

```bash
# View real-time logs
forge logs

# Filter by function
forge logs --function get-risk-analysis-fn
```

---

## 🐛 Troubleshooting

### Issue: "App not appearing in PR sidebar"

**Solutions:**
1. Verify installation: `forge install --list`
2. Check manifest syntax: `forge lint`
3. Re-install: `forge install --upgrade`

### Issue: "Function handler not found"

**Solutions:**
1. Check handler paths in `manifest.yml`
2. Ensure files exist: `ls src/bridge/`
3. Verify exports: Check `export const handler = ...`

### Issue: "Permission denied errors"

**Solutions:**
1. Add required scopes in `manifest.yml`
2. Re-deploy: `forge deploy`
3. Re-install to update permissions: `forge install --upgrade`

### Issue: "Frontend not loading"

**Solutions:**
1. Verify build: `ls frontend/build/`
2. Check resource path in manifest: `path: frontend/build`
3. Re-build frontend: `npm run build:frontend`
4. Re-deploy: `forge deploy`

### Issue: "CORS errors"

**Solutions:**
1. Ensure external domains listed in manifest
2. Add to `external.fetch.backend`:
   ```yaml
   external:
     fetch:
       backend:
         - 'api.github.com'
         - '*.supabase.co'
   ```

---

## 🚀 Production Deployment

### Step 1: Create Production Environment

```bash
forge environment create production
```

### Step 2: Deploy to Production

```bash
npm run deploy:production
```

### Step 3: Install to Production Sites

```bash
forge install --environment production
```

### Step 4: Promote to Marketplace (Optional)

1. Go to [Forge Console](https://developer.atlassian.com/console)
2. Select your app
3. Click "Distribute" → "Atlassian Marketplace"
4. Fill out listing details
5. Submit for review

---

## 📊 Monitoring

### View Invocations

```bash
forge invocations
```

Shows function call statistics.

### View Storage Usage

```bash
forge storage
```

Shows cached data size.

### View Environment Variables

```bash
forge variables list
```

---

## 🔄 Updates

### Update Code

```bash
# Make changes to code
# Re-build frontend if needed
npm run build:frontend

# Deploy update
forge deploy

# Users get update automatically (no re-install needed)
```

### Update Manifest

```bash
# Edit manifest.yml
# Deploy
forge deploy

# Upgrade installations to get new permissions/modules
forge install --upgrade
```

---

## 📚 Forge Commands Reference

```bash
# Authentication
forge login                    # Login to Forge
forge logout                   # Logout
forge whoami                   # Show current user

# App Management
forge create                   # Create new app
forge deploy                   # Deploy app
forge install                  # Install app to site
forge install --upgrade        # Upgrade existing installation
forge uninstall                # Uninstall from site

# Development
forge tunnel                   # Start development tunnel
forge logs                     # View logs
forge lint                     # Check manifest syntax

# Environment Management
forge environment create <name>
forge environment list
forge environment delete <name>

# Variables
forge variables set <KEY> <value>
forge variables list
forge variables delete <KEY>

# Storage
forge storage                  # View storage usage
forge storage clear            # Clear all storage

# Deployment Info
forge install --list           # List installations
forge invocations              # View function calls
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] All dependencies installed (`npm install`)
- [ ] Frontend builds successfully (`npm run build:frontend`)
- [ ] Environment variables configured (`forge variables set`)
- [ ] Manifest syntax valid (`forge lint`)
- [ ] Handler paths correct in manifest

### Deployment
- [ ] Forge CLI logged in (`forge whoami`)
- [ ] App created (`forge create`)
- [ ] App deployed (`forge deploy`)
- [ ] App installed (`forge install`)

### Testing
- [ ] PR sidebar appears in test PR
- [ ] Risk analysis loads successfully
- [ ] Radar chart renders correctly
- [ ] Actions (Jira, PR comment) work with confirmation
- [ ] Error handling works (network failures, invalid data)
- [ ] Logs show no errors (`forge logs`)

### Production
- [ ] Production environment created
- [ ] Deployed to production (`--environment production`)
- [ ] Installed to production sites
- [ ] Monitoring configured
- [ ] Documentation updated

---

## 🆘 Support Resources

- **Forge Documentation:** https://developer.atlassian.com/platform/forge/
- **Forge Community:** https://community.developer.atlassian.com/
- **Forge CLI Reference:** https://developer.atlassian.com/platform/forge/cli-reference/
- **Custom UI Guide:** https://developer.atlassian.com/platform/forge/custom-ui/

---

## 🎉 You're Ready!

Your Code Risk Radar Forge app is now deployed and ready to analyze pull requests!

**Next Steps:**
1. Test with real PRs in your repository
2. Gather feedback from team
3. Tune Rovo agent prompts based on results
4. Add custom features as needed

**Questions?** Check the troubleshooting section or Forge documentation.
