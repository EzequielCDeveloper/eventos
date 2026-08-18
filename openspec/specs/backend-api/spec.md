# Backend API Specification

## Purpose

Defines the REST API surface for the Plataforma Eventos backend: endpoint catalog, request/response contracts, authentication/authorization middleware, error model, data model mapping, pagination, filtering, versioning, and non-functional requirements (health, logging, rate limiting).

## Requirements

### Requirement: REST Resource Endpoints (BR-001)

The system MUST expose REST endpoints for all 30+ domain entities using plural nouns (`/reservations`, `/services`, `/users`). Standard HTTP methods map to CRUD: GET (read), POST (create), PUT/PATCH (update), DELETE (soft/hard). All endpoints MUST be under `/api/v1/`.

#### Scenario: CRUD operations on resources

- GIVEN a domain entity (e.g., services, reservations)
- WHEN GET/POST/PUT/DELETE is called on the corresponding resource path
- THEN the correct CRUD operation is performed and JSON is returned

#### Scenario: Versioning prefix enforced

- GIVEN any API request
- WHEN the path does not start with `/api/v1/`
- THEN the request is rejected with 404

### Requirement: Response Envelope (BR-001.4, UR-001.1)

The system MUST return JSON responses with consistent envelope: `{ data, meta?, errors? }`. List endpoints MUST include `meta: { total, page, limit, pages }`.

#### Scenario: Paginated list response

- GIVEN a list endpoint with `?page=1&limit=20`
- WHEN the request succeeds
- THEN response contains `data` array, `meta.total`, `meta.page`, `meta.limit`, `meta.pages`

### Requirement: Filtering and Sorting (BR-001.6–BR-001.7)

The system SHOULD support filtering via query params (e.g., `?service_type=salon&status=publicado`) and sorting (`?sort=rating:desc`).

#### Scenario: Filtered search

- GIVEN a service search endpoint
- WHEN `?service_type=salon&zone=centro` is provided
- THEN only matching services are returned

### Requirement: Authentication & Authorization (BR-002)

The system MUST verify backend-issued JWT on every protected endpoint. Requests without valid JWT return 401. The system MUST extract `user.id`, `user.role`, `user.segment` from JWT payload. Three roles MUST be enforced: `usuario`, `prestador`, `administrador`.

#### Scenario: Valid JWT grants access

- GIVEN a valid JWT in `Authorization: Bearer <token>` header
- WHEN a protected endpoint is called
- THEN the request proceeds with `req.user` populated

#### Scenario: Missing or invalid JWT

- GIVEN no JWT or an expired/invalid JWT
- WHEN a protected endpoint is called
- THEN 401 is returned

#### Scenario: Role-based access denied

- GIVEN a JWT with role `usuario`
- WHEN an admin-only endpoint is called
- THEN 403 is returned

### Requirement: Admin Function Gating (BR-002.4)

The system MUST gate admin endpoints to exactly 5 functions: moderation, provider management, stats, technical disputes, commission. Admin cannot access non-admin routes; non-admin cannot access admin routes.

#### Scenario: Admin access to admin endpoints

- GIVEN a JWT with role `administrador`
- WHEN `/admin/stats` is called
- THEN the request proceeds

#### Scenario: Non-admin blocked from admin endpoints

- GIVEN a JWT with role `prestador`
- WHEN `/admin/stats` is called
- THEN 403 is returned

### Requirement: Provider Verification Gate (BR-002.5)

The system MUST require provider verification before publishing services. `verified = true` MUST be checked at service publish; reject with descriptive error if not verified.

#### Scenario: Unverified provider blocked from publishing

- GIVEN a provider with `verified = false`
- WHEN attempting to publish a service
- THEN the request is rejected with a descriptive error

### Requirement: Soft-Delete Auth Guard (BR-002.6)

The system MUST reject authentication for soft-deleted users (`deleted_at` set). JWT verification MUST check `deleted_at IS NULL`.

#### Scenario: Soft-deleted user cannot authenticate

- GIVEN a user with `deleted_at` set
- WHEN login is attempted
- THEN 401 is returned

### Requirement: JWT Issue & Refresh (BR-002.7, UR-003)

The system MUST issue JWT on login (POST /api/auth/login) and support refresh flow (POST /auth/refresh). Backend validates credentials, issues tokens, and rotates on refresh.

#### Scenario: Login returns JWT

- GIVEN valid credentials
- WHEN POST /api/auth/login is called
- THEN a JWT is returned in the response

