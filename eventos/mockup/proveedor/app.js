/* ============================================
   FiestaExpert — Centro de Socios (Proveedor) v2
   SPA Provider Console: dashboard 5 tabs + wizard
   onboarding 3 pasos + KYC + calendario con
   inventario/bloqueos/precios dinámicos + mensajes
   avanzados + anuncios + reporte mensual.
   Datos desde FEStore/FEAPI (contrato JWT).
   ============================================ */
(function () {
  'use strict';

  /* ---------- Guard defensivo: FEStore debe existir ---------- */
  if (!window.FEStore) {
    console.error('FiestaExpert: FEStore no disponible. Carga shared/store.js antes de app.js.');
    return;
  }

  var FE = window.FEStore;
  var API = window.FEAPI;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Configuración de pantallas ---------- */
  var SCREENS = {
    hoy: { title: 'Hoy' },
    mensajes: { title: 'Mensajes' },
    calendario: { title: 'Calendario' },
    anuncios: { title: 'Anuncios' },
    estadisticas: { title: 'Estadísticas' },
    onboarding: { title: 'Alta de Servicio' },
    'nuevo-anuncio': { title: 'Nuevo Anuncio' }
  };

  var DRAWER_BASE = 'flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200';
  var DRAWER_ACTIVE = 'bg-secondary-container text-on-secondary-container font-bold translate-x-1';
  var DRAWER_INACTIVE = 'text-on-surface-variant hover:bg-surface-container-high';
  var BOTTOM_BASE = 'flex flex-col items-center justify-center transition-colors';
  var BOTTOM_ACTIVE = 'text-primary bg-primary-fixed rounded-full px-4 py-1 scale-90';
  var BOTTOM_INACTIVE = 'text-on-surface-variant hover:text-primary';

  var current = 'hoy';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX');
  }

  /* ---------- Modo Proveedor toggle ---------- */
  var PROVEEDOR_ON =
    'w-full flex items-center justify-between px-md py-sm bg-primary text-on-primary rounded-lg border border-primary shadow-md transition-colors';
  var PROVEEDOR_OFF =
    'w-full flex items-center justify-between px-md py-sm bg-surface-container-low rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-colors';

  function toggleProveedor(button) {
    var label = button.querySelector('.font-label-md');
    var icon = button.querySelector('[data-icon="toggle"]');
    var isOn = label && label.textContent === 'Modo Proveedor';
    button.className = isOn ? PROVEEDOR_ON : PROVEEDOR_OFF;
    if (label) label.textContent = isOn ? 'Modo Cliente' : 'Modo Proveedor';
    if (icon) icon.textContent = isOn ? 'person' : 'swap_horiz';
  }

  /* ---------- Menú móvil off-canvas ---------- */
  var menuDrawer = document.getElementById('menu-drawer');
  var menuOverlay = document.getElementById('menu-overlay');

  function openMenu() {
    if (!menuDrawer || !menuOverlay) return;
    menuDrawer.classList.remove('-translate-x-full');
    menuDrawer.setAttribute('aria-hidden', 'false');
    menuOverlay.classList.remove('opacity-0', 'pointer-events-none');
  }

  function closeMenu() {
    if (!menuDrawer || !menuOverlay) return;
    menuDrawer.classList.add('-translate-x-full');
    menuDrawer.setAttribute('aria-hidden', 'true');
    menuOverlay.classList.add('opacity-0', 'pointer-events-none');
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;

  function toast(message) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('opacity-0', 'pointer-events-none');
    el.classList.add('opacity-100');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.add('opacity-0', 'pointer-events-none');
      el.classList.remove('opacity-100');
    }, 2500);
  }

  /* ---------- Modal ---------- */
  function openModal(id) {
    var el = $(id);
    if (el) {
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    var el = $(id);
    if (el) el.classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ---------- Router (SPA) ---------- */
  function allScreens() {
    return Array.prototype.slice.call(document.querySelectorAll('.screen'));
  }

  function drawerItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#drawer-desktop [data-nav]'));
  }

  function bottomItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#bottom-nav [data-nav]'));
  }

  function drawerMobileItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#menu-drawer [data-nav]'));
  }

  function applyDrawerItem(item) {
    var active = item.dataset.nav === current;
    item.className = DRAWER_BASE + ' ' + (active ? DRAWER_ACTIVE : DRAWER_INACTIVE);
    var icon = item.querySelector('.nav-icon');
    if (icon) icon.style.fontVariationSettings = active ? "'FILL' 1" : "'FILL' 0";
  }

  function applyBottomItem(item) {
    var active = item.dataset.nav === current;
    item.className = BOTTOM_BASE + ' ' + (active ? BOTTOM_ACTIVE : BOTTOM_INACTIVE);
    var icon = item.querySelector('.nav-icon');
    if (icon) icon.style.fontVariationSettings = active ? "'FILL' 1" : "'FILL' 0";
  }

  function updateNavState() {
    drawerItems().concat(drawerMobileItems()).forEach(applyDrawerItem);
    bottomItems().forEach(applyBottomItem);
  }

  function navigate(name) {
    if (!SCREENS[name]) return;
    current = name;
    allScreens().forEach(function (section) {
      section.classList.toggle('hidden', section.id !== 'screen-' + name);
    });
    updateNavState();
    window.scrollTo(0, 0);
    document.title = SCREENS[name].title + ' — Centro de Socios';
    closeMenu();
    if (name === 'mensajes') resetChatMobile();
    if (name === 'calendario') { renderCalendar(); renderInventario(); renderPrecios(); }
    if (name === 'anuncios') renderAnuncios();
    if (name === 'estadisticas') { renderRevenueChart(); renderReporte(); renderPagos(); }
    if (name === 'onboarding') renderWizard();
  }

  /* ============================================================
     WIZARD ONBOARDING 3 PASOS (MP-001..005) + autoguardado
     ============================================================ */
  var WIZARD_STEPS = [
    { n: 1, label: 'Tipo y ubicación' },
    { n: 2, label: 'Fotos y descripción' },
    { n: 3, label: 'Tarifas y políticas' }
  ];
  var wizardTipo = null;
  var wizardAprobacion = 'manual';
  var wizardFotos = [];
  var DEMO_FOTO = 'https://lh3.googleusercontent.com/aida-public/AB6AXuCq4X8Gy-oex5q9DlY5cOCde8-L4Ll39-k7reImCjQ8Vqe5EaMMg8wSdwNVJThrT-21QKYnKCHYNrC0ufoC0H6MG72KaJS4-4pexzifwnETkxZDKdTDZUK32HbWmeQhDJmth9u7AuyBrsbs3yeFkWXXRVKr5R6A080CXhpz2SHE3n5_R083Y0CyYvOZ4idjV37lJ0gfelibyb9hfrg682DyDEeQEuqcCflm_DYrQiN9P8vuy1pGLWeVwg';

  function getWizard() {
    return FE.getState('wizardOnboarding') || { paso: 1, datos: {} };
  }

  function setWizard(patch) {
    var w = getWizard();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) w[k] = patch[k];
    FE.setState('wizardOnboarding', w);
    return w;
  }

  function wizardData() {
    return getWizard().datos || {};
  }

  function autoguardar(campos) {
    var datos = wizardData();
    for (var k in campos) if (Object.prototype.hasOwnProperty.call(campos, k)) datos[k] = campos[k];
    setWizard({ datos: datos });
  }

  function renderWizardProgress(paso) {
    var bar = $('wizard-progress');
    if (!bar) return;
    bar.innerHTML = WIZARD_STEPS.map(function (s) {
      var estado = s.n < paso ? 'done' : s.n === paso ? 'current' : 'todo';
      return (
        '<div class="flex items-center gap-xs shrink-0" aria-current="' + (estado === 'current' ? 'step' : 'false') + '">' +
        '<span class="w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ' +
        (estado === 'done' ? 'bg-primary text-on-primary' : estado === 'current' ? 'bg-primary-container text-on-primary-container ring-2 ring-primary' : 'bg-surface-container-high text-on-surface-variant') + '">' +
        '<span class="material-symbols-outlined text-[16px]">' + (estado === 'done' ? 'check' : 'radio_button_unchecked') + '</span>' +
        '</span>' +
        '<span class="font-label-sm text-label-sm ' + (estado === 'current' ? 'text-primary font-semibold' : 'text-on-surface-variant') + ' whitespace-nowrap">' + s.label + '</span>' +
        (s.n < WIZARD_STEPS.length ? '<span class="material-symbols-outlined text-on-surface-variant/40 text-[16px] mx-xs">chevron_right</span>' : '') +
        '</div>'
      );
    }).join('');
  }

  function wizardMostrarPaso(n) {
    setWizard({ paso: n });
    WIZARD_STEPS.forEach(function (s) {
      var el = $('wizard-paso-' + s.n);
      if (el) el.classList.toggle('hidden', s.n !== n);
    });
    renderWizardProgress(n);
    window.scrollTo(0, 0);
  }

  function wizardSeleccionarTipo(tipo) {
    wizardTipo = tipo;
    autoguardar({ tipo: tipo });
    document.querySelectorAll('[data-wizard-tipo]').forEach(function (btn) {
      var on = btn.dataset.wizardTipo === tipo;
      btn.className = 'wizard-tipo-btn rounded-xl p-md flex flex-col items-center gap-sm transition-colors ' +
        (on ? 'border-2 border-primary bg-primary-fixed/20' : 'border border-outline-variant hover:border-primary');
    });
    var help = $('wizard-tipo-help');
    if (help) {
      help.textContent = tipo === 'salones'
        ? 'Salón: capacidad concurrente forzada a 1 evento por slot.'
        : tipo === 'sonido'
        ? 'Sonido: capacidad concurrente configurable (default 2).'
        : 'Servicio: capacidad 1 (tarifa por hora o paquete).';
    }
    var cap = $('wizard-capacidad');
    if (cap) {
      if (tipo === 'salones') { cap.value = '1'; cap.disabled = true; }
      else if (tipo === 'servicios-persona') { cap.value = '1'; cap.disabled = true; }
      else { cap.disabled = false; if (!cap.value) cap.value = '2'; }
      autoguardar({ capacidad: cap.value });
    }
    var capHelp = $('wizard-capacidad-help');
    if (capHelp) capHelp.textContent = tipo === 'salones' ? 'Salón forzado a 1 evento por slot.' : 'Número de servicios concurrentes por slot.';
  }

  function wizardRenderFotos() {
    var cont = $('wizard-fotos');
    var count = $('wizard-fotos-count');
    if (!cont) return;
    if (count) count.textContent = '(' + wizardFotos.length + '/5)';
    cont.innerHTML = wizardFotos.map(function (f, i) {
      return (
        '<div class="relative aspect-square rounded-lg overflow-hidden border border-outline-variant group">' +
        '<img class="w-full h-full object-cover" src="' + f + '" alt="Foto ' + (i + 1) + '"/>' +
        '<button data-action="wizard-foto-quitar" data-idx="' + i + '" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Quitar foto">' +
        '<span class="material-symbols-outlined text-[14px]">close</span>' +
        '</button>' +
        '</div>'
      );
    }).join('');
    autoguardar({ fotos: wizardFotos });
  }

  function wizardValidarPaso(n) {
    if (n === 1) {
      if (!wizardTipo) { toast('Selecciona el tipo de servicio.'); return false; }
      if (!$('wizard-ubicacion').value.trim()) { toast('Ingresa la ubicación.'); return false; }
      if (!$('wizard-capacidad').value) { toast('Ingresa la capacidad.'); return false; }
      autoguardar({ ubicacion: $('wizard-ubicacion').value.trim(), capacidad: $('wizard-capacidad').value });
      return true;
    }
    if (n === 2) {
      if (wizardFotos.length < 5) {
        var err = $('wizard-fotos-error');
        if (err) err.classList.remove('hidden');
        toast('Mínimo 5 fotos requeridas.');
        return false;
      }
      var tituloVal = $('wizard-titulo').value.trim();
      var descVal = $('wizard-descripcion').value.trim();
      if (!tituloVal) { toast('Ingresa el título del anuncio.'); return false; }
      if (!descVal) { toast('Ingresa la descripción.'); return false; }
      autoguardar({ titulo: tituloVal, descripcion: descVal });
      return true;
    }
    if (n === 3) {
      if (!$('wizard-precio').value || Number($('wizard-precio').value) <= 0) { toast('Ingresa un precio base válido.'); return false; }
      if (!$('wizard-politicas-check').checked) { toast('Debes aceptar las políticas de la plataforma.'); return false; }
      autoguardar({
        precio: $('wizard-precio').value,
        deposito: $('wizard-deposito').value,
        retencion: $('wizard-retencion').value,
        ventana: $('wizard-ventana').value,
        aprobacion: wizardAprobacion
      });
      return true;
    }
    return true;
  }

  function wizardPublicar() {
    if (!wizardValidarPaso(3)) return;
    var datos = wizardData();
    // Persiste como listing nuevo (pendiente de verificación; MP-004)
    var nuevo = {
      id: 'list-' + Date.now(),
      providerId: (FE.getCurrentUser() || { id: 'demo-proveedor' }).id,
      titulo: datos.titulo,
      categoria: datos.tipo,
      descripcion: datos.descripcion,
      fotos: wizardFotos,
      reglas: [],
      precios: { base: Number(datos.precio), modelo: datos.tipo === 'salones' ? 'bloque' : datos.tipo === 'sonido' ? 'paquete' : 'hora', dinamicos: [] },
      politicas: { cancelacion: 'Configurada', retencionPct: Number(datos.retencion || 50), ventanaSinPenalizacion: Number(datos.ventana || 30), deposito: Number(datos.deposito || 0) },
      aprobacion: datos.aprobacion || 'manual',
      estado: 'pendiente',
      kycRequerido: true,
      fecha: new Date().getDate() + ' ' + ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][new Date().getMonth()] + ' ' + new Date().getFullYear()
    };
    FE.set('listings', nuevo);
    // Entra a la cola de moderación (MA-003)
    FE.set('moderationQueue', {
      id: 'mod-' + Date.now(),
      listingId: nuevo.id,
      titulo: nuevo.titulo,
      categoria: nuevo.categoria,
      estado: 'pendiente',
      motivo: 'Alta de servicio registrada por el proveedor.',
      historial: [{ fecha: new Date().toISOString().slice(0, 10), decision: 'enviada', motivo: 'Alta de servicio registrada por el proveedor.', adminId: null }]
    });
    // Reset wizard
    FE.setState('wizardOnboarding', { paso: 1, datos: {} });
    wizardFotos = [];
    wizardTipo = null;
    toast('Servicio publicado. Estado: Pendiente de verificación.');
    navigate('anuncios');
  }

  function renderWizard() {
    var w = getWizard();
    var datos = w.datos || {};
    wizardTipo = datos.tipo || null;
    wizardFotos = (datos.fotos || []).slice();
    wizardAprobacion = datos.aprobacion || 'manual';
    var paso = w.paso || 1;
    if (paso > 3) paso = 3;

    if (wizardTipo) wizardSeleccionarTipo(wizardTipo);
    if (datos.ubicacion && $('wizard-ubicacion')) $('wizard-ubicacion').value = datos.ubicacion;
    if (datos.capacidad && $('wizard-capacidad')) $('wizard-capacidad').value = datos.capacidad;
    if (datos.titulo && $('wizard-titulo')) $('wizard-titulo').value = datos.titulo;
    if (datos.descripcion && $('wizard-descripcion')) $('wizard-descripcion').value = datos.descripcion;
    if (datos.precio && $('wizard-precio')) $('wizard-precio').value = datos.precio;
    if (datos.deposito && $('wizard-deposito')) $('wizard-deposito').value = datos.deposito;
    if (datos.retencion && $('wizard-retencion')) $('wizard-retencion').value = datos.retencion;
    if (datos.ventana && $('wizard-ventana')) $('wizard-ventana').value = datos.ventana;
    wizardRenderFotos();
    document.querySelectorAll('[data-wizard-aprobacion]').forEach(function (btn) {
      var on = btn.dataset.wizardAprobacion === wizardAprobacion;
      btn.className = 'wizard-aprobacion-btn rounded-full px-md py-sm font-label-md text-label-md transition-colors ' +
        (on ? 'border-2 border-primary bg-primary-fixed/20 text-primary' : 'border border-outline-variant text-on-surface hover:border-primary');
    });
    wizardMostrarPaso(paso);
  }

  /* ============================================================
     KYC (MP-015)
     ============================================================ */
  var kycProveedor = 'Verificamex';

  function promptKYC(user) {
    $('kyc-paso-1').classList.remove('hidden');
    $('kyc-paso-2').classList.add('hidden');
    $('kyc-paso-3').classList.add('hidden');
    openModal('kyc-modal');
  }

  function kycSeleccionar(btn) {
    kycProveedor = btn.dataset.kycProveedor;
    document.querySelectorAll('[data-kyc-proveedor]').forEach(function (b) {
      var on = b === btn;
      b.className = 'kyc-prov-btn font-label-md text-label-md px-md py-sm rounded-full transition-colors ' +
        (on ? 'border border-primary bg-primary-fixed/30 text-primary' : 'border border-outline-variant text-on-surface hover:border-primary');
    });
  }

  function kycCapturar() {
    if (!$('kyc-consent').checked) { toast('Debes aceptar el consentimiento.'); return; }
    $('kyc-paso-1').classList.add('hidden');
    $('kyc-paso-2').classList.remove('hidden');
  }

  function kycEnviar() {
    // Resultado simulado: aprobado (demo determinista)
    var aprobado = true;
    $('kyc-paso-2').classList.add('hidden');
    $('kyc-paso-3').classList.remove('hidden');
    var u = FE.getCurrentUser();
    if (aprobado) {
      $('kyc-resultado-icono').textContent = 'verified';
      $('kyc-resultado-icono').className = 'material-symbols-outlined text-6xl text-primary';
      $('kyc-resultado-titulo').textContent = 'Verificado';
      $('kyc-resultado-copy').textContent = 'Tu badge de proveedor verificado está activo (vía ' + kycProveedor + ').';
      $('kyc-reintentar').classList.add('hidden');
      if (u) {
        FE.update('users', u.id, { verificado: true, kycStatus: 'approved', badges: ['identidad-verificada'] });
        renderSaludo();
        renderKycBadge();
      }
    } else {
      $('kyc-resultado-icono').textContent = 'error';
      $('kyc-resultado-icono').className = 'material-symbols-outlined text-6xl text-error';
      $('kyc-resultado-titulo').textContent = 'Pendiente';
      $('kyc-resultado-copy').textContent = 'No pudimos verificar tu identidad. Puedes reintentar.';
      $('kyc-reintentar').classList.remove('hidden');
      if (u) FE.update('users', u.id, { kycStatus: 'rejected' });
    }
  }

  function renderKycBadge() {
    var u = FE.getCurrentUser();
    if (!u) return;
    var badge = document.querySelector('#drawer-desktop .font-label-sm');
    if (badge) {
      badge.innerHTML = u.verificado
        ? '<span class="material-symbols-outlined text-[16px] text-secondary">verified</span> Verificado' + (u.kycStatus === 'approved' ? ' • ' + kycProveedor : '')
        : '<span class="material-symbols-outlined text-[16px] text-outline">pending</span> Pendiente de verificación';
    }
  }

  /* ============================================================
     MENSAJES (MP-008) — inbox + hilo + respuestas rápidas + voz
     ============================================================ */
  var RESPONSES_RAPIDAS = [
    'Gracias por tu consulta, te respondo en breve.',
    'Claro, con gusto. ¿Cuántos invitados serán?',
    'Sí, tenemos disponibilidad ese día. Te confirmo.',
    'Te comparto la cotización por mensaje privado.'
  ];

  var activeThreadId = null;
  var voiceTimer = null;
  var voiceSeconds = 0;
  var callTimer = null;

  function convsProveedor() {
    var u = FE.getCurrentUser() || { id: 'demo-proveedor' };
    return FE.get('conversations').filter(function (c) {
      return c.participantes.indexOf(u.id) !== -1 || c.proveedorId === u.id;
    });
  }

  function totalUnread() {
    return convsProveedor().reduce(function (acc, c) { return acc + (c.noLeidos || 0); }, 0);
  }

  function updateUnreadTotal() {
    var total = totalUnread();
    document.querySelectorAll('.unread-total').forEach(function (el) {
      el.textContent = String(total);
      el.classList.toggle('hidden', total === 0);
    });
  }

  function renderConversationList() {
    var list = $('chat-list-items');
    if (!list) return;
    list.innerHTML = convsProveedor().map(function (c) {
      var rowActive = c.id === activeThreadId;
      return (
        '<button type="button" data-thread-id="' + c.id + '" class="w-full flex items-start gap-md px-lg py-md text-left border-b border-outline-variant/50 transition-colors ' +
        (rowActive ? 'bg-surface-container-low' : 'hover:bg-surface-container-low') + '">' +
        '<span class="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 font-label-md text-label-md">' + escapeHtml((c.titulo || 'C').slice(0, 1).toUpperCase()) + '</span>' +
        '<span class="flex-1 min-w-0">' +
        '<span class="block font-label-md text-label-md text-on-surface font-semibold truncate">' + escapeHtml(c.titulo) + '</span>' +
        '<span class="block font-body-md text-body-md text-on-surface-variant truncate">' + escapeHtml(c.ultimoMensaje || '') + '</span>' +
        '</span>' +
        (c.noLeidos > 0 ? '<span class="shrink-0 bg-error text-on-error font-label-sm text-[10px] px-2 py-0.5 rounded-full">' + c.noLeidos + '</span>' : '') +
        '</button>'
      );
    }).join('');
    updateUnreadTotal();
  }

  function activeThread() {
    if (activeThreadId === null) return null;
    var found = null;
    convsProveedor().forEach(function (c) { if (c.id === activeThreadId) found = c; });
    return found;
  }

  function selectThread(id) {
    var conv = null;
    FE.get('conversations').forEach(function (c) { if (c.id === id) conv = c; });
    if (!conv) return;
    activeThreadId = id;
    FE.update('conversations', id, { noLeidos: 0 });
    renderConversationList();
    renderThread();
    var grid = $('chat-grid');
    var thread = $('chat-thread-panel');
    if (grid && thread && window.innerWidth < 768) {
      grid.classList.add('chat-thread-open');
      thread.classList.remove('hidden');
      thread.classList.add('flex');
    }
  }

  function mensajesDe(convId) {
    return FE.get('messages').filter(function (m) { return m.convId === convId; });
  }

  function renderThread() {
    var conv = activeThread();
    var title = $('chat-thread-title');
    var subject = $('chat-thread-subject');
    var messagesEl = $('chat-messages');
    if (!title || !subject || !messagesEl) return;

    if (!conv) {
      title.textContent = '';
      subject.textContent = '';
      messagesEl.innerHTML =
        '<div class="flex-1 flex flex-col items-center justify-center text-center gap-sm min-h-[300px]">' +
        '<span class="material-symbols-outlined text-[40px] text-on-surface-variant">chat_bubble_outline</span>' +
        '<p class="font-label-md text-label-md text-on-surface-variant">Selecciona una conversación para comenzar.</p>' +
        '</div>';
      return;
    }

    title.textContent = conv.titulo;
    subject.textContent = 'Cliente interesado en tu servicio';
    var u = FE.getCurrentUser() || { id: 'demo-proveedor' };
    messagesEl.innerHTML = mensajesDe(conv.id).map(function (m) {
      var isMine = m.de === 'proveedor' || m.de === u.id;
      return (
        '<div class="flex ' + (isMine ? 'justify-end' : 'justify-start') + '">' +
        '<div class="max-w-[75%] px-md py-sm rounded-xl font-body-md text-body-md ' +
        (isMine ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface') + '">' +
        (m.texto ? escapeHtml(m.texto) : '') +
        (m.notaVoz
          ? '<span class="flex items-center gap-2"><span class="material-symbols-outlined">graphic_eq</span> Nota de voz · ' + m.notaVoz.duracionSec + 's <button data-action="voice-play" class="underline">Reproducir</button></span>'
          : '') +
        '<span class="block text-right font-label-sm text-[10px] mt-xs opacity-70">' +
        (isMine ? (m.leido ? 'Leído ✓✓' : 'Enviado ✓') : '') +
        '</span>' +
        '</div>' +
        '</div>'
      );
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage() {
    var conv = activeThread();
    var input = $('chat-input');
    if (!conv || !input) return;
    var text = input.value.trim();
    if (!text) return;
    var msg = { id: 'msg-' + Date.now(), convId: conv.id, de: 'proveedor', texto: text, leido: false, leidoEn: null };
    FE.set('messages', msg);
    FE.update('conversations', conv.id, { ultimoMensaje: text });
    input.value = '';
    renderThread();

    // Respuesta simulada del cliente (real-time simulado)
    var respuestas = [
      '¡Gracias! Perfecto, quedamos pendientes.',
      'Entendido, te confirmo los datos por aquí.',
      'Me parece muy bien, gracias por la respuesta.'
    ];
    setTimeout(function () {
      var resp = respuestas[Math.floor(Math.random() * respuestas.length)];
      var nuevo = { id: 'msg-' + Date.now(), convId: conv.id, de: 'usuario', texto: resp, leido: false, leidoEn: null };
      FE.set('messages', nuevo);
      var msgs = mensajesDe(conv.id);
      var last = msgs[msgs.length - 2];
      if (last) FE.update('messages', last.id, { leido: true, leidoEn: new Date().toISOString() });
      renderThread();
    }, 1500);
  }

  function insertarRespuestaRapida(texto) {
    var input = $('chat-input');
    if (input) {
      input.value = texto;
      input.focus();
    }
  }

  function voiceStart() {
    voiceSeconds = 0;
    var rec = $('voice-recorder');
    var timer = $('voice-timer');
    if (!rec || !timer) return;
    rec.classList.remove('hidden');
    rec.classList.add('flex');
    timer.textContent = '0:00';
    clearInterval(voiceTimer);
    voiceTimer = setInterval(function () {
      voiceSeconds += 1;
      var min = Math.floor(voiceSeconds / 60);
      var sec = voiceSeconds % 60;
      timer.textContent = min + ':' + String(sec).padStart(2, '0');
      if (voiceSeconds === 90) toast('Límite de 2 minutos próximo.');
      if (voiceSeconds >= 120) voiceStop('límite de 2 minutos alcanzado');
    }, 1000);
  }

  function voiceStop(mensaje) {
    clearInterval(voiceTimer);
    var rec = $('voice-recorder');
    if (rec) {
      rec.classList.add('hidden');
      rec.classList.remove('flex');
    }
    if (mensaje) toast(mensaje);
    var conv = activeThread();
    if (voiceSeconds >= 2 && conv) {
      var msg = { id: 'msg-' + Date.now(), convId: conv.id, de: 'proveedor', notaVoz: { duracionSec: Math.min(voiceSeconds, 120) }, leido: false, leidoEn: null };
      FE.set('messages', msg);
      FE.update('conversations', conv.id, { ultimoMensaje: 'Nota de voz (' + Math.min(voiceSeconds, 120) + 's)' });
      renderThread();
    }
  }

  function callStart() {
    var conv = activeThread();
    if (!conv) return;
    $('call-titulo').textContent = conv.titulo;
    $('call-estado').textContent = 'Llamando…';
    openModal('call-overlay');
    clearTimeout(callTimer);
    callTimer = setTimeout(function () {
      $('call-estado').textContent = 'En curso';
    }, 2000);
  }

  function callFinalizar() {
    clearTimeout(callTimer);
    $('call-estado').textContent = 'Finalizada';
    setTimeout(function () {
      closeModal('call-overlay');
      toast('Llamada finalizada.');
    }, 800);
  }

  function resetChatMobile() {
    var grid = $('chat-grid');
    var thread = $('chat-thread-panel');
    if (!grid || !thread) return;
    grid.classList.remove('chat-thread-open');
    thread.classList.add('hidden');
    thread.classList.remove('flex');
  }

  function renderQuickReplies() {
    var cont = $('quick-replies');
    if (!cont) return;
    cont.innerHTML = RESPONSES_RAPIDAS.map(function (r) {
      return (
        '<button data-respuesta-rapida data-respuesta-rapida-text="' + escapeHtml(r) + '" class="whitespace-nowrap shrink-0 px-md py-sm border border-outline-variant rounded-full font-label-sm text-label-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors">' + escapeHtml(r) + '</button>'
      );
    }).join('');
  }

  /* ============================================================
     CALENDARIO + INVENTARIO (MP-009/010) + PRECIOS (MP-011)
     ============================================================ */
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var CAPACIDAD_DEFAULT = { salones: 1, sonido: 2, 'servicios-persona': 1 };

  var calCursor = new Date();
  calCursor.setDate(1);
  var diaSeleccionado = null;

  function fmtYMD(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }

  function listaActiva() {
    var u = FE.getCurrentUser() || { id: 'demo-proveedor' };
    var listings = FE.get('listings');
    var found = null;
    listings.forEach(function (l) { if (l.providerId === u.id && !found) found = l; });
    return found || (listings[0] || null);
  }

  function renderCalendar() {
    var header = $('cal-header');
    var weekdays = $('cal-weekdays');
    var grid = $('cal-grid');
    if (!header || !weekdays || !grid) return;

    var y = calCursor.getFullYear();
    var m = calCursor.getMonth();
    header.textContent = MESES[m] + ' ' + y;
    weekdays.innerHTML = DIAS_LABEL.map(function (d) { return '<div class="py-sm">' + d + '</div>'; }).join('');

    var list = listaActiva();
    var bloqueos = FE.get('blockedDates').filter(function (b) { return !list || b.listingId === list.id; });
    var firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    var dim = new Date(y, m + 1, 0).getDate();
    var today = new Date();
    var isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;

    var cells = '';
    for (var i = 0; i < firstDow; i += 1) {
      cells += '<div class="min-h-[72px] md:min-h-[92px]"></div>';
    }
    for (var d = 1; d <= dim; d += 1) {
      var fecha = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var bloqueado = bloqueos.some(function (b) { return b.fecha === fecha; });
      var isToday = isCurrentMonth && today.getDate() === d;
      var sel = diaSeleccionado === fecha;
      cells +=
        '<button data-cal-dia data-fecha="' + fecha + '" class="min-h-[72px] md:min-h-[92px] rounded-lg border p-1.5 flex flex-col gap-1 overflow-hidden text-left ' +
        (sel ? 'border-primary ring-2 ring-primary' : bloqueado ? 'border-error bg-error-container/40' : isToday ? 'border-primary ring-2 ring-primary bg-primary-fixed/10' : 'border-surface-container-high bg-surface-container-lowest') + '">' +
        '<span class="font-label-sm text-label-sm ' + (isToday ? 'text-primary font-bold' : bloqueado ? 'text-error font-bold' : 'text-on-surface') + '">' + d + '</span>' +
        (bloqueado ? '<span class="font-label-sm text-[10px] leading-tight truncate bg-error-container text-on-error-container px-1.5 py-0.5 rounded-md">Bloqueado</span>' : '') +
        '</button>';
    }
    grid.innerHTML = cells;
  }

  function renderInventario() {
    var cont = $('inventario-slots');
    var fechaEl = $('inventario-fecha');
    if (!cont) return;
    var list = listaActiva();
    if (!list) {
      cont.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">Publica un anuncio para gestionar inventario.</p>';
      return;
    }
    var cat = list.categoria || 'salones';
    var base = CAPACIDAD_DEFAULT[cat] || 1;
    if (fechaEl) fechaEl.textContent = 'Anuncio: ' + list.titulo + (diaSeleccionado ? ' · ' + diaSeleccionado : '');

    var slots = FE.get('inventorySlots').filter(function (s) {
      return s.listingId === list.id && (!diaSeleccionado || s.fecha === diaSeleccionado);
    });
    var plantilla = ['10:00 - 14:00', '16:00 - 20:00', '21:00 - 01:00'];

    cont.innerHTML = plantilla.map(function (h, idx) {
      var slot = null;
      slots.forEach(function (s) { if (s.horario === h) slot = s; });
      var capacidad = slot ? slot.capacidad : base;
      var ocupados = slot ? slot.ocupados : (idx === 1 ? 1 : 0);
      var estado = ocupados >= capacidad ? 'lleno' : ocupados > 0 ? 'parcial' : 'disponible';
      var badge = estado === 'lleno' ? 'bg-tertiary-fixed-dim text-on-tertiary-fixed' : estado === 'parcial' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-fixed text-on-primary-fixed';
      var label = estado === 'lleno' ? 'Lleno' : estado === 'parcial' ? 'Parcial' : 'Disponible';
      var capLabel = cat === 'salones' ? 'Salón: 1 evento' : 'Capacidad: ' + capacidad;
      return (
        '<div class="border border-outline-variant rounded-xl p-md">' +
        '<div class="flex items-center justify-between mb-xs">' +
        '<span class="font-label-md text-label-md text-on-surface font-semibold">' + h + '</span>' +
        '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full ' + badge + '">' + label + '</span>' +
        '</div>' +
        '<div class="flex items-center justify-between">' +
        '<span class="font-body-md text-body-md text-sm text-on-surface-variant">' + capLabel + '</span>' +
        '<span class="font-body-md text-body-md text-sm text-on-surface-variant">' + ocupados + '/' + capacidad + ' ocupados</span>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  function renderPrecios() {
    var list = listaActiva();
    var cont = $('precios-lista');
    var vigente = $('precio-vigente');
    if (!cont) return;
    if (!list) {
      cont.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">Sin anuncio activo.</p>';
      if (vigente) vigente.textContent = '';
      return;
    }
    var reglas = FE.get('dynamicPricing').filter(function (r) { return r.listingId === list.id; });
    cont.innerHTML = reglas.length
      ? reglas.map(function (r) {
          return (
            '<div class="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm">' +
            '<div>' +
            '<p class="font-body-md text-body-md text-on-surface font-semibold">' + escapeHtml(r.nombre) + '</p>' +
            '<p class="font-label-sm text-label-sm text-on-surface-variant">' + r.tipo + ' · ' + (r.periodos && r.periodos.length ? r.periodos[0] + ' → ' + r.periodos[1] : '—') + '</p>' +
            '</div>' +
            '<span class="font-label-md text-label-md ' + (r.ajustePct >= 0 ? 'text-green-600' : 'text-error') + ' font-bold">' + (r.ajustePct >= 0 ? '+' : '') + r.ajustePct + '%</span>' +
            '</div>'
          );
        }).join('')
      : '<div class="bg-surface-container-low rounded-lg px-md py-sm flex items-center gap-sm"><span class="material-symbols-outlined text-[18px] text-on-surface-variant">sell</span><span class="font-body-md text-body-md text-on-surface-variant">Tasa fija: sin ajustes dinámicos configurados.</span></div>';

    if (vigente) {
      var base = list.precios ? list.precios.base : 0;
      var total = reglas.reduce(function (acc, r) { return acc + (r.ajustePct || 0); }, 0);
      var vigenteVal = Math.round(base * (1 + total / 100));
      vigente.textContent = 'Precio base ' + money(base) + ' → vigente ' + money(vigenteVal) + ' (ajuste ' + (total >= 0 ? '+' : '') + total + '%).';
    }
  }

  function shiftMonth(delta) {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + delta, 1);
    renderCalendar();
    renderInventario();
  }

  /* ============================================================
     ANUNCIOS (MP-012) — persistente en FEStore
     ============================================================ */
  var anuncioEditingId = null;

  var CATEGORY_STYLES = {
    'salones': 'bg-primary-fixed text-on-primary-fixed',
    'sonido': 'bg-secondary-fixed text-on-secondary-fixed',
    'servicios-persona': 'bg-tertiary-fixed text-on-tertiary-fixed'
  };

  function CATEGORY_LABEL(c) {
    return c === 'salones' ? 'Salón' : c === 'sonido' ? 'Sonido' : 'Servicio';
  }

  function renderAnuncios() {
    var list = $('anuncios-list');
    var empty = $('anuncios-vacio');
    if (!list) return;
    var u = FE.getCurrentUser() || { id: 'demo-proveedor' };
    var anuncios = FE.get('listings').filter(function (a) { return a.providerId === u.id; });

    list.innerHTML = anuncios.map(function (a) {
      var catCls = CATEGORY_STYLES[a.categoria] || 'bg-surface-variant text-on-surface-variant';
      var status = a.estado === 'publicado' ? 'Publicado' : 'Pendiente de verificación';
      var statusCls = a.estado === 'publicado' ? 'bg-green-50 text-green-600' : 'bg-secondary-container text-on-secondary-container';
      return (
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg flex flex-col md:flex-row md:items-center gap-md">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex flex-wrap items-center gap-sm mb-xs">' +
        '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + catCls + '">' + CATEGORY_LABEL(a.categoria) + '</span>' +
        '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + statusCls + '">' + status + '</span>' +
        (a.kycRequerido && !(FE.getCurrentUser() || {}).verificado
          ? '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider bg-error-container text-on-error-container">KYC requerido</span>'
          : '') +
        '</div>' +
        '<h3 class="font-headline-md text-[20px] text-on-surface leading-tight">' + escapeHtml(a.titulo) + '</h3>' +
        '<p class="font-label-sm text-label-sm text-on-surface-variant mt-xs">Publicado: ' + escapeHtml(a.fecha) + ' · Fotos: ' + (a.fotos || []).length + '</p>' +
        '</div>' +
        '<div class="flex items-center justify-between md:justify-end gap-md md:gap-lg md:min-w-[280px]">' +
        '<span class="font-headline-md text-[20px] text-primary">' + money((a.precios && a.precios.base) || 0) + '</span>' +
        '<div class="flex gap-sm">' +
        '<button data-action="anuncio-editar" data-id="' + a.id + '" class="bg-surface-container-lowest text-primary border border-outline-variant font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-xs">' +
        '<span class="material-symbols-outlined text-[16px]">edit</span> Editar' +
        '</button>' +
        '<button data-action="anuncio-eliminar" data-id="' + a.id + '" class="bg-surface-container-lowest text-error border border-outline-variant font-label-md text-label-md px-md py-sm rounded-lg hover:bg-error-container transition-colors flex items-center gap-xs">' +
        '<span class="material-symbols-outlined text-[16px]">delete</span> Eliminar' +
        '</button>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    if (empty) empty.classList.toggle('hidden', anuncios.length > 0);
  }

  function anuncioEditar(id) {
    var a = null;
    FE.get('listings').forEach(function (x) { if (x.id === id) a = x; });
    if (!a) return;
    anuncioEditingId = id;
    $('anuncio-titulo').value = a.titulo;
    $('anuncio-categoria').value = a.categoria;
    $('anuncio-descripcion').value = a.descripcion || '';
    $('anuncio-precio').value = (a.precios && a.precios.base) || '';
    $('anuncio-imagen').value = (a.fotos && a.fotos[0]) || '';
    $('anuncio-submit').textContent = 'Guardar Cambios';
    navigate('nuevo-anuncio');
  }

  function anuncioEliminar(id) {
    if (anuncioEditingId === id) resetAnuncioForm();
    FE.remove('listings', id);
    renderAnuncios();
    toast('Anuncio eliminado');
  }

  function resetAnuncioForm() {
    anuncioEditingId = null;
    ['anuncio-titulo', 'anuncio-descripcion', 'anuncio-precio', 'anuncio-imagen'].forEach(function (id) {
      var el = $(id);
      if (el) el.value = '';
    });
    var cat = $('anuncio-categoria');
    if (cat) cat.value = 'salones';
    var submit = $('anuncio-submit');
    if (submit) submit.textContent = 'Publicar';
  }

  function anuncioPublicar() {
    var titulo = $('anuncio-titulo').value.trim();
    var categoria = $('anuncio-categoria').value;
    var descripcion = $('anuncio-descripcion').value.trim();
    var precioRaw = $('anuncio-precio').value;
    var imagen = $('anuncio-imagen').value.trim();
    var precio = Number(precioRaw);

    if (!titulo || !descripcion || !precioRaw || isNaN(precio) || precio <= 0) {
      toast('Completa los campos obligatorios.');
      return;
    }

    var fecha = new Date().getDate() + ' ' + MESES[new Date().getMonth()].substring(0, 3).toLowerCase() + ' ' + new Date().getFullYear();

    if (anuncioEditingId) {
      var target = null;
      FE.get('listings').forEach(function (x) { if (x.id === anuncioEditingId) target = x; });
      if (target) {
        FE.update('listings', target.id, {
          titulo: titulo,
          categoria: categoria,
          descripcion: descripcion,
          precios: { base: precio, modelo: target.precios ? target.precios.modelo : 'bloque', dinamicos: (target.precios && target.precios.dinamicos) || [] },
          fotos: imagen ? [imagen].concat((target.fotos || []).slice(0, 4)) : target.fotos,
          fecha: fecha
        });
      }
      toast('Anuncio actualizado');
    } else {
      FE.set('listings', {
        id: 'list-' + Date.now(),
        providerId: (FE.getCurrentUser() || { id: 'demo-proveedor' }).id,
        titulo: titulo,
        categoria: categoria,
        descripcion: descripcion,
        fotos: imagen ? [imagen] : [],
        reglas: [],
        precios: { base: precio, modelo: 'bloque', dinamicos: [] },
        politicas: { cancelacion: 'Estricta', retencionPct: 50, ventanaSinPenalizacion: 30, deposito: 0 },
        aprobacion: 'manual',
        estado: 'pendiente',
        kycRequerido: true,
        fecha: fecha
      });
      toast('Anuncio publicado. Estado: Pendiente de verificación.');
    }

    resetAnuncioForm();
    renderAnuncios();
    navigate('anuncios');
  }

  /* ============================================================
     ESTADÍSTICAS + REPORTE MENSUAL (MP-013/014)
     ============================================================ */
  var REVENUE = [
    { dia: 'L', valor: 1800 },
    { dia: 'M', valor: 1750 },
    { dia: 'X', valor: 1900 },
    { dia: 'J', valor: 1650 },
    { dia: 'V', valor: 2000 },
    { dia: 'S', valor: 2200 },
    { dia: 'D', valor: 1150 }
  ];

  function renderRevenueChart() {
    var chart = $('revenue-chart');
    if (!chart) return;
    var max = Math.max.apply(null, REVENUE.map(function (r) { return r.valor; }));
    var hoyIdx = (new Date().getDay() + 6) % 7;
    chart.innerHTML = REVENUE.map(function (r, i) {
      var h = Math.round((r.valor / max) * 100);
      var hoy = i === hoyIdx;
      return (
        '<div class="flex-1 flex flex-col items-center justify-end gap-sm h-full" title="$' + r.valor.toLocaleString('es-MX') + '">' +
        '<div class="w-full rounded-t-md transition-all ' + (hoy ? 'bg-secondary' : 'bg-primary') + '" style="height:' + h + '%"></div>' +
        '<span class="font-label-sm text-label-sm text-on-surface-variant">' + r.dia + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderReporte() {
    var state = $('stats-state');
    if (!state) return;
    // Gate: sin sesión el gate de auth está visible; no lanzar requests 401
    if (!FE.getCurrentUser()) return;
    var reporte = FE.getState('monthlyReport') || { mes: 'Agosto 2026', transacciones: 12, bruto: 118500, impuestos: 18960, comision: 17775, neto: 81765 };

    // Simular carga (skeleton) vía FEAPI
    state.setAttribute('data-state', 'loading');
    API.request('monthlyReport', 'read', {}, API.authHeaders()).then(function (res) {
      if (res.error) {
        if (API.handleUnauthorized(res)) return;
        state.setAttribute('data-state', 'error');
        state.innerHTML =
          '<div class="fe-state"><span class="material-symbols-outlined fe-state-icon">error</span>' +
          '<p class="fe-state-title font-label-md text-label-md">Error al cargar el reporte</p>' +
          '<button data-action="reporte-reintentar" class="mt-md bg-primary text-on-primary font-label-md text-label-md px-lg py-2 rounded-full">Reintentar</button></div>';
        return;
      }
      state.setAttribute('data-state', 'empty');
      if ($('reporte-mes')) $('reporte-mes').textContent = reporte.mes;
      if ($('rep-transacciones')) $('rep-transacciones').textContent = String(reporte.transacciones);
      if ($('rep-bruto')) $('rep-bruto').textContent = money(reporte.bruto);
      if ($('rep-impuestos')) $('rep-impuestos').textContent = money(reporte.impuestos);
      if ($('rep-comision')) $('rep-comision').textContent = money(reporte.comision);
      if ($('rep-neto')) $('rep-neto').textContent = money(reporte.neto);
    });
  }

  function renderPagos() {
    var cont = $('pagos-historial');
    if (!cont) return;
    var pagos = [
      { fecha: '12 ago 2026', concepto: 'Boda Familia García', monto: 12450, estado: 'pagado' },
      { fecha: '05 ago 2026', concepto: 'XV años Camila R.', monto: 8900, estado: 'pagado' },
      { fecha: '28 jul 2026', concepto: 'Graduación Colegio Reforma', monto: 11500, estado: 'pagado' },
      { fecha: '20 jul 2026', concepto: 'Evento Corporativo Nexa', monto: 16500, estado: 'pagado' }
    ];
    cont.innerHTML = pagos.map(function (p) {
      return (
        '<div class="flex items-center justify-between bg-surface-container-low rounded-lg px-md py-sm">' +
        '<div>' +
        '<p class="font-body-md text-body-md text-on-surface">' + escapeHtml(p.concepto) + '</p>' +
        '<p class="font-label-sm text-label-sm text-on-surface-variant">' + escapeHtml(p.fecha) + '</p>' +
        '</div>' +
        '<div class="text-right">' +
        '<p class="font-label-md text-label-md text-on-surface font-semibold">' + money(p.monto) + '</p>' +
        '<p class="font-label-sm text-label-sm text-green-600">Pagado</p>' +
        '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ============================================================
     Event delegation
     ============================================================ */
  document.addEventListener('click', function (event) {
    var navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      event.preventDefault();
      navigate(navTarget.dataset.nav);
      return;
    }

    var threadTarget = event.target.closest('[data-thread-id]');
    if (threadTarget) {
      selectThread(threadTarget.dataset.threadId);
      return;
    }

    var diaTarget = event.target.closest('[data-cal-dia]');
    if (diaTarget) {
      diaSeleccionado = diaTarget.dataset.fecha;
      renderCalendar();
      renderInventario();
      return;
    }

    var wizardTipoTarget = event.target.closest('[data-wizard-tipo]');
    if (wizardTipoTarget) {
      wizardSeleccionarTipo(wizardTipoTarget.dataset.wizardTipo);
      return;
    }

    var kycProvTarget = event.target.closest('[data-kyc-proveedor]');
    if (kycProvTarget) {
      kycSeleccionar(kycProvTarget);
      return;
    }

    var aprobTarget = event.target.closest('[data-wizard-aprobacion]');
    if (aprobTarget) {
      wizardAprobacion = aprobTarget.dataset.wizardAprobacion;
      document.querySelectorAll('[data-wizard-aprobacion]').forEach(function (btn) {
        var on = btn === aprobTarget;
        btn.className = 'wizard-aprobacion-btn rounded-full px-md py-sm font-label-md text-label-md transition-colors ' +
          (on ? 'border-2 border-primary bg-primary-fixed/20 text-primary' : 'border border-outline-variant text-on-surface hover:border-primary');
      });
      return;
    }

    var rapidaTarget = event.target.closest('[data-respuesta-rapida]');
    if (rapidaTarget) {
      insertarRespuestaRapida(rapidaTarget.dataset.respuestaRapidaText || rapidaTarget.dataset.respuestaRapida);
      return;
    }

    var target = event.target.closest('[data-action]');
    if (!target) return;

    if (target.tagName === 'A') {
      event.preventDefault();
    }

    switch (target.dataset.action) {
      case 'toggle-proveedor':
        toggleProveedor(target);
        break;
      case 'abrir-menu':
        openMenu();
        break;
      case 'cerrar-menu':
        closeMenu();
        break;
      case 'chat-back':
        resetChatMobile();
        break;
      case 'chat-send':
        sendMessage();
        break;
      case 'chat-llamar':
        callStart();
        break;
      case 'voice-start':
        voiceStart();
        break;
      case 'voice-stop':
        voiceStop('Nota de voz guardada.');
        break;
      case 'voice-play':
        toast('Reproduciendo nota de voz (simulación).');
        break;
      case 'call-finalizar':
        callFinalizar();
        break;
      case 'cal-prev':
        shiftMonth(-1);
        break;
      case 'cal-next':
        shiftMonth(1);
        break;
      case 'bloqueo-abrir':
        $('bloqueo-fecha').value = diaSeleccionado || '2026-08-25';
        $('bloqueo-motivo').value = 'mantenimiento';
        openModal('bloqueo-modal');
        break;
      case 'bloqueo-cerrar':
        closeModal('bloqueo-modal');
        break;
      case 'bloqueo-guardar':
        var listBloq = listaActiva();
        if (listBloq) {
          FE.set('blockedDates', {
            id: 'bd-' + Date.now(),
            listingId: listBloq.id,
            fecha: $('bloqueo-fecha').value,
            motivo: $('bloqueo-motivo').value
          });
        }
        closeModal('bloqueo-modal');
        toast('Fecha bloqueada.');
        renderCalendar();
        renderInventario();
        break;
      case 'precio-abrir':
        openModal('precio-modal');
        break;
      case 'precio-cerrar':
        closeModal('precio-modal');
        break;
      case 'precio-guardar':
        var listP = listaActiva();
        var ajuste = Number($('precio-ajuste').value);
        if (listP && !isNaN(ajuste)) {
          FE.set('dynamicPricing', {
            id: 'dp-' + Date.now(),
            listingId: listP.id,
            tipo: $('precio-tipo').value,
            nombre: $('precio-nombre').value.trim() || 'Regla demo',
            ajustePct: ajuste,
            periodos: [$('precio-inicio').value || '2026-01-01', $('precio-fin').value || '2026-12-31'],
            aplicaDias: [5, 6]
          });
        }
        closeModal('precio-modal');
        toast('Regla de precio guardada.');
        renderPrecios();
        break;
      case 'anuncio-editar':
        anuncioEditar(target.dataset.id);
        break;
      case 'anuncio-eliminar':
        anuncioEliminar(target.dataset.id);
        break;
      case 'anuncio-publicar':
        anuncioPublicar();
        break;
      case 'anuncio-cancelar':
        resetAnuncioForm();
        navigate('anuncios');
        break;
      case 'wizard-next':
        var w = getWizard();
        var n = w.paso || 1;
        if (wizardValidarPaso(n)) wizardMostrarPaso(n + 1);
        break;
      case 'wizard-prev':
        var w2 = getWizard();
        wizardMostrarPaso(Math.max(1, (w2.paso || 1) - 1));
        break;
      case 'wizard-publicar':
        wizardPublicar();
        break;
      case 'wizard-foto-agregar':
        if (wizardFotos.length < 6) {
          wizardFotos.push(DEMO_FOTO);
          var err2 = $('wizard-fotos-error');
          if (err2 && wizardFotos.length >= 5) err2.classList.add('hidden');
          wizardRenderFotos();
        }
        break;
      case 'wizard-foto-quitar':
        var idx = Number(target.dataset.idx);
        wizardFotos.splice(idx, 1);
        wizardRenderFotos();
        break;
      case 'reporte-reintentar':
        renderReporte();
        break;
      case 'aprobar':
      case 'ver-detalles':
      case 'reporte':
        toast('Acción en construcción.');
        break;
      case 'kyc-cerrar':
        closeModal('kyc-modal');
        break;
      case 'kyc-capturar':
        kycCapturar();
        break;
      case 'kyc-enviar':
        kycEnviar();
        break;
      case 'kyc-reintentar':
        $('kyc-paso-3').classList.add('hidden');
        $('kyc-paso-1').classList.remove('hidden');
        $('kyc-consent').checked = false;
        break;
      case 'logout':
        if (window.FEAuth && window.FEAuth.logout) {
          window.FEAuth.logout();
        } else if (window.FEStore) {
          window.FEStore.clearSession();
          window.location.reload();
        }
        break;
      default:
        break;
    }
  });

  // Slider de comisión (evento input) y chat Enter
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeMenu(); closeModal('kyc-modal'); closeModal('bloqueo-modal'); closeModal('precio-modal'); }
    if (event.key === 'Enter' && event.target && event.target.id === 'chat-input') {
      event.preventDefault();
      sendMessage();
    }
  });

  /* ---------- Saludo + KYC badge con la sesión ---------- */
  function renderSaludo(user) {
    var u = user || FE.getCurrentUser();
    var h1 = $('saludo-proveedor');
    if (u && u.nombre && h1) h1.textContent = 'Hola, ' + u.nombre + '.';
    renderKycBadge();
  }

  /* ---------- Tab Hoy (MP-007): alertas + recordatorios desde store ---------- */
  function renderHoy() {
    var alertas = $('hoy-alertas');
    var recordatorios = $('hoy-recordatorios');
    if (!alertas || !recordatorios) return;

    var u = FE.getCurrentUser() || { id: 'demo-proveedor' };
    var convs = FE.get('conversations').filter(function (c) {
      return c.participantes.indexOf(u.id) !== -1 || c.proveedorId === u.id;
    });
    var noLeidos = convs.reduce(function (acc, c) { return acc + (c.noLeidos || 0); }, 0);
    var pendientes = FE.get('reservations').filter(function (r) { return r.estado === 'confirmada'; });

    alertas.innerHTML = '';
    if (noLeidos > 0) {
      alertas.innerHTML +=
        '<button data-nav="mensajes" class="flex items-center gap-md bg-error-container text-on-error-container rounded-lg px-md py-sm text-left">' +
        '<span class="material-symbols-outlined text-[20px]">mail</span>' +
        '<span class="flex-1 font-body-md text-body-md">Tienes <strong>' + noLeidos + ' mensaje' + (noLeidos === 1 ? '' : 's') + ' sin leer</strong></span>' +
        '<span class="material-symbols-outlined">chevron_right</span></button>';
    }
    if (pendientes.length > 0) {
      alertas.innerHTML +=
        '<button data-nav="calendario" class="flex items-center gap-md bg-secondary-container text-on-secondary-container rounded-lg px-md py-sm text-left">' +
        '<span class="material-symbols-outlined text-[20px]">event_available</span>' +
        '<span class="flex-1 font-body-md text-body-md"><strong>' + pendientes.length + ' reserva' + (pendientes.length === 1 ? '' : 's') + ' pendiente' + (pendientes.length === 1 ? '' : 's') + '</strong> por revisar hoy</span>' +
        '<span class="material-symbols-outlined">chevron_right</span></button>';
    }
    if (!alertas.innerHTML) {
      alertas.innerHTML = '<p class="font-body-md text-body-md text-on-surface-variant">Todo al día. No hay alertas urgentes.</p>';
    }

    var recordatoriosData = [
      { icono: 'check_circle', texto: 'Resumen semanal disponible en Estadísticas', nav: 'estadisticas' },
      { icono: 'star', texto: 'Nueva reseña de Salón Las Palmas (4.8 ★)', nav: 'anuncios' },
      { icono: 'event', texto: 'Boda Familia García — mañana 17:00', nav: 'calendario' }
    ];
    recordatorios.innerHTML = recordatoriosData.map(function (r) {
      return (
        '<button data-nav="' + r.nav + '" class="flex items-center gap-md bg-surface-container-low rounded-lg px-md py-sm text-left hover:bg-surface-container-high transition-colors">' +
        '<span class="material-symbols-outlined text-[20px] text-primary">' + r.icono + '</span>' +
        '<span class="flex-1 font-body-md text-body-md text-on-surface">' + r.texto + '</span>' +
        '<span class="material-symbols-outlined text-on-surface-variant">chevron_right</span></button>'
      );
    }).join('');
  }

  document.addEventListener('fe:session-changed', function (event) {
    renderSaludo(event.detail);
    renderHoy();
    // Re-render tras login (el gate ocultó los requests 401 en la carga inicial)
    if (current === 'estadisticas') { renderReporte(); renderPagos(); }
    if (current === 'calendario') { renderCalendar(); renderInventario(); renderPrecios(); }
  });

  // Hook MP-015: prompt KYC al primer login de un proveedor sin verificar
  document.addEventListener('fe:kyc-prompt', function (event) {
    var u = event.detail || FE.getCurrentUser();
    if (u && !u.verificado) {
      setTimeout(function () { promptKYC(u); }, 400);
    }
  });

  /* ---------- Init ---------- */
  renderConversationList();
  renderQuickReplies();
  renderCalendar();
  renderRevenueChart();
  renderAnuncios();
  updateUnreadTotal();
  renderSaludo();
  renderHoy();
  navigate('hoy');
})();
