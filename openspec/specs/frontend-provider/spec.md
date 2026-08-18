# Frontend Provider Specification

## Purpose

Defines the provider-facing React application: information architecture, onboarding wizard, dashboard tabs, verification flows, inventory/pricing management, and statistics.

## Requirements

### Requirement: Provider Information Architecture (FR-002)

The system MUST provide a ProviderLayout component wrapping all provider routes. 5-tab dashboard: Hoy, Mensajes, Calendario, Anuncios, Estadísticas. Onboarding wizard (3 steps) with auto-save between steps. Onboarding resumes on app close (localStorage or API). Tax calculator accessible from dashboard. Monthly report: transactions, gross, taxes, commission, net. CFDI remains deferred (out of MVP scope).

#### Scenario: Dashboard tabs render

- GIVEN a verified provider
- WHEN the dashboard loads
- THEN 5 tabs are visible: Hoy, Mensajes, Calendario, Anuncios, Estadísticas

#### Scenario: Onboarding auto-save

- GIVEN a provider completing step 1 of onboarding
- WHEN the app is closed mid-step
- WHEN the provider reopens the app
- THEN step 1 data is preserved and onboarding resumes

### Requirement: Onboarding Wizard (FR-011.1–FR-011.4)

The system MUST implement a 3-step onboarding wizard with progress indicator. Step 1: service type, location, capacity. Step 2: photos (min 5), title, description. Step 3: pricing, policies, cancellation, deposit.

#### Scenario: Complete onboarding

- GIVEN a new provider
- WHEN all 3 steps are completed
- THEN the service is created in `borrador` status

#### Scenario: Photo minimum enforced

- GIVEN a provider on step 2
- WHEN fewer than 5 photos are uploaded
- THEN step 3 cannot be reached

### Requirement: Dashboard — Hoy Tab (FR-011.5)

The system MUST display: urgent alerts, weekly summary, reminders, quick actions on the Hoy tab.

#### Scenario: Today dashboard loads

- GIVEN a provider with 2 upcoming reservations this week
- WHEN the Hoy tab is opened
- THEN alerts, summary, and quick actions are displayed

### Requirement: Dashboard — Calendario Tab (FR-011.6)

The system MUST provide monthly/weekly view, slot inventory, date blocking, availability indicators. Dynamic pricing configuration on calendar.

#### Scenario: Monthly calendar view

- GIVEN a provider with 15 reservations in March
- WHEN the Calendario tab is opened
- THEN the monthly view shows booked/available slots

#### Scenario: Date blocking

- GIVEN a provider who needs to block December 25
- WHEN the date is selected and blocked
- THEN the slot is unavailable for booking

### Requirement: Dashboard — Anuncios Tab (FR-011.7)

The system MUST allow editing photos, description, rules, cancellation policy from the Anuncios tab.

#### Scenario: Edit listing

- GIVEN a provider viewing the Anuncios tab
- WHEN the description is updated and saved
- THEN the listing reflects the new description

### Requirement: Dashboard — Estadísticas Tab (FR-011.8)

The system MUST display: payment history, earnings, response/acceptance rate, average rating.

#### Scenario: Stats display

- GIVEN a provider with 50 completed reservations
- WHEN the Estadísticas tab is opened
- THEN payment history, earnings, response rate, acceptance rate, and avg rating are shown

### Requirement: Verification Flows (FR-010)

The system MUST show a verification prompt on first login (if not verified). KYC flow: consent → capture → result. Verification badge on provider profile. Client voluntary verification option.

#### Scenario: Unverified provider prompted

- GIVEN a provider who has not verified
- WHEN the provider logs in for the first time
- THEN a verification prompt is displayed

#### Scenario: KYC flow

- GIVEN a provider consenting to KYC
- WHEN the KYC flow is completed
- THEN the verification status updates and badge is shown if successful
