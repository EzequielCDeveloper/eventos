# Frontend Architecture — Vite + React

## Stack

- Vite 5 + React 18
- React Router v6
- Zustand (estado)
- Tailwind CSS + Radix UI
- Firebase (auth + realtime chat)
- Conekta.js (pagos)

## Estructura de Carpetas

```
src/
├── assets/
│   ├── images/
│   └── icons/
│
├── components/                    # Componentes UI compartidos
│   ├── ui/                        # Button, Input, Card, Modal, Badge
│   ├── layout/                    # AppLayout, ProviderLayout, AdminLayout
│   └── icons/
│
├── features/                      # Dominios de negocio
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── OnboardingWizard/
│   │   │       ├── StepBasico.tsx
│   │   │       ├── StepVisual.tsx
│   │   │       └── StepPrecios.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── OnboardingPage.tsx
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── search/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── booking/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── provider/
│   │   ├── components/
│   │   │   ├── today/
│   │   │   ├── calendar/
│   │   │   ├── listings/
│   │   │   └── stats/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── chat/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── payments/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── notifications/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   ├── profile/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── types.ts
│   │   └── index.ts
│   │
│   └── admin/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── types.ts
│       └── index.ts
│
├── hooks/                         # Hooks globales
├── lib/                           # Utilidades
│   ├── api.ts                     # Cliente HTTP
│   ├── conekta.ts                 # Wrapper pagos
│   ├── firebase.ts                # Firebase config
│   ├── formatters.ts              # Formateo MXN, fechas
│   └── constants.ts               # Enums, config
│
├── stores/                        # Estado global
│   ├── authStore.ts
│   └── uiStore.ts
│
├── types/                         # Tipos globales
│   ├── models.ts
│   └── api.ts
│
├── router.tsx
├── App.tsx
└── main.tsx
```

## Auth — Flujo

```
Login (Firebase Auth)
  ↓
Token JWT → authStore
  ↓
Rol (usuario/prestador/administrador)
  ↓
Layout correspondiente:
  - usuario    → AppLayout (navbar inferior)
  - prestador  → ProviderLayout (tabs dashboard)
  - administrador → AdminLayout (sidebar)
```

### Rutas protegidas

| Ruta | Rol requerido |
|------|---------------|
| `/`, `/search`, `/booking/*`, `/favorites`, `/rentals`, `/chat/*`, `/profile` | `usuario` |
| `/provider/*` | `prestador` |
| `/provider/onboarding` | `prestador` |
| `/admin/*` | `administrador` |
| `/login`, `/register` | público |

### Onboarding Wizard (3 pasos)

Paso 1 → Tipo servicio + ubicación + capacidad
Paso 2 → Fotos (mínimo 5) + título + descripción
Paso 3 → Tarifas + políticas + cancelación + depósito

Guardado automático entre pasos. Reanuda desde último paso al cerrar app.
Publicación pendiente de verificación del admin.
