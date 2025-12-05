# 🚀 Code Risk Radar - Codegeist 2025 Kickoff

**Project Blueprint & Execution Plan**  
**Target**: Codegeist 2025 - Apps for Software Teams  
**Timeline**: 17 days (December 5-21, 2025)  
**Team**: 3 members (AI/ML, Backend, Frontend)

---

## 📋 Project Overview

**Code Risk Radar** is an AI-powered security and quality assistant that proactively scans Bitbucket pull requests, detects risky patterns (SQL injection, secrets, anti-patterns), and auto-creates Jira issues with actionable fixes—all within the Atlassian ecosystem via Forge and Rovo.

### Key Differentiators vs Generic AI Reviewers

1. **Context-Aware Risk Scoring**: Uses historical incident data (vector search) to prioritize by business impact, not just severity
2. **Bidirectional Jira Integration**: Auto-creates tickets, tracks remediation status back to Bitbucket
3. **Rovo-Native Workflow**: Conversational agent + actions accessible in Slack/Teams/Confluence
4. **Runs on Atlassian**: Forge-first architecture (minimal external dependencies)
5. **Safety-First Design**: All write operations require explicit user approval with dry-run previews

---

## 🎯 Feature Prioritization

### MVP (Must-Have for Submission) ✅
- [x] PR webhook triggers risk analysis on code diffs
- [x] Detect 5+ critical patterns (SQL injection, secrets, eval, breaking changes, TODOs)
- [x] Display risks in Bitbucket PR panel with severity badges
- [x] Create Jira issue for high severity (with user approval)
- [x] Rovo agent: "Summarize risks in PR-X"
- [x] Dry-run preview for ALL write operations

### Nice-to-Have (If Time Permits) 🎁
- [ ] Rovo action: "Suggest Fix" generates code patches via LLM
- [ ] Vector search: find similar past vulnerabilities
- [ ] Slack notifications for critical risks
- [ ] Custom risk rules via UI

### Stretch Goals (Post-Codegeist) 🚀
- [ ] Auto-remediation: commit fixes directly (with approval)
- [ ] Risk trend dashboard in Jira
- [ ] Multi-language support (currently JS/Python/Java)
- [ ] SAST tool integration (Snyk, SonarQube)

---

## 📁 Repository Structure (All Files Generated)

```
CodeRiskRadar/
├── manifest.yml                     ✅ Forge app config (modules, permissions)
├── package.json                     ✅ Dependencies
├── .gitignore                       ✅ 
├── README.md                        ✅ Setup & usage guide
├── SECURITY.md                      ✅ Safety rules & compliance
├── DEVELOPMENT_PLAN.md              ✅ 17-day milestone plan
│
├── src/
│   ├── index.js                     ✅ Main webhook handlers
│   ├── riskAnalyzer.js              ✅ Pattern detection + LLM enhancement
│   ├── jiraIntegration.js           ✅ Create/update Jira issues
│   ├── storage.js                   ✅ Forge Entities wrapper
│   ├── dryRunService.js             ✅ Generate previews for safety
│   ├── rovoAgent.js                 ✅ Conversational risk exploration
│   ├── rovoActions.js               ✅ Explain Risk, Suggest Fix, Approve Fix
│   └── vectorSearch.js              ✅ Supabase pgvector integration
│
├── static/
│   └── riskPanel/
│       ├── index.html               ✅ PR panel UI
│       ├── styles.css               ✅ Styling
│       └── script.js                ✅ Frontend logic + Forge bridge
│
└── tests/
    ├── riskAnalyzer.test.js         ✅ Unit tests for detection
    └── jiraIntegration.test.js      ✅ Mock Jira API tests
```

**Status**: ✅ All 19 files generated and ready to use

---

## 📅 17-Day Execution Plan

| **Days** | **Focus** | **Owner** | **Deliverables** |
|----------|-----------|-----------|------------------|
| **1-2** | Project setup, scaffolding | All | Forge app initialized, test accounts ready |
| **3-4** | Core infrastructure | Backend + AI/ML | Webhook listener, risk patterns defined |
| **5-6** | Risk detection engine | AI/ML + Backend | Analyzer detects 5+ patterns, Forge storage working |
| **7-8** | Jira integration + UI design | Backend + Frontend | Jira API works, PR panel UI mockup |
| **9-10** | Rovo agent & actions | AI/ML + Backend + Frontend | Agent responds, actions work with approval |
| **11-12** | Vector search + polish | All | Similar risks found, UI fully functional |
| **13-14** | End-to-end testing | All | Full workflow tested, edge cases covered |
| **15** | Polish & optimization | All | Production-ready UI, performance tuned |
| **16** | Documentation & demo | All | README, demo video (5-7 min), slides |
| **17** | Deployment & submission | All | Live in production, Codegeist submitted |

