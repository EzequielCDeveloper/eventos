/* ============================================
   FiestaExpert — Panel de Admin (SPA) v2
   Router vanilla + datos persistidos en FEStore:
   moderación con workflow (pendiente → aprobada/
   advertida/rechazada) + historial, proveedores
   bloqueados, disputas técnicas, comisión global
   con historial. Estados compartidos data-state.
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

  /* ---------- Configuración de pantallas (exactamente 5; MA-001) ---------- */
  var SCREENS = {
    moderacion: 'Moderación',
    bloqueados: 'Proveedores Bloqueados',
    estadisticas: 'Estadísticas',
    disputas: 'Disputas Técnicas',
    comision: 'Comisión Global'
  };

  var CLASSES = {
    DESK_ON: ['bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'translate-x-1'],
    DESK_OFF: ['text-on-surface-variant', 'hover:bg-surface-container-high'],
    MOB_ON: ['text-primary', 'bg-primary-fixed', 'rounded-full', 'px-4', 'py-1', 'scale-90'],
    MOB_OFF: ['text-on-surface-variant', 'hover:text-primary']
  };

  var currentNav = 'moderacion';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX');
  }

  /* ---------- Estado activo de navegación ---------- */
  function setActive(items, activeClasses, offClasses) {
    items.forEach(function (item) {
      var on = item.dataset.nav === currentNav;
      item.classList.remove.apply(item.classList, activeClasses.concat(offClasses));
      item.classList.add.apply(item.classList, on ? activeClasses : offClasses);
      var icon = item.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = on ? "'FILL' 1" : "'FILL' 0";
      var label = item.querySelector('span:not(.material-symbols-outlined)');
      if (label) label.classList.toggle('font-bold', on);
    });
  }

  function updateNav() {
    setActive(Array.prototype.slice.call(document.querySelectorAll('#sidebar-desktop .admin-nav')), CLASSES.DESK_ON, CLASSES.DESK_OFF);
    setActive(Array.prototype.slice.call(document.querySelectorAll('#menu-drawer .admin-nav')), CLASSES.DESK_ON, CLASSES.DESK_OFF);
    setActive(Array.prototype.slice.call(document.querySelectorAll('.admin-nav-mob')), CLASSES.MOB_ON, CLASSES.MOB_OFF);
  }

  /* ---------- Menú móvil off-canvas ---------- */
  var menuDrawer = $('menu-drawer');
  var menuOverlay = $('menu-overlay');

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
    var el = $('toast');
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

  function navigate(name) {
    if (!SCREENS[name]) return;
    currentNav = name;
    allScreens().forEach(function (section) {
      section.classList.toggle('hidden', section.id !== 'screen-' + name);
    });
    updateNav();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = SCREENS[name] + ' — Panel de Admin';
    closeMenu();
    if (name === 'moderacion') renderModeracion();
    if (name === 'bloqueados') renderBloqueados();
    if (name === 'estadisticas') { renderChart(); renderEstadisticas(); }
    if (name === 'disputas') renderDisputas();
    if (name === 'comision') syncComisionDraft();
  }

  /* ============================================================
     MODERACIÓN (MA-003) — workflow persistente + historial
     ============================================================ */
  var MOD_ESTADO_STYLE = {
    'pendiente': 'bg-secondary-container text-on-secondary-container',
    'aprobada': 'bg-green-50 text-green-600',
    'advertida': 'bg-tertiary-fixed-dim text-on-tertiary-fixed',
    'rechazada': 'bg-error-container text-on-error-container'
  };

  var motivoPendiente = null; // { accion, id } para el modal de motivo

  function renderModeracion() {
    var state = $('moderacion-state');
    var list = $('moderacion-list');
    var historial = $('moderacion-historial');
    if (!state || !list || !historial) return;
    // Gate: sin sesión el gate de auth está visible; no lanzar requests 401
    if (!FE.getCurrentUser()) return;

    state.setAttribute('data-state', 'loading');
    API.request('moderationQueue', 'read', {}, API.authHeaders()).then(function (res) {
      if (res.error) {
        if (API.handleUnauthorized(res)) return;
        state.setAttribute('data-state', 'error');
        list.innerHTML =
          '<div class="fe-state"><span class="material-symbols-outlined fe-state-icon">error</span>' +
          '<p class="fe-state-title font-label-md text-label-md">Error al cargar la cola</p>' +
          '<button data-action="moderacion-reintentar" class="mt-md bg-primary text-on-primary font-label-md text-label-md px-lg py-2 rounded-full">Reintentar</button></div>';
        return;
      }

      var cola = res.data || [];
      var empty = state.querySelector('[data-empty="true"]');
      var count = $('moderacion-count');
      if (count) {
        var pend = cola.filter(function (m) { return m.estado === 'pendiente'; }).length;
        count.textContent = pend === 0
          ? 'No hay solicitudes pendientes por revisar.'
          : 'Tienes <strong class="text-primary">' + pend + ' solicitud' + (pend === 1 ? '' : 'es') + ' pendiente' + (pend === 1 ? '' : 's') + '</strong> por revisar.';
      }
      state.setAttribute('data-state', cola.length === 0 ? 'empty' : 'empty');
      if (empty) empty.classList.toggle('hidden', cola.length > 0);

      list.innerHTML = cola.map(function (m) {
        var chip = MOD_ESTADO_STYLE[m.estado] || 'bg-surface-container-high text-on-surface-variant';
        var acciones = '';
        if (m.estado === 'pendiente') {
          acciones =
            '<div class="flex sm:flex-col gap-sm w-full sm:w-auto mt-sm sm:mt-0">' +
            '<button data-action="mod-aprobar" data-id="' + m.id + '" class="flex-1 sm:flex-none bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors text-center">Aprobar</button>' +
            '<button data-action="mod-advertir" data-id="' + m.id + '" class="flex-1 sm:flex-none bg-tertiary-fixed-dim text-on-tertiary-fixed font-label-md text-label-md px-md py-sm rounded-lg hover:bg-tertiary-fixed transition-colors text-center">Advertir</button>' +
            '<button data-action="mod-rechazar" data-id="' + m.id + '" class="flex-1 sm:flex-none bg-surface-container-lowest text-error border border-outline-variant font-label-md text-label-md px-md py-sm rounded-lg hover:bg-error-container transition-colors text-center">Rechazar</button>' +
            '</div>';
        } else {
          acciones = '<span class="font-label-sm text-label-sm text-on-surface-variant mt-xs">Revisada</span>';
        }
        return (
          '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg flex flex-col sm:flex-row gap-md items-start sm:items-center">' +
          '<div class="flex-1 min-w-0">' +
          '<div class="flex flex-wrap items-center gap-sm mb-xs">' +
          '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + chip + '">' + escapeHtml(m.estado) + '</span>' +
          '<span class="bg-surface-container-high text-on-surface-variant font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">' + escapeHtml(m.categoria || 'servicio') + '</span>' +
          '</div>' +
          '<h4 class="font-headline-md text-[20px] text-on-surface leading-tight">' + escapeHtml(m.titulo) + '</h4>' +
          '<p class="font-body-md text-body-md text-on-surface-variant mt-xs">' + escapeHtml(m.motivo || '') + '</p>' +
          (m.historial && m.historial.length > 1
            ? '<p class="font-label-sm text-label-sm text-on-surface-variant mt-xs">Última decisión: ' + escapeHtml(m.historial[m.historial.length - 1].decision) + ' · ' + escapeHtml(m.historial[m.historial.length - 1].motivo || '') + '</p>'
            : '') +
          '</div>' +
          acciones +
          '</div>'
        );
      }).join('');

      // Historial de decisiones (todas las entradas con decisión)
      var decisiones = [];
      cola.forEach(function (m) {
        (m.historial || []).forEach(function (h) {
          if (h.decision && h.decision !== 'enviada') {
            decisiones.push({ solicitud: m.titulo, fecha: h.fecha, decision: h.decision, motivo: h.motivo, adminId: h.adminId });
          }
        });
      });
      decisiones.reverse();
      var histEmpty = state.querySelectorAll('[data-empty="true"]')[1];
      historial.innerHTML = decisiones.length
        ? decisiones.map(function (d) {
            var chip = MOD_ESTADO_STYLE[d.decision] || 'bg-surface-container-high text-on-surface-variant';
            return (
              '<div class="bg-surface-container-low rounded-lg p-md">' +
              '<div class="flex items-center justify-between mb-xs">' +
              '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + chip + '">' + escapeHtml(d.decision) + '</span>' +
              '<span class="font-label-sm text-label-sm text-on-surface-variant">' + escapeHtml(d.fecha) + '</span>' +
              '</div>' +
              '<p class="font-body-md text-body-md text-sm text-on-surface font-semibold">' + escapeHtml(d.solicitud) + '</p>' +
              (d.motivo ? '<p class="font-body-md text-body-md text-xs text-on-surface-variant mt-xs">' + escapeHtml(d.motivo) + '</p>' : '') +
              '</div>'
            );
          }).join('')
        : '';
      if (histEmpty) histEmpty.classList.toggle('hidden', decisiones.length > 0);
    });
  }

  function modAccion(id, accion) {
    if (accion === 'aprobar') {
      // Aprobar no exige motivo (pero se registra igual en el historial)
      aplicarDecision(id, 'aprobada', 'Solicitud aprobada por el administrador.');
      return;
    }
    // Advertir / rechazar exigen motivo explícito
    motivoPendiente = { accion: accion, id: id };
    $('motivo-titulo').textContent = accion === 'rechazar' ? 'Rechazar solicitud' : 'Advertir solicitud';
    $('motivo-copy').textContent = accion === 'rechazar'
      ? 'Registra el motivo del rechazo. Quedará en el historial de la solicitud.'
      : 'Registra el motivo de la advertencia. El proveedor podrá verlo.';
    $('motivo-texto').value = '';
    $('motivo-error').classList.add('hidden');
    openModal('motivo-modal');
  }

  function aplicarDecision(id, decision, motivo) {
    var m = null;
    FE.get('moderationQueue').forEach(function (x) { if (x.id === id) m = x; });
    if (!m) return;
    var historial = (m.historial || []).slice();
    historial.push({
      fecha: new Date().toISOString().slice(0, 10),
      decision: decision,
      motivo: motivo,
      adminId: (FE.getCurrentUser() || { id: 'demo-admin' }).id
    });
    FE.update('moderationQueue', id, { estado: decision, historial: historial });
    // Refleja en el listing correspondiente
    if (m.listingId) {
      var estadoListing = decision === 'aprobada' ? 'publicado' : (decision === 'advertida' ? 'publicado' : 'rechazado');
      FE.update('listings', m.listingId, { estado: estadoListing });
    }
    renderModeracion();
    toast('Solicitud ' + (decision === 'aprobada' ? 'aprobada' : decision === 'advertida' ? 'advertida' : 'rechazada') + '.');
  }

  /* ============================================================
     PROVEEDORES BLOQUEADOS (MA-004) — persistente en FEStore
     ============================================================ */
  function renderBloqueados() {
    var listEl = $('bloqueados-list');
    var countEl = $('bloqueados-count');
    var emptyEl = $('bloqueados-vacio');
    if (!listEl) return;

    var items = FE.get('blockedProviders');
    listEl.innerHTML = items.map(function (b) {
      return (
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg flex flex-col md:flex-row md:items-center gap-md">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex flex-wrap items-center gap-sm mb-xs">' +
        '<span class="bg-error-container text-on-error-container font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Bloqueado</span>' +
        '<span class="bg-surface-container-high text-on-surface-variant font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">' + escapeHtml(b.tipo) + '</span>' +
        '<span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-xs"><span class="material-symbols-outlined text-[14px]">event</span> Desde ' + escapeHtml(b.fecha) + '</span>' +
        '</div>' +
        '<h3 class="font-headline-md text-[20px] text-on-surface leading-tight">' + escapeHtml(b.nombre) + '</h3>' +
        '<p class="font-label-sm text-label-sm text-on-surface-variant mt-xs break-all">' + escapeHtml(b.email) + '</p>' +
        '<div id="motivo-' + b.id + '" class="hidden mt-sm bg-surface-container-low rounded-lg p-md font-body-md text-body-md text-on-surface-variant">' +
        '<strong class="font-label-md text-label-md text-on-surface block mb-xs">Motivo del bloqueo</strong>' + escapeHtml(b.motivo) +
        '</div>' +
        '</div>' +
        '<div class="flex sm:flex-col lg:flex-row gap-sm w-full sm:w-auto shrink-0">' +
        '<button data-action="bloqueado-motivo" data-id="' + b.id + '" class="flex-1 sm:flex-none border border-outline-variant font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors text-primary text-center">Ver motivo</button>' +
        '<button data-action="bloqueado-desbloquear" data-id="' + b.id + '" class="flex-1 sm:flex-none bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors text-center">Desbloquear</button>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    if (countEl) {
      var n = items.length;
      countEl.textContent = n + ' proveedor' + (n === 1 ? '' : 'es') + ' bloqueado' + (n === 1 ? '' : 's');
    }
    if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);
  }

  function desbloquearProveedor(id) {
    var prev = FE.get('blockedProviders').length;
    FE.remove('blockedProviders', id);
    if (FE.get('blockedProviders').length === prev) return;
    renderBloqueados();
    toast('Proveedor desbloqueado.');
  }

  function toggleMotivo(id) {
    var motivoEl = $('motivo-' + id);
    if (!motivoEl) return;
    motivoEl.classList.toggle('hidden');
    var btn = document.querySelector('[data-action="bloqueado-motivo"][data-id="' + id + '"]');
    if (btn) btn.textContent = motivoEl.classList.contains('hidden') ? 'Ver motivo' : 'Ocultar motivo';
  }

  /* ============================================================
     ESTADÍSTICAS (MA-005) — skeleton de carga + KPIs
     ============================================================ */
  var MONTHLY_STATS = [
    { label: 'E', reservas: 48 },
    { label: 'F', reservas: 52 },
    { label: 'M', reservas: 47 },
    { label: 'A', reservas: 55 },
    { label: 'M', reservas: 61 },
    { label: 'J', reservas: 68 },
    { label: 'J', reservas: 74 },
    { label: 'A', reservas: 87 },
    { label: 'S', reservas: 78 },
    { label: 'O', reservas: 84 },
    { label: 'N', reservas: 80 },
    { label: 'D', reservas: 92 }
  ];

  function renderChart() {
    var chart = $('estadisticas-chart');
    if (!chart) return;
    var max = Math.max.apply(null, MONTHLY_STATS.map(function (m) { return m.reservas; }));
    var mesActual = new Date().getMonth();
    chart.innerHTML = MONTHLY_STATS.map(function (m, i) {
      var h = Math.round((m.reservas / max) * 100);
      var esActual = i === mesActual;
      var esFuturo = i > mesActual;
      var color = esActual ? 'bg-secondary' : (esFuturo ? 'bg-primary opacity-40' : 'bg-primary');
      return (
        '<div class="flex-1 flex flex-col items-center justify-end gap-sm h-full" title="' + m.label + ': ' + m.reservas + ' reservas">' +
        '<div class="w-full rounded-t-md transition-all ' + color + '" style="height:calc(' + h + '% - 2rem)"></div>' +
        '<span class="font-label-sm text-label-sm ' + (esActual ? 'text-primary font-bold' : 'text-on-surface-variant') + '">' + m.label + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function renderEstadisticas() {
    var state = $('estadisticas-state');
    var kpis = $('estadisticas-kpis');
    if (!state || !kpis) return;
    // Gate: sin sesión no lanzar requests 401
    if (!FE.getCurrentUser()) return;
    var reservas = MONTHLY_STATS[new Date().getMonth()].reservas;
    state.setAttribute('data-state', 'loading');
    API.request('monthlyReport', 'read', {}, API.authHeaders()).then(function (res) {
      if (res.error) {
        if (API.handleUnauthorized(res)) return;
        state.setAttribute('data-state', 'error');
        kpis.innerHTML =
          '<div class="md:col-span-4 fe-state"><span class="material-symbols-outlined fe-state-icon">error</span>' +
          '<p class="fe-state-title font-label-md text-label-md">Error al cargar estadísticas</p>' +
          '<button data-action="stats-reintentar" class="mt-md bg-primary text-on-primary font-label-md text-label-md px-lg py-2 rounded-full">Reintentar</button></div>';
        return;
      }
      state.setAttribute('data-state', 'empty');
      var comision = FE.getState('commissionSettings') || { tasa: 15 };
      kpis.innerHTML =
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg">' +
        '<p class="font-label-md text-label-md text-on-surface-variant mb-xs flex items-center gap-sm"><span class="material-symbols-outlined text-[18px] text-primary">group</span> Usuarios registrados</p>' +
        '<h4 class="font-display-lg text-[28px] leading-none text-primary">3,450</h4></div>' +
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg">' +
        '<p class="font-label-md text-label-md text-on-surface-variant mb-xs flex items-center gap-sm"><span class="material-symbols-outlined text-[18px] text-secondary">storefront</span> Proveedores activos</p>' +
        '<h4 class="font-display-lg text-[28px] leading-none text-on-surface">128</h4></div>' +
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg">' +
        '<p class="font-label-md text-label-md text-on-surface-variant mb-xs flex items-center gap-sm"><span class="material-symbols-outlined text-[18px] text-primary">event_available</span> Reservas este mes</p>' +
        '<h4 id="kpi-reservas-mes-stats" class="font-display-lg text-[28px] leading-none text-secondary">' + reservas + '</h4></div>' +
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg">' +
        '<p class="font-label-md text-label-md text-on-surface-variant mb-xs flex items-center gap-sm"><span class="material-symbols-outlined text-[18px] text-primary">payments</span> Ingresos plataforma</p>' +
        '<div class="flex items-baseline gap-sm"><h4 class="font-display-lg text-[28px] leading-none text-primary">$18,240</h4>' +
        '<span class="font-label-sm text-label-sm text-green-600 bg-green-50 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-xs"><span class="material-symbols-outlined text-[14px]">arrow_upward</span> 9%</span></div></div>';
    });
  }

  /* ============================================================
     DISPUTAS TÉCNICAS (MA-006) — persistente en FEStore
     ============================================================ */
  var DISPUTA_STATUS_STYLE = {
    'abierta': 'bg-error-container text-on-error-container',
    'en_revision': 'bg-secondary-container text-on-secondary-container',
    'resuelta': 'bg-green-50 text-green-600'
  };

  function DISPUTA_LABEL(e) {
    return e === 'abierta' ? 'Abierta' : e === 'en_revision' ? 'En revisión' : 'Resuelta';
  }

  var filtroDisputas = 'todas';

  var FILTRO_BASE = 'font-label-md text-label-md px-md py-sm rounded-full transition-colors';
  var FILTRO_ACTIVE = 'bg-primary text-on-primary';
  var FILTRO_INACTIVE = 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low';

  function updateDisputaTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('#disputas-tabs [data-filtro]'));
    tabs.forEach(function (tab) {
      var active = tab.dataset.filtro === filtroDisputas;
      tab.className = FILTRO_BASE + ' ' + (active ? FILTRO_ACTIVE : FILTRO_INACTIVE);
    });
  }

  function setDisputaFiltro(filtro) {
    filtroDisputas = filtro || 'todas';
    updateDisputaTabs();
    renderDisputas();
  }

  function renderDisputas() {
    var listEl = $('disputas-list');
    var emptyEl = $('disputas-vacio');
    if (!listEl) return;
    var match = { abierta: 'abierta', revision: 'en_revision', resuelta: 'resuelta' };
    var filtro = match[filtroDisputas];
    var items = filtro
      ? FE.get('technicalDisputes').filter(function (d) { return d.estado === filtro; })
      : FE.get('technicalDisputes');

    listEl.innerHTML = items.map(function (d) {
      var chip = DISPUTA_STATUS_STYLE[d.estado] || 'bg-surface-container-high text-on-surface-variant';
      var actions = '';
      if (d.estado === 'abierta') {
        actions =
          '<button data-action="disputa-revisar" data-id="' + d.id + '" class="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors flex items-center gap-xs">' +
          '<span class="material-symbols-outlined text-[16px]">manage_search</span> Iniciar Revisión</button>';
      } else if (d.estado === 'en_revision') {
        actions =
          '<button data-action="disputa-resolver" data-id="' + d.id + '" class="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors flex items-center gap-xs">' +
          '<span class="material-symbols-outlined text-[16px]">task_alt</span> Resolver</button>';
      } else {
        actions = '<span class="font-label-sm text-label-sm text-green-600 flex items-center gap-xs"><span class="material-symbols-outlined text-[16px]">check_circle</span> Cerrada</span>';
      }
      return (
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg flex flex-col gap-md">' +
        '<div class="flex flex-wrap items-start justify-between gap-md">' +
        '<div class="min-w-0">' +
        '<div class="flex flex-wrap items-center gap-sm mb-xs">' +
        '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + chip + '">' + DISPUTA_LABEL(d.estado) + '</span>' +
        '<span class="bg-surface-container-high text-on-surface-variant font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">' + escapeHtml(d.servicio) + '</span>' +
        '<span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-xs"><span class="material-symbols-outlined text-[14px]">event</span> ' + escapeHtml(d.fecha) + '</span>' +
        '</div>' +
        '<h3 class="font-headline-md text-[20px] text-on-surface leading-tight">' + escapeHtml(d.titulo) + '</h3>' +
        '<p class="font-body-md text-body-md text-on-surface-variant mt-xs">' + escapeHtml(d.proveedor) + ' <span>vs</span> ' + escapeHtml(d.cliente) + '</p>' +
        '</div>' +
        '<div class="flex gap-sm shrink-0 mt-xs">' + actions + '</div>' +
        '</div>' +
        '<p class="font-body-md text-body-md text-on-surface-variant border-t border-outline-variant/50 pt-md">' + escapeHtml(d.descripcion) + '</p>' +
        '</div>'
      );
    }).join('');

    if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);
  }

  function cambiarEstadoDisputa(id, estado) {
    var found = null;
    FE.get('technicalDisputes').forEach(function (d) { if (d.id === id) found = d; });
    if (!found) return;
    FE.update('technicalDisputes', id, { estado: estado });
    renderDisputas();
    toast(estado === 'resuelta' ? 'Disputa resuelta.' : 'La disputa pasó a En revisión.');
  }

  /* ============================================================
     COMISIÓN GLOBAL (MA-007) — persistente con historial
     ============================================================ */
  var draftComision = 15;

  function fechaCorta(date) {
    var meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return String(date.getDate()).padStart(2, '0') + ' ' + meses[date.getMonth()] + ' ' + date.getFullYear();
  }

  function commissionData() {
    return FE.getState('commissionSettings') || { tasa: 15, historial: [] };
  }

  function updateComisionPreview() {
    var tasaEl = $('comision-tasa');
    var provEl = $('comision-proveedor');
    var platEl = $('comision-plataforma');
    if (tasaEl) tasaEl.textContent = draftComision + '%';
    var plataforma = Math.round((1000 * draftComision) / 100);
    var proveedor = 1000 - plataforma;
    if (provEl) provEl.textContent = '$' + proveedor;
    if (platEl) platEl.textContent = '$' + plataforma;
  }

  function renderComisionHistorial() {
    var list = $('comision-historial');
    if (!list) return;
    var data = commissionData();
    list.innerHTML = (data.historial || []).map(function (h) {
      return (
        '<div class="flex justify-between items-center bg-surface-container-low rounded-lg px-md py-sm">' +
        '<span class="font-body-md text-body-md text-on-surface">' + escapeHtml(h.fecha) + '</span>' +
        '<span class="font-label-md text-label-md text-primary font-bold">' + h.tasa + '%</span>' +
        '</div>'
      );
    }).join('');
  }

  function syncComisionDraft() {
    var data = commissionData();
    draftComision = data.tasa;
    var slider = $('comision-slider');
    if (slider) slider.value = String(draftComision);
    updateComisionPreview();
    renderComisionHistorial();
  }

  function guardarComision() {
    // Validación de rango acotado (10..30)
    if (draftComision < 10 || draftComision > 30) {
      toast('La comisión debe estar entre 10% y 30%.');
      return;
    }
    var data = commissionData();
    data.tasa = draftComision;
    var historial = (data.historial || []).slice();
    var ultima = historial[historial.length - 1];
    if (!ultima || ultima.tasa !== draftComision) {
      historial.push({ fecha: fechaCorta(new Date()), tasa: draftComision, adminId: (FE.getCurrentUser() || { id: 'demo-admin' }).id });
    }
    FE.setState('commissionSettings', { tasa: draftComision, historial: historial });
    renderComisionHistorial();
    toast('Comisión actualizada.');
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

    var target = event.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
      case 'abrir-menu':
        openMenu();
        break;
      case 'cerrar-menu':
        closeMenu();
        break;
      case 'logout':
        if (window.FEAuth && window.FEAuth.logout) {
          window.FEAuth.logout();
        } else if (window.FEStore) {
          window.FEStore.clearSession();
          window.location.reload();
        }
        break;

      /* Moderación */
      case 'mod-aprobar':
        modAccion(target.dataset.id, 'aprobar');
        break;
      case 'mod-advertir':
        modAccion(target.dataset.id, 'advertir');
        break;
      case 'mod-rechazar':
        modAccion(target.dataset.id, 'rechazar');
        break;
      case 'moderacion-reintentar':
        renderModeracion();
        break;
      case 'motivo-cerrar':
        motivoPendiente = null;
        closeModal('motivo-modal');
        break;
      case 'motivo-guardar':
        var motivo = $('motivo-texto').value.trim();
        var errEl = $('motivo-error');
        if (!motivo) {
          if (errEl) errEl.classList.remove('hidden');
          return;
        }
        if (errEl) errEl.classList.add('hidden');
        if (motivoPendiente) {
          aplicarDecision(motivoPendiente.id, motivoPendiente.accion === 'rechazar' ? 'rechazada' : 'advertida', motivo);
        }
        motivoPendiente = null;
        closeModal('motivo-modal');
        break;

      /* Bloqueados */
      case 'bloqueado-desbloquear':
        desbloquearProveedor(target.dataset.id);
        break;
      case 'bloqueado-motivo':
        toggleMotivo(target.dataset.id);
        break;

      /* Estadísticas */
      case 'stats-reintentar':
        renderEstadisticas();
        break;

      /* Disputas */
      case 'disputa-filtro':
        setDisputaFiltro(target.dataset.filtro);
        break;
      case 'disputa-revisar':
        cambiarEstadoDisputa(target.dataset.id, 'en_revision');
        break;
      case 'disputa-resolver':
        cambiarEstadoDisputa(target.dataset.id, 'resuelta');
        break;

      /* Comisión */
      case 'comision-guardar':
        guardarComision();
        break;

      case 'reporte':
        toast('El reporte completo estará disponible próximamente.');
        break;
      case 'placeholder':
        toast('Pantalla en construcción.');
        break;
      default:
        break;
    }
  });

  // Slider de comisión (vista previa en vivo)
  var comisionSlider = $('comision-slider');
  if (comisionSlider) {
    comisionSlider.addEventListener('input', function () {
      draftComision = Number(comisionSlider.value);
      updateComisionPreview();
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeMenu(); closeModal('motivo-modal'); }
  });

  /* ---------- Saludo con la sesión activa ---------- */
  function renderSaludo(user) {
    var u = user || FE.getCurrentUser();
    var h1 = $('saludo-admin');
    if (u && u.nombre && h1) h1.textContent = 'Hola, ' + u.nombre + '.';
  }

  document.addEventListener('fe:session-changed', function (event) {
    renderSaludo(event.detail);
    // Re-render de la pantalla actual ahora que hay sesión (el gate ocultó
    // los requests 401 durante la carga inicial)
    if (currentNav === 'moderacion') renderModeracion();
    if (currentNav === 'estadisticas') renderEstadisticas();
    if (currentNav === 'disputas') renderDisputas();
    if (currentNav === 'comision') syncComisionDraft();
  });

  /* ---------- Init ---------- */
  renderSaludo();
  updateDisputaTabs();
  renderDisputas();
  syncComisionDraft();
  navigate('moderacion');
})();
