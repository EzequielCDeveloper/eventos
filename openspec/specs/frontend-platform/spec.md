# Frontend Platform Specification

## Purpose

Defines shared frontend architecture concerns: messaging UI, state management, API client layer, design system, and routing. These are cross-cutting concerns shared across client, provider, and admin applications.

## Requirements

### Requirement: Messaging UI (FR-009)

The system MUST provide chat thread: client ↔ provider. Real-time message delivery via Socket.IO (`lib/socket.ts`). Voice note recording and playback (max 120s). Quick replies selector (provider). Message read receipts (`read_at` display). Scheduled messages displayed in thread.

#### Scenario: Real-time message delivery

- GIVEN an active chat conversation
- WHEN a message is sent by one party
- THEN it appears instantly for the other party without refresh

#### Scenario: Voice note recording

- GIVEN a user in a chat
- WHEN the record button is held for 30 seconds
- THEN a voice note is recorded with duration display and sent

#### Scenario: Read receipts

- GIVEN a sent message
- WHEN the recipient reads it
- THEN `read_at` timestamp is displayed to the sender

### Requirement: State Management (FR-013)

The system MUST use Zustand stores: `authStore`, `uiStore`. Feature-based stores in feature directories. Auth state: JWT, user profile, role accessible globally. Server state caching (React Query or similar).

#### Scenario: Auth state persistence

- GIVEN a logged-in user
- WHEN the app is refreshed
- THEN the JWT, user profile, and role are restored from Zustand store

#### Scenario: Feature store isolation

- GIVEN the booking feature and the chat feature
- WHEN each manages its own state
- THEN changes in one feature do not affect the other

### Requirement: API Client Layer (FR-014)

The system MUST provide a centralized API client with JWT attachment (`Authorization: Bearer <token>`). Error handling interceptor. Request/response TypeScript type definitions matching backend shapes. Request retry logic for transient failures.

#### Scenario: JWT automatically attached

- GIVEN a logged-in user with a valid JWT
- WHEN any API request is made
- THEN the `Authorization: Bearer <token>` header is included

#### Scenario: 401 triggers redirect

- GIVEN an API response with status 401
- WHEN the error interceptor processes it
- THEN the user is redirected to the login page

#### Scenario: Retry on transient failure

- GIVEN an API request that returns 503
- WHEN the retry logic executes
- THEN the request is retried with exponential backoff

### Requirement: Design System (FR-015)

The system MUST use Tailwind CSS utility-first styling. Radix UI for accessible primitives (dialog, dropdown, toast, etc.). Responsive: mobile-first, break at tablet/desktop. Consistent icon system. Dark mode support (if planned).

#### Scenario: Responsive layout

- GIVEN a client on a mobile device (375px width)
- WHEN the app loads
- THEN the layout adapts to mobile view with bottom navigation

#### Scenario: Accessible dialog

- GIVEN a Radix UI Dialog component
- WHEN opened
- THEN focus is trapped inside and escape closes it

### Requirement: Routing (FR-017)

The system MUST use React Router v6 with nested routes matching the IA structure. Protected routes: redirect unauthenticated to login. Role-based route guards: client/provider/admin render correct layout. Lazy loading for feature routes (code splitting).

#### Scenario: Unauthenticated redirect

- GIVEN a user not logged in
- WHEN accessing a protected route (e.g., /reservations)
- THEN the user is redirected to /login

#### Scenario: Role-based layout

- GIVEN a user with role `prestador`
- WHEN navigating to provider routes
- THEN ProviderLayout is rendered

#### Scenario: Lazy loading

- GIVEN the booking feature route
- WHEN the route is first accessed
- THEN the feature bundle is loaded on demand (code splitting)
