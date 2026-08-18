# Backend Business Logic Specification

## Purpose

Defines the core business logic for the Plataforma Eventos: reservation lifecycle, payments/commissions, cancellations/refunds, messaging, notifications, identity verification, collaborative packages, and Mexican regulatory compliance.

## Requirements

### Requirement: Reservation Lifecycle (BR-005)

The system MUST implement a 13-state reservation lifecycle: `creado → invitaciones_pendientes → ... → completada/cancelada`. State transitions MUST be enforced; invalid transitions rejected. Slot availability MUST be validated transactionally at booking time (concurrent bookings: one succeeds, one rejected). Salon concurrency forced to 1 (app-level). `reservation_status_history` generated on every status change. Cancellation policy snapshot stored at creation. `total_price = base_amount + extras_amount + taxes_amount + commission_amount`.

#### Scenario: Successful booking

- GIVEN a available slot with capacity > 0
- WHEN a client creates a reservation
- THEN the slot is reserved, status is `creado`, and `total_price` is calculated correctly

#### Scenario: Concurrent booking conflict

- GIVEN a slot with 1 remaining capacity
- WHEN two clients book simultaneously
- THEN one succeeds and the other receives `RESERVATION_SLOT_CONFLICT` error

#### Scenario: Invalid state transition

- GIVEN a reservation in status `confirmada`
- WHEN an attempt to move it back to `creado`
- THEN the transition is rejected

### Requirement: Alcohol Permit Flow (BR-005.8)

The system MUST pause state at `permiso_alcohol` until H-5 decision when alcohol permit is requested. State machine halts at this step.

#### Scenario: Alcohol permit requested

- GIVEN a reservation with alcohol permit requested
- WHEN the reservation reaches `permiso_alcohol` state
- THEN the state halts until the client makes a continue/cancel decision at H-5

### Requirement: Package Reservations (BR-005.7)

The system SHOULD support package reservations with multiple `reservation_items`. Package creates linked reservation_items per member.

#### Scenario: Package booking creates multiple items

- GIVEN a package with 3 members (salon + sound + meseros)
- WHEN a client books the package
- THEN 3 reservation_items are created, one per member service

### Requirement: Payments & Commissions (BR-006)

The system MUST integrate Conekta server-side SDK for payment processing (MXN only). Three payment types: anticipo, saldo, deposito_garantia. Commission rate from latest `commission_settings` row. Commission summed into visible price (client sees rent + taxes; provider sees full price). Currency CHECK = 'MXN' enforced. Flexible billing: (1) mandatory advance, (2) full pre-event, (3) post-service.

#### Scenario: Payment processed via Conekta

- GIVEN a reservation with total_price $10,000 MXN
- WHEN the client pays the anticipo
- THEN a Conekta charge is created, `conekta_charge_id` stored, payment status is `procesado`

#### Scenario: Commission calculation

- GIVEN a commission rate of 10% and a reservation of $10,000
- WHEN the payment is processed
- THEN `commission_amount = $1,000`, client sees $10,000 (rent+taxes), provider sees $11,000 (full)

#### Scenario: Non-MXN currency rejected

- GIVEN a payment attempt with currency USD
- WHEN the payment is submitted
- THEN it is rejected at both application and DB level

### Requirement: CFDI Generation (BR-006.7, BR-012.7)

CFDI generation per payment is DEFERRED per user instruction ("por el momento CFDI queda pendiente"). Requirements kept as documented constraint for future implementation. No active scenarios.

### Requirement: Monthly Tax Report (BR-006.8)

The system MUST generate monthly tax report per provider: transactions, gross, taxes, commission, net. Report queryable by admin and provider.

#### Scenario: Provider views monthly report

- GIVEN a provider with transactions in January
- WHEN the provider requests the January report
- THEN the report shows total transactions, gross amount, taxes, commission, and net earnings

### Requirement: Cancellations & Refunds (BR-007)

Client cancellation: advance is non-refundable; near cancellation applies provider policy. Provider cancellation: FULL refund of advance + deposit + additional payments. Retention acceptance required before processing near cancellation. Application order: advance → deposit → other payments. Five refund reasons enforced. Refunds via Conekta API.

#### Scenario: Client cancels far in advance

- GIVEN a client who booked 30 days before event
- WHEN the client cancels
- THEN the advance is non-refundable, other payments refunded per policy

#### Scenario: Provider cancels

- GIVEN a confirmed reservation
- WHEN the provider cancels
- THEN full refund is processed automatically and client is notified

