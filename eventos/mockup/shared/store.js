/* ============================================
   FiestaExpert — Almacén Compartido (FEStore) v2
   Datos demo + persistencia localStorage + sesión
   con token JWT simulado.
   Consumible por las tres secciones (usuario/,
   proveedor/, admin/) sin backend.
   Cargar ANTES de shared/api.js, shared/auth.js y
   de cada app.js. Sin dependencias; file:// ok.
   v2: seed con 3 categorías (salones/sonido/
   servicios-persona) y fechas 2026; entidades
   nuevas (favoritos, notificaciones, chat,
   anuncios, inventario, comisión, moderación);
   login emite token falso demo-jwt.<rol>.<ts>.
   ============================================ */
(function () {
  'use strict';

  /* ---------- Constantes ---------- */
  var SEED_VERSION = 2;

  var KEY_USERS = 'fiestakexpert.users';
  var KEY_SERVICES = 'fiestakexpert.services';
  var KEY_RESERVATIONS = 'fiestakexpert.reservations';
  var KEY_REVIEWS = 'fiestakexpert.reviews';
  var KEY_SESSION = 'fiestakexpert.session';
  var KEY_SEED_VERSION = 'fiestakexpert.seedVersion';
  var KEY_FAVORITES = 'fiestakexpert.favorites';
  var KEY_NOTIFICATIONS = 'fiestakexpert.notifications';
  var KEY_CONVERSATIONS = 'fiestakexpert.conversations';
  var KEY_MESSAGES = 'fiestakexpert.messages';
  var KEY_LISTINGS = 'fiestakexpert.listings';
  var KEY_INVENTORY = 'fiestakexpert.inventorySlots';
  var KEY_BLOCKED_DATES = 'fiestakexpert.blockedDates';
  var KEY_PRICING = 'fiestakexpert.dynamicPricing';
  var KEY_BLOCKED_PROVIDERS = 'fiestakexpert.blockedProviders';
  var KEY_DISPUTES = 'fiestakexpert.technicalDisputes';
  var KEY_MODERATION = 'fiestakexpert.moderationQueue';
  var KEY_DRAFT_RESERVATION = 'fiestakexpert.draftReservation';
  var KEY_WIZARD = 'fiestakexpert.wizardOnboarding';
  var KEY_MONTHLY_REPORT = 'fiestakexpert.monthlyReport';
  var KEY_COMMISSION = 'fiestakexpert.commissionSettings';
  var KEY_UI_STATE = 'fiestakexpert.uiState';

  // Entidades colección (CRUD genérico) y objetos únicos (estado).
  var ENTITY_KEYS = {
    users: KEY_USERS,
    services: KEY_SERVICES,
    reservations: KEY_RESERVATIONS,
    reviews: KEY_REVIEWS,
    favorites: KEY_FAVORITES,
    notifications: KEY_NOTIFICATIONS,
    conversations: KEY_CONVERSATIONS,
    messages: KEY_MESSAGES,
    listings: KEY_LISTINGS,
    inventorySlots: KEY_INVENTORY,
    blockedDates: KEY_BLOCKED_DATES,
    dynamicPricing: KEY_PRICING,
    blockedProviders: KEY_BLOCKED_PROVIDERS,
    technicalDisputes: KEY_DISPUTES,
    moderationQueue: KEY_MODERATION
  };

  var STATE_KEYS = {
    session: KEY_SESSION,
    draftReservation: KEY_DRAFT_RESERVATION,
    wizardOnboarding: KEY_WIZARD,
    monthlyReport: KEY_MONTHLY_REPORT,
    commissionSettings: KEY_COMMISSION,
    uiState: KEY_UI_STATE
  };

  /* ---------- Capa de persistencia (localStorage + fallback memoria) ---------- */
  var persistent = true;
  var memory = {};
  var storage = null;

  try {
    storage = window.localStorage;
  } catch (e) {
    storage = null;
    persistent = false;
  }

  function useMemoryFallback() {
    persistent = false;
    storage = null;
  }

  function readRaw(key) {
    if (storage) {
      try {
        return storage.getItem(key);
      } catch (e) {
        useMemoryFallback();
      }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function writeRaw(key, value) {
    if (storage) {
      try {
        storage.setItem(key, value);
        return;
      } catch (e) {
        useMemoryFallback();
      }
    }
    memory[key] = value;
  }

  function removeRaw(key) {
    if (storage) {
      try {
        storage.removeItem(key);
        return;
      } catch (e) {
        useMemoryFallback();
      }
    }
    delete memory[key];
  }

  function readArray(key) {
    var raw = readRaw(key);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveArray(key, items) {
    writeRaw(key, JSON.stringify(items));
  }

  function readObject(key, fallback) {
    var raw = readRaw(key);
    if (!raw) return fallback || {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : (fallback || {});
    } catch (e) {
      return fallback || {};
    }
  }

  function saveObject(key, obj) {
    writeRaw(key, JSON.stringify(obj || {}));
  }

  function findById(items, id) {
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(id)) return items[i];
    }
    return null;
  }

  /* ---------- Fotos demo (URLs de las demos vigentes) ---------- */
  var DEMO_FOTOS = [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCq4X8Gy-oex5q9DlY5cOCde8-L4Ll39-k7reImCjQ8Vqe5EaMMg8wSdwNVJThrT-21QKYnKCHYNrC0ufoC0H6MG72KaJS4-4pexzifwnETkxZDKdTDZUK32HbWmeQhDJmth9u7AuyBrsbs3yeFkWXXRVKr5R6A080CXhpz2SHE3n5_R083Y0CyYvOZ4idjV37lJ0gfelibyb9hfrg682DyDEeQEuqcCflm_DYrQiN9P8vuy1pGLWeVwg',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuApAd-5f70Cqqpbpu7gUM2nkmQsvaHWEg-26W7yBngxbi6DERfx6rxiScTL-fV3hl_2MLfVsPJneQ7REVzaouszW4omK8lbtqHQRgWPuODfj8CiajMFVECv-T8-Y7N-j7VBF5BOkf96zO5gunsOBfKK-beARNpX2rMsQm1oWv36kOWxHTUNDpQKkLBoRCbHJbItr8f_D7m_xLv_jz40hNpVHRjpR2Gclvu2PGAVFjNigQFNg_ZrH8ncGQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBuEPm6XftA8obkZpwcMhs0fy2FfQr7Zm8Jc3x1xwZr8BFD_SG0DO60rAuXT0nk0u0Jr7PB-XQ4OW_3ksWlw-6bGFYU0T2FOzEl461eoVYfMOjIqNvx1RMNGgDt7ymhkJlstkrbsJy-xzGSADPC-XCHTn5m2eHuL35l0r6VpXhNZSSZAOtt-ky7KYRX3WhBh3FCNLmKEg0Qhq-MZrx-T-SgLQaSmI8CVjr8AsN1odzsVAZswh2NrdTN4w',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD84702IokLoNr9AFwxEjZ5a0OK0uInRGSDcyX-gvd5Ijmcr8T4Hy6UhAHpesOZVbriIQoIy_RTE8M_Lz-65SwFvGfkYgGobDyE0gfg0BqMJbIFUgZeCFJmAMjfBodLgkKl1L4P-W982iZFB8j1mnxFqMZ1J6HnSQ6GTCAiGutcgbpSgKvHFA4Tu-esxe_erNRNSBJdC3avBrc2Xlnd0nglOf1QTSszfRR9oSYt42obOmY2FX8IxfWd4g',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAtAbHBEMW-8jM9rMmmcrQeriGqt4MyWXQVP-GzK81yZeAI-5jKVDnA5uX8YP93G4wYpwJmA1eWFOWi0Hh1W3Q8chuX6bkrQ2I-Pue9CbPFpAuC8MCyklNuF2KGS6ZYkSy-cex6N-PfDwvVyVRdQdF4KamU4igH0n3b05lIuhj_G-cZduIRCRJ8Hrfs3FjCLnLGNVPJhLzXXSTSZS-JVIqSRC-_PsHGEzWKvFImtphhAa8m4z8jaY-9oA',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDEN7iLlGhnbnsCvgKVjT0M-ty7pE6sz8OoqcmjVYZhiDtMcZZoGwecwa_KTc4rl327sUd4u8L8EHXxhrsU2VtqGDEbMEoeQWmUAEBddLj205L5grgvdqzknvZ7740dAholHnrXB-MvJu0_l-_7Cuv4rkpdNGQA6cfRMQcpCkfoMG8Jtyvp3tBxAkBFvKwsoboVo10Lm7J0h_aJjBp-Firmi_NNSCWg2iX7IK3MmP6rT9WH3RZfHtkIEA',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC7iDzWOfHvb3XQL4kXagwpQpQ1074JW6W4EHUf7et6zXT-ZU-CvMc1bqeSfdT9wkKwUQFnk9UkzQa7xvQm8YsorZJubc55zEj1uVX8Gy6UbMU7nc3qg-AFz2UxZHiUXUM5cyPxvQledccqOexKkcSWo6W8raV_RbRkApPnOcXCIZd8mqkzaznFCBYE_-5B3uL26W_QijS_4a7uYiozapHXtb-gD4Fj_e3rA6dbUyF-sfwhs-YrGAtWxg',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuA4BY6ltmOMY7FRF7c-OIic19AKgN4gH50KCxUWJCcY_1jhU-frUmTlwiDiOk7Uzo6VgtBXnktTOJJ_2gRxgKBM3NSS0a1Rva6K5rkdC1TJdAB58WjI9-gckkzfok5re52sQCipAg9UJfMVlil6ext46PaZnUo6KYtJqS7ZnKpMktmuNgymKKIcGwlJiGMrmYZwaJpZA6SLaw0pwhigMSfiXeW-oA-NMNVU_rPiyYdilFXf1QHO_gRKUQ',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuC8nRHmsJqdNgzbIx5SdV519FHXpctYZfOkR3F9iIxmjcOAuYvGsFR_Gh_1-Bvq8wdfWi1nie8NRnC1qXaERmZLbW2bFRprkoZ2z8ttJpmD-VSW6-SMDoc0qvZR4_M2CPO8BQxdQRcmchJO2N17EeYDSEJpoJE7CvcrmZPLKWMth8Y8cQB_UafrnOenjO9mLlAiLQNCpEmzMLD8tEWnkTvhgHf0-8s7m0IexLGcNfz8Z2yV6jGcAS82lg'
  ];

  function fotos(n) {
    var out = [];
    for (var i = 0; i < n; i += 1) {
      out.push(DEMO_FOTOS[i % DEMO_FOTOS.length]);
    }
    return out;
  }

  /* ---------- Datos demo: usuarios ---------- */
  function demoUsers() {
    return [
      {
        id: 'demo-usuario',
        nombre: 'Alejandro Mendoza',
        email: 'usuario@demo.com',
        password: 'demo123',
        rol: 'usuario',
        verificado: true,
        kycStatus: 'approved',
        badges: ['identidad-verificada'],
        consentPrivacidad: true,
        cookiePref: 'aceptadas'
      },
      {
        id: 'demo-proveedor',
        nombre: 'Juan Carlos Pérez',
        email: 'proveedor@demo.com',
        password: 'demo123',
        rol: 'proveedor',
        verificado: true,
        kycStatus: 'approved',
        badges: ['identidad-verificada'],
        consentPrivacidad: true,
        cookiePref: 'aceptadas'
      },
      {
        id: 'demo-admin',
        nombre: 'Administrador Demo',
        email: 'admin@demo.com',
        password: 'demo123',
        rol: 'admin',
        verificado: true,
        kycStatus: 'approved',
        badges: [],
        consentPrivacidad: true,
        cookiePref: 'aceptadas'
      }
    ];
  }

  /* ---------- Servicios: 3 categorías, fechas 2026 ---------- */
  function demoServices() {
    return [
      {
        id: 'demo-salon-1',
        categoria: 'salones',
        titulo: 'Salón Las Palmas',
        descripcion: 'Salón Las Palmas ofrece un ambiente inigualable de elegancia y modernidad para tus eventos más especiales. Con arquitectura contemporánea, ventanales panorámicos e iluminación inteligente. Ideal para bodas, graduaciones y eventos corporativos.',
        ubicacion: 'Polanco, CDMX',
        capacidad: 300,
        precioBase: 8000,
        modeloPrecio: 'bloque',
        horaExtra: 1500,
        fotos: fotos(6),
        amenities: ['Wi-Fi de Alta Velocidad', 'Pista de Baile', 'Aire Acondicionado', 'Estacionamiento Privado', 'Acústica Premium', 'Áreas Climatizadas'],
        extras: [
          { nombre: 'Catering Premium', descripcion: 'Menú de 3 tiempos, incluye degustación.', precio: 250, porPersona: true },
          { nombre: 'Decoración Temática', descripcion: 'Arreglos florales e iluminación arquitectónica.', precio: 3000 },
          { nombre: 'Bartender Profesional', descripcion: 'Servicio por 5 horas (no incluye destilados).', precio: 1200 }
        ],
        slots: ['10:00 - 14:00', '16:00 - 20:00', '21:00 - 01:00'],
        rating: 4.8,
        reviewsCount: 120,
        aprobacion: 'manual',
        estado: 'publicado',
        politicas: {
          cancelacion: 'Estricta',
          retencionPct: 50,
          ventanaSinPenalizacion: 30,
          deposito: 2000,
          descripcion: 'Reembolso parcial (50% retención) hasta 30 días antes del evento.'
        }
      },
      {
        id: 'demo-salon-2',
        categoria: 'salones',
        titulo: 'Espacio Industrial Miraluz',
        descripcion: 'Loft moderno para eventos corporativos y presentaciones. Internet de alta velocidad, pista de baile y capacidad para 200 invitados.',
        ubicacion: 'Narvarte, CDMX',
        capacidad: 200,
        precioBase: 12500,
        modeloPrecio: 'bloque',
        horaExtra: 2000,
        fotos: fotos(5),
        amenities: ['Internet de alta velocidad', 'Sonido incluido', 'Estacionamiento', 'Pantalla LED'],
        extras: [
          { nombre: 'Sonido incluido', descripcion: 'Equipo básico de sonido', precio: 0 }
        ],
        slots: ['08:00 - 12:00', '14:00 - 18:00', '19:00 - 23:00'],
        rating: 4.6,
        reviewsCount: 84,
        aprobacion: 'manual',
        estado: 'publicado',
        politicas: {
          cancelacion: 'Moderada',
          retencionPct: 30,
          ventanaSinPenalizacion: 15,
          deposito: 3000,
          descripcion: 'Reembolso con 30% de retención hasta 15 días antes.'
        }
      },
      {
        id: 'demo-salon-3',
        categoria: 'salones',
        titulo: 'Jardín Los Encinos',
        descripcion: 'Exclusivo jardín para bodas y galas. Estacionamiento privado, valet parking y área de ceremonia al aire libre.',
        ubicacion: 'San Ángel, CDMX',
        capacidad: 400,
        precioBase: 35000,
        modeloPrecio: 'bloque',
        horaExtra: 3500,
        fotos: fotos(6),
        amenities: ['Jardín privado', 'Valet Parking', 'Coordinador de evento', 'Iluminación exterior'],
        extras: [
          { nombre: 'Jardín privado', descripcion: 'Área exclusiva para ceremonia', precio: 0 },
          { nombre: 'Coordinador de evento', descripcion: 'Acompañamiento durante el bloque', precio: 2500 }
        ],
        slots: ['12:00 - 16:00', '17:00 - 21:00', '22:00 - 02:00'],
        rating: 4.9,
        reviewsCount: 156,
        aprobacion: 'manual',
        estado: 'publicado',
        politicas: {
          cancelacion: 'Estricta',
          retencionPct: 50,
          ventanaSinPenalizacion: 45,
          deposito: 7000,
          descripcion: 'Reembolso parcial (50% retención) hasta 45 días antes.'
        }
      },
      {
        id: 'demo-sonido-1',
        categoria: 'sonido',
        titulo: 'Sonido Profesional FullSound',
        descripcion: 'Equipo de sonido amplificado con operador incluido. Paquetes para bodas, XV años y eventos corporativos.',
        ubicacion: 'Roma Norte, CDMX',
        capacidad: 2,
        precioBase: 5000,
        modeloPrecio: 'paquete',
        paquete: 'Básico',
        fotos: fotos(5),
        amenities: ['Operador incluido', 'Microfonía inalámbrica', 'Consola digital'],
        extras: [
          { nombre: 'Luz ambiental LED', descripcion: 'Set de iluminación básico', precio: 1200 }
        ],
        slots: ['09:00 - 13:00', '15:00 - 19:00', '20:00 - 00:00'],
        rating: 4.4,
        reviewsCount: 62,
        aprobacion: 'inmediata',
        estado: 'publicado',
        politicas: {
          cancelacion: 'Flexible',
          retencionPct: 10,
          ventanaSinPenalizacion: 7,
          deposito: 1000,
          descripcion: 'Reembolso con 10% de retención hasta 7 días antes.'
        }
      },
      {
        id: 'demo-sonido-2',
        categoria: 'sonido',
        titulo: 'Sonido Élite Rentas',
        descripcion: 'Sonido de alta potencia para conciertos y eventos masivos. Incluye técnico de sonido y equipo de respaldo.',
        ubicacion: 'Guadalupe Inn, CDMX',
        capacidad: 2,
        precioBase: 8500,
        modeloPrecio: 'paquete',
        paquete: 'Premium',
        fotos: fotos(5),
        amenities: ['Técnico incluido', 'Línea de array', 'Subwoofers activos'],
        extras: [],
        slots: ['10:00 - 14:00', '16:00 - 20:00', '21:00 - 01:00'],
        rating: 4.7,
        reviewsCount: 45,
        aprobacion: 'inmediata',
        estado: 'pendiente',
        politicas: {
          cancelacion: 'Moderada',
          retencionPct: 25,
          ventanaSinPenalizacion: 10,
          deposito: 2000,
          descripcion: 'Reembolso con 25% de retención hasta 10 días antes.'
        }
      },
      {
        id: 'demo-servicio-1',
        categoria: 'servicios-persona',
        titulo: 'Animador Profesional',
        descripcion: 'Animación profesional para bodas, XV años y eventos infantiles. Carisma y experiencia para mantener el evento vivo.',
        ubicacion: 'Centro, CDMX',
        capacidad: 1,
        precioBase: 250,
        modeloPrecio: 'hora',
        porPersona: true,
        fotos: fotos(5),
        amenities: ['Equipo de animación', 'Juegos y dinámicas', 'Micrófono inalámbrico'],
        extras: [
          { nombre: 'Hora adicional', descripcion: 'Extensión de cobertura', precio: 250 }
        ],
        slots: ['09:00 - 13:00', '15:00 - 19:00', '20:00 - 00:00'],
        rating: 4.7,
        reviewsCount: 38,
        aprobacion: 'inmediata',
        estado: 'publicado',
        politicas: {
          cancelacion: 'Flexible',
          retencionPct: 10,
          ventanaSinPenalizacion: 5,
          deposito: 0,
          descripcion: 'Reembolso con 10% de retención hasta 5 días antes.'
        }
      },
      {
        id: 'demo-servicio-2',
        categoria: 'servicios-persona',
        titulo: 'Fotógrafo de Eventos',
        descripcion: 'Cobertura fotográfica completa para bodas y XV años. Entrega de galería digital en 7 días.',
        ubicacion: 'Polanco, CDMX',
        capacidad: 1,
        precioBase: 4500,
        modeloPrecio: 'paquete',
        paquete: 'Cobertura 6h',
        fotos: fotos(5),
        amenities: ['Sesión previa', 'Galería digital', 'Dron opcional'],
        extras: [],
        slots: ['10:00 - 16:00', '15:00 - 21:00'],
        rating: 4.9,
        reviewsCount: 29,
        aprobacion: 'inmediata',
        estado: 'publicado',
        politicas: {
          cancelacion: 'Flexible',
          retencionPct: 15,
          ventanaSinPenalizacion: 7,
          deposito: 500,
          descripcion: 'Reembolso con 15% de retención hasta 7 días antes.'
        }
      }
    ];
  }

  /* ---------- Reservas: 4 estados para las 4 tabs (fechas 2026) ---------- */
  function demoReservations() {
    return [
      {
        id: 'demo-res-1',
        serviceId: 'demo-salon-1',
        userId: 'demo-usuario',
        fecha: '2026-12-15',
        horario: '18:00 - 22:00',
        estado: 'confirmada',
        pago: 'completo',
        alcohol: false,
        contratoAceptado: true,
        total: 12450,
        renta: 10000,
        impuestos: 1600,
        extras: 850,
        reviewDada: false
      },
      {
        id: 'demo-res-2',
        serviceId: 'demo-sonido-1',
        userId: 'demo-usuario',
        fecha: '2026-11-20',
        horario: '16:00 - 20:00',
        estado: 'en_curso',
        pago: 'completo',
        alcohol: false,
        contratoAceptado: false,
        total: 5800,
        renta: 5000,
        impuestos: 800,
        extras: 0,
        reviewDada: false
      },
      {
        id: 'demo-res-3',
        serviceId: 'demo-salon-2',
        userId: 'demo-usuario',
        fecha: '2026-08-10',
        horario: '14:00 - 20:00',
        estado: 'completada',
        pago: 'completo',
        alcohol: true,
        contratoAceptado: true,
        total: 15200,
        renta: 12500,
        impuestos: 2000,
        extras: 700,
        reviewDada: false
      },
      {
        id: 'demo-res-4',
        serviceId: 'demo-servicio-1',
        userId: 'demo-usuario',
        fecha: '2026-07-02',
        horario: '18:00 - 22:00',
        estado: 'cancelada',
        pago: 'pendiente',
        alcohol: false,
        contratoAceptado: false,
        total: 1500,
        renta: 1000,
        impuestos: 160,
        extras: 340,
        reembolso: 'Parcial (50% retención por cancelación a 10 días)',
        reviewDada: false
      },
      {
        id: 'demo-res-5',
        serviceId: 'demo-salon-3',
        userId: 'demo-usuario',
        fecha: '2026-10-05',
        horario: '17:00 - 21:00',
        estado: 'completada',
        pago: 'completo',
        alcohol: true,
        contratoAceptado: true,
        total: 38900,
        renta: 35000,
        impuestos: 5600,
        extras: -1700,
        reviewDada: true
      }
    ];
  }

  /* ---------- Reviews ---------- */
  function demoReviews() {
    return [
      { id: 'demo-rev-1', serviceId: 'demo-salon-1', userId: 'demo-usuario', rating: 5, comentario: 'Excelente espacio, el servicio superó las expectativas.', fecha: '2026-11-20' },
      { id: 'demo-rev-2', serviceId: 'demo-sonido-1', userId: 'demo-usuario', rating: 4, comentario: 'Buen equipo de sonido, puntuales en la instalación.', fecha: '2026-11-25' },
      { id: 'demo-rev-3', serviceId: 'demo-salon-1', userId: 'reg-2', rating: 5, comentario: 'El salón quedó perfecto para nuestra boda. El equipo muy atento.', fecha: '2026-10-12' },
      { id: 'demo-rev-4', serviceId: 'demo-salon-1', userId: 'reg-3', rating: 4, comentario: 'Muy buen lugar, solo mejorar la iluminación del estacionamiento.', fecha: '2026-09-30' },
      { id: 'demo-rev-5', serviceId: 'demo-salon-3', userId: 'demo-usuario', rating: 5, comentario: 'El jardín es espectacular, la ceremonia quedó de ensueño.', fecha: '2026-10-20' },
      { id: 'demo-rev-6', serviceId: 'demo-servicio-1', userId: 'reg-4', rating: 5, comentario: 'El animador mantuvo a todos los invitados bailando toda la noche.', fecha: '2026-11-05' }
    ];
  }

  /* ---------- Favoritos (persistente) ---------- */
  function demoFavorites() {
    return [{ userId: 'demo-usuario', serviceIds: ['demo-salon-1'] }];
  }

  /* ---------- Notificaciones: críticas, recordatorios H-48/H-2 ---------- */
  function demoNotifications() {
    return [
      { id: 'demo-not-1', userId: 'demo-usuario', tipo: 'contrato', criticidad: 'alta', canales: ['in-app', 'email'], leida: false, fecha: '2026-08-14T10:00:00', titulo: 'Contrato pendiente de firma', mensaje: 'Tu reserva en Salón Las Palmas requiere firma de contrato antes del evento.' },
      { id: 'demo-not-2', userId: 'demo-usuario', tipo: 'pago', criticidad: 'alta', canales: ['in-app', 'push'], leida: false, fecha: '2026-08-14T09:30:00', titulo: 'Confirmación de pago recibida', mensaje: 'Tu anticipo de $2,000 fue recibido para la reserva del 15 de diciembre.' },
      { id: 'demo-not-3', userId: 'demo-usuario', tipo: 'cancelacion', criticidad: 'alta', canales: ['in-app', 'email'], leida: false, fecha: '2026-08-13T18:00:00', titulo: 'Recordatorio de política de cancelación', mensaje: 'Revisa la política de cancelación de tu próxima reserva (ventana sin penalización vence pronto).' },
      { id: 'demo-not-4', userId: 'demo-usuario', tipo: 'recordatorio', criticidad: 'media', canales: ['in-app'], leida: true, fecha: '2026-08-12T12:00:00', titulo: 'Falta poco para tu evento', mensaje: 'Tu evento del 15 de diciembre está a 48 horas. Revisa los detalles (H-48).', recordatorio: 'h48' },
      { id: 'demo-not-5', userId: 'demo-usuario', tipo: 'recordatorio', criticidad: 'media', canales: ['in-app', 'push'], leida: true, fecha: '2026-08-11T16:00:00', titulo: 'Último aviso: 2 horas para tu evento', mensaje: 'Tu proveedor está confirmado. Llega con 30 minutos de anticipación (H-2).', recordatorio: 'h2' },
      { id: 'demo-not-6', userId: 'demo-usuario', tipo: 'mensaje', criticidad: 'baja', canales: ['in-app'], leida: true, fecha: '2026-08-10T11:00:00', titulo: 'Nuevo mensaje del proveedor', mensaje: 'Salón Las Palmas te envió un mensaje en el chat.' },
      { id: 'demo-not-7', userId: 'demo-usuario', tipo: 'reseña', criticidad: 'baja', canales: ['in-app'], leida: true, fecha: '2026-08-09T15:00:00', titulo: 'Tu reseña fue publicada', mensaje: 'Gracias por compartir tu experiencia con Sonido Profesional FullSound.' }
    ];
  }

  /* ---------- Conversaciones y mensajes (cliente ↔ proveedor) ---------- */
  function demoConversations() {
    return [
      {
        id: 'demo-conv-1',
        participantes: ['demo-usuario', 'demo-proveedor'],
        clienteId: 'demo-usuario',
        proveedorId: 'demo-proveedor',
        servicioId: 'demo-salon-1',
        titulo: 'Salón Las Palmas',
        ultimoMensaje: 'Te confirmo la disponibilidad para el sábado.',
        noLeidos: 2
      },
      {
        id: 'demo-conv-2',
        participantes: ['demo-usuario', 'demo-proveedor'],
        clienteId: 'demo-usuario',
        proveedorId: 'demo-proveedor',
        servicioId: 'demo-sonido-1',
        titulo: 'Sonido Profesional FullSound',
        ultimoMensaje: '¿Incluye operador el paquete básico?',
        noLeidos: 0
      }
    ];
  }

  function demoMessages() {
    return [
      { id: 'demo-msg-1', convId: 'demo-conv-1', de: 'proveedor', texto: 'Hola Alejandro, gracias por contactar a Salón Las Palmas.', leido: true, leidoEn: '2026-08-14T09:00:00' },
      { id: 'demo-msg-2', convId: 'demo-conv-1', de: 'usuario', texto: 'Quisiera cotizar el salón para una boda de 120 invitados.', leido: true, leidoEn: '2026-08-14T09:05:00' },
      { id: 'demo-msg-3', convId: 'demo-conv-1', de: 'proveedor', texto: 'Claro, con gusto te comparto el paquete Platino y la disponibilidad.', leido: true, leidoEn: '2026-08-14T09:10:00' },
      { id: 'demo-msg-4', convId: 'demo-conv-1', de: 'usuario', texto: '¿Incluye mobiliario y pista de baile?', leido: true, leidoEn: '2026-08-14T09:15:00' },
      { id: 'demo-msg-5', convId: 'demo-conv-1', de: 'proveedor', texto: 'Sí, ambos servicios están incluidos en el paquete.', leido: false, leidoEn: null },
      { id: 'demo-msg-6', convId: 'demo-conv-1', de: 'usuario', texto: 'Perfecto, ¿para el sábado tendríamos fecha disponible?', leido: false, leidoEn: null },
      { id: 'demo-msg-7', convId: 'demo-conv-2', de: 'proveedor', texto: 'Hola, gracias por tu interés en FullSound.', leido: true, leidoEn: '2026-08-12T10:00:00' },
      { id: 'demo-msg-8', convId: 'demo-conv-2', de: 'usuario', texto: '¿Incluye operador el paquete básico?', leido: true, leidoEn: '2026-08-12T10:05:00' },
      { id: 'demo-msg-9', convId: 'demo-conv-2', de: 'proveedor', texto: 'Sí, el operador está incluido en todos los paquetes.', leido: false, leidoEn: null }
    ];
  }

  /* ---------- Anuncios del proveedor (listings) ---------- */
  function demoListings() {
    return [
      {
        id: 'demo-list-1',
        providerId: 'demo-proveedor',
        titulo: 'Salón Las Palmas — Fines de semana de Octubre',
        categoria: 'salones',
        descripcion: 'Salón para bodas y eventos, hasta 300 invitados.',
        fotos: fotos(5),
        reglas: ['No se permite confeti', 'Hora límite 01:00', 'Decoración con proveedor aprobado'],
        precios: { base: 8000, modelo: 'bloque', dinamicos: [] },
        politicas: { cancelacion: 'Estricta', retencionPct: 50, ventanaSinPenalizacion: 30, deposito: 2000 },
        aprobacion: 'manual',
        estado: 'publicado',
        kycRequerido: true,
        fecha: '12 ago 2026'
      },
      {
        id: 'demo-list-2',
        providerId: 'demo-proveedor',
        titulo: 'Sonido Profesional para Bodas',
        categoria: 'sonido',
        descripcion: 'Equipo de sonido amplificado con operador incluido.',
        fotos: fotos(5),
        reglas: ['Operador incluido', 'Música hasta las 02:00'],
        precios: { base: 5000, modelo: 'paquete', dinamicos: [] },
        politicas: { cancelacion: 'Flexible', retencionPct: 10, ventanaSinPenalizacion: 7, deposito: 1000 },
        aprobacion: 'inmediata',
        estado: 'publicado',
        kycRequerido: true,
        fecha: '10 ago 2026'
      },
      {
        id: 'demo-list-3',
        providerId: 'demo-proveedor',
        titulo: 'Servicio de Fotografía y Video',
        categoria: 'servicios-persona',
        descripcion: 'Cobertura completa para bodas y XV años.',
        fotos: fotos(5),
        reglas: ['Entrega de galería en 7 días', 'Dron disponible'],
        precios: { base: 4500, modelo: 'paquete', dinamicos: [] },
        politicas: { cancelacion: 'Flexible', retencionPct: 15, ventanaSinPenalizacion: 7, deposito: 500 },
        aprobacion: 'inmediata',
        estado: 'pendiente',
        kycRequerido: true,
        fecha: '02 ago 2026'
      }
    ];
  }

  /* ---------- Inventario por slot (capacidad por tipo) ---------- */
  function demoInventorySlots() {
    return [
      { id: 'inv-1', listingId: 'demo-list-1', fecha: '2026-08-20', horario: '16:00 - 20:00', capacidad: 1, ocupados: 0, estadoSlot: 'disponible' },
      { id: 'inv-2', listingId: 'demo-list-1', fecha: '2026-08-20', horario: '21:00 - 01:00', capacidad: 1, ocupados: 1, estadoSlot: 'lleno' },
      { id: 'inv-3', listingId: 'demo-list-2', fecha: '2026-08-20', horario: '16:00 - 20:00', capacidad: 2, ocupados: 1, estadoSlot: 'parcial' },
      { id: 'inv-4', listingId: 'demo-list-2', fecha: '2026-08-21', horario: '16:00 - 20:00', capacidad: 2, ocupados: 0, estadoSlot: 'disponible' },
      { id: 'inv-5', listingId: 'demo-list-3', fecha: '2026-08-22', horario: '10:00 - 16:00', capacidad: 1, ocupados: 0, estadoSlot: 'disponible' }
    ];
  }

  /* ---------- Fechas bloqueadas ---------- */
  function demoBlockedDates() {
    return [
      { id: 'bd-1', listingId: 'demo-list-1', fecha: '2026-08-25', motivo: 'mantenimiento' },
      { id: 'bd-2', listingId: 'demo-list-2', fecha: '2026-08-27', motivo: 'inoperacion' },
      { id: 'bd-3', listingId: 'demo-list-1', fecha: '2026-09-03', motivo: 'privado' }
    ];
  }

  /* ---------- Precios dinámicos ---------- */
  function demoDynamicPricing() {
    return [
      { id: 'dp-1', listingId: 'demo-list-1', tipo: 'temporada', nombre: 'Temporada alta', ajustePct: 20, periodos: ['2026-11-01', '2026-12-31'], aplicaDias: [5, 6] }
    ];
  }

  /* ---------- Reporte mensual (SIN CFDI) ---------- */
  function demoMonthlyReport() {
    return {
      mes: 'Agosto 2026',
      transacciones: 12,
      bruto: 118500,
      impuestos: 18960,
      comision: 17775,
      neto: 81765
    };
  }

  /* ---------- Comisión global ---------- */
  function demoCommissionSettings() {
    return {
      tasa: 15,
      historial: [
        { fecha: '01 ene 2026', tasa: 10 },
        { fecha: '01 mar 2026', tasa: 12 },
        { fecha: '01 jul 2026', tasa: 15 }
      ]
    };
  }

  /* ---------- Proveedores bloqueados ---------- */
  function demoBlockedProviders() {
    return [
      { id: 'b1', providerId: 'demo-proveedor-2', nombre: 'Salón Las Palmas', tipo: 'Salón', motivo: 'Incumplimiento reiterado de horarios y falta de respuesta a los clientes durante tres semanas consecutivas.', fecha: '02 ago 2026', email: 'contacto@salonlaspalmas.com' },
      { id: 'b2', providerId: 'demo-proveedor-3', nombre: 'Sonido Élite Rentas', tipo: 'Sonido', motivo: 'Publicación de precios engañosos y cobros no autorizados reportados por dos clientes.', fecha: '28 jul 2026', email: 'soporte@sonidoelite.com' },
      { id: 'b3', providerId: 'demo-proveedor-4', nombre: 'Animación Festiva MX', tipo: 'Servicio', motivo: 'Incidentes de seguridad reportados por dos clientes durante eventos recientes.', fecha: '15 jul 2026', email: 'hola@animacionfestiva.mx' }
    ];
  }

  /* ---------- Disputas técnicas (sin comerciales) ---------- */
  function demoTechnicalDisputes() {
    return [
      { id: 'd1', tipo: 'tecnica', titulo: 'Cobro duplicado por anticipo', proveedor: 'Salón Las Palmas', cliente: 'Alejandro Mendoza', servicio: 'Salón', estado: 'abierta', fecha: '11 ago 2026', descripcion: 'El cliente reporta un doble cobro del anticipo de la reserva; el proveedor no ha respondido a la solicitud de aclaración.' },
      { id: 'd2', tipo: 'tecnica', titulo: 'Equipo de sonido no instalado', proveedor: 'Sonido Profesional FullSound', cliente: 'María Fernández', servicio: 'Sonido', estado: 'en_revision', fecha: '08 ago 2026', descripcion: 'El equipo contratado no llegó al evento; se requiere verificar la política de reembolso y los términos del contrato.' },
      { id: 'd3', tipo: 'tecnica', titulo: 'Discrepancia en fecha del evento', proveedor: 'Jardín Los Encinos', cliente: 'Carlos Ramírez', servicio: 'Salón', estado: 'resuelta', fecha: '02 ago 2026', descripcion: 'Hubo una confusión sobre la fecha reservada; se resolvió con una reprogramación sin costo adicional para el cliente.' }
    ];
  }

  /* ---------- Cola de moderación (workflow persistente) ---------- */
  function demoModerationQueue() {
    return [
      {
        id: 'mod-1',
        listingId: 'demo-list-1',
        titulo: 'Espacio Industrial Miraluz',
        categoria: 'salones',
        estado: 'pendiente',
        motivo: 'Alta de servicio en revisión desde hace 2 días.',
        historial: [
          { fecha: '2026-08-13', decision: 'enviada', motivo: 'Alta de servicio registrada por el proveedor.', adminId: null }
        ]
      },
      {
        id: 'mod-2',
        listingId: 'demo-list-2',
        titulo: 'Jardín Los Encinos',
        categoria: 'salones',
        estado: 'pendiente',
        motivo: 'Alta de servicio en revisión desde ayer.',
        historial: [
          { fecha: '2026-08-14', decision: 'enviada', motivo: 'Alta de servicio registrada por el proveedor.', adminId: null }
        ]
      },
      {
        id: 'mod-3',
        listingId: 'demo-list-3',
        titulo: 'Sonido Élite Rentas',
        categoria: 'sonido',
        estado: 'pendiente',
        motivo: 'Alta de servicio en revisión desde hoy.',
        historial: [
          { fecha: '2026-08-15', decision: 'enviada', motivo: 'Alta de servicio registrada por el proveedor.', adminId: null }
        ]
      }
    ];
  }

  /* ---------- Seed versionado e idempotente ---------- */
  function seed(preservados) {
    var extra = (preservados || []).filter(function (u) {
      return u && typeof u.id === 'string' && u.id.indexOf('demo-') !== 0;
    });

    saveArray(KEY_USERS, demoUsers().concat(extra));
    saveArray(KEY_SERVICES, demoServices());
    saveArray(KEY_RESERVATIONS, demoReservations());
    saveArray(KEY_REVIEWS, demoReviews());
    saveArray(KEY_FAVORITES, demoFavorites());
    saveArray(KEY_NOTIFICATIONS, demoNotifications());
    saveArray(KEY_CONVERSATIONS, demoConversations());
    saveArray(KEY_MESSAGES, demoMessages());
    saveArray(KEY_LISTINGS, demoListings());
    saveArray(KEY_INVENTORY, demoInventorySlots());
    saveArray(KEY_BLOCKED_DATES, demoBlockedDates());
    saveArray(KEY_PRICING, demoDynamicPricing());
    saveArray(KEY_BLOCKED_PROVIDERS, demoBlockedProviders());
    saveArray(KEY_DISPUTES, demoTechnicalDisputes());
    saveArray(KEY_MODERATION, demoModerationQueue());

    saveObject(KEY_DRAFT_RESERVATION, { paso: 1, fechaHora: null, extras: [], datosPago: null, alcoholAceptado: false, tcAceptado: false });
    saveObject(KEY_WIZARD, { paso: 1, datos: { tipo: null, ubicacion: '', capacidad: '', fotos: [], titulo: '', descripcion: '', tarifas: {}, politicas: {} } });
    saveObject(KEY_MONTHLY_REPORT, demoMonthlyReport());
    saveObject(KEY_COMMISSION, demoCommissionSettings());
    saveObject(KEY_UI_STATE, { filtrosBusqueda: [], notifAbierto: false });

    // Sesión vacía presente desde el primer load (invariante).
    writeRaw(KEY_SESSION, '');
    writeRaw(KEY_SEED_VERSION, String(SEED_VERSION));
  }

  /* ---------- CRUD genérico por entidad (colecciones) ---------- */
  function get(entity, id) {
    var key = ENTITY_KEYS[entity];
    if (!key) return null;
    var items = readArray(key);
    if (id === undefined) return items;
    return findById(items, id);
  }

  function set(entity, obj) {
    var key = ENTITY_KEYS[entity];
    if (!key || !obj) return null;
    var items = readArray(key);
    var replaced = false;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(obj.id)) {
        items[i] = obj;
        replaced = true;
        break;
      }
    }
    if (!replaced) items.push(obj);
    saveArray(key, items);
    return obj;
  }

  function update(entity, id, patch) {
    var key = ENTITY_KEYS[entity];
    if (!key || !patch) return null;
    var items = readArray(key);
    var item = findById(items, id);
    if (!item) return null;
    for (var prop in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, prop)) {
        item[prop] = patch[prop];
      }
    }
    saveArray(key, items);
    // Sincroniza la sesión si se actualizó el usuario autenticado:
    // badge de verificación (MU-018/MP-015), consentimiento de privacidad
    // y cookies (MU-017) deben reflejarse en session.user sin re-login.
    if (entity === 'users') {
      var sesion = readObject(KEY_SESSION, null);
      if (sesion && sesion.user && String(sesion.user.id) === String(id)) {
        sesion.user = item;
        saveObject(KEY_SESSION, sesion);
      }
    }
    return item;
  }

  function remove(entity, id) {
    var key = ENTITY_KEYS[entity];
    if (!key) return null;
    var items = readArray(key);
    var next = [];
    var removed = null;
    for (var i = 0; i < items.length; i++) {
      if (String(items[i].id) === String(id)) {
        removed = items[i];
      } else {
        next.push(items[i]);
      }
    }
    if (removed) saveArray(key, next);
    return removed;
  }

  /* ---------- Estado (objetos únicos) ---------- */
  function getState(name) {
    var key = STATE_KEYS[name];
    if (!key) return null;
    return readObject(key);
  }

  function setState(name, obj) {
    var key = STATE_KEYS[name];
    if (!key) return null;
    saveObject(key, obj);
    return obj;
  }

  /* ---------- Sesión con token falso ---------- */
  function emitirToken(user) {
    var ts = Date.now();
    var exp = ts + 2 * 60 * 60 * 1000; // 2 horas
    var token = 'demo-jwt.' + (user.rol || 'usuario') + '.' + ts;
    return { token: token, exp: exp };
  }

  function setSession(user) {
    if (!user) return;
    var t = emitirToken(user);
    saveObject(KEY_SESSION, { user: user, token: t.token, exp: t.exp });
  }

  function clearSession() {
    writeRaw(KEY_SESSION, '');
  }

  function getSession() {
    var s = readObject(KEY_SESSION, null);
    if (!s || !s.user) return null;
    return s;
  }

  function getCurrentUser() {
    var s = getSession();
    return s && s.user ? s.user : null;
  }

  /* ---------- Auth ---------- */
  function nextRegId(users) {
    var max = 0;
    for (var i = 0; i < users.length; i++) {
      var match = /^reg-(\d+)$/.exec(users[i].id || '');
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
    return 'reg-' + (max + 1);
  }

  function register(user) {
    var nombre = String((user && user.nombre) || '').trim();
    var email = String((user && user.email) || '').trim().toLowerCase();
    var password = user && user.password;

    if (!nombre || !email || !password) {
      return { ok: false, error: 'Completa todos los campos.' };
    }

    var users = readArray(KEY_USERS);
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).toLowerCase() === email) {
        return { ok: false, error: 'El email ya está registrado.' };
      }
    }

    var nuevo = {
      id: nextRegId(users),
      nombre: nombre,
      email: email,
      password: password,
      rol: user.rol === 'proveedor' || user.rol === 'admin' ? user.rol : 'usuario',
      verificado: false,
      kycStatus: 'none',
      badges: []
    };
    users.push(nuevo);
    saveArray(KEY_USERS, users);
    setSession(nuevo);
    return { ok: true, user: nuevo, session: getSession() };
  }

  function login(email, password) {
    var e = String(email || '').trim().toLowerCase();
    var users = readArray(KEY_USERS);
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).toLowerCase() === e && users[i].password === password) {
        setSession(users[i]);
        return { ok: true, user: users[i], session: getSession() };
      }
    }
    return { ok: false, error: 'Credenciales incorrectas' };
  }

  function logout() {
    clearSession();
  }

  /* ---------- Favoritos ---------- */
  function getFavorites(userId) {
    var userIdActual = userId || (getCurrentUser() || {}).id || 'demo-usuario';
    var favs = readArray(KEY_FAVORITES);
    var row = null;
    favs.forEach(function (f) { if (f.userId === userIdActual) row = f; });
    return row ? row.serviceIds : [];
  }

  function toggleFavorite(serviceId, userId) {
    var userIdActual = userId || (getCurrentUser() || {}).id || 'demo-usuario';
    var favs = readArray(KEY_FAVORITES);
    var row = null;
    favs.forEach(function (f) { if (f.userId === userIdActual) row = f; });
    if (!row) {
      row = { userId: userIdActual, serviceIds: [] };
      favs.push(row);
    }
    var idx = row.serviceIds.indexOf(serviceId);
    if (idx === -1) {
      row.serviceIds.push(serviceId);
    } else {
      row.serviceIds.splice(idx, 1);
    }
    saveArray(KEY_FAVORITES, favs);
    return row.serviceIds.indexOf(serviceId) !== -1;
  }

  /* ---------- Reset ---------- */
  function resetDemo() {
    Object.keys(ENTITY_KEYS).forEach(function (k) { removeRaw(ENTITY_KEYS[k]); });
    Object.keys(STATE_KEYS).forEach(function (k) { removeRaw(STATE_KEYS[k]); });
    removeRaw(KEY_SEED_VERSION);
    seed();
  }

  /* ---------- Init: seed idempotente ---------- */
  function init() {
    var version = readRaw(KEY_SEED_VERSION);
    if (version !== String(SEED_VERSION)) {
      var existentes = readArray(KEY_USERS);
      var preservados = existentes.filter(function (u) {
        return u && typeof u.id === 'string' && u.id.indexOf('demo-') !== 0;
      });
      seed(preservados);
    }
  }

  init();

  /* ---------- API pública ---------- */
  window.FEStore = {
    SEED_VERSION: SEED_VERSION,
    getUsers: function () { return get('users'); },
    getServices: function () { return get('services'); },
    getReservations: function () { return get('reservations'); },
    getReviews: function () { return get('reviews'); },
    get: get,
    set: set,
    update: update,
    remove: remove,
    getState: getState,
    setState: setState,
    register: register,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    emitirToken: emitirToken,
    getFavorites: getFavorites,
    toggleFavorite: toggleFavorite,
    seed: seed,
    resetDemo: resetDemo,
    persistent: persistent
  };
})();
