/* ============================================
   FiestaExpert — Gate de autenticación (auth.js)
   Overlay full-screen inyectado por JS: selección
   de rol, login/registro contra FEStore y control
   de acceso por rol de sección.
   Dependencias: FEStore (shared/store.js) — cargar
   ANTES que este archivo y que cada app.js.
   Sin dependencias externas; funciona sobre file://.
   ============================================ */
(function () {
  'use strict';

  /* ---------- Guard defensivo ---------- */
  if (!window.FEStore) {
    console.error('FiestaExpert: FEStore no disponible. Carga shared/store.js antes de shared/auth.js.');
    return;
  }

  // Alias local: acceso explícito vía window (evita dependencia del scope global).
  var FE = window.FEStore;

  /* ---------- Configuración por rol ---------- */
  var ROLES = {
    usuario: { titulo: 'Cliente', icono: 'person', seccion: 'usuario/index.html' },
    proveedor: { titulo: 'Proveedor', icono: 'storefront', seccion: 'proveedor/index.html' },
    admin: { titulo: 'Administrador', icono: 'admin_panel_settings', seccion: 'admin/index.html' }
  };

  var DEMO_CREDS = {
    usuario: { email: 'usuario@demo.com', password: 'demo123' },
    proveedor: { email: 'proveedor@demo.com', password: 'demo123' },
    admin: { email: 'admin@demo.com', password: 'demo123' }
  };

  /* ---------- Estado interno ---------- */
  var overlay = null;
  var seccionRol = null;      // rol del <body data-role>
  var rolSeleccionado = null; // rol elegido en pantalla 1
  var modo = 'login';         // 'login' | 'registro'
  var mensajeInicial = null;  // aviso opcional al mostrar el gate (p. ej. "Sesión expirada")

  /* ---------- Helpers ---------- */
  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  function mostrarError(mensaje) {
    var el = document.getElementById('fe-auth-error');
    if (el) {
      el.textContent = mensaje;
      el.style.display = 'block';
    }
  }

  function ocultarError() {
    var el = document.getElementById('fe-auth-error');
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  // Inyecta estilos críticos del gate: garantizan que el overlay
  // bloquee la pantalla incluso si el CDN de Tailwind no carga.
  function inyectarEstilosCriticos() {
    var css = [
      '#fe-auth-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:90;background:#f7f9fc;color:#191c1e;overflow-y:auto;font-family:Inter,system-ui,sans-serif;}',
      '#fe-auth-overlay.fe-auth-hidden{display:none;}',
      '#fe-auth-overlay ::placeholder{color:#767683;}',
      '#fe-auth-overlay input{outline:none;}'
    ].join('\n');
    var styleTag = document.createElement('style');
    styleTag.setAttribute('data-fe-auth-critical', '');
    styleTag.textContent = css;
    (document.head || document.documentElement).appendChild(styleTag);
  }

  /* ---------- Construcción del overlay ---------- */
  function construirOverlay() {
    var div = document.createElement('div');
    div.id = 'fe-auth-overlay';
    div.className = 'fe-auth-hidden';

    var html = '';
    html += '<div class="w-full min-h-full flex items-center justify-center p-margin-mobile md:p-margin-desktop">';
    html += '<div class="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg p-xl md:p-xxl">';

    /* Marca FiestaExpert */
    html += '<div class="text-center mb-lg">';
    html += '<h1 class="font-display-lg text-headline-md text-primary tracking-tight">FiestaExpert</h1>';
    html += '<p class="font-body-md text-body-md text-on-surface-variant mt-xs">Inicia sesión para continuar</p>';
    html += '</div>';

    /* Paso 1: selección de rol */
    html += '<div id="fe-auth-paso-rol" class="fe-auth-paso">';
    html += '<h2 class="font-headline-md text-headline-md mb-md">¿Quién eres?</h2>';
    html += '<div class="grid grid-cols-3 gap-md">';
    Object.keys(ROLES).forEach(function (rol) {
      html += '<button type="button" data-auth="select-rol" data-rol="' + rol + '"';
      html += ' class="flex flex-col items-center gap-sm p-md bg-surface-container-lowest rounded-xl border border-outline-variant hover:border-primary transition-colors cursor-pointer">';
      html += '<span class="material-symbols-outlined text-primary" style="font-size:32px;">' + ROLES[rol].icono + '</span>';
      html += '<span class="font-label-md text-label-md text-on-surface">' + ROLES[rol].titulo + '</span>';
      html += '</button>';
    });
    html += '</div>';
    html += '</div>';

    /* Paso 2: login / registro */
    html += '<div id="fe-auth-paso-form" class="fe-auth-paso" style="display:none;">';
    html += '<div id="fe-auth-form-body"></div>';
    html += '<p id="fe-auth-error" class="font-label-md text-label-md text-error mt-sm" style="display:none;"></p>';
    html += '<button type="button" data-auth="submit" id="fe-auth-submit"';
    html += ' class="w-full mt-md bg-primary text-on-primary font-label-md text-label-md px-xl py-3 rounded-full shadow-md hover:bg-primary-container transition-all active:scale-95">Iniciar sesión</button>';
    html += '<button type="button" data-auth="toggle-modo"';
    html += ' class="w-full mt-md text-primary font-label-md text-label-md hover:underline transition-colors">¿No tienes cuenta? Crear una</button>';
    html += '<p class="font-label-sm text-label-sm text-on-surface-variant mt-lg text-center">Demo: <span id="fe-auth-demo-cred"></span></p>';
    html += '</div>';

    /* Paso 3: rol no correspondiente (mismatch) */
    html += '<div id="fe-auth-paso-mismatch" class="fe-auth-paso" style="display:none;">';
    html += '<div class="bg-error-container text-on-error-container rounded-lg p-md mb-lg">';
    html += '<h2 class="font-headline-md text-headline-md mb-xs">Sección incorrecta</h2>';
    html += '<p class="font-body-md text-body-md" id="fe-auth-mismatch-msg"></p>';
    html += '</div>';
    html += '<button type="button" data-auth="ir-seccion"';
    html += ' class="w-full bg-primary text-on-primary font-label-md text-label-md px-xl py-3 rounded-full shadow-md hover:bg-primary-container transition-all active:scale-95">Ir a mi sección</button>';
    html += '<button type="button" data-auth="cambiar-cuenta"';
    html += ' class="w-full mt-md bg-surface-container-lowest border border-outline-variant text-on-surface font-label-md text-label-md px-xl py-3 rounded-full hover:bg-surface-container-low transition-colors">Cambiar de cuenta</button>';
    html += '</div>';

    html += '</div></div>';
    div.innerHTML = html;

    // Inyectado como PRIMER hijo del <body>
    document.body.insertBefore(div, document.body.firstChild);
    overlay = div;
  }

  /* ---------- Visibilidad del overlay ---------- */
  function mostrarOverlay() {
    overlay.classList.remove('fe-auth-hidden');
    document.body.style.overflow = 'hidden';
    if (mensajeInicial && $('fe-auth-error')) {
      mostrarError(mensajeInicial);
    }
  }

  function ocultarOverlay() {
    overlay.classList.add('fe-auth-hidden');
    document.body.style.overflow = '';
  }

  /* ---------- Notificación de cambio de sesión ---------- */
  // Tras login/registro exitoso desde el gate (sin recargar la página),
  // los app.js de las secciones necesitan re-renderizar perfil/saludo con la
  // sesión recién persistida. Se avisa con un evento propio de FiestaExpert.
  // Guard defensivo: los harnesses Node con shim DOM mínimo no implementan
  // dispatchEvent; el evento es solo para el browser.
  function notificarSesion(user) {
    if (typeof document === 'undefined' || typeof document.dispatchEvent !== 'function') return;
    document.dispatchEvent(new CustomEvent('fe:session-changed', { detail: user }));
  }

  function mostrarPaso(nombre) {
    var pasos = ['rol', 'form', 'mismatch'];
    pasos.forEach(function (p) {
      var el = document.getElementById('fe-auth-paso-' + p);
      if (el) el.style.display = p === nombre ? 'block' : 'none';
    });
    ocultarError();
  }

  /* ---------- Render de formulario (login ⇄ registro) ---------- */
  function renderFormulario() {
    var esRegistro = modo === 'registro';
    var cred = DEMO_CREDS[rolSeleccionado] || DEMO_CREDS.usuario;
    var rolTitulo = ROLES[rolSeleccionado] ? ROLES[rolSeleccionado].titulo : 'Cliente';

    var html = '';
    html += '<button type="button" data-auth="volver-roles"';
    html += ' class="flex items-center gap-xs text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors">';
    html += '<span class="material-symbols-outlined" style="font-size:18px;">arrow_back</span>Cambiar rol</button>';

    html += '<h2 class="font-headline-md text-headline-md mt-md mb-xs">';
    html += esRegistro ? 'Crear cuenta' : 'Iniciar sesión';
    html += '</h2>';
    html += '<p class="font-body-md text-body-md text-on-surface-variant mb-md">Rol: <span class="font-semibold">' + rolTitulo + '</span></p>';

    if (esRegistro) {
      html += '<label class="block mb-sm">';
      html += '<span class="font-label-sm text-label-sm text-on-surface-variant">Nombre</span>';
      html += '<input id="fe-auth-nombre" type="text" autocomplete="name" placeholder="Tu nombre"';
      html += ' class="w-full mt-xs px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-primary transition-colors">';
      html += '</label>';
    }

    html += '<label class="block mb-sm">';
    html += '<span class="font-label-sm text-label-sm text-on-surface-variant">Correo electrónico</span>';
    html += '<input id="fe-auth-email" type="email" autocomplete="email" placeholder="tu@correo.com"';
    html += ' class="w-full mt-xs px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-primary transition-colors">';
    html += '</label>';

    html += '<label class="block">';
    html += '<span class="font-label-sm text-label-sm text-on-surface-variant">Contraseña</span>';
    html += '<input id="fe-auth-password" type="password" autocomplete="current-password" placeholder="••••••••"';
    html += ' class="w-full mt-xs px-md py-sm bg-surface-container-low border border-outline-variant rounded-lg font-body-md text-body-md text-on-surface focus:border-primary transition-colors">';
    html += '</label>';

    document.getElementById('fe-auth-form-body').innerHTML = html;

    var submit = document.getElementById('fe-auth-submit');
    if (submit) submit.textContent = esRegistro ? 'Crear cuenta' : 'Iniciar sesión';

    var toggle = overlay.querySelector('[data-auth="toggle-modo"]');
    if (toggle) toggle.textContent = esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Crear una';

    var demo = document.getElementById('fe-auth-demo-cred');
    if (demo) demo.textContent = cred.email + ' · ' + cred.password;
  }

  /* ---------- Envío de login / registro ---------- */
  function enviarFormulario() {
    var result;
    if (modo === 'registro') {
      result = FE.register({
        nombre: val('fe-auth-nombre'),
        email: val('fe-auth-email'),
        password: val('fe-auth-password'),
        rol: rolSeleccionado
      });
    } else {
      result = FE.login(val('fe-auth-email'), val('fe-auth-password'));
    }

    if (!result.ok) {
      mostrarError(result.error || 'No se pudo completar la solicitud.');
      return;
    }

    // Éxito: aplica la regla de rol
    var user = result.user;
    if (user.rol === seccionRol) {
      ocultarOverlay();
      // Re-render inmediato de perfil/saludo con la sesión activa (login o
      // registro sin recarga): los init de app.js ya corrieron con el gate
      // visible y getCurrentUser() null o con la sesión ANTERIOR.
      notificarSesion(user);
      // Hook MP-015: primer login de un proveedor sin verificar → prompt KYC.
      if (user.rol === 'proveedor' && !user.verificado) {
        if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
          document.dispatchEvent(new CustomEvent('fe:kyc-prompt', { detail: user }));
        }
      }
    } else {
      // Redirección a la sección del rol de la sesión
      var destino = ROLES[user.rol] ? ROLES[user.rol].seccion : null;
      window.location.href = destino ? '../' + destino : '../usuario/index.html';
    }
  }

  /* ---------- Pantalla de mismatch ---------- */
  function mostrarMismatch() {
    var user = FE.getCurrentUser();
    var rolSesion = user && user.rol ? user.rol : 'usuario';
    var tituloSesion = ROLES[rolSesion] ? ROLES[rolSesion].titulo : rolSesion;
    var tituloSeccion = ROLES[seccionRol] ? ROLES[seccionRol].titulo : seccionRol;

    var msg = document.getElementById('fe-auth-mismatch-msg');
    if (msg) {
      msg.textContent = 'Tu sesión es de rol "' + tituloSesion + '", pero esta sección es para "' + tituloSeccion + '".';
    }
    mostrarPaso('mismatch');
  }

  /* ---------- Delegación de eventos ---------- */
  // Registrado PRIMERO (auth.js carga antes que app.js): cuando el overlay
  // está visible, los clicks se detienen aquí y jamás llegan a [data-action].
  document.addEventListener('click', function (event) {
    if (!overlay || overlay.classList.contains('fe-auth-hidden')) return;

    event.stopImmediatePropagation();
    var target = event.target.closest('[data-auth]');
    if (!target) return;

    switch (target.dataset.auth) {
      case 'select-rol':
        rolSeleccionado = target.dataset.rol || 'usuario';
        modo = 'login';
        renderFormulario();
        mostrarPaso('form');
        break;

      case 'volver-roles':
        mostrarPaso('rol');
        break;

      case 'toggle-modo':
        modo = modo === 'login' ? 'registro' : 'login';
        renderFormulario();
        break;

      case 'submit':
        enviarFormulario();
        break;

      case 'ir-seccion':
        var user = FE.getCurrentUser();
        var rolDestino = user && user.rol ? user.rol : 'usuario';
        var seccion = ROLES[rolDestino] ? ROLES[rolDestino].seccion : 'usuario/index.html';
        window.location.href = '../' + seccion;
        break;

      case 'cambiar-cuenta':
        FE.clearSession();
        rolSeleccionado = null;
        modo = 'login';
        mostrarPaso('rol');
        break;
    }
  });

  // Enter dentro del overlay envía el formulario; sin colisión con app.js
  // (stopImmediatePropagation solo cuando el gate está visible).
  document.addEventListener('keydown', function (event) {
    if (!overlay || overlay.classList.contains('fe-auth-hidden')) return;
    if (event.key !== 'Enter') return;
    var target = event.target;
    if (!overlay.contains(target)) return;
    event.stopImmediatePropagation();
    enviarFormulario();
  });

  /* ---------- Init ---------- */
  function init() {
    // data-role lo agrega el cableado (Fase 4); defensivo: asume 'usuario'.
    var bodyRol = document.body ? document.body.getAttribute('data-role') : null;
    if (!bodyRol) {
      console.warn('FiestaExpert: <body> sin data-role; se asume "usuario".');
      bodyRol = 'usuario';
    }
    seccionRol = bodyRol;

    inyectarEstilosCriticos();
    construirOverlay();

    var user = FE.getCurrentUser();
    if (user) {
      if (user.rol === seccionRol) {
        ocultarOverlay(); // sesión válida: app.js arranca normal
      } else {
        mostrarMismatch(); // jamás se muestra contenido de sección no autorizada
        mostrarOverlay();
      }
    } else {
      rolSeleccionado = null;
      modo = 'login';
      mostrarPaso('rol');
      mostrarOverlay();
    }
  }

  // API para el cableado de la Fase 4 (WU2): logout real desde app.js.
  window.FEAuth = {
    logout: function () {
      FE.logout(); // clearSession()
      window.location.reload();
    },
    // MS-005 / D-003: 401 (token ausente o expirado) → re-muestra el gate
    // con aviso de sesión expirada. Lo invoca shared/api.js ante un 401.
    onUnauthorized: function (error) {
      FE.clearSession();
      rolSeleccionado = seccionRol || 'usuario';
      modo = 'login';
      renderFormulario();
      mostrarPaso('form');
      mostrarError(error && error.message ? error.message : 'Sesión expirada. Inicia sesión nuevamente.');
      mostrarOverlay();
    },
    authInit: init
  };

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();