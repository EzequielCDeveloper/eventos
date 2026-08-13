# Exploration: Documentación Completa de Producto — App Eventos

**Change**: `documentacion-producto-eventos`
**Date**: 2026-08-11
**Status**: Complete

---

## Current State

The project contains exactly **2 product documentation files** plus an empty OpenSpec scaffold:

| File | Lines | Coverage |
|------|-------|----------|
| `eventos.md` | 41 | Skeleton: 3 roles, basic nav bars, footer links. No business logic. |
| `arquitectura_interfaz_proveedores_eventos.md` | 59 | Provider onboarding wizard (3 steps), dashboard 5 tabs, adaptation table. |
| `openspec/config.yaml` | 34 | SDD context configured. No specs or changes yet. |

**Estimated coverage of the 23 product decisions: ~10%.**

---

## Gap Analysis: 23 Decisions vs. Existing Documentation

### Decisions Completely Missing (❌)

| # | Decision | Impact |
|---|----------|--------|
| 1 | MVP: particulares + empresas (posadas) | No target segment or MVP scope defined |
| 2 | Ingresos: comisión por transacción | No revenue model |
| 4 | Pagos: Conekta API (México, MXN) | No payment provider or currency |
| 5 | Reviews: solo tras pago completo + fecha evento pasada | No review system |
| 6 | Paquetes colaborativos: líder = salón | Complex collaborative flow undocumented |
| 8 | Precios: 3 modelos (salón, sonido, servicio-persona) | Three distinct pricing models absent |
| 9 | Comisión se suma al precio; visibilidad diferenciada | Critical UX/pricing visibility rule missing |
| 10 | Depósito de garantía configurable por salón | No deposit logic |
| 11 | Contrato FÍSICO, firma dual, INE, permiso alcohol | Complex physical-digital flow undocumented |
| 12 | Chat texto/voz/video; MVP: notas de voz | Only "Chat con clientes" in nav skeleton |
| 13 | Anticipos, cobro flexible, plataforma no responde por impago post | Payment flexibility rules missing |
| 14 | Calculadora impuestos + reporte mensual | No tax management docs |
| 16 | Usuario: ve horarios rentables | No search/browse UX |
| 18 | Cancelaciones: 3 escenarios, políticas por actor | Most complex rules, zero documentation |
| 19 | Sin mediación de disputas | Platform boundary undefined |
| 20 | Filtros: fecha, capacidad, zona, presupuesto, tipo, alberca, internet, calificación | No search/filter UX |
| 21 | Notificaciones: 14+ tipos | Only vague "alertas de acción inmediata" |
| 22 | Verificación: INE + KYC APIs (Verificamex incluida) | Zero verification docs |
| 14+ | Admin role scope | Listed as role #3 but zero functionality |

### Decisions Partially Covered (⚠️)

| # | Decision | What Exists | What's Missing |
|---|----------|-------------|----------------|
| 3 | Reserva por bloques + paquetes | "Bloques de 4, 6, 8 horas" mentioned | No paquete completo definition |
| 7 | Capacidad concurrente: 1-for-salon, configurable for others | Generic "capacidad concurrente" | Forced-1-for-salons rule, configuration mechanism |
| 15 | Proveedores: mantenimiento e inoperación | "Bloqueo de fechas no disponibles" | Maintenance vs. unavailability distinction |
| 17 | Agenda electrónica GRATUITA | Dashboard "Calendario" tab | Free agenda scope, cross-industry adaptability |
| 23 | Ranking: 3 métricas | 3 metrics mentioned | Ranking algorithm, weighting, visibility |

---

## Errors Found

| # | Issue | Detail |
|---|-------|--------|
| E1 | **Role mismatch** | `eventos.md` lists "Administrador" as role #3 but no decision references admin functionality. Needs explicit scope or removal. |
| E2 | **"asesorado" label** | `eventos.md` calls user "Usuario normal (asesorado)" — ambiguous. Is it a role variant or descriptor? |
| E3 | **Provider concurrency contradiction** | `arquitectura_interfaz...` says providers handle "3 o 4 eventos simultáneos" but Decision 7 FORCES salons to 1-evento-a-la-vez. Contradiction. |

---

## Loose Ends / Ambiguities

| # | Issue | Detail |
|---|-------|--------|
| L1 | **"Zona de trabajo" + viáticos por KM** | Mentioned in adaptation table but never addressed in decisions. Travel fees undefined. |
| L2 | **"Reserva inmediata vs. aprobación manual"** | Onboarding mentions both but no decision specifies which is default or if providers can toggle. |
| L3 | **"Ajuste dinámico de precios"** | Dashboard mentions it but decisions don't address surge/seasonal pricing. |
| L4 | **"Mínimo de fotos"** | Onboarding mentions minimum but no quantity or quality standards decided. |
| L5 | **Admin role scope** | Referenced but zero functionality defined. |
| L6 | **Concurrent event limits for sound/service** | Decision 7 says "configurable" but no mechanism or max limits defined. |
| L7 | **Deposit × cancellation interaction** | Decision 10 (deposit) and Decision 18 (cancellation) have implicit edge cases. |
| L8 | **Physical contract ceremony** | Decision 11 covers rules but not the operational flow (who initiates, where, digital tracking). |
| L9 | **"Lista de espera" for alcohol permit** | What happens if permit doesn't arrive by H-5h? Escalation path undefined. |
| L10 | **Voice notes MVP scope** | Decision 12 says "notas de voz tipo WhatsApp" but no transcription, playback, or storage limits. |

