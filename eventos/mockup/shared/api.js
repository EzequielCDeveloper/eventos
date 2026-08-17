/* ============================================
   FiestaExpert — API simulada (api.js)
   window.FEAPI.request(entity, action, payload)
   Simulador del contrato JWT de lib/api.ts (axios):
   valida token Bearer + rol vs document.body.dataset.role,
   responde envelope { data } | { error: { code, status } }
   y simula 401 / 403 / 5xx / timeout / offline.
   Dependencias: FEStore (shared/store.js) — cargar
   DESPUÉS de store.js y ANTES de auth.js y app.js.
   Sin dependencias externas; funciona sobre file://.
   ============================================ */
(function () {
  'use strict';

  if (!window.FEStore) {
    console.error('FiestaExpert: FEAPI requiere FEStore. Carga shared/store.js primero.');
    return;
  }

  var FE = window.FEStore;

  /* ---------- Estado de simulación de red ---------- */
  // La UI demo puede forzar fallos (offline / 5xx / timeout) para
  // ejercitar los estados compartidos (MS-004).
  var sim = {
    mode: 'online',     // 'online' | 'offline' | 'error'
    latencyMin: 350,
    latencyMax: 750,
    failRate: 0         // 0..1 probabilidad de 5xx cuando mode='online'
  };

  function getBodyRole() {
    var body = document.body;
    return body ? (body.getAttribute('data-role') || 'usuario') : 'usuario';
  }

  function getSession() {
    var u = FE.getCurrentUser();
    var s = FE.getSession ? FE.getSession() : null;
    return s || (u ? { user: u, token: null, exp: null } : null);
  }

  /* ---------- Token falso: apariencia JWT ---------- */
  function tokenExpirado(token, exp) {
    if (!token) return true;
    if (exp && Date.now() > exp) return true;
    return false;
  }

  /* ---------- Respuestas ---------- */
  function ok(data, status) {
    return { data: data, status: status || 200 };
  }

  function err(code, status, message) {
    return { error: { code: code, status: status, message: message } };
  }

  /* ---------- Demora simulada ---------- */
  function delay() {
    var min = sim.latencyMin;
    var max = sim.latencyMax;
    return Math.round(min + Math.random() * (max - min));
  }

  /* ---------- Acciones soportadas por entidad ----------
     El CRUD genérico del FEStore cubre las entidades del
     modelo de datos (D-002). FEAPI expone operaciones
     estándar y un passthrough para lógica de dominio demo. */
  var ENTITY_OPS = {
    create: function (entity, payload) {
      var id = (payload && payload.id) || entity.slice(0, 3) + '-' + Date.now();
      var item = Object.assign({}, payload || {}, { id: id });
      FE.set(entity, item);
      return ok(item, 201);
    },
    read: function (entity, payload) {
      var items = FE.get(entity);
      var id = payload && payload.id;
      if (id !== undefined && id !== null) {
        var found = null;
        items.forEach(function (it) { if (String(it.id) === String(id)) found = it; });
        return ok(found, found ? 200 : 404);
      }
      return ok(items || [], 200);
    },
    update: function (entity, payload) {
      if (!payload || payload.id === undefined) return err('bad_request', 400, 'update requiere id');
      var item = FE.update(entity, payload.id, payload.patch || {});
      if (!item) return err('not_found', 404, entity + ' no encontrado');
      return ok(item, 200);
    },
    remove: function (entity, payload) {
      if (!payload || payload.id === undefined) return err('bad_request', 400, 'remove requiere id');
      var removed = FE.remove(entity, payload.id);
      if (!removed) return err('not_found', 404, entity + ' no encontrado');
      return ok(removed, 200);
    }
  };

  /* ---------- Contrato de request ----------
     payload: { entity, action, payload?, headers? }
     headers.Authorization = 'Bearer <token>' (D-003). */
  function request(entity, action, payload, headers) {
    // 1) Offline simulado (toggle de demo)
    if (sim.mode === 'offline') {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(err('network_error', 0, 'Sin conexión. Revisa tu red e inténtalo de nuevo.'));
        }, 200);
      });
    }

    // 2) Autenticación: token Bearer ausente/expirado → 401
    var session = getSession();
    var token = null;
    var role = null;
    if (headers && headers.Authorization && headers.Authorization.indexOf('Bearer ') === 0) {
      token = headers.Authorization.slice(7);
    }
    if (session && session.token) token = token || session.token;
    if (session && session.user) role = session.user.rol;

    if (!token || tokenExpirado(token, session && session.exp)) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(err('unauthorized', 401, 'Sesión expirada o sin iniciar.'));
        }, 120);
      });
    }

    // 3) Rol: el token fija el rol; debe coincidir con la sección → 403
    var bodyRole = getBodyRole();
    if (!role || role !== bodyRole) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(err('forbidden', 403, 'No tienes permisos para esta sección.'));
        }, 120);
      });
    }

    // 4) Fallo aleatorio (5xx) configurable
    if (sim.mode === 'error' || (sim.mode === 'online' && sim.failRate > 0 && Math.random() < sim.failRate)) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(err('server_error', 500, 'Error del servidor. Inténtalo de nuevo.'));
        }, delay());
      });
    }

    // 5) Ejecución de la operación
    var op = ENTITY_OPS[action];
    return new Promise(function (resolve) {
      setTimeout(function () {
        if (op) {
          resolve(op(entity, payload || {}));
        } else {
          resolve(err('bad_request', 400, 'Acción no soportada: ' + action));
        }
      }, delay());
    });
  }

  /* ---------- Helpers para los app.js ---------- */
  function authHeaders() {
    var session = getSession();
    return { Authorization: 'Bearer ' + ((session && session.token) || '') };
  }

  // Dispara 401 → login: delega en auth.js (window.FEAuth.onUnauthorized)
  function handleUnauthorized(result) {
    if (result && result.error && result.error.status === 401) {
      if (window.FEAuth && typeof window.FEAuth.onUnauthorized === 'function') {
        window.FEAuth.onUnauthorized(result.error);
        return true;
      }
    }
    return false;
  }

  window.FEAPI = {
    request: request,
    authHeaders: authHeaders,
    handleUnauthorized: handleUnauthorized,
    sim: sim
  };
})();
