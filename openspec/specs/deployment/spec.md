# Deployment Specification

## Purpose

Defines the deployment, infrastructure, CI/CD, security, and observability requirements for the Plataforma Eventos: Docker, VPS, Nginx, Cloudflare, environment configuration, and operations.

## Requirements

### Requirement: Environment & Configuration (UR-005)

The system MUST use environment variables for all secrets: JWT_SECRET, Conekta API key, Verificamex API key, DB connection. Separate .env files per environment: .env.development, .env.staging, .env.production. Frontend env vars prefixed with `VITE_`. Backend env vars NOT exposed to frontend. Config validation on startup (e.g., Joi, zod).

#### Scenario: Missing config fails fast

- GIVEN the backend starts without JWT_SECRET configured
- WHEN the application initializes
- THEN it exits with a clear error message

#### Scenario: Frontend env isolation

- GIVEN a VITE_ prefixed env var
- WHEN the Vite build runs
- THEN it is included in the client bundle; non-VITE_ vars are not exposed

### Requirement: Deployment Topology (UR-006)

The system MUST use Docker: frontend static build + backend container. VPS: single server deployment. Nginx: serves frontend static files AND reverse proxies `/api/*` to backend. Cloudflare: DNS proxy, SSL/TLS termination, DDoS protection. Single origin: frontend and API on same domain (no CORS needed). Docker Compose for local development. Production Dockerfile optimized (multi-stage build, non-root user).

#### Scenario: Single-origin deployment

- GIVEN the production deployment
- WHEN a browser requests `example.com/services`
- THEN Nginx serves the frontend static file

#### Scenario: API proxy

- GIVEN the production deployment
- WHEN a browser requests `example.com/api/v1/services`
- THEN Nginx proxies the request to the backend container

#### Scenario: Local development

- GIVEN a developer cloning the repo
- WHEN `docker compose up` is run
- THEN both frontend and backend start with hot-reload

### Requirement: CI/CD (UR-007)

The system MUST run automated tests on push. Linting and type checking in CI. Automated build verification (Docker build succeeds). Deployment pipeline: push to main → build → deploy. Database migration step in deployment.

#### Scenario: CI pipeline runs on PR

- GIVEN a pull request
- WHEN the PR is opened
- THEN tests, linting, and type checking run automatically

#### Scenario: Deployment on merge

- GIVEN a PR merged to main
- WHEN the deployment pipeline runs
- THEN the app is built, tested, and deployed to the VPS

### Requirement: Security (UR-008)

Secrets MUST never be in code or version control (.gitignore excludes .env). Security headers via Nginx: X-Content-Type-Options, X-Frame-Options, CSP, HSTS. Rate limiting on backend (especially auth endpoints). CORS configured for development (separate origins). Input validation on all endpoints (SQL injection, XSS prevention). Helmet.js or equivalent security middleware. Dependency vulnerability scanning.

#### Scenario: Security headers present

- GIVEN a production response
- WHEN response headers are inspected
- THEN X-Content-Type-Options, X-Frame-Options, CSP, HSTS are present

#### Scenario: Rate limiting

- GIVEN 20 rapid requests from the same IP to /auth/login
- WHEN the 21st request is made
- THEN 429 (too many requests) is returned

#### Scenario: Secrets not in code

- GIVEN the repository
- WHEN `.env` files are checked
- THEN they are in .gitignore and not committed

### Requirement: Observability (UR-010)

The system MUST provide GET /api/v1/health returning 200 with DB status. Application logging: structured JSON logs. Error logging: all 5xx errors with context. Database backup: automated daily backups. Process manager: PM2 or systemd (auto-restart on crash). Log rotation. Rollback plan: previous Docker image tag preserved.

#### Scenario: Structured logging

- GIVEN a request to any endpoint
- WHEN the request is processed
- THEN structured JSON logs include method, path, status, duration, user_id

#### Scenario: Daily backup

- GIVEN the MariaDB database
- WHEN a day passes
- THEN an automated backup is created and restorable

#### Scenario: Graceful restart

- GIVEN the backend process
- WHEN SIGTERM is received
- THEN connections are drained, DB pool is closed, process exits cleanly

### Requirement: Cloudflare Configuration (UR-006.4)

Cloudflare MUST provide DNS proxy, SSL/TLS termination, and DDoS protection. HTTPS enforced via Cloudflare. WebSocket support for Socket.IO MUST be configured.

#### Scenario: HTTPS enforced

- GIVEN a request to the production domain
- WHEN the request arrives
- THEN it is served over HTTPS via Cloudflare

#### Scenario: WebSocket upgrade

- GIVEN a Socket.IO client connecting
- WHEN the WebSocket upgrade request is made through Cloudflare
- THEN the connection is established successfully
