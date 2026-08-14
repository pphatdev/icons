# Branch Protection — Maintainer Setup

This repo ships several security controls (CODEOWNERS review, an icon
validator workflow, SHA-pinned actions). Those controls only *block a merge*
if branch protection is enabled to enforce them. Apply the settings below
once per protected branch (`main`, `master`, `develop`).

## Option A — GitHub UI

Settings → Branches → **Add branch protection rule**

Branch name pattern: `main` (repeat for `master`, `develop`).

Check:

- **Require a pull request before merging**
  - Required approvals: **1**
  - Dismiss stale reviews when new commits are pushed
  - **Require review from Code Owners** ← makes `.github/CODEOWNERS` binding
- **Require status checks to pass before merging**
  - Require branches to be up to date before merging
  - Required checks (search & add each):
    - `validate` (from `Validate Icons` workflow)
    - `update-json` (from `Auto Update Category JSON` workflow)
- **Require signed commits**
- **Require linear history**
- **Do not allow bypassing the above settings**
- **Restrict who can push to matching branches** → maintainers only
- Unchecked / off:
  - Allow force pushes
  - Allow deletions

## Option B — `gh api` (idempotent, scriptable)

Run once per branch. Requires a token with `repo` + `admin:repo` scope.

```bash
BRANCH=main   # then repeat for master, develop
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/pphatdev/icons/branches/$BRANCH/protection" \
  -f "required_status_checks[strict]=true" \
  -F "required_status_checks[contexts][]=validate" \
  -F "required_status_checks[contexts][]=update-json" \
  -F "enforce_admins=true" \
  -F "required_pull_request_reviews[dismiss_stale_reviews]=true" \
  -F "required_pull_request_reviews[require_code_owner_reviews]=true" \
  -F "required_pull_request_reviews[required_approving_review_count]=1" \
  -f "restrictions=null" \
  -F "required_linear_history=true" \
  -F "allow_force_pushes=false" \
  -F "allow_deletions=false" \
  -F "required_conversation_resolution=true"
```

Then enable required signed commits (separate endpoint):

```bash
gh api --method POST \
  "repos/pphatdev/icons/branches/$BRANCH/protection/required_signatures"
```

## Also enable in Settings → Security

- **Private vulnerability reporting** — makes the link in `SECURITY.md` work.
- **Dependabot alerts** + **Dependabot security updates** — auto-PRs for
  `electron@33`, `next@15`, `react@19`, and the many transitive deps.
- **Secret scanning** + **push protection** — catches accidentally-committed
  tokens before they hit the remote.
- **Code scanning** with the default CodeQL setup (JavaScript/TypeScript).

## Verifying the guardrails work

After enabling, open a throwaway PR that touches `.github/workflows/foo.yml`
without your review — the merge button should be blocked with:

> Code owner review required — pphatdev must approve

And a PR adding `brands/evil.json` with `<svg onload="…">` should show:

> Validate Icons / validate — Failed

If either check *doesn't* block, revisit the corresponding setting above.
