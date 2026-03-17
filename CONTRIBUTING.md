# Contributing to RentalSuite

Thank you for your interest in contributing! This document explains how to
report bugs, propose features, and submit code changes.

---

## Table of Contents

- [Reporting Bugs](#reporting-bugs)
- [Proposing Features](#proposing-features)
- [Branch Workflow](#branch-workflow)
- [Commit Style](#commit-style)
- [Setting Up a Local Development Environment](#setting-up-a-local-development-environment)

---

## Reporting Bugs

Before opening an issue, please:

1. Check the [open issues](../../issues) to see if it has already been reported.
2. Verify you are running the latest version (`git pull origin main`).

When filing a bug report, include:

- **Steps to reproduce** — the exact sequence of actions that trigger the bug.
- **Expected behaviour** — what you expected to happen.
- **Actual behaviour** — what actually happened.
- **Environment** — OS, Docker version, Node.js version, browser (if frontend).
- **Relevant logs** — output of `docker compose -f docker-compose.prod.yml logs api --tail=50`.

---

## Proposing Features

Open an issue with the `enhancement` label and describe:

- The problem you are trying to solve.
- Your proposed solution.
- Any alternative approaches you considered.

Large features should be discussed in an issue before a pull request is opened.

---

## Branch Workflow

```
main        ← stable production releases (protected)
develop     ← active development target — all PRs merge here
```

1. Fork the repository and create your branch from `develop`:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/my-feature
   ```

2. Make your changes and commit (see [Commit Style](#commit-style) below).

3. Push your branch and open a Pull Request targeting **`develop`**.

4. A maintainer will review and merge into `develop`.
   Releases are periodically merged from `develop` → `main` and tagged.

---

## Commit Style

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
**written in Spanish**, matching the project's existing history:

```
<type>: <short description in Spanish>

[optional body]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code restructuring without behaviour change |
| `test` | Adding or fixing tests |
| `chore` | Build scripts, CI, dependency updates |

### Examples

```
feat: edición masiva de reservas con selección múltiple
fix: error 401 en checkin cuando el token ya ha sido usado
docs: actualizar API_ENDPOINTS con nuevos endpoints de gastos recurrentes
refactor: extraer lógica de paginación a hook usePagination
```

Rules:

- Use the imperative, present tense in the description ("añadir", not "añadido").
- Keep the first line under 72 characters.
- Do **not** add `Co-Authored-By` or tool attribution lines.

---

## Setting Up a Local Development Environment

### Prerequisites

- Docker ≥ 24 with the Compose plugin
- Node.js ≥ 20 + npm

### Steps

**1. Clone and install dependencies**

```bash
git clone https://github.com/your-org/rentalsuite.git
cd rentalsuite
npm install
```

**2. Start infrastructure**

```bash
docker compose up -d postgres redis
```

**3. Configure environment**

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env:
#   DATABASE_URL  → use localhost:5432 (not the Docker hostname)
#   REDIS_URL     → use localhost:6379
#   JWT_SECRET    → any random string for local dev
```

**4. Run Prisma migrations**

```bash
cd apps/api
DATABASE_URL="postgresql://rentcrm:your-password@localhost:5432/rentcrm" \
    npx prisma migrate dev
cd ../..
```

> If `migrate dev` fails with "migration modified", use `prisma db push` instead.
> This project has historical migration drift; `db push` is the standard in development.

**5. Start the API**

```bash
npm run dev --workspace=apps/api
# API available at http://localhost:3001
```

**6. Start the frontend**

```bash
npm run dev --workspace=apps/frontend
# Frontend available at http://localhost:5173
```

### Deploying API changes locally

The API Dockerfile copies a pre-built `dist/`. Always build before rebuilding
the image:

```bash
npm run build --workspace=apps/api
docker compose build api && docker compose up -d api
docker logs rentcrm-api --tail=20
```

The frontend uses the Vite dev server (`npm run dev`), which has hot reload.
In Docker (prod) the frontend is a static build — see `apps/frontend/Dockerfile.prod`.

### Running tests

```bash
npm test --workspace=apps/api
```

---

## Code Style

- TypeScript strict mode throughout.
- All i18n strings go in `apps/frontend/src/i18n/index.ts` — no separate JSON files.
- Prisma migrations always run from the host with an explicit `DATABASE_URL`;
  never from inside a container.
- Public API routes require the `@Public()` decorator; the JWT guard is global.

---

## License

By contributing you agree that your contributions will be licensed under the
[GNU General Public License v3.0](LICENSE).