#### Scenario: Token refresh

- GIVEN a valid JWT
- WHEN POST /auth/refresh is called
- THEN a new JWT is issued and the old one is invalidated

### Requirement: Error Model (BR-003)

The system MUST return structured error responses: `{ error: { code, message, details? } }`. Standard HTTP status codes MUST be used: 400 (validation), 401 (auth), 403 (forbidden), 404 (not found), 409 (conflict), 422 (unprocessable), 500 (server). Machine-readable error codes MUST be included (e.g., `RESERVATION_SLOT_CONFLICT`, `PROVIDER_NOT_VERIFIED`).

#### Scenario: Structured error response

- GIVEN a validation error on a POST request
- WHEN the request is processed
- THEN response is 400 with `{ error: { code: "VALIDATION_ERROR", message: "...", details: [...] } }`

#### Scenario: Frontend handles 401/403/422 (UR-004)

- GIVEN an API error response
- WHEN the frontend receives 401, it redirects to login; 403 shows "unauthorized"; 422 displays field errors

### Requirement: Data Model Mapping (BR-004)

The system MUST map all 30+ tables to ORM models. `DECIMAL(10,2)` for all MXN amounts. ENUM types for closed sets. JSON columns for free-form payloads. Soft delete (`deleted_at`) on users and services. `ON DELETE RESTRICT` for all FKs except junction tables (CASCADE). Versioned SQL migrations with up/down pairs. Seed data for default amenities, event types, initial commission rate. Two materialized views: `v_provider_ranking`, `v_slot_availability`.

#### Scenario: Monetary amounts stored as DECIMAL

- GIVEN a payment of $1,500.50 MXN
- WHEN stored in the database
- THEN the value is exact (no floating-point rounding)

#### Scenario: Soft-deleted records excluded

- GIVEN a user with `deleted_at` set
- WHEN a normal query runs
- THEN the user is not included in results

### Requirement: API Endpoints Catalog (UR-002)

The system MUST provide the following endpoint groups: Auth (register, login, logout, me), Users (profile, verify-ine, verify-kyc), Services (CRUD, search, slots), Pricing (salon/sound/persona, extras, dynamic-rules), Inventory (slots, blocks, hours), Packages (create, invite, respond, availability), Reservations (create, list, status, timeline), Contracts (get, confirm), Payments (create, get, refund), Messages (conversations, messages), Notifications (list, read), Reviews (create, list), Favorites (add, remove), Admin (stats, commission, disputes, moderation).

#### Scenario: All endpoint groups accessible

- GIVEN the API is deployed
- WHEN each endpoint group is called with valid auth
- THEN the correct resource operations are available

### Requirement: Request/Response Shapes (UR-001.2–UR-001.6)

Responses MUST use `Content-Type: application/json`. Request bodies for POST/PUT/PATCH MUST be JSON. IDs are integer auto-increment. Dates use ISO 8601 strings.

#### Scenario: JSON content type

- GIVEN any API request
- WHEN the response is returned
- THEN `Content-Type: application/json` is set

### Requirement: Non-Functional Requirements (BR-014)

The system MUST provide GET /api/v1/health returning 200 with DB status. Request logging: method, path, status, duration, user_id. Rate limiting on auth endpoints. Database connection pooling. Graceful shutdown (SIGTERM). Automated daily MariaDB backups. Audit logs for state-changing operations.

#### Scenario: Health check

- GIVEN the backend is running
- WHEN GET /api/v1/health is called
- THEN 200 is returned with DB connectivity status

#### Scenario: Rate limiting on auth

- GIVEN 10 rapid login attempts from same IP
- WHEN the 11th attempt is made
- THEN 429 (too many requests) is returned

### Requirement: API Versioning (UR-011)

The system MUST use URL-based versioning: `/api/v1/...`. A version upgrade strategy MUST be documented for breaking changes.

#### Scenario: Versioned endpoints

- GIVEN the API v1
- WHEN a new breaking change is introduced
- THEN a `/api/v2/...` path is created and v1 remains functional

### Design-Decision Placeholders

- **ORM/Query Builder**: BQ-001 — Sequelize, Knex, Prisma, or raw SQL? (Design phase)
- **Search Implementation**: BQ-007 — SQL queries vs full-text engine? (Design phase)
- **Dynamic Pricing Timing**: BQ-009 — At search, at booking, or both? (Product decision)
