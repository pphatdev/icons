# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Use GitHub's **private vulnerability reporting** for this repository:
[Report a vulnerability](https://github.com/pphatdev/icons/security/advisories/new)

You should receive an acknowledgement within a few business days. If you
haven't heard back, ping [@pphatdev](https://github.com/pphatdev) on the
advisory itself.

## Scope

In scope:

- The published `@pphatdev/registry` CLI and anything it installs into
  consumer projects.
- The icon registry itself (`brands/*.json`, `regular/*.json`, `*.json`
  index files) — poisoning attacks, stored XSS in SVG payloads, unsafe
  content that would execute in a consumer's browser or Electron app.
- The local development tooling under `.github/scripts/` — including the
  demo HTTP server (`demo-server.ts`) and the Electron desktop app
  (`.github/scripts/desktop/`).
- GitHub Actions workflows under `.github/workflows/` — script injection,
  secret exfiltration, unpinned third-party actions.

Out of scope:

- Findings that require an attacker to already have write access to the
  repository or to a maintainer's machine.
- Denial-of-service against localhost dev servers (they're bound to
  loopback by default).
- Missing security headers on GitHub Pages / documentation sites we
  don't control.

## What we look for in a good report

- A concrete proof-of-concept (a poisoned icon JSON, a curl command,
  a minimal HTML page) — not just a theoretical class of bug.
- The specific commit or version affected.
- Impact: what an attacker gains and under what preconditions.

## Maintainer setup

Branch protection, required status checks, and disclosure-reporting flags
that enforce the controls in this repo are documented in
[`.github/BRANCH_PROTECTION.md`](./.github/BRANCH_PROTECTION.md).

Thanks for helping keep the ecosystem safe.