#### Scenario: Near cancellation requires acceptance

- GIVEN a client canceling within the provider's retention window
- WHEN cancellation is initiated
- THEN the retention policy is displayed and `retention_accepted = true` must be confirmed before processing

### Requirement: Messaging (BR-008)

The system MUST persist all text messages with sender, timestamp, `read_at`. Voice notes: max 120s duration, `audio_url`, `duration_seconds`. Conversations UNIQUE on (client_id, provider_id, service_id). Quick replies for providers. Scheduled messages (4 automation types). Messages searchable and accessible post-event.

#### Scenario: Text message sent

- GIVEN a conversation between client and provider
- WHEN a text message is sent
- THEN it is stored with sender, timestamp, and `read_at = NULL`

#### Scenario: Voice note uploaded

- GIVEN a conversation
- WHEN a voice note of 90 seconds is uploaded
- THEN it is stored with `audio_url` and `duration_seconds = 90`

#### Scenario: Voice note exceeds duration

- GIVEN a voice note of 130 seconds
- WHEN upload is attempted
- THEN it is rejected (DB CHECK constraint ≤ 120s)

### Requirement: Notifications (BR-009)

The system MUST implement 16 notification types across 3 channels (push, email, in_app). Critical notifications (contract, payment, cancellation) MUST use ≥2 channels. Notification status tracking: `pendiente → enviada → leida`. Push notification integration (provider TBD: FCM or OneSignal). Email notification integration (provider TBD: SendGrid or Mailgun). Event reminders: H-48 push+email, H-2 push, both parties.

#### Scenario: Critical notification multi-channel

- GIVEN a contract signing notification (critical)
- WHEN the notification is triggered
- THEN it is sent via push AND email (minimum 2 channels)

#### Scenario: Event reminder timing

- GIVEN an event on Saturday at 10:00
- WHEN Thursday 10:00 arrives (H-48)
- THEN push + email reminders are sent to both client and provider

### Requirement: Identity Verification (BR-010)

Verification is mandatory for providers (blocks publication), voluntary for clients (badge). INE presencial method: physical delivery + contract signing. KYC remote: Verificamex (primary), Truora (mid), Veriff (high). Verificamex: REST API, POST, 10s timeout, API key auth. Identity verification logs ONLY metadata (no CURP, no name, no OCR data stored). Explicit consent required before verification.

#### Scenario: Unverified provider blocked

- GIVEN a provider with no verification
- WHEN attempting to publish a service
- THEN the publish is rejected until verification completes

#### Scenario: Verificamex KYC

- GIVEN a provider consenting to KYC
- WHEN the Verificamex API is called
- THEN metadata (result, estatus) is logged; no PII stored

#### Scenario: Consent required before verification

- GIVEN a user who has not given consent
- WHEN verification is initiated
- THEN the system requires explicit consent (consent_logs entry) before proceeding

### Requirement: Collaborative Packages (BR-011)

Only salons can create/lead packages. 7-state package lifecycle. Cross-slot availability verification before publish. Price auto-computed: sum of member prices + extras + taxes + hidden platform fee. Member rejection → leader can invite replacement of same type.

#### Scenario: Salon creates package

- GIVEN a salon provider
- WHEN a package is created with sound and mesero members
- THEN the package enters `creado` state with the salon as leader

#### Scenario: Cross-slot availability check

- GIVEN a package with 3 members
- WHEN the package is published
- THEN all member slots are verified atomically; if any slot is unavailable, publish fails

### Requirement: Regulatory Compliance (BR-012)

LFPDPPP: explicit consent before data collection, ARCO rights support (20 business-day deadline), no INE/biometric data persisted. Ley Consumer: clear price breakdown before booking, cancellation policy visible. Código Comercio: valid electronic contracts (bilateral confirmation + digital preservation). Comercio Electrónico: T&C before transaction. COFEPRIS: sanitary self-declaration for catering. NOM-151: electronic document preservation.

#### Scenario: Privacy consent required

- GIVEN a new user
- WHEN the user first interacts with data collection
- THEN a privacy consent modal is shown and `consent_logs` entry is created

#### Scenario: ARCO rights request

- GIVEN a user requesting data access
- WHEN the ARCO request is submitted
- THEN `arco_requests` is created with `deadline_at` = now + 20 business days

#### Scenario: Price breakdown before payment

- GIVEN a reservation ready for payment
- WHEN the client views the price summary
- THEN rent + taxes are clearly displayed (no hidden commission)
