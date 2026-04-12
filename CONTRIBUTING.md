# Contributing to Universal Uploader

Thanks for your interest in contributing! This document explains how the process works.

---

## The Basic Flow

1. **Open an Issue first** — before writing any code, open an Issue describing the bug or the feature you want to add. This avoids wasted effort in case it's already being worked on or doesn't fit the project direction.

2. **Wait for a green light** — the maintainer will review the Issue and let you know if it's a good fit and how to approach it.

3. **Fork, implement, and open a Pull Request** — once approved, fork the repo, make your changes, and open a PR against the `master` branch.

4. **Review and merge** — the maintainer reviews the code, may request changes, and merges it when it's ready.

---

## Types of Contributions

### Bug fixes
If a cloud provider changes their API and presigned URL generation breaks, open an Issue with:
- Which provider is affected (`aws`, `r2`, `azure`, or `gcs`)
- What the current behavior is vs. what it should be
- A link to the provider's changelog or documentation if available

### New cloud provider
If you want to add support for a new provider (e.g., Backblaze B2, DigitalOcean Spaces):
- Open an Issue first to discuss it — not all providers will be accepted
- If approved, follow the pattern of the existing services in `src/services/`
- The new service must export a single `generate<Provider>UploadUrl` function
- Add the provider to the routing logic in `src/index.ts`
- Update the README with credentials setup instructions and an API example

### Documentation improvements
No Issue needed for small fixes (typos, clarifications). Just open a PR directly.

---

## Code Guidelines

- Follow the existing patterns in `src/services/*.ts` — consistency matters more than cleverness
- Do not log credentials or sensitive data anywhere
- Keep error messages generic on the client side (details go to `console.error` for server logs only)
- Test your changes locally with `test-endpoints.sh` before submitting

---

## What Will Not Be Merged

- Changes that weaken the security model (e.g., logging credentials, removing encryption)
- Providers that require running a separate server (this must stay serverless)
- Large refactors without prior discussion in an Issue

---

## Local Setup

```bash
git clone https://github.com/YOUR_USERNAME/api-uploader
cd api-uploader
npm install
cp .dev.vars.example .dev.vars   # add your MASTER_ENCRYPTION_KEY
cp test-config.example.json test-config.json  # add your test credentials
npm run dev
```

See the [README](README.md) for full setup and testing instructions.
