# Sample PR payloads for testing

This directory should contain sample PR payloads for testing feature extraction and model inference.

## Format

Each JSON file should follow Bitbucket webhook payload structure:

```json
{
  "pullrequest": {
    "id": 123,
    "title": "Fix authentication bug",
    "description": "This PR fixes a security issue",
    "author": {
      "display_name": "John Doe"
    },
    "created_on": "2025-12-05T10:00:00Z",
    "updated_on": "2025-12-05T14:00:00Z"
  },
  "repository": {
    "slug": "my-repo"
  },
  "diff_stats": {
    "lines_added": 150,
    "lines_deleted": 80,
    "files": ["src/auth/login.js", "test/auth.test.js"]
  },
  "commit_history": [
    {"hash": "abc123"},
    {"hash": "def456"}
  ],
  "diff_text": "... actual diff content ..."
}
```

## Test Files

- `low_risk_pr.json` - Simple documentation update
- `medium_risk_pr.json` - Feature addition with tests
- `high_risk_pr.json` - Security fix, breaking changes

Generate with:
```bash
python generate_synthetic_data.py
```
