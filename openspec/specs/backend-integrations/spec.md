# Backend Integrations Specification

## Purpose

Defines external service integrations for the Plataforma Eventos backend: Conekta payments, Verificamex identity verification, push/email notification providers, and file storage.

## Requirements

### Requirement: Conekta Integration (BR-013.1)

The system MUST integrate Conekta server-side SDK for charges, refunds, and webhooks. Payment lifecycle (create, capture, refund) managed via Conekta API. MXN only.

#### Scenario: Charge creation via Conekta

- GIVEN a reservation with payment due
- WHEN the payment is processed
- THEN a Conekta charge is created and `conekta_charge_id` is stored

#### Scenario: Refund via Conekta

- GIVEN a processed payment eligible for refund
- WHEN a refund is initiated
- THEN the Conekta API refund is called and payment status updated to `reembolsado`

#### Scenario: Conekta webhook received

- GIVEN a Conekta webhook event (charge.paid, charge.failed)
- WHEN the webhook is received
- THEN the payment status is updated accordingly

### Requirement: Verificamex Integration (BR-013.2, BR-010.5)

The system MUST integrate Verificamex REST API: POST with API key authentication, 10-second timeout. Returns verification result against Lista Nominal.

#### Scenario: Successful KYC verification

- GIVEN a provider consenting to KYC
- WHEN the Verificamex API is called with valid INE data
- THEN the result (verificado/ine_vencido/etc.) is returned and metadata logged

#### Scenario: Verificamex timeout

- GIVEN a Verificamex API call
- WHEN the API does not respond within 10 seconds
- THEN the request times out gracefully and the user is notified

### Requirement: JWT Verification Library (BR-013.3)

The system MUST use a JWT verification library (e.g., `jsonwebtoken`) to validate its own issued tokens. Backend validates signature and expiration on every protected endpoint.

#### Scenario: Token verification

- GIVEN a backend-issued JWT
- WHEN the token is verified
- THEN the signature is validated and expiration checked

### Requirement: Push Notification Provider (BR-013.4, BR-009.4)

The system SHOULD integrate a push notification provider (FCM or OneSignal). Push delivery functional for 13 of 16 notification types.

#### Scenario: Push notification sent

- GIVEN a notification with push channel
- WHEN the notification is triggered
- THEN the push provider API is called and delivery status tracked

### Requirement: Email Provider (BR-013.5, BR-009.5)

The system SHOULD integrate an email provider (SendGrid or Mailgun). Email delivery functional for 8 of 16 notification types.

#### Scenario: Email notification sent

- GIVEN a notification with email channel
- WHEN the notification is triggered
- THEN the email provider API is called and delivery status tracked

### Requirement: File Storage (BR-013.6, UR-012)

The system MUST support file storage for photos (min 5 per service), voice notes (max 120s audio), and contract scans. Files MUST use private URLs with signed tokens (not publicly accessible). Provider TBD: S3, Cloudflare R2, or local filesystem.

#### Scenario: Photo upload

- GIVEN a provider creating a service listing
- WHEN photos are uploaded
- THEN they are stored and accessible via signed URLs

#### Scenario: Voice note upload

- GIVEN a user in a chat conversation
- WHEN a voice note (≤120s) is uploaded
- THEN it is stored and accessible via signed URL

#### Scenario: Private file access

- GIVEN a stored file (photo, voice note, contract scan)
- WHEN the file URL is accessed without a valid signed token
- THEN access is denied (403)

### Design-Decision Placeholders

- **File Storage Provider**: UQ-004 — S3 vs Cloudflare R2 vs local? (Design phase)
- **Push Provider**: UQ-002 — FCM vs OneSignal? (Design phase)
- **Email Provider**: UQ-003 — SendGrid vs Mailgun? (Design phase)
