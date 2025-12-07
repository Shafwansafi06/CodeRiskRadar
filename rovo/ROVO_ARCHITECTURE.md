# Rovo Architecture for Code Risk Radar

## Overview
This document describes the Rovo agent and action architecture for Code Risk Radar.

## Components

### Agents
1. **RiskAnalyst** - Analyzes code changes and provides risk assessment
2. **Historian** - Retrieves similar past incidents and learns from history

### Actions
1. **createJiraTask** - Creates Jira tasks from risk analysis (dry-run first)
2. **postPRComment** - Posts risk analysis as PR comments (dry-run first)
3. **createFixBranchPR** - Creates fix branch and PR (manual confirmation required)

## Safety Rules
- All write operations return previews first
- Require explicit `confirm=true` parameter to execute
- Log all operations for audit trail
- Rate limiting on action executions

## Integration Points
- Forge API for Jira integration
- GitHub API for PR operations
- Supabase for embeddings and history
- ML pipeline for risk scoring