**Daily Standup**: 9 AM (15 min) - What's done? What's next? Blockers?

---

## 🛡️ Explicit Safety Rules

### Rule 1: No Silent Writes
All operations that modify Bitbucket repos or Jira issues MUST:
1. Show a dry-run preview in UI (diff for code, summary for Jira)
2. Require explicit user click on "Approve" button
3. Log approval event to Forge Entities (audit trail)

**Covered Operations**:
- Create Jira issue
- Update Jira issue
- Commit code fix
- Add PR comment

### Rule 2: Rate Limiting
- Max 10 LLM calls per PR (prevent cost overruns)
- Cache results in Forge storage (7-day TTL)

### Rule 3: Data Minimization
- Only send code **diffs** to LLM (not full repo)
- Strip credentials from logs
- No PII processed without consent

### Rule 4: Fail-Safe Defaults
- If analysis errors out → post generic comment ("Risk scan incomplete")
- Never block PR merge due to tool failure

### Rule 5: User Control
- Teams can disable auto-Jira creation
- Set custom severity thresholds
- Configure via Forge storage or `.coderiskadar.yml`

---

## 🚀 Getting Started (Quick Commands)

### 1. Install Dependencies
```bash
cd /home/shafwan-safi/Desktop/CodeRiskRadar
npm install
```

### 2. Set Environment Variables
```bash
forge variables set OPENAI_API_KEY "your-key"
forge variables set JIRA_PROJECT_KEY "RISK"
forge variables set SUPABASE_URL "your-url"      # Optional
forge variables set SUPABASE_KEY "your-key"      # Optional
```

### 3. Deploy to Forge
```bash
forge deploy
forge install --site your-site.atlassian.net
```

### 4. Test Locally
```bash
forge tunnel  # For local development
```

### 5. Run Tests
```bash
npm test
```

---

## 📊 Success Metrics

- [ ] PR webhook processes diffs in <5 seconds
- [ ] Risk detection accuracy >85%
- [ ] Jira issue creation success rate >95%
- [ ] Rovo agent response time <3 seconds
- [ ] Zero write operations without user approval
- [ ] Demo video <7 minutes
- [ ] All safety rules tested

---

## 🎯 Codegeist 2025 Alignment

✅ **Category**: Apps for Software Teams (Bitbucket + Jira)  
✅ **Runs on Atlassian**: Forge-native, minimal external infra  
✅ **Rovo Integration**: Agent + 3 actions (Explain, Suggest, Approve)  
✅ **Innovation**: Context-aware risk scoring with vector search  
✅ **Safety**: Dry-run previews + audit trail + fail-safe defaults  
✅ **User Value**: Proactive security, reduces MTTR, actionable insights  

---

## 📞 Team Communication

**Daily Standup**: 9:00 AM (15 min via Slack/Zoom)  
**Code Reviews**: PR-based (GitHub/Bitbucket)  
**Blockers**: Post in #blockers channel immediately  
**Demo Practice**: Day 16 (1 hour rehearsal)  

---

## 🎬 Next Steps

1. **Today**: Run `npm install`, set environment variables
2. **Tomorrow**: Deploy scaffold to Forge, test webhook
3. **Day 3**: Start Day 3-4 tasks (see DEVELOPMENT_PLAN.md)
4. **Day 16**: Record demo video
5. **Day 17**: Submit to Codegeist 🎉

---

## 📄 Key Documents

- **README.md**: Setup instructions, architecture, usage examples
- **SECURITY.md**: Safety guidelines, compliance, incident response
- **DEVELOPMENT_PLAN.md**: Detailed daily task breakdown
- **manifest.yml**: Forge app configuration
- **package.json**: Dependencies and scripts

---

**Status**: ✅ **READY TO BUILD**  
**All files generated**: 19/19  
**Blueprint approved**: Pending team review  
**Estimated completion**: December 21, 2025

---

**Good luck, team! Let's win Codegeist 2025! 🏆**
