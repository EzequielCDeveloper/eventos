# Frontend Client Specification

## Purpose

Defines the client-facing React application: information architecture, search/discovery, service detail, booking flow, cancellation UX, notifications display, favorites/rental history, and regulatory UX compliance.

## Requirements

### Requirement: Client Information Architecture (FR-001)

The system MUST provide 5-tab bottom navigation: Inicio, Favoritos, Rentas, Chat, Perfil. Secondary navigation on Inicio: Salones / Sonidos / Servicios. Role-based routing: client routes guarded, provider routes separate. AppLayout component wraps all client routes. Deep linking for service detail, booking flow state, reservation detail.

#### Scenario: Bottom navigation renders

- GIVEN a client user
- WHEN the app loads
- THEN 5 tabs are visible: Inicio, Favoritos, Rentas, Chat, Perfil

#### Scenario: Category filter on Inicio

- GIVEN the Inicio tab
- WHEN the secondary nav is visible
- THEN Salones / Sonidos / Servicios filter tabs are displayed

#### Scenario: Deep link to service detail

- GIVEN a direct URL to a service detail page
- WHEN the URL is accessed
- THEN the correct service is displayed

### Requirement: Search & Discovery (FR-004)

The system MUST provide search with 8+ filter dimensions: date, capacity, zone, budget, event type, pool, internet, rating. Filter state persists across navigation. Results display: photo, title, rating, price, capacity, location. Map view for results (if applicable).

#### Scenario: Multi-filter search

- GIVEN a user searching for venues
- WHEN filters for date, capacity=100, zone=centro, pool=true are applied
- THEN only matching services are shown in results

#### Scenario: Filter persistence

- GIVEN a user who applied filters and navigated away
- WHEN the user returns to search
- THEN the previously applied filters are still active

### Requirement: Service Detail (FR-005)

The system MUST display: gallery (min 5 photos, swipeable), pricing, rating, amenities, extras, available time slots, cancellation policy, reviews (1-5 stars + comment). Favorite toggle: add/remove. Availability calendar showing open slots.

#### Scenario: Service detail page

- GIVEN a service with 8 photos, 4.5 rating, 3 extras
- WHEN the detail page is loaded
- THEN all sections render: gallery, pricing, rating, amenities, extras, slots, policy, reviews

#### Scenario: Favorite toggle

- GIVEN a service not in favorites
- WHEN the heart icon is tapped
- THEN the service is added to favorites and the icon changes to filled

### Requirement: Booking Flow (FR-006)

The system MUST implement a 6-step booking flow: (1) Select date/time block, (2) Select extras, (3) Price summary with breakdown, (4) Payment via Conekta.js, (5) Contract signing (salon only), (6) Confirmation. Price summary shows cancellation policy. Alcohol permit prompt at H-5 if applicable. Booking flow state preserved on navigation back.

#### Scenario: Complete booking flow

- GIVEN a user selecting a service
- WHEN all 6 steps are completed
- THEN a reservation is created and confirmation is displayed

#### Scenario: Price summary shows client-visible price

- GIVEN a reservation with base $8,000 + taxes $1,280 + commission $1,000
- WHEN the price summary is displayed
- THEN the client sees $9,280 (rent + taxes), commission is hidden

#### Scenario: Alcohol permit prompt

- GIVEN a reservation with alcohol requested
- WHEN H-5 arrives
- THEN a prompt is shown with continue/cancel choice

### Requirement: Cancellation & Refund UX (FR-007)

The system MUST allow client cancellation from detail screen. Near cancellation: show retention policy, require acceptance. Provider cancellation: automatic full refund notification. Refund status displayed in reservation detail.

#### Scenario: Client initiates cancellation

- GIVEN a confirmed reservation
- WHEN the client taps cancel
- THEN the cancellation flow starts with policy display

#### Scenario: Near cancellation acceptance

- GIVEN a cancellation within the retention window
- WHEN the retention policy is displayed
- THEN the client must explicitly accept before the cancellation proceeds

### Requirement: Notifications Display (FR-008)

The system MUST provide an in-app notification center with read/unread state. Critical notifications highlighted. Notification badges on navigation tabs. Push notification handling. Event reminders at H-48 and H-2.

#### Scenario: Notification center

- GIVEN a user with 3 unread notifications
- WHEN the notification center is opened
- THEN 3 unread items are highlighted and badge count shows 3

#### Scenario: Push notification received

- GIVEN the app is in background
- WHEN a push notification arrives
- THEN the notification is displayed and badge count updated

### Requirement: Favorites & Rental History (FR-012)

The system MUST provide a favorites list persistent across sessions. Rental history tabs: Active, In-progress, Completed, Cancelled. Review enabled only when payment complete AND event_date < now.

#### Scenario: Favorites synced

- GIVEN a user who favorited 3 services
- WHEN the user opens the Favorites tab
- THEN all 3 services are displayed

#### Scenario: Review conditional visibility

- GIVEN a completed reservation with event_date in the past
- WHEN the reservation detail is viewed
- THEN the review form is available

### Requirement: Regulatory UX (FR-016)

The system MUST show: privacy consent modal before first data collection, T&C acceptance before transaction, price breakdown before payment confirmation, cancellation policy before booking. ARCO rights request form accessible from profile. Cookie consent banner.

#### Scenario: Privacy consent on first visit

- GIVEN a first-time user
- WHEN the app loads for the first time
- THEN a privacy consent modal is shown before any data collection

#### Scenario: T&C before booking

- GIVEN a user about to confirm a booking
- WHEN the booking confirmation step is reached
- THEN T&C acceptance is required before proceeding
