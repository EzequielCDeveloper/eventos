/* ============================================
   FiestaExpert — Almacén Compartido (FEStore)
   Datos demo + persistencia localStorage + sesión.
   Consumible por las tres secciones (usuario/,
   proveedor/, admin/) sin backend.
   Cargar ANTES de shared/auth.js y de cada app.js.
   Sin dependencias; funciona sobre file://.
   ============================================ */
(function () {
  'use strict';

  /* ---------- Constantes ---------- */
  var SEED_VERSION = 1;

  var KEY_USERS = 'fiestakexpert.users';
  var KEY_SERVICES = 'fiestakexpert.services';
  var KEY_RESERVATIONS = 'fiestakexpert.reservations';
  var KEY_REVIEWS = 'fiestakexpert.reviews';
  var KEY_SESSION = 'fiestakexpert.session';
  var KEY_SEED_VERSION = 'fiestakexpert.seedVersion';

  // Entidades soportadas por el CRUD genérico (clave corta -> clave localStorage)
  var ENTITY_KEYS = {
    users: KEY_USERS,
    services: KEY_SERVICES,
    reservations: KEY_RESERVATIONS,
    reviews: KEY_REVIEWS
  };

  /* ---------- Capa de persistencia ----------
     localStorage con fallback en memoria: si el navegador
     bloquea el storage (p. ej. file:// en modo estricto),
     el store opera en memoria sin errores de consola y
     expone persistent = false. */
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

  /* ---------- Lectura/escritura de entidades ---------- */
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

  function findById(items, id) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  /* ---------- Datos demo ---------- */

  // Cuenta demo por rol; password demo123 para las tres.
  function demoUsers() {
    return [
      {
        id: 'demo-usuario',
        nombre: 'Alejandro Mendoza',
        email: 'usuario@demo.com',
        password: 'demo123',
        rol: 'usuario',
        verificado: true,
        badges: ['identidad-verificada']
      },
      {
        id: 'demo-proveedor',
        nombre: 'Juan',
        email: 'proveedor@demo.com',
        password: 'demo123',
        rol: 'proveedor',
        verificado: true,
        badges: ['identidad-verificada']
      },
      {
        id: 'demo-admin',
        nombre: 'Administrador Demo',
        email: 'admin@demo.com',
        password: 'demo123',
        rol: 'admin',
        verificado: true,
        badges: []
      }
    ];
  }

  // Servicios demo: 3 salones reales del prototipo + 1 sonido (paquete)
  // + 1 servicio-persona (hora) para cubrir la taxonomía completa.
  function demoServices() {
    return [
      {
        id: 'demo-salon-1',
        nombre: 'Salón Las Palmas',
        tipo: 'salon',
        precio: { modelo: 'bloque', base: 8000, horaExtra: 1500 },
        fotos: [],
        extras: [
          { nombre: 'Mantelería premium', descripcion: 'Incluida con el bloque base', precio: 0 },
          { nombre: 'Iluminación ambiental', descripcion: 'Montaje de luces LED', precio: 1800 }
        ],
        rating: 4.8
      },
      {
        id: 'demo-salon-2',
        nombre: 'Espacio Industrial Miraluz',
        tipo: 'salon',
        precio: { modelo: 'bloque', base: 12500, horaExtra: 2000 },
        fotos: [],
        extras: [
          { nombre: 'Sonido incluido', descripcion: 'Equipo básico de sonido', precio: 0 }
        ],
        rating: 4.6
      },
      {
        id: 'demo-salon-3',
        nombre: 'Jardín Los Encinos',
        tipo: 'salon',
        precio: { modelo: 'bloque', base: 35000, horaExtra: 3500 },
        fotos: [],
        extras: [
          { nombre: 'Jardín privado', descripcion: 'Área exclusiva para ceremonia', precio: 0 },
          { nombre: 'Coordinador de evento', descripcion: 'Acompañamiento durante el bloque', precio: 2500 }
        ],
        rating: 4.9
      },
      {
        id: 'demo-sonido-1',
        nombre: 'Sonido Profesional FullSound',
        tipo: 'sonido',
        precio: { modelo: 'paquete', paquete: 'Básico', base: 5000 },
        fotos: [],
        extras: [],
        rating: 4.4
      },
      {
        id: 'demo-servicio-1',
        nombre: 'Animador Profesional',
        tipo: 'servicio',
        precio: { modelo: 'hora', base: 250, porPersona: true },
        fotos: [],
        extras: [],
        rating: 4.7
      }
    ];
  }

  // Reservación demo coherente con la pantalla Rentas del prototipo.
  function demoReservations() {
    return [
      {
        id: 'demo-res-1',
        serviceId: 'demo-salon-1',
        userId: 'demo-usuario',
        fecha: '2026-12-15',
        horario: '18:00 - 22:00',
        estado: 'confirmada',
        total: 12450
      }
    ];
  }

  function demoReviews() {
    return [
      {
        id: 'demo-rev-1',
        serviceId: 'demo-salon-1',
        userId: 'demo-usuario',
        rating: 5,
        comentario: 'Excelente espacio, el servicio superó las expectativas.',
        fecha: '2026-11-20'
      },
      {
        id: 'demo-rev-2',
        serviceId: 'demo-sonido-1',
        userId: 'demo-usuario',
        rating: 4,
        comentario: 'Buen equipo de sonido, puntuales en la instalación.',
        fecha: '2026-11-25'
      }
    ];
  }

  /* ---------- Seed versionado e idempotente ---------- */
  function seed(preservados) {
    // Parámetro interno: al re-sembrar se conservan los usuarios registrados
    // (id sin prefijo demo-); el seed público (seed()) siembra el demo puro.
    var extra = (preservados || []).filter(function (u) {
      return u && typeof u.id === 'string' && u.id.indexOf('demo-') !== 0;
    });
    saveArray(KEY_USERS, demoUsers().concat(extra));
    saveArray(KEY_SERVICES, demoServices());
    saveArray(KEY_RESERVATIONS, demoReservations());
    saveArray(KEY_REVIEWS, demoReviews());
    // Sesión presente desde el primer load (vacía): invariante del spec
    // (6 claves fiestakexpert.* visibles en devtools).
    writeRaw(KEY_SESSION, '');
    writeRaw(KEY_SEED_VERSION, String(SEED_VERSION));
  }

  /* ---------- CRUD genérico por entidad ----------
     entity: 'users' | 'services' | 'reservations' | 'reviews'
     get(entity, id): lista completa si id es undefined, si no el ítem.
     set(entity, obj): inserta o reemplaza por id.
     update(entity, id, patch): fusiona el parche y persiste.
     remove(entity, id): elimina y devuelve el ítem eliminado. */
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
      if (items[i].id === obj.id) {
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
    return item;
  }

  function remove(entity, id) {
    var key = ENTITY_KEYS[entity];
    if (!key) return null;
    var items = readArray(key);
    var next = [];
    var removed = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        removed = items[i];
      } else {
        next.push(items[i]);
      }
    }
    if (removed) saveArray(key, next);
    return removed;
  }

  /* ---------- Sesión ---------- */
  function setSession(user) {
    if (!user) return;
    writeRaw(KEY_SESSION, JSON.stringify(user));
  }

  // La clave queda vacía (no ausente): invariante del spec.
  function clearSession() {
    writeRaw(KEY_SESSION, '');
  }

  function getCurrentUser() {
    var raw = readRaw(KEY_SESSION);
    if (!raw) return null;
    try {
      var user = JSON.parse(raw);
      return user && user.id ? user : null;
    } catch (e) {
      return null;
    }
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

  // register: email único, id interno no-demo, inicia sesión.
  // Devuelve { ok, user } o { ok: false, error }.
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
      badges: []
    };
    users.push(nuevo);
    saveArray(KEY_USERS, users);
    setSession(nuevo);
    return { ok: true, user: nuevo };
  }

  // login: valida contra el array; error exacto del spec si no coincide.
  function login(email, password) {
    var e = String(email || '').trim().toLowerCase();
    var users = readArray(KEY_USERS);
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].email).toLowerCase() === e && users[i].password === password) {
        setSession(users[i]);
        return { ok: true, user: users[i] };
      }
    }
    return { ok: false, error: 'Credenciales incorrectas' };
  }

  function logout() {
    clearSession();
  }

  /* ---------- Reset ---------- */
  // Restablece el demo completo (borra también usuarios registrados).
  function resetDemo() {
    removeRaw(KEY_USERS);
    removeRaw(KEY_SERVICES);
    removeRaw(KEY_RESERVATIONS);
    removeRaw(KEY_REVIEWS);
    removeRaw(KEY_SESSION);
    removeRaw(KEY_SEED_VERSION);
    seed();
  }

  /* ---------- Init: seed idempotente ---------- */
  // Si la versión del seed no coincide con SEED_VERSION se re-siembra
  // PRESERVANDO los usuarios registrados (id sin prefijo demo-).
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
    getUsers: function () { return get('users'); },
    getServices: function () { return get('services'); },
    getReservations: function () { return get('reservations'); },
    getReviews: function () { return get('reviews'); },
    get: get,
    set: set,
    update: update,
    remove: remove,
    register: register,
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    setSession: setSession,
    clearSession: clearSession,
    seed: seed,
    resetDemo: resetDemo,
    persistent: persistent
  };
})();