---

## Missing Documentation Categories

1. **Business model** — revenue, pricing, commissions (Decisions 2, 8, 9)
2. **User flows** — reservation, payment, cancellation (Decisions 3, 4, 11, 13, 18)
3. **Provider flows** — onboarding, packages, availability (Decisions 6, 7, 15)
4. **Payment/financial** — Conekta, deposits, refunds (Decisions 4, 10, 13)
5. **Cancellation policy** — most complex rules (Decision 18)
6. **Messaging/notifications** — chat types, 14+ notification triggers (Decisions 12, 21)
7. **Identity verification** — KYC flow, Verificamex (Decision 22)
8. **Search/discovery** — filters, ranking algorithm (Decisions 20, 23)
9. **Tax management** — calculator, monthly reports (Decision 14)
10. **Legal/regulatory** — Mexican 2026 regulations (User note C)
11. **Simplification areas** — explicit trade-offs (User note B)
12. **Admin role** — referenced but undefined

---

## Recommended Document Structure

**Convention**: `snake_case` español for filenames. All files in `/home/anon/uni/web/`.

| # | File | Description | Decisions |
|---|------|-------------|-----------|
| 0 | `README.md` | Índice maestro, visión, glossario, tabla de decisiones | — |
| 1 | `vision_y_alcance.md` | MVP, segmentos, modelo ingresos, alcance marketplace | 1, 2 |
| 2 | `roles_y_permisos.md` | Roles, permisos, verificación, ranking, admin scope | 22, 23 |
| 3 | `taxonomia_de_servicios.md` | Tipos (salón, sonido, servicio-persona), categorías, extras | 8 |
| 4 | `paquetes_colaborativos.md` | Paquete completo, líder salón, invitación, disponibilidad cruzada | 6 |
| 5 | `flujo_de_reserva.md` | Bloques horas, paquete completo, contrato físico, firma, permisos | 3, 7, 11 |
| 6 | `pagos_y_comisiones.md` | Conekta, comisión, tarifa app, impuestos, depósito, cobro flexible | 4, 9, 10, 13, 14 |
| 7 | `cancelaciones_y_reembolsos.md` | Políticas por actor, tiempos, retención, devolución | 18, 19 |
| 8 | `mensajeria.md` | Chat texto/voz/video, MVP notas de voz, automatizaciones | 12 |
| 9 | `notificaciones.md` | 14+ tipos, triggers, canales | 21 |
| 10 | `verificacion_de_identidad.md` | INE presencial, KYC APIs, Verificamex, Lista Nominal | 22 |
| 11 | `interfaces_cliente.md` | Explorar, buscar, filtros, detalle, favoritos, rentas, perfil | 16, 20 |
| 12 | `interfaces_proveedor.md` | Onboarding, dashboard 5 tabs, agenda, configuración, calendario | 15, 17 |
| 13 | `areas_de_simplificacion.md` | Trade-offs explícitos, qué NO se hace en MVP | User note B |
| 14 | `normativa_mexicana_2026.md` | Ley Federal Protección Datos, CNBV, Ley Consumer, permisos alcohol | User note C |
| 15 | `verificamex_integracion.md` | Detalle técnico integración: API, Lista Nominal, flujo, errores | User note A + Decision 22 |

---

## Recommendation

This is a **greenfield documentation change** — existing files are skeletons to rewrite, not patch.

**Approach**: Start with `README.md` as anchor, work in dependency order (vision → roles → taxonomía → flujos → interfaces). Preserve good content from `arquitectura_interfaz...` (provider dashboard structure). Flag 3 errors and 10 loose ends for user resolution during proposal.

**Cognitive load considerations** (per cognitive-doc-design skill):
- Each doc: lead with answer, progressive disclosure, chunking, signposting
- Cross-reference between docs but keep each self-contained
- Use tables/checklists over prose for rules and decisions
- Design for reviewer verification without reconstructing whole story

---

## Risks

| Risk | Severity | Detail |
|------|----------|--------|
| R1 | High | Verificamex integration (User note A) requires API research — zero existing detail |
| R2 | High | Mexican 2026 regulations (User note C) requires current legal research — training data may be stale |
| R3 | Medium | Physical contract flow (Decision 11) is highly operational — needs careful UX documentation |
| R4 | Medium | Cancellation × deposit interaction (Decisions 10, 18) has implicit edge cases |
| R5 | Low | Admin role referenced but completely undefined — scope creep risk |

---

## Ready for Proposal

**Yes.** All 23 decisions are captured. Exploration identified 3 errors, 10 loose ends, and the complete 16-document structure. Ready for `sdd-propose` to define the concrete change with file list and loose-end resolution strategy.
