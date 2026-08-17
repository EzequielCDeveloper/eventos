/* ============================================
   FiestaExpert — Centro de Socios (Proveedor)
   SPA Provider Console. Router vanilla + datos
   demo en memoria. Sin frameworks.
   ============================================ */
(function () {
  'use strict';

  /* ---------- Guard defensivo (Fase 4): FEStore debe existir ---------- */
  if (!window.FEStore) {
    console.error('FiestaExpert: FEStore no disponible. Carga shared/store.js antes de app.js.');
    return;
  }

  const $ = (id) => document.getElementById(id);

  /* ---------- Configuración de pantallas ---------- */
  const SCREENS = {
    hoy: { title: 'Hoy' },
    mensajes: { title: 'Mensajes' },
    calendario: { title: 'Calendario' },
    anuncios: { title: 'Anuncios' },
    estadisticas: { title: 'Estadísticas' },
    'nuevo-anuncio': { title: 'Nuevo Anuncio' }
  };

  /* ---------- Estilos de estado de navegación ---------- */
  const DRAWER_BASE = 'flex items-center gap-md px-md py-sm rounded-lg transition-all duration-200';
  const DRAWER_ACTIVE = 'bg-secondary-container text-on-secondary-container font-bold translate-x-1';
  const DRAWER_INACTIVE = 'text-on-surface-variant hover:bg-surface-container-high';
  const BOTTOM_BASE = 'flex flex-col items-center justify-center transition-colors';
  const BOTTOM_ACTIVE = 'text-primary bg-primary-fixed rounded-full px-4 py-1 scale-90';
  const BOTTOM_INACTIVE = 'text-on-surface-variant hover:text-primary';

  let current = 'hoy';

  /* ---------- Modo Proveedor toggle ---------- */
  const PROVEEDOR_ON =
    'w-full flex items-center justify-between px-md py-sm bg-primary text-on-primary rounded-lg border border-primary shadow-md transition-colors';
  const PROVEEDOR_OFF =
    'w-full flex items-center justify-between px-md py-sm bg-surface-container-low rounded-lg border border-outline-variant hover:bg-surface-container-highest transition-colors';

  function toggleProveedor(button) {
    const label = button.querySelector('.font-label-md');
    const icon = button.querySelector('[data-icon="toggle"]');
    const isOn = label && label.textContent === 'Modo Proveedor';
    button.className = isOn ? PROVEEDOR_ON : PROVEEDOR_OFF;
    if (label) label.textContent = isOn ? 'Modo Cliente' : 'Modo Proveedor';
    if (icon) icon.textContent = isOn ? 'person' : 'swap_horiz';
  }

  /* ---------- Menú móvil off-canvas (sin librerías) ---------- */
  const menuDrawer = document.getElementById('menu-drawer');
  const menuOverlay = document.getElementById('menu-overlay');

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
    const el = document.getElementById('toast');
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
    const active = item.dataset.nav === current;
    item.className = DRAWER_BASE + ' ' + (active ? DRAWER_ACTIVE : DRAWER_INACTIVE);
    const icon = item.querySelector('.nav-icon');
    if (icon) icon.style.fontVariationSettings = active ? "'FILL' 1" : "'FILL' 0";
  }

  function applyBottomItem(item) {
    const active = item.dataset.nav === current;
    item.className = BOTTOM_BASE + ' ' + (active ? BOTTOM_ACTIVE : BOTTOM_INACTIVE);
    const icon = item.querySelector('.nav-icon');
    if (icon) icon.style.fontVariationSettings = active ? "'FILL' 1" : "'FILL' 0";
  }

  function updateNavState() {
    drawerItems().concat(drawerMobileItems()).forEach(applyDrawerItem);
    bottomItems().forEach(applyBottomItem);
  }

  function navigate(name) {
    if (!SCREENS[name]) return;
    if (name !== 'nuevo-anuncio') resetAnuncioForm();
    current = name;
    allScreens().forEach(function (section) {
      section.classList.toggle('hidden', section.id !== 'screen-' + name);
    });
    updateNavState();
    window.scrollTo(0, 0);
    document.title = SCREENS[name].title + ' — Centro de Socios';
    closeMenu();
    if (name === 'mensajes') resetChatMobile();
    if (name === 'calendario') renderCalendar();
    if (name === 'anuncios') renderAnuncios();
    if (name === 'nuevo-anuncio' && !anuncioEditingId) resetAnuncioForm();
  }

  /* ============================================================
     MENSAJES
     ============================================================ */
  const CONVERSATIONS = [
    {
      id: 1,
      nombre: 'María Fernández',
      iniciales: 'MF',
      asunto: 'Nueva consulta',
      unread: 2,
      mensajes: [
        { de: 'cliente', texto: 'Hola, buen día. Quisiera cotizar el salón para una boda de 120 invitados.' },
        { de: 'proveedor', texto: 'Claro, con gusto te comparto el paquete Platino y la disponibilidad.' },
        { de: 'cliente', texto: '¿Incluye mobiliario y pista de baile?' },
        { de: 'proveedor', texto: 'Sí, ambos servicios están incluidos en el paquete.' },
        { de: 'cliente', texto: 'Perfecto, ¿para el sábado tendríamos fecha disponible?' },
        { de: 'proveedor', texto: 'Te confirmo el estatus mañana por la mañana.' }
      ]
    },
    {
      id: 2,
      nombre: 'Carlos Ramírez',
      iniciales: 'CR',
      asunto: 'Confirmación de fecha',
      unread: 1,
      mensajes: [
        { de: 'cliente', texto: 'Confirmamos la reserva para el 20 de diciembre.' },
        { de: 'proveedor', texto: 'Recibido. El salón queda apartado con el anticipo.' },
        { de: 'cliente', texto: 'Nos gustaría agregar el servicio de sonido amplificado.' }
      ]
    },
    {
      id: 3,
      nombre: 'Lucía Torres',
      iniciales: 'LT',
      asunto: 'Presupuesto boda',
      unread: 0,
      mensajes: [
        { de: 'cliente', texto: 'Hola, me gustaría un presupuesto integral para una boda en primavera.' },
        { de: 'proveedor', texto: 'Con gusto. Te preparo una propuesta con catering y decoración opcional.' }
      ]
    }
  ];

  let activeThreadId = null;

  function totalUnread() {
    return CONVERSATIONS.reduce(function (acc, c) {
      return acc + c.unread;
    }, 0);
  }

  function updateUnreadTotal() {
    const total = totalUnread();
    document.querySelectorAll('.unread-total').forEach(function (el) {
      el.textContent = String(total);
      el.classList.toggle('hidden', total === 0);
    });
  }

  function renderConversationList() {
    const list = $('chat-list-items');
    if (!list) return;
    list.innerHTML = CONVERSATIONS.map(function (c) {
      const initials = c.iniciales || c.nombre.slice(0, 2).toUpperCase();
      const rowActive = c.id === activeThreadId;
      return (
        '<button type="button" data-thread-id="' + c.id + '" class="w-full flex items-start gap-md px-lg py-md text-left border-b border-outline-variant/50 transition-colors ' +
        (rowActive ? 'bg-surface-container-low' : 'hover:bg-surface-container-low') + '">' +
        '<span class="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 font-label-md text-label-md">' + initials + '</span>' +
        '<span class="flex-1 min-w-0">' +
        '<span class="block font-label-md text-label-md text-on-surface font-semibold truncate">' + c.nombre + '</span>' +
        '<span class="block font-body-md text-body-md text-on-surface-variant truncate">' + c.asunto + '</span>' +
        '</span>' +
        (c.unread > 0
          ? '<span class="shrink-0 bg-error text-on-error font-label-sm text-[10px] px-2 py-0.5 rounded-full">' + c.unread + '</span>'
          : '') +
        '</button>'
      );
    }).join('');
  }

  function activeThread() {
    if (activeThreadId === null) return null;
    var found = null;
    CONVERSATIONS.forEach(function (c) { if (c.id === activeThreadId) found = c; });
    return found;
  }

  function selectThread(id) {
    const conv = CONVERSATIONS.filter(function (c) { return c.id === id; })[0];
    if (!conv) return;
    activeThreadId = id;
    conv.unread = 0;
    updateUnreadTotal();
    renderConversationList();
    renderThread();
    const grid = $('chat-grid');
    const thread = $('chat-thread-panel');
    if (grid && thread && window.innerWidth < 768) {
      grid.classList.add('chat-thread-open');
      thread.classList.remove('hidden');
      thread.classList.add('flex');
    }
  }

  function renderThread() {
    const conv = activeThread();
    const title = $('chat-thread-title');
    const subject = $('chat-thread-subject');
    const messagesEl = $('chat-messages');
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

    title.textContent = conv.nombre;
    subject.textContent = conv.asunto;
    messagesEl.innerHTML = conv.mensajes.map(function (m) {
      const sent = m.de === 'proveedor';
      return (
        '<div class="flex ' + (sent ? 'justify-end' : 'justify-start') + '">' +
        '<div class="max-w-[75%] px-md py-sm rounded-xl font-body-md text-body-md ' +
        (sent ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface') + '">' + m.texto + '</div>' +
        '</div>'
      );
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function sendMessage() {
    const conv = activeThread();
    const input = $('chat-input');
    if (!conv || !input) return;
    const text = input.value.trim();
    if (!text) return;
    conv.mensajes.push({ de: 'proveedor', texto: text });
    input.value = '';
    renderThread();
  }

  function resetChatMobile() {
    const grid = $('chat-grid');
    const thread = $('chat-thread-panel');
    if (!grid || !thread) return;
    grid.classList.remove('chat-thread-open');
    thread.classList.add('hidden');
    thread.classList.remove('flex');
  }

  /* ============================================================
     CALENDARIO
     ============================================================ */
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS_LABEL = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  const EVENTS = [
    { dia: 14, titulo: 'Boda Familia García', hora: '17:00' },
    { dia: 17, titulo: 'Salón Las Palmas', hora: '12:00' },
    { dia: 5, titulo: 'Graduación Colegio Reforma', hora: '10:00' },
    { dia: 9, titulo: 'XV años Camila R.', hora: '19:00' },
    { dia: 20, titulo: 'Evento Corporativo Nexa', hora: '14:00' },
    { dia: 24, titulo: 'Boda Familia Torres', hora: '16:00' },
    { dia: 28, titulo: 'Fiesta Infantil Luna', hora: '11:00' }
  ];

  let calCursor = new Date();
  calCursor.setDate(1);

  function renderCalendar() {
    const header = $('cal-header');
    const weekdays = $('cal-weekdays');
    const grid = $('cal-grid');
    if (!header || !weekdays || !grid) return;

    const y = calCursor.getFullYear();
    const m = calCursor.getMonth();
    header.textContent = MESES[m] + ' ' + y;

    weekdays.innerHTML = DIAS_LABEL.map(function (d) {
      return '<div class="py-sm">' + d + '</div>';
    }).join('');

    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7;
    const dim = new Date(y, m + 1, 0).getDate();
    const today = new Date();
    const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;

    let cells = '';
    for (let i = 0; i < firstDow; i += 1) {
      cells += '<div class="min-h-[72px] md:min-h-[92px]"></div>';
    }
    for (let d = 1; d <= dim; d += 1) {
      const dayEvents = EVENTS.filter(function (e) { return e.dia === d; });
      const isToday = isCurrentMonth && today.getDate() === d;
      cells +=
        '<div class="min-h-[72px] md:min-h-[92px] rounded-lg border p-1.5 flex flex-col gap-1 overflow-hidden ' +
        (isToday ? 'border-primary ring-2 ring-primary bg-primary-fixed/10' : 'border-surface-container-high bg-surface-container-lowest') + '">' +
        '<span class="font-label-sm text-label-sm ' + (isToday ? 'text-primary font-bold' : 'text-on-surface') + '">' + d + '</span>' +
        dayEvents.slice(0, 2).map(function (e) {
          return '<span class="font-label-sm text-[10px] leading-tight truncate bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded-md" title="' + e.titulo + ' — ' + e.hora + '">' + e.titulo + ' — ' + e.hora + '</span>';
        }).join('') +
        '</div>';
    }
    grid.innerHTML = cells;
  }

  function shiftMonth(delta) {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + delta, 1);
    renderCalendar();
  }

  /* ============================================================
     ANUNCIOS + NUEVO ANUNCIO
     ============================================================ */
  let ANNOUNCEMENTS = [
    { id: 'a1', titulo: 'Salón Las Palmas — Fines de semana de Octubre', categoria: 'Salón', descripcion: 'Salón para bodas y eventos, hasta 300 invitados.', precio: 8000, imagen: '', status: 'Activo', fecha: '12 ago 2026' },
    { id: 'a2', titulo: 'Sonido Profesional para Bodas', categoria: 'Sonido', descripcion: 'Equipo de sonido amplificado con operador incluido.', precio: 3500, imagen: '', status: 'Activo', fecha: '10 ago 2026' },
    { id: 'a3', titulo: 'Servicio de Fotografía y Video', categoria: 'Servicio', descripcion: 'Cobertura completa para bodas y XV años.', precio: 4500, imagen: '', status: 'Pausado', fecha: '02 ago 2026' }
  ];

  let anuncioEditingId = null;

  const CATEGORY_STYLES = {
    'Salón': 'bg-primary-fixed text-on-primary-fixed',
    'Sonido': 'bg-secondary-fixed text-on-secondary-fixed',
    'Servicio': 'bg-tertiary-fixed text-on-tertiary-fixed'
  };

  function renderAnuncios() {
    const list = $('anuncios-list');
    const empty = $('anuncios-vacio');
    if (!list) return;

    list.innerHTML = ANNOUNCEMENTS.map(function (a) {
      const catCls = CATEGORY_STYLES[a.categoria] || 'bg-surface-variant text-on-surface-variant';
      const statusCls = a.status === 'Activo'
        ? 'bg-green-50 text-green-600'
        : 'bg-surface-container-high text-on-surface-variant';
      return (
        '<div class="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-lg flex flex-col md:flex-row md:items-center gap-md">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex flex-wrap items-center gap-sm mb-xs">' +
        '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + catCls + '">' + a.categoria + '</span>' +
        '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ' + statusCls + '">' + a.status + '</span>' +
        '</div>' +
        '<h3 class="font-headline-md text-[20px] text-on-surface leading-tight">' + a.titulo + '</h3>' +
        '<p class="font-label-sm text-label-sm text-on-surface-variant mt-xs">Publicado: ' + a.fecha + '</p>' +
        '</div>' +
        '<div class="flex items-center justify-between md:justify-end gap-md md:gap-lg md:min-w-[280px]">' +
        '<span class="font-headline-md text-[20px] text-primary">$' + a.precio.toLocaleString('es-MX') + '</span>' +
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

    if (empty) empty.classList.toggle('hidden', ANNOUNCEMENTS.length > 0);
  }

  function anuncioEditar(id) {
    const a = ANNOUNCEMENTS.filter(function (x) { return x.id === id; })[0];
    if (!a) return;
    anuncioEditingId = id;
    $('anuncio-titulo').value = a.titulo;
    $('anuncio-categoria').value = a.categoria;
    $('anuncio-descripcion').value = a.descripcion || '';
    $('anuncio-precio').value = a.precio;
    $('anuncio-imagen').value = a.imagen || '';
    $('anuncio-submit').textContent = 'Guardar Cambios';
    navigate('nuevo-anuncio');
  }

  function anuncioEliminar(id) {
    if (anuncioEditingId === id) resetAnuncioForm();
    ANNOUNCEMENTS = ANNOUNCEMENTS.filter(function (x) { return x.id !== id; });
    renderAnuncios();
    toast('Anuncio eliminado');
  }

  function resetAnuncioForm() {
    anuncioEditingId = null;
    ['anuncio-titulo', 'anuncio-descripcion', 'anuncio-precio', 'anuncio-imagen'].forEach(function (id) {
      const el = $(id);
      if (el) el.value = '';
    });
    const cat = $('anuncio-categoria');
    if (cat) cat.value = 'Salón';
    const submit = $('anuncio-submit');
    if (submit) submit.textContent = 'Publicar';
  }

  function anuncioPublicar() {
    const titulo = $('anuncio-titulo').value.trim();
    const categoria = $('anuncio-categoria').value;
    const descripcion = $('anuncio-descripcion').value.trim();
    const precioRaw = $('anuncio-precio').value;
    const imagen = $('anuncio-imagen').value.trim();
    const precio = Number(precioRaw);

    if (!titulo || !descripcion || !precioRaw || isNaN(precio) || precio <= 0) {
      toast('Completa los campos obligatorios.');
      return;
    }

    const hoy = new Date();
    const fecha = hoy.getDate() + ' ' + MESES[hoy.getMonth()].substring(0, 3).toLowerCase() + ' ' + hoy.getFullYear();

    if (anuncioEditingId) {
      const target = ANNOUNCEMENTS.filter(function (x) { return x.id === anuncioEditingId; })[0];
      if (target) {
        target.titulo = titulo;
        target.categoria = categoria;
        target.descripcion = descripcion;
        target.precio = precio;
        target.imagen = imagen;
        target.fecha = fecha;
      }
      toast('Anuncio actualizado');
    } else {
      ANNOUNCEMENTS.unshift({
        id: 'a' + Date.now(),
        titulo: titulo,
        categoria: categoria,
        descripcion: descripcion,
        precio: precio,
        imagen: imagen,
        status: 'Activo',
        fecha: fecha
      });
      toast('Anuncio publicado');
    }

    resetAnuncioForm();
    renderAnuncios();
    navigate('anuncios');
  }

  /* ============================================================
     ESTADISTICAS
     ============================================================ */
  const REVENUE = [
    { dia: 'L', valor: 1800 },
    { dia: 'M', valor: 1750 },
    { dia: 'X', valor: 1900 },
    { dia: 'J', valor: 1650 },
    { dia: 'V', valor: 2000 },
    { dia: 'S', valor: 2200 },
    { dia: 'D', valor: 1150 }
  ];

  function renderRevenueChart() {
    const chart = $('revenue-chart');
    if (!chart) return;
    const max = Math.max.apply(null, REVENUE.map(function (r) { return r.valor; }));
    const hoyIdx = (new Date().getDay() + 6) % 7;

    chart.innerHTML = REVENUE.map(function (r, i) {
      const h = Math.round((r.valor / max) * 100);
      const hoy = i === hoyIdx;
      return (
        '<div class="flex-1 flex flex-col items-center justify-end gap-sm h-full" title="$' + r.valor.toLocaleString('es-MX') + '">' +
        '<div class="w-full rounded-t-md transition-all ' + (hoy ? 'bg-secondary' : 'bg-primary') + '" style="height:' + h + '%"></div>' +
        '<span class="font-label-sm text-label-sm text-on-surface-variant">' + r.dia + '</span>' +
        '</div>'
      );
    }).join('');
  }

  /* ============================================================
     Event delegation
     ============================================================ */
  document.addEventListener('click', function (event) {
    // Navegación SPA (drawer desktop, bottom nav, drawer móvil, atajos)
    const navTarget = event.target.closest('[data-nav]');
    if (navTarget) {
      event.preventDefault();
      navigate(navTarget.dataset.nav);
      return;
    }

    // Selección de conversación
    const threadTarget = event.target.closest('[data-thread-id]');
    if (threadTarget) {
      selectThread(Number(threadTarget.dataset.threadId));
      return;
    }

    const target = event.target.closest('[data-action]');
    if (!target) return;

    // Los enlaces de navegación no deben saltar al inicio de la página.
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
      case 'cal-prev':
        shiftMonth(-1);
        break;
      case 'cal-next':
        shiftMonth(1);
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
      case 'aprobar':
      case 'ver-detalles':
      case 'reporte':
      case 'placeholder':
        toast('Acción en construcción.');
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
    }
  });

  // Enviar mensaje con Enter y cerrar menú con Escape
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
    if (event.key === 'Enter' && event.target && event.target.id === 'chat-input') {
      event.preventDefault();
      sendMessage();
    }
  });

  /* ---------- Saludo con la sesión activa (Fase 4) ---------- */
  // Re-render del saludo; se ejecuta en el init (carga inicial) y en cada
  // fe:session-changed (login desde el gate sin recargar la página).
  function renderSaludo(user) {
    const u = user || window.FEStore.getCurrentUser();
    const h1 = $('saludo-proveedor');
    if (u && u.nombre && h1) h1.textContent = 'Hola, ' + u.nombre + '.';
  }

  document.addEventListener('fe:session-changed', function (event) {
    renderSaludo(event.detail);
  });

  /* ---------- Init ---------- */
  renderConversationList();
  renderCalendar();
  renderRevenueChart();
  renderAnuncios();
  updateUnreadTotal();
  renderSaludo();
  navigate('hoy');
})();