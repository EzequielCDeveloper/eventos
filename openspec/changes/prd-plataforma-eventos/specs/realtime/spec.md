# Realtime Specification

## Purpose

Defines real-time communication for the Plataforma Eventos: Socket.IO text chat, voice/video calls (Agora, D-005), and notification delivery across push/email/in-app channels.

## Requirements

### Requirement: Real-Time Text Chat (UR-009.1)

The system MUST provide real-time text chat via Socket.IO. Messages MUST be delivered bidirectionally in real-time. Frontend client at `lib/socket.ts`. Backend Socket.IO middleware for auth verification.

#### Scenario: Bidirectional message delivery

- GIVEN two users in the same chat room
- WHEN User A sends a message
- THEN User B receives it in real-time without polling

#### Scenario: Socket.IO auth on connection

- GIVEN a user connecting to Socket.IO
- WHEN the connection handshake includes a valid JWT
- THEN the connection is established

#### Scenario: Socket.IO auth rejection

- GIVEN a user connecting to Socket.IO
- WHEN the connection handshake includes no JWT or an invalid JWT
- THEN the connection is rejected

### Requirement: Voice/Video Calls (UR-009.2)

The system MUST support voice/video calls via Agora (D-005). Call initiation, connection, and termination MUST be functional. Voice/video is IN SCOPE for MVP.

#### Scenario: Voice call initiated

- GIVEN a client and provider in a chat
- WHEN the client initiates a voice call
- THEN the call is established and both parties can communicate

#### Scenario: Video call terminated

- GIVEN an active video call
- WHEN either party hangs up
- THEN the call is terminated and a `call_logs` entry is created

### Requirement: Notification Delivery (UR-009.3)

The system MUST deliver notifications via push, email, and in_app channels. Notifications dispatched per type/channel spec. 16 notification types across 3 channels. Critical notifications use ≥2 channels.

#### Scenario: Multi-channel dispatch

- GIVEN a contract signing notification (critical)
- WHEN the notification is triggered
- THEN it is sent via push AND email (minimum 2 channels)

#### Scenario: In-app notification

- GIVEN a user with an in_app notification
- WHEN the user opens the notification center
- THEN the notification is displayed with read/unread state

### Requirement: Voice Note Upload (UR-009.4)

The system MUST support voice note upload and playback (pre-recorded, not real-time streaming). Max 120 seconds duration.

#### Scenario: Voice note uploaded and played

- GIVEN a user in a chat
- WHEN a 45-second voice note is recorded and sent
- THEN it is stored and the recipient can play it back

#### Scenario: Voice note duration limit

- GIVEN a user attempting to record a 130-second voice note
- WHEN the duration exceeds 120 seconds
- THEN the recording is stopped or rejected

### Design-Decision Placeholders

- **Voice/Video Provider**: UQ-006 — Resolved (D-005): Agora (managed, per-minute cost); free tier 10K min/month covers MVP.
- **Socket.IO Auth Middleware**: UQ-009 — JWT verification on Socket.IO handshake? (Design phase)
