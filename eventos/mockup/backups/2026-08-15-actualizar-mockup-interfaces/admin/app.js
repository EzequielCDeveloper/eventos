/* ============================================
   FiestaExpert — Panel de Admin (SPA)
   Router vanilla + datos demo en memoria.
   Patrón de Centro de Socios (proveedor/app.js).
   Sin frameworks.
   ============================================ */
(function () {
  'use strict';

  /* ---------- Guard defensivo (Fase 4): FEStore debe existir ---------- */
  if (!window.FEStore) {
    console.error('FiestaExpert: FEStore no disponible. Carga shared/store.js antes de app.js.');
    return;
  }

  const $ = function (id) { return document.getElementById(id); };

  /* ---------- Configuración de pantallas ---------- */
  const SCREENS = {
    moderacion: 'Moderación',
    bloqueados: 'Proveedores Bloqueados',
    estadisticas: 'Estadísticas',
    disputas: 'Disputas Técnicas',
    comision: 'Comisión Global'
  };

  /* ---------- Estilos de estado de navegación ---------- */
  const CLASSES = {
    DESK_ON: ['bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'translate-x-1'],
    DESK_OFF: ['text-on-surface-variant', 'hover:bg-surface-container-high'],
    MOB_ON: ['text-primary', 'bg-primary-fixed', 'rounded-full', 'px-4', 'py-1', 'scale-90'],
    MOB_OFF: ['text-on-surface-variant', 'hover:text-primary']
  };

  // C2: nav admin con exactamente 5 funciones; activo por defecto = Moderación.
  let currentNav = 'moderacion';

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Estado activo de navegación (clases) ---------- */
  function setActive(items, activeClasses, offClasses) {
    items.forEach(function (item) {
      const on = item.dataset.nav === currentNav;
      item.classList.remove.apply(item.classList, activeClasses.concat(offClasses));
      item.classList.add.apply(item.classList, on ? activeClasses : offClasses);
      const icon = item.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = on ? "'FILL' 1" : "'FILL' 0";
      const label = item.querySelector('span:not(.material-symbols-outlined)');
      if (label) label.classList.toggle('font-bold', on);
    });
  }

  function updateNav() {
    setActive(Array.prototype.slice.call(document.querySelectorAll('#sidebar-desktop .admin-nav')), CLASSES.DESK_ON, CLASSES.DESK_OFF);
    setActive(Array.prototype.slice.call(document.querySelectorAll('#menu-drawer .admin-nav')), CLASSES.DESK_ON, CLASSES.DESK_OFF);
    setActive(Array.prototype.slice.call(document.querySelectorAll('.admin-nav-mob')), CLASSES.MOB_ON, CLASSES.MOB_OFF);
  }

  /* ---------- Menú móvil off-canvas (sin librerías) ---------- */
  const menuDrawer = $('menu-drawer');
  const menuOverlay = $('menu-overlay');

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

  /* ---------- Toast (reemplaza alert() en el flujo demo) ---------- */
  let toastTimer = null;

  function toast(message) {
    const el = $('toast');
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
    if (name === 'disputas') renderDisputas();
    if (name === 'comision') syncComisionDraft();
  }

  /* ============================================================
     PROVEEDORES BLOQUEADOS
     ============================================================ */
  let BLOCKED_PROVIDERS = [
    { id: 'b1', nombre: 'Salón Las Palmas', tipo: 'Salón', motivo: 'Incumplimiento reiterado de horarios y falta de respuesta a los clientes durante tres semanas consecutivas.', fecha: '02 ago 2026', email: 'contacto@salonlaspalmas.com' },
    { id: 'b2', nombre: 'Sonido Élite Rentas', tipo: 'Sonido', motivo: 'Publicación de precios engañosos y cobros no autorizados reportados por dos clientes.', fecha: '28 jul 2026', email: 'soporte@sonidoelite.com' },
    { id: 'b3', nombre: 'Animación Festiva MX', tipo: 'Servicio', motivo: 'Incidentes de seguridad reportados por dos clientes durante eventos recientes.', fecha: '15 jul 2026', email: 'hola@animacionfestiva.mx' }
  ];

  function renderBloqueados() {
    const listEl = $('bloqueados-list');
    const countEl = $('bloqueados-count');
    const emptyEl = $('bloqueados-vacio');

    if (listEl) {
      listEl.innerHTML = BLOCKED_PROVIDERS.map(function (b) {
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
    }

    if (countEl) {
      const n = BLOCKED_PROVIDERS.length;
      countEl.textContent = n + ' proveedor' + (n === 1 ? '' : 'es') + ' bloqueado' + (n === 1 ? '' : 's');
    }
    if (emptyEl) emptyEl.classList.toggle('hidden', BLOCKED_PROVIDERS.length > 0);
  }

  function desbloquearProveedor(id) {
    const prev = BLOCKED_PROVIDERS.length;
    BLOCKED_PROVIDERS = BLOCKED_PROVIDERS.filter(function (b) { return b.id !== id; });
    if (BLOCKED_PROVIDERS.length === prev) return;
    renderBloqueados();
    toast('Proveedor desbloqueado.');
  }

  function toggleMotivo(id) {
    const motivoEl = $('motivo-' + id);
    if (!motivoEl) return;
    motivoEl.classList.toggle('hidden');
    const btn = document.querySelector('[data-action="bloqueado-motivo"][data-id="' + id + '"]');
    if (btn) btn.textContent = motivoEl.classList.contains('hidden') ? 'Ver motivo' : 'Ocultar motivo';
  }

  /* ============================================================
     ESTADÍSTICAS
     ============================================================ */
  const MONTHLY_STATS = [
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
    const chart = $('estadisticas-chart');
    if (!chart) return;
    const max = Math.max.apply(null, MONTHLY_STATS.map(function (m) { return m.reservas; }));
    const mesActual = new Date().getMonth();

    chart.innerHTML = MONTHLY_STATS.map(function (m, i) {
      const h = Math.round((m.reservas / max) * 100);
      const esActual = i === mesActual;
      const esFuturo = i > mesActual;
      const color = esActual ? 'bg-secondary' : (esFuturo ? 'bg-primary opacity-40' : 'bg-primary');
      return (
        '<div class="flex-1 flex flex-col items-center justify-end gap-sm h-full" title="' + m.label + ': ' + m.reservas + ' reservas">' +
        '<div class="w-full rounded-t-md transition-all ' + color + '" style="height:calc(' + h + '% - 2rem)"></div>' +
        '<span class="font-label-sm text-label-sm ' + (esActual ? 'text-primary font-bold' : 'text-on-surface-variant') + '">' + m.label + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /* KPI "Reservas este mes": deriva del mes real para coincidir con el gráfico. */
  function renderKpisMesActual() {
    const reservas = MONTHLY_STATS[new Date().getMonth()].reservas;
    const dash = $('kpi-reservas-mes-dash');
    const stats = $('kpi-reservas-mes-stats');
    if (dash) dash.textContent = String(reservas);
    if (stats) stats.textContent = String(reservas);
  }

  /* ============================================================
     DISPUTAS TÉCNICAS
     ============================================================ */
  const DISPUTA_STATUS_STYLE = {
    'Abierta': 'bg-error-container text-on-error-container',
    'En revisión': 'bg-secondary-container text-on-secondary-container',
    'Resuelta': 'bg-green-50 text-green-600'
  };

  let DISPUTES = [
    { id: 'd1', titulo: 'Cobro duplicado por anticipo', proveedor: 'Salón Las Palmas', cliente: 'Alejandro Mendoza', servicio: 'Salón', estado: 'Abierta', fecha: '11 ago 2026', descripcion: 'El cliente reporta un doble cobro del anticipo de la reserva; el proveedor no ha respondido a la solicitud de aclaración.' },
    { id: 'd2', titulo: 'Equipo de sonido no instalado', proveedor: 'Sonido Profesional FullSound', cliente: 'María Fernández', servicio: 'Sonido', estado: 'En revisión', fecha: '08 ago 2026', descripcion: 'El equipo contratado no llegó al evento; se requiere verificar la política de reembolso y los términos del contrato.' },
    { id: 'd3', titulo: 'Discrepancia en fecha del evento', proveedor: 'Jardín Los Encinos', cliente: 'Carlos Ramírez', servicio: 'Salón', estado: 'Resuelta', fecha: '02 ago 2026', descripcion: 'Hubo una confusión sobre la fecha reservada; se resolvió con una reprogramación sin costo adicional para el cliente.' }
  ];

  let filtroDisputas = 'todas';

  const FILTRO_BASE = 'font-label-md text-label-md px-md py-sm rounded-full transition-colors';
  const FILTRO_ACTIVE = 'bg-primary text-on-primary';
  const FILTRO_INACTIVE = 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:bg-surface-container-low';

  function updateDisputaTabs() {
    const tabs = Array.prototype.slice.call(document.querySelectorAll('#disputas-tabs [data-filtro]'));
    tabs.forEach(function (tab) {
      const active = tab.dataset.filtro === filtroDisputas;
      tab.className = FILTRO_BASE + ' ' + (active ? FILTRO_ACTIVE : FILTRO_INACTIVE);
    });
  }

  function setDisputaFiltro(filtro) {
    filtroDisputas = filtro || 'todas';
    updateDisputaTabs();
    renderDisputas();
  }

  function renderDisputas() {
    const listEl = $('disputas-list');
    const emptyEl = $('disputas-vacio');
    const match = { abierta: 'Abierta', revision: 'En revisión', resuelta: 'Resuelta' };
    const filtro = match[filtroDisputas];
    const items = filtro ? DISPUTES.filter(function (d) { return d.estado === filtro; }) : DISPUTES;

    if (listEl) {
      listEl.innerHTML = items.map(function (d) {
        const chip = DISPUTA_STATUS_STYLE[d.estado] || 'bg-surface-container-high text-on-surface-variant';
        let actions = '';
        if (d.estado === 'Abierta') {
          actions =
            '<button data-action="disputa-revisar" data-id="' + d.id + '" class="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors flex items-center gap-xs">' +
            '<span class="material-symbols-outlined text-[16px]">manage_search</span> Iniciar Revisión</button>';
        } else if (d.estado === 'En revisión') {
          actions =
            '<button data-action="disputa-resolver" data-id="' + d.id + '" class="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary-container transition-colors flex items-center gap-xs">' +
            '<span class="material-symbols-outlined text-[16px]">task_alt</span> Resolver</button>';
        } else {
          actions =
            '<span class="font-label-sm text-label-sm text-green-600 flex items-center gap-xs"><span class="material-symbols-outlined text-[16px]">check_circle</span> Cerrada</span>';
        }
        return (
          '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg flex flex-col gap-md">' +
          '<div class="flex flex-wrap items-start justify-between gap-md">' +
          '<div class="min-w-0">' +
          '<div class="flex flex-wrap items-center gap-sm mb-xs">' +
          '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + chip + '">' + escapeHtml(d.estado) + '</span>' +
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
    }

    if (emptyEl) emptyEl.classList.toggle('hidden', items.length > 0);
  }

  function cambiarEstadoDisputa(id, estado) {
    let found = null;
    DISPUTES.forEach(function (d) { if (d.id === id) found = d; });
    if (!found) return;
    found.estado = estado;
    renderDisputas();
    toast(estado === 'Resuelta' ? 'Disputa resuelta.' : 'La disputa pasó a En revisión.');
  }

  /* ============================================================
     COMISIÓN GLOBAL
     ============================================================ */
  let commission = {
    tasa: 15,
    historial: [
      { fecha: '01 ene 2026', tasa: 10 },
      { fecha: '01 mar 2026', tasa: 12 },
      { fecha: '01 jul 2026', tasa: 15 }
    ]
  };

  let draftComision = commission.tasa;

  function fechaCorta(date) {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return String(date.getDate()).padStart(2, '0') + ' ' + meses[date.getMonth()] + ' ' + date.getFullYear();
  }

  function updateComisionPreview() {
    const tasaEl = $('comision-tasa');
    const provEl = $('comision-proveedor');
    const platEl = $('comision-plataforma');
    if (tasaEl) tasaEl.textContent = draftComision + '%';
    const plataforma = Math.round((1000 * draftComision) / 100);
    const proveedor = 1000 - plataforma;
    if (provEl) provEl.textContent = '$' + proveedor;
    if (platEl) platEl.textContent = '$' + plataforma;
  }

  function renderComisionHistorial() {
    const list = $('comision-historial');
    if (!list) return;
    list.innerHTML = commission.historial.map(function (h) {
      return (
        '<div class="flex justify-between items-center bg-surface-container-low rounded-lg px-md py-sm">' +
        '<span class="font-body-md text-body-md text-on-surface">' + escapeHtml(h.fecha) + '</span>' +
        '<span class="font-label-md text-label-md text-primary font-bold">' + h.tasa + '%</span>' +
        '</div>'
      );
    }).join('');
  }

  function syncComisionDraft() {
    draftComision = commission.tasa;
    const slider = $('comision-slider');
    if (slider) slider.value = String(draftComision);
    updateComisionPreview();
    renderComisionHistorial();
  }

  function guardarComision() {
    commission.tasa = draftComision;
    const ultima = commission.historial[commission.historial.length - 1];
    if (!ultima || ultima.tasa !== draftComision) {
      commission.historial.push({ fecha: fechaCorta(new Date()), tasa: draftComision });
    }
    renderComisionHistorial();
    toast('Comisión actualizada.');
  }

  /* ============================================================
     Event delegation
     ============================================================ */
  document.addEventListener('click', function (event) {
    // Navegación SPA (sidebar desktop, drawer móvil, bottom nav, atajos)
    const navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      event.preventDefault();
      navigate(navTarget.dataset.nav);
      return;
    }

    const target = event.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
      case 'abrir-menu':
        openMenu();
        break;
      case 'cerrar-menu':
        closeMenu();
        break;
      case 'logout':
        // Logout real (Fase 4): limpia la sesión y vuelve al gate
        if (window.FEAuth && window.FEAuth.logout) {
          window.FEAuth.logout();
        } else if (window.FEStore) {
          window.FEStore.clearSession();
          window.location.reload();
        }
        break;
      case 'aprobar':
        toast('Solicitud aprobada (demo).');
        break;
      case 'rechazar':
        toast('Solicitud rechazada (demo).');
        break;
      case 'aprobar-todo':
        toast('Todas las solicitudes aprobadas (demo).');
        break;
      case 'reporte':
        toast('El reporte completo estará disponible próximamente.');
        break;
      case 'placeholder':
        toast('Pantalla en construcción.');
        break;
      case 'bloqueado-desbloquear':
        desbloquearProveedor(target.dataset.id);
        break;
      case 'bloqueado-motivo':
        toggleMotivo(target.dataset.id);
        break;
      case 'disputa-filtro':
        setDisputaFiltro(target.dataset.filtro);
        break;
      case 'disputa-revisar':
        cambiarEstadoDisputa(target.dataset.id, 'En revisión');
        break;
      case 'disputa-resolver':
        cambiarEstadoDisputa(target.dataset.id, 'Resuelta');
        break;
      case 'comision-guardar':
        guardarComision();
        break;
    }
  });

  // Slider de comisión (evento input: vista previa en vivo)
  const comisionSlider = $('comision-slider');
  if (comisionSlider) {
    comisionSlider.addEventListener('input', function () {
      draftComision = Number(comisionSlider.value);
      updateComisionPreview();
    });
  }

  // Cerrar el menú móvil con Escape
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });

  /* ---------- Saludo con la sesión activa (Fase 4) ---------- */
  // Se ejecuta en el init y en cada fe:session-changed (login sin recargar).
  function renderSaludo(user) {
    const u = user || window.FEStore.getCurrentUser();
    const h1 = $('saludo-admin');
    if (u && u.nombre && h1) h1.textContent = 'Hola, ' + u.nombre + '.';
  }

  document.addEventListener('fe:session-changed', function (event) {
    renderSaludo(event.detail);
  });

  /* ---------- Init ---------- */
  renderBloqueados();
  renderChart();
  renderKpisMesActual();
  renderSaludo();
  updateDisputaTabs();
  renderDisputas();
  syncComisionDraft();
  navigate('moderacion');
})();