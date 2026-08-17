/* ============================================
   FiestaExpert — SPA Cliente (Vanilla JS) v2
   Router + favoritos/notificaciones/detalle/
   reserva 6 pasos/rentas/chat/normativa.
   Datos desde FEStore + FEAPI (contrato JWT).
   Sin frameworks.
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

  /* ---------- Configuración de pantallas ---------- */
  var SCREENS = {
    inicio: { title: 'FiestaExpert - Inicio' },
    busqueda: { title: 'FiestaExpert - Búsqueda' },
    detalle: { title: 'Detalle de Servicio - FiestaExpert' },
    reserva: { title: 'Reserva - FiestaExpert' },
    rentas: { title: 'Mis Rentas - FiestaExpert' },
    perfil: { title: 'Perfil del Cliente' },
    favoritos: { title: 'Favoritos' },
    chat: { title: 'Chat' },
    notificaciones: { title: 'Notificaciones' }
  };

  // Pantallas que ocultan el shell global (header/bottom-nav).
  var SUB_SCREENS = ['detalle', 'reserva'];

  var CLASSES = {
    MOB_ON: ['text-primary', 'bg-primary-fixed', 'rounded-full', 'px-4', 'py-1', 'scale-90'],
    MOB_OFF: ['text-on-surface-variant', 'hover:text-primary'],
    DESK_ON: ['text-primary', 'font-bold', 'bg-primary-fixed/20'],
    DESK_OFF: ['text-on-surface-variant', 'hover:bg-surface-container-low']
  };

  var current = 'inicio';
  var servicioActual = null;   // servicio en detalle/reserva
  var galleryIndex = 0;

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function allScreens() {
    return Array.prototype.slice.call(document.querySelectorAll('.screen'));
  }

  function desktopNavItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#app-desktopnav [data-nav]'));
  }

  function mobileNavItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#app-bottomnav [data-nav]'));
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX');
  }

  function stars(rating) {
    var r = Math.round(rating || 0);
    var out = '';
    for (var i = 1; i <= 5; i += 1) {
      out += '<span class="material-symbols-outlined text-secondary text-[16px]" style="font-variation-settings: \'FILL\' ' + (i <= r ? 1 : 0) + ';">star</span>';
    }
    return out;
  }

  function toast(message) {
    var t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.add('hidden'); }, 2600);
  }

  function fmtFecha(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return d.getDate() + ' de ' + meses[d.getMonth()] + ', ' + d.getFullYear();
  }

  /* ---------- Router ---------- */
  function navigate(screen) {
    if (!SCREENS[screen]) return;
    current = screen;
    allScreens().forEach(function (section) {
      section.classList.toggle('hidden', section.id !== 'screen-' + screen);
    });
    document.body.classList.toggle('shell-hidden', SUB_SCREENS.indexOf(screen) !== -1);
    updateNavState();
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = SCREENS[screen].title;
    closeModal();
    if (screen === 'favoritos') renderFavoritos();
    if (screen === 'notificaciones') renderNotificaciones();
    if (screen === 'rentas') renderRentas('activas');
    if (screen === 'chat') renderChatList();
    if (screen === 'detalle' && servicioActual) renderDetalle();
  }

  function updateNavState() {
    mobileNavItems().forEach(function (item) {
      var active = item.dataset.nav === current;
      item.classList.remove.apply(item.classList, CLASSES.MOB_ON.concat(CLASSES.MOB_OFF));
      var icon = item.querySelector('.nav-icon');
      var label = item.querySelector('.nav-label');
      if (active) {
        item.classList.add.apply(item.classList, CLASSES.MOB_ON);
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
        if (label) label.classList.add('font-bold');
      } else {
        item.classList.add.apply(item.classList, CLASSES.MOB_OFF);
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
        if (label) label.classList.remove('font-bold');
      }
    });

    desktopNavItems().forEach(function (item) {
      var active = item.dataset.nav === current;
      item.classList.remove.apply(item.classList, CLASSES.DESK_ON.concat(CLASSES.DESK_OFF));
      var icon = item.querySelector('.nav-icon');
      if (active) {
        item.classList.add.apply(item.classList, CLASSES.DESK_ON);
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        item.classList.add.apply(item.classList, CLASSES.DESK_OFF);
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
      }
    });
  }

  /* ---------- Modales ---------- */
  function openModal(id) {
    var el = $(id);
    if (el) {
      el.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    var ids = id ? [id] : ['alcohol-modal', 'reserva-detalle-modal', 'cancelar-modal', 'privacidad-modal', 'tc-modal', 'verificar-modal', 'arco-modal', 'call-overlay'];
    ids.forEach(function (i) {
      var el = $(i);
      if (el) el.classList.add('hidden');
    });
    document.body.style.overflow = '';
  }

  /* ============================================================
     CATEGORÍAS / BÚSQUEDA (render de servicios desde FEStore)
     ============================================================ */
  var categoriaActiva = 'todos';

  var CATEGORY_ON =
    'whitespace-nowrap px-6 py-2 rounded-full bg-primary text-on-primary font-label-md shadow-sm';
  var CATEGORY_OFF =
    'whitespace-nowrap px-6 py-2 rounded-full bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-label-md hover:bg-surface-container-low transition-colors';

  function selectCategory(button) {
    document.querySelectorAll('[data-category]').forEach(function (cat) {
      cat.className = cat === button ? CATEGORY_ON : CATEGORY_OFF;
    });
    categoriaActiva = button.dataset.category || 'todos';
    renderServices();
  }

  var SLOT_OFF =
    'py-2 px-3 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface text-center hover:bg-surface-container-low transition-colors';
  var SLOT_ON =
    'py-2 px-3 border-2 border-primary bg-primary/5 rounded-lg font-label-md text-label-md text-primary font-semibold text-center transition-colors';

  function serviceCard(s) {
    var favs = FE.getFavorites();
    var isFav = favs.indexOf(s.id) !== -1;
    var modelo = s.modeloPrecio === 'bloque' ? '/ bloque' : (s.modeloPrecio === 'hora' ? '/ hora' : '/ paquete');
    return (
      '<article data-open-detail data-card="' + escapeHtml(s.titulo) + '" data-id="' + escapeHtml(s.id) + '" class="group bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0px_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 flex flex-col cursor-pointer">' +
      '<div class="relative h-56 w-full">' +
      '<img class="w-full h-full object-cover" alt="' + escapeHtml(s.titulo) + '" src="' + (s.fotos && s.fotos[0]) + '" loading="lazy"/>' +
      '<button data-fav data-id="' + escapeHtml(s.id) + '" aria-label="Favorito" class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-lowest/80 ' + (isFav ? 'text-error' : 'text-on-surface-variant hover:text-error') + ' transition-colors">' +
      '<span class="material-symbols-outlined text-[20px]" style="font-variation-settings: \'FILL\' ' + (isFav ? 1 : 0) + ';">favorite</span>' +
      '</button>' +
      '</div>' +
      '<div class="p-lg flex-1 flex flex-col">' +
      '<div class="flex justify-between items-start mb-sm">' +
      '<h2 class="font-headline-md text-headline-md-mobile md:text-headline-md text-on-surface group-hover:text-primary transition-colors">' + escapeHtml(s.titulo) + '</h2>' +
      '<div class="flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded-md">' +
      '<span class="material-symbols-outlined text-secondary text-[16px]" style="font-variation-settings: \'FILL\' 1;">star</span>' +
      '<span class="font-label-md text-on-surface">' + s.rating + '</span>' +
      '</div>' +
      '</div>' +
      '<p class="font-body-md text-on-surface-variant mb-md flex-1">Capacidad hasta ' + s.capacidad + ' personas. ' + (s.amenities && s.amenities[0] ? s.amenities[0] + '.' : '') + '</p>' +
      '<div class="flex justify-between items-end mt-auto pt-4 border-t border-surface-variant">' +
      '<div>' +
      '<p class="font-label-sm text-on-surface-variant">Desde</p>' +
      '<p class="font-headline-md text-[20px] text-primary">' + money(s.precioBase) + ' MXN <span class="font-body-md text-on-surface-variant">' + modelo + '</span></p>' +
      '</div>' +
      '<span class="material-symbols-outlined text-primary bg-primary-fixed w-10 h-10 flex items-center justify-center rounded-full group-hover:bg-primary group-hover:text-on-primary transition-colors">arrow_forward</span>' +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderServices() {
    var grid = $('services-grid');
    var state = $('services-state');
    if (!grid || !state) return;

    state.setAttribute('data-state', 'loading');
    var q = ($('search-input') ? $('search-input').value : '').trim().toLowerCase();

    // Simular latencia via FEAPI (data-state loading → resultados)
    API.request('services', 'read', {}, API.authHeaders()).then(function (res) {
      if (res.error) {
        if (API.handleUnauthorized(res)) return;
        state.setAttribute('data-state', 'error');
        return;
      }
      var items = res.data.filter(function (s) {
        var okCat = categoriaActiva === 'todos' || s.categoria === categoriaActiva;
        var okQ = !q || String(s.titulo).toLowerCase().indexOf(q) !== -1;
        return okCat && okQ && s.estado === 'publicado';
      });
      grid.innerHTML = items.map(serviceCard).join('');
      var empty = state.querySelector('[data-empty="true"]');
      if (empty) {
        empty.classList.toggle('hidden', items.length > 0);
        state.setAttribute('data-state', items.length === 0 ? 'no-results' : 'empty');
      }
    });
  }

  function clearSearch() {
    if ($('search-input')) $('search-input').value = '';
    if ($('busqueda-input')) $('busqueda-input').value = '';
    categoriaActiva = 'todos';
    document.querySelectorAll('[data-category]').forEach(function (cat) {
      cat.className = CATEGORY_OFF;
    });
    renderServices();
  }

  /* ============================================================
     FAVORITOS (MU-006) — persistente en FEStore
     ============================================================ */
  function toggleFav(serviceId) {
    var isFav = FE.toggleFavorite(serviceId);
    // Refresca corazones en pantalla (cards y detalle)
    document.querySelectorAll('[data-fav][data-id="' + serviceId + '"]').forEach(function (btn) {
      var icon = btn.querySelector('.material-symbols-outlined');
      btn.classList.toggle('text-error', isFav);
      btn.classList.toggle('text-on-surface-variant', !isFav);
      if (icon) icon.style.fontVariationSettings = isFav ? "'FILL' 1" : "'FILL' 0";
    });
    if (servicioActual && servicioActual.id === serviceId) renderDetalleFavState(isFav);
    toast(isFav ? 'Agregado a favoritos.' : 'Eliminado de favoritos.');
    if (current === 'favoritos') renderFavoritos();
  }

  function renderDetalleFavState(isFav) {
    var icon = $('detail-fav-icon');
    if (icon) {
      icon.textContent = isFav ? 'favorite' : 'favorite_border';
      icon.style.fontVariationSettings = isFav ? "'FILL' 1" : "'FILL' 0";
    }
  }

  function renderFavoritos() {
    var grid = $('favoritos-grid');
    var state = $('favoritos-state');
    if (!grid || !state) return;
    var favs = FE.getFavorites();
    var services = FE.getServices();
    var items = services.filter(function (s) { return favs.indexOf(s.id) !== -1; });
    var empty = state.querySelector('[data-empty="true"]');
    state.setAttribute('data-state', items.length === 0 ? 'empty' : 'loading');
    grid.innerHTML = items.map(serviceCard).join('');
    if (empty) empty.classList.toggle('hidden', items.length > 0);
    if (items.length > 0) state.setAttribute('data-state', 'empty');
  }

  /* ============================================================
     NOTIFICACIONES (MU-016) — centro + badges
     ============================================================ */
  function notifCount() {
    return FE.get('notifications').filter(function (n) { return !n.leida; }).length;
  }

  function updateNotifBadges() {
    var n = notifCount();
    ['notif-badge-mob', 'notif-badge-desk'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.textContent = String(n);
      el.classList.toggle('hidden', n === 0);
    });
    var perfil = $('perfil-notif-count');
    if (perfil) perfil.textContent = n > 0 ? n + ' sin leer' : '';
  }

  var CRITICAL_STYLE = 'bg-error-container text-on-error-container border-l-4 border-error';
  var NORMAL_STYLE = 'bg-surface-container-lowest border border-surface-container-high';

  function renderNotificaciones() {
    var list = $('notificaciones-list');
    var state = $('notificaciones-state');
    if (!list || !state) return;
    var items = FE.get('notifications');
    var empty = state.querySelector('[data-empty="true"]');
    state.setAttribute('data-state', items.length === 0 ? 'empty' : 'loading');

    list.innerHTML = items.map(function (n) {
      var cls = n.criticidad === 'alta' ? CRITICAL_STYLE : NORMAL_STYLE;
      var canales = (n.canales || []).map(function (c) {
        return '<span class="material-symbols-outlined text-[14px]" title="' + escapeHtml(c) + '">' + (c === 'email' ? 'mail' : c === 'push' ? 'notifications_active' : 'chat') + '</span>';
      }).join('');
      return (
        '<button data-action="notif-toggle" data-id="' + n.id + '" class="w-full text-left rounded-xl p-lg flex items-start gap-md transition-colors hover:bg-surface-container-low ' + cls + '">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center gap-sm mb-xs">' +
        '<span class="font-label-md text-label-md font-semibold text-on-surface truncate">' + escapeHtml(n.titulo) + '</span>' +
        (n.recordatorio ? '<span class="font-label-sm text-[10px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container uppercase">' + n.recordatorio + '</span>' : '') +
        '</div>' +
        '<p class="font-body-md text-body-md text-sm text-on-surface-variant">' + escapeHtml(n.mensaje) + '</p>' +
        '<div class="flex items-center gap-sm mt-xs font-label-sm text-label-sm text-on-surface-variant">' +
        '<span class="material-symbols-outlined text-[14px]">schedule</span>' + escapeHtml(fmtFecha(n.fecha.slice(0, 10))) +
        '<span class="flex gap-xs ml-sm">' + canales + '</span>' +
        '<span class="ml-auto">' + (n.leida ? 'Leída' : '<strong class="text-primary">Nueva</strong>') + '</span>' +
        '</div>' +
        '</div>' +
        '</button>'
      );
    }).join('');

    if (empty) empty.classList.toggle('hidden', items.length > 0);
    if (items.length > 0) state.setAttribute('data-state', 'empty');
    updateNotifBadges();
  }

  function toggleNotif(id) {
    var item = FE.get('notifications').filter(function (n) { return n.id === id; })[0];
    if (item) FE.update('notifications', id, { leida: !item.leida });
    renderNotificaciones();
  }

  function marcarTodasLeidas() {
    FE.get('notifications').forEach(function (n) {
      if (!n.leida) FE.update('notifications', n.id, { leida: true });
    });
    renderNotificaciones();
    toast('Todas las notificaciones marcadas como leídas.');
  }

  /* ============================================================
     DETALLE (MU-004/005) — galería ≥5, reviews, amenities, extras
     ============================================================ */
  function findService(id) {
    var items = FE.getServices();
    var found = null;
    items.forEach(function (s) { if (s.id === id) found = s; });
    return found;
  }

  function openDetalle(id) {
    servicioActual = findService(id);
    if (!servicioActual) return;
    galleryIndex = 0;
    navigate('detalle');
  }

  function renderGallery() {
    var gallery = $('detail-gallery');
    var dots = $('detail-gallery-dots');
    if (!gallery) return;
    var fotos = (servicioActual.fotos || []).slice(0, 6);
    gallery.innerHTML = fotos.map(function (f, i) {
      return '<img alt="' + escapeHtml(servicioActual.titulo) + ' foto ' + (i + 1) + '" class="w-full h-full object-cover shrink-0 snap-center" src="' + f + '" loading="lazy"/>';
    }).join('');
    if (dots) {
      dots.innerHTML = fotos.map(function (_, i) {
        return '<div class="w-2 h-2 rounded-full ' + (i === galleryIndex ? 'bg-white' : 'bg-white/50') + '"></div>';
      }).join('');
    }
  }

  function shiftGallery(delta) {
    var fotos = (servicioActual.fotos || []).slice(0, 6);
    if (!fotos.length) return;
    galleryIndex = (galleryIndex + delta + fotos.length) % fotos.length;
    var gallery = $('detail-gallery');
    if (gallery) gallery.scrollTo({ left: galleryIndex * gallery.clientWidth, behavior: 'smooth' });
    renderGallery();
  }

  function renderDetalle() {
    var s = servicioActual;
    if (!s) return;

    $('detail-titulo').textContent = s.titulo;
    $('detail-categoria').textContent = s.categoria === 'salones' ? 'Salón' : s.categoria === 'sonido' ? 'Sonido' : 'Servicio';
    $('detail-rating').textContent = String(s.rating);
    $('detail-reviews-count').textContent = '(' + s.reviewsCount + ' reseñas)';
    $('detail-ubicacion').innerHTML = '<span class="material-symbols-outlined text-[16px]">location_on</span> ' + escapeHtml(s.ubicacion);
    $('detail-descripcion').textContent = s.descripcion;

    var amenities = $('detail-amenities');
    amenities.innerHTML = s.amenities.map(function (a) {
      return (
        '<div class="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/30">' +
        '<span class="material-symbols-outlined text-primary text-[24px]">check_circle</span>' +
        '<span class="font-body-md text-body-md text-on-surface">' + escapeHtml(a) + '</span>' +
        '</div>'
      );
    }).join('');

    var extras = $('detail-extras');
    extras.innerHTML = s.extras.map(function (e) {
      return (
        '<label class="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant cursor-pointer hover:bg-surface-container-low transition-colors">' +
        '<div class="flex items-start gap-3">' +
        '<input type="checkbox" data-extra="' + escapeHtml(e.nombre) + '" class="mt-1 w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0"/>' +
        '<div>' +
        '<span class="block font-label-md text-label-md text-on-surface font-semibold">' + escapeHtml(e.nombre) + '</span>' +
        '<span class="block font-body-md text-body-md text-on-surface-variant text-sm">' + escapeHtml(e.descripcion) + '</span>' +
        '</div>' +
        '</div>' +
        '<span class="font-label-md text-label-md text-on-surface">' + (e.precio === 0 ? 'Incluido' : '+$' + (e.porPersona ? e.precio + '/pers' : e.precio)) + '</span>' +
        '</label>'
      );
    }).join('');

    var reviews = $('detail-reviews');
    var revs = FE.getReviews().filter(function (r) { return r.serviceId === s.id; }).slice(0, 3);
    reviews.innerHTML = revs.length
      ? revs.map(function (r) {
          return (
            '<div class="bg-surface-container-lowest rounded-lg border border-outline-variant/40 p-md">' +
            '<div class="flex items-center gap-xs mb-xs">' + stars(r.rating) + '</div>' +
            '<p class="font-body-md text-body-md text-on-surface">' + escapeHtml(r.comentario) + '</p>' +
            '<p class="font-label-sm text-label-sm text-on-surface-variant mt-xs">' + escapeHtml(fmtFecha(r.fecha)) + '</p>' +
            '</div>'
          );
        }).join('')
      : '<p class="font-body-md text-body-md text-on-surface-variant">Aún no hay reseñas para este servicio.</p>';

    $('detail-politica-titulo').textContent = 'Política de Cancelación ' + s.politicas.cancelacion;
    $('detail-politica-copy').textContent = s.politicas.descripcion;

    $('detail-precio').textContent = money(s.precioBase).replace('$', '');
    var mob = $('detail-precio-mob');
    if (mob) mob.textContent = money(s.precioBase) + ' MXN';
    $('detail-modelo').textContent = s.modeloPrecio === 'bloque' ? 'Bloque base:' : s.modeloPrecio === 'hora' ? 'Tarifa por hora:' : 'Paquete:';
    var he = $('detail-hora-extra');
    if (he) he.textContent = s.horaExtra ? money(s.horaExtra) + ' MXN' : (s.modeloPrecio === 'hora' ? money(s.precioBase) + '/hora' : 'Incluida');
    $('reserva-capacidad') && ($('reserva-capacidad').textContent = 'Capacidad: hasta ' + s.capacidad + ' personas.');

    // Slots
    var slots = $('time-slots');
    slots.innerHTML = (s.slots || []).map(function (sl, i) {
      var disabled = i === 2; // demo: el tercer slot aparece como no disponible
      return '<button data-slot' + (disabled ? ' disabled' : '') + ' class="' + (disabled ? 'py-2 px-3 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface-variant opacity-50 bg-surface-container-high text-center cursor-not-allowed' : SLOT_OFF) + '">' + sl + '</button>';
    }).join('');

    // Fecha demo 2026
    var fechaInput = $('detail-fecha');
    if (fechaInput && !fechaInput.value) fechaInput.value = '2026-12-15';

    renderGallery();
    renderDetalleFavState(FE.getFavorites().indexOf(s.id) !== -1);
    if ($('reserva-servicio-nombre')) $('reserva-servicio-nombre').textContent = s.titulo + ' · ' + s.ubicacion;
  }

  /* ============================================================
     RESERVA 6 PASOS (MU-007..09; D-007) — estado en draftReservation
     ============================================================ */
  var PASOS = [
    { n: 1, label: 'Fecha y hora' },
    { n: 2, label: 'Extras' },
    { n: 3, label: 'Resumen' },
    { n: 4, label: 'Pago' },
    { n: 5, label: 'Contrato' },
    { n: 6, label: 'Confirmación' }
  ];

  function getDraft() {
    return FE.getState('draftReservation') || { paso: 1, fechaHora: null, extras: [], datosPago: null, alcoholAceptado: false, tcAceptado: false };
  }

  function setDraft(patch) {
    var draft = getDraft();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) draft[k] = patch[k];
    FE.setState('draftReservation', draft);
    return draft;
  }

  function pasosVisibles() {
    var total = servicioActual && servicioActual.categoria === 'salones' ? 6 : 5;
    return PASOS.filter(function (p) {
      return p.n <= total;
    });
  }

  function renderStepper() {
    var stepper = $('reserva-stepper');
    if (!stepper) return;
    var draft = getDraft();
    var visibles = pasosVisibles();
    stepper.innerHTML = visibles.map(function (p) {
      var estado = p.n < draft.paso ? 'done' : p.n === draft.paso ? 'current' : 'todo';
      var icono = estado === 'done' ? 'check_circle' : String(p.n);
      return (
        '<div class="flex items-center gap-xs shrink-0" aria-current="' + (estado === 'current' ? 'step' : 'false') + '">' +
        '<span class="w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md ' +
        (estado === 'done' ? 'bg-primary text-on-primary' : estado === 'current' ? 'bg-primary-container text-on-primary-container ring-2 ring-primary' : 'bg-surface-container-high text-on-surface-variant') + '">' +
        '<span class="material-symbols-outlined text-[16px]">' + (estado === 'done' ? 'check' : 'radio_button_unchecked') + '</span>' +
        '</span>' +
        '<span class="font-label-sm text-label-sm ' + (estado === 'current' ? 'text-primary font-semibold' : 'text-on-surface-variant') + ' whitespace-nowrap">' + p.label + '</span>' +
        (p.n < visibles.length ? '<span class="material-symbols-outlined text-on-surface-variant/40 text-[16px] mx-xs">chevron_right</span>' : '') +
        '</div>'
      );
    }).join('');
  }

  function mostrarPaso(n) {
    setDraft({ paso: n });
    pasosVisibles().forEach(function (p) {
      var el = $('reserva-paso-' + p.n);
      if (el) el.classList.toggle('hidden', p.n !== n);
    });
    renderStepper();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderResumenReserva() {
    var s = servicioActual;
    if (!s) return;
    var draft = getDraft();
    var extrasSel = (s.extras || []).filter(function (e) { return draft.extras.indexOf(e.nombre) !== -1; });
    var extrasTotal = extrasSel.reduce(function (acc, e) { return acc + (e.precio || 0); }, 0);
    var renta = s.precioBase;
    var impuestos = Math.round((renta + extrasTotal) * 0.16);
    var total = renta + extrasTotal + impuestos;

    var html =
      '<div class="flex justify-between"><span class="text-on-surface-variant">Renta (' + (s.modeloPrecio === 'bloque' ? 'bloque 4h' : s.modeloPrecio) + ')</span><span>' + money(renta) + '</span></div>' +
      (extrasSel.length ? '<div class="flex justify-between"><span class="text-on-surface-variant">Extras (' + extrasSel.length + ')</span><span>' + money(extrasTotal) + '</span></div>' : '') +
      '<div class="flex justify-between"><span class="text-on-surface-variant">IVA (16%)</span><span>' + money(impuestos) + '</span></div>' +
      '<div class="flex justify-between border-t border-outline-variant pt-md font-semibold"><span>Total</span><span class="text-primary">' + money(total) + '</span></div>';
    var cont = $('reserva-resumen');
    if (cont) cont.innerHTML = html;

    var pol = $('reserva-politica');
    if (pol) pol.textContent = s.politicas.descripcion + ' · Retención ' + s.politicas.retencionPct + '% · Depósito ' + money(s.politicas.deposito) + '.';

    var confirmCopy = $('reserva-confirmacion-copy');
    if (confirmCopy) confirmCopy.textContent = 'Tu reserva en ' + s.titulo + ' el ' + (draft.fechaHora ? fmtFecha(draft.fechaHora.fecha) : '') + ' quedó confirmada. El proveedor recibirá una notificación.';
    var confDet = $('reserva-confirmacion-detalle');
    if (confDet) {
      confDet.innerHTML =
        '<div class="flex justify-between"><span class="text-on-surface-variant">Fecha</span><span>' + (draft.fechaHora ? fmtFecha(draft.fechaHora.fecha) : '—') + '</span></div>' +
        '<div class="flex justify-between"><span class="text-on-surface-variant">Horario</span><span>' + (draft.fechaHora ? draft.fechaHora.horario : '—') + '</span></div>' +
        '<div class="flex justify-between"><span class="text-on-surface-variant">Total pagado</span><span>' + money(total) + '</span></div>' +
        '<div class="flex justify-between"><span class="text-on-surface-variant">Estado</span><span class="text-primary font-semibold">Confirmada</span></div>';
    }
  }

  function renderReservaExtras() {
    var cont = $('reserva-extras');
    if (!cont || !servicioActual) return;
    var draft = getDraft();
    cont.innerHTML = servicioActual.extras.map(function (e) {
      var checked = draft.extras.indexOf(e.nombre) !== -1;
      return (
        '<label class="flex items-start justify-between p-4 bg-surface-container-lowest rounded-lg border border-outline-variant cursor-pointer hover:bg-surface-container-low transition-colors">' +
        '<div class="flex items-start gap-3">' +
        '<input type="checkbox" data-reserva-extra="' + escapeHtml(e.nombre) + '" ' + (checked ? 'checked' : '') + ' class="mt-1 w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0"/>' +
        '<div>' +
        '<span class="block font-label-md text-label-md text-on-surface font-semibold">' + escapeHtml(e.nombre) + '</span>' +
        '<span class="block font-body-md text-body-md text-on-surface-variant text-sm">' + escapeHtml(e.descripcion) + '</span>' +
        '</div>' +
        '</div>' +
        '<span class="font-label-md text-label-md text-on-surface">' + (e.precio === 0 ? 'Incluido' : '+$' + e.precio) + '</span>' +
        '</label>'
      );
    }).join('');
  }

  function renderReservaSlots() {
    var cont = $('reserva-slots');
    if (!cont || !servicioActual) return;
    var draft = getDraft();
    var fecha = draft.fechaHora ? draft.fechaHora.fecha : '';
    cont.innerHTML = servicioActual.slots.map(function (sl, i) {
      var sel = draft.fechaHora && draft.fechaHora.horario === sl;
      return '<button type="button" data-reserva-slot data-horario="' + escapeHtml(sl) + '" class="' + (sel ? SLOT_ON : SLOT_OFF) + '">' + sl + '</button>';
    }).join('');
  }

  function validarPaso1() {
    var fecha = $('reserva-fecha').value;
    var sel = document.querySelector('#reserva-slots [data-reserva-slot].border-primary');
    if (!fecha) { toast('Selecciona la fecha del evento.'); return false; }
    if (!sel) { toast('Selecciona un horario disponible.'); return false; }
    setDraft({ fechaHora: { fecha: fecha, horario: sel.dataset.horario } });
    return true;
  }

  function validarPaso4() {
    var name = $('card-name').value.trim();
    var num = $('card-number').value.trim();
    var exp = $('card-expiry').value.trim();
    var cvc = $('card-cvc').value.trim();
    if (!name || !num || !exp || !cvc) { toast('Completa los datos de tu tarjeta.'); return false; }
    setDraft({ datosPago: { nombre: name, ultimos4: num.slice(-4) } });
    return true;
  }

  function reservaConfirmar() {
    var s = servicioActual;
    var draft = getDraft();
    if (!s || !draft.fechaHora) return;
    if (!$('reserva-tc-check').checked) { toast('Debes aceptar los Términos y Condiciones.'); return; }

    var extrasSel = (s.extras || []).filter(function (e) { return draft.extras.indexOf(e.nombre) !== -1; });
    var extrasTotal = extrasSel.reduce(function (acc, e) { return acc + (e.precio || 0); }, 0);
    var renta = s.precioBase;
    var impuestos = Math.round((renta + extrasTotal) * 0.16);
    var total = renta + extrasTotal + impuestos;

    // Persistir reserva vía FEAPI (contrato JWT) en reservations[]
    API.request('reservations', 'create', {
      serviceId: s.id,
      userId: (FE.getCurrentUser() || { id: 'demo-usuario' }).id,
      fecha: draft.fechaHora.fecha,
      horario: draft.fechaHora.horario,
      estado: 'confirmada',
      pago: 'completo',
      alcohol: draft.alcoholAceptado,
      contratoAceptado: s.categoria === 'salones',
      total: total,
      renta: renta,
      impuestos: impuestos,
      extras: extrasTotal,
      reviewDada: false
    }, API.authHeaders()).then(function (res) {
      if (res.error) {
        if (API.handleUnauthorized(res)) return;
        toast('No se pudo confirmar la reserva (demo).');
        return;
      }
      // Limpia el draft
      FE.setState('draftReservation', { paso: 1, fechaHora: null, extras: [], datosPago: null, alcoholAceptado: false, tcAceptado: false });
      toast('Reserva confirmada.');
      navigate('rentas');
    });
  }

  function iniciarReserva() {
    var s = servicioActual;
    if (!s) return;
    // Reinicia el draft si no hay fecha seleccionada aún
    var draft = getDraft();
    if (!draft.fechaHora) {
      setDraft({ paso: 1, fechaHora: null, extras: [], datosPago: null, alcoholAceptado: false, tcAceptado: false });
    }
    // Copia la fecha/horario del detalle si ya se eligió
    var detFecha = $('detail-fecha') ? $('detail-fecha').value : '';
    var detSlot = document.querySelector('#time-slots [data-slot].border-primary');
    if (detFecha && detSlot && !draft.fechaHora) {
      setDraft({ fechaHora: { fecha: detFecha, horario: detSlot.textContent } });
    }
    renderReservaSlots();
    renderReservaExtras();
    renderResumenReserva();
    mostrarPaso(1);
    navigate('reserva');
  }

  /* ============================================================
     RENTAS (MU-010/011) — 4 tabs + detalle + cancelación
     ============================================================ */
  var rentaTab = 'activas';

  function selectRentaTab(button) {
    rentaTab = button.dataset.tab;
    document.querySelectorAll('.renta-tab').forEach(function (t) {
      var on = t === button;
      t.classList.toggle('text-primary', on);
      t.classList.toggle('border-b-2', on);
      t.classList.toggle('border-primary', on);
      t.classList.toggle('text-on-surface-variant', !on);
    });
    renderRentas(rentaTab);
  }

  function renderRentas(tab) {
    var grid = $('rentas-grid');
    var vacio = $('rentas-vacio');
    var state = $('rentas-state');
    if (!grid) return;
    var tabId = tab || rentaTab;
    var servicios = FE.getServices();
    var all = FE.getReservations();
    // Mapeo tab → estado canónico del store (MU-010): los tabs usan
    // activas/en-curso/completadas/canceladas; reservations[] usa
    // confirmada/en_curso/completada/cancelada.
    var TAB_ESTADO = { activas: 'confirmada', 'en-curso': 'en_curso', completadas: 'completada', canceladas: 'cancelada' };
    var estadoFiltro = TAB_ESTADO[tabId] || tabId;
    var items = all.filter(function (r) { return r.estado === estadoFiltro; });
    var empty = state ? state.querySelector('[data-empty="true"]') : null;
    if (state) state.setAttribute('data-state', items.length === 0 ? 'empty' : 'loading');

    grid.innerHTML = items.map(function (r) {
      var s = null;
      servicios.forEach(function (sv) { if (sv.id === r.serviceId) s = sv; });
      var nombre = s ? s.titulo : 'Servicio';
      var foto = s && s.fotos && s.fotos[0] ? s.fotos[0] : '';
      var statusLabel = r.estado === 'confirmada' ? 'Confirmada' : r.estado === 'en_curso' ? 'En curso' : r.estado === 'completada' ? 'Completada' : 'Cancelada';
      var statusCls = r.estado === 'cancelada' ? 'text-outline' : 'text-primary';
      var revisable = r.estado === 'completada' && r.pago === 'completo' && new Date(r.fecha + 'T12:00:00') < new Date();
      return (
        '<article data-reserva-card data-id="' + r.id + '" class="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-surface-variant overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-shadow duration-300 flex flex-col cursor-pointer">' +
        '<div class="relative h-48 w-full bg-surface-container">' +
        (foto ? '<img alt="' + escapeHtml(nombre) + '" class="object-cover w-full h-full" src="' + foto + '" loading="lazy"/>' : '<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-[40px] text-on-surface-variant">event</span></div>') +
        '<div class="absolute top-sm right-sm bg-surface-container-lowest/90 backdrop-blur-sm px-3 py-1 rounded-full border border-surface-variant">' +
        '<span class="font-label-sm text-label-sm flex items-center gap-1 ' + statusCls + '"><span class="material-symbols-outlined text-[16px]">' + (r.estado === 'cancelada' ? 'cancel' : 'check_circle') + '</span> ' + statusLabel + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="p-md flex-1 flex flex-col">' +
        '<h3 class="font-headline-md text-[20px] leading-tight text-on-surface mb-xs">' + escapeHtml(nombre) + '</h3>' +
        '<div class="flex flex-col gap-xs mb-md text-on-surface-variant font-body-md text-[14px]">' +
        '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">event</span><span>' + escapeHtml(fmtFecha(r.fecha)) + '</span></div>' +
        '<div class="flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">schedule</span><span>' + escapeHtml(r.horario) + '</span></div>' +
        '</div>' +
        '<div class="mt-auto pt-sm border-t border-surface-variant flex justify-between items-center">' +
        '<span class="font-label-md text-label-md text-on-surface-variant">Total</span>' +
        '<span class="font-headline-md text-[18px] text-on-surface">' + money(r.total) + ' MXN</span>' +
        '</div>' +
        '<div class="mt-md flex gap-sm">' +
        '<button data-action="reserva-ver" data-id="' + r.id + '" class="flex-1 bg-surface-container-lowest border border-primary text-primary hover:bg-primary-fixed/20 font-label-md text-label-md py-2.5 rounded-lg transition-colors">Ver detalle</button>' +
        '</div>' +
        '</div>' +
        '</article>'
      );
    }).join('');

    if (vacio) vacio.classList.toggle('hidden', items.length > 0);
    if (state && items.length > 0) state.setAttribute('data-state', 'empty');
  }

  function renderReservaDetalle(id) {
    var r = null;
    FE.getReservations().forEach(function (x) { if (x.id === id) r = x; });
    if (!r) return;
    var s = null;
    FE.getServices().forEach(function (sv) { if (sv.id === r.serviceId) s = sv; });
    var revisable = r.estado === 'completada' && r.pago === 'completo' && new Date(r.fecha + 'T12:00:00') < new Date();

    var body = $('reserva-detalle-body');
    body.innerHTML =
      '<div class="flex items-center gap-md">' +
      (s && s.fotos && s.fotos[0] ? '<img class="w-16 h-16 rounded-lg object-cover" src="' + s.fotos[0] + '" alt=""/>' : '') +
      '<div>' +
      '<h3 class="font-headline-md text-[20px] text-on-surface">' + escapeHtml(s ? s.titulo : 'Servicio') + '</h3>' +
      '<p class="font-body-md text-body-md text-sm text-on-surface-variant">' + escapeHtml(fmtFecha(r.fecha)) + ' · ' + escapeHtml(r.horario) + '</p>' +
      '</div>' +
      '</div>' +
      '<div class="grid grid-cols-2 gap-md font-body-md text-body-md">' +
      '<div class="bg-surface-container-low rounded-lg p-md"><p class="font-label-sm text-label-sm text-on-surface-variant">Estado</p><p class="font-semibold text-on-surface">' + escapeHtml(r.estado) + '</p></div>' +
      '<div class="bg-surface-container-low rounded-lg p-md"><p class="font-label-sm text-label-sm text-on-surface-variant">Pago</p><p class="font-semibold text-on-surface">' + escapeHtml(r.pago) + '</p></div>' +
      '<div class="bg-surface-container-low rounded-lg p-md"><p class="font-label-sm text-label-sm text-on-surface-variant">Total</p><p class="font-semibold text-primary">' + money(r.total) + '</p></div>' +
      '<div class="bg-surface-container-low rounded-lg p-md"><p class="font-label-sm text-label-sm text-on-surface-variant">Alcohol</p><p class="font-semibold text-on-surface">' + (r.alcohol ? 'Sí (permiso)' : 'No') + '</p></div>' +
      '</div>' +
      (r.reembolso ? '<div class="bg-surface-container-low rounded-lg p-md"><p class="font-label-sm text-label-sm text-on-surface-variant">Reembolso</p><p class="font-body-md text-body-md text-sm text-on-surface">' + escapeHtml(r.reembolso) + '</p></div>' : '') +
      (revisable
        ? '<button data-action="reserva-calificar" data-id="' + r.id + '" class="w-full bg-primary text-on-primary font-label-md text-label-md px-lg py-3 rounded-lg hover:bg-primary-container transition-colors flex items-center justify-center gap-2"><span class="material-symbols-outlined text-[18px]">star_rate</span> Calificar</button>'
        : '<div class="bg-surface-container-low rounded-lg p-md text-center"><span class="font-label-sm text-[11px] text-on-surface-variant flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[14px]">info</span> ' + (r.estado === 'completada' && r.pago !== 'completo' ? 'Disponible después del pago completo' : 'Calificación disponible después del evento') + '</span></div>') +
      (r.estado === 'confirmada' || r.estado === 'en_curso'
        ? '<button data-action="reserva-cancelar" data-id="' + r.id + '" class="w-full bg-surface-container-lowest border border-error text-error font-label-md text-label-md px-lg py-3 rounded-lg hover:bg-error-container transition-colors">Cancelar reserva</button>'
        : '');
    openModal('reserva-detalle-modal');
  }

  function abrirCancelar(id) {
    var r = null;
    FE.getReservations().forEach(function (x) { if (x.id === id) r = x; });
    if (!r) return;
    var s = null;
    FE.getServices().forEach(function (sv) { if (sv.id === r.serviceId) s = sv; });
    var pol = s && s.politicas ? s.politicas : { retencionPct: 50, descripcion: '' };
    $('cancelar-politica').textContent = pol.descripcion || 'Retención del ' + pol.retencionPct + '% sobre el total.';
    var reemb = r.pago === 'completo'
      ? 'Reembolso estimado: ' + money(Math.round(r.total * (100 - pol.retencionPct) / 100)) + ' (' + (100 - pol.retencionPct) + '% del total).'
      : 'No se procesará reembolso: el pago está pendiente.';
    $('cancelar-reembolso').textContent = reemb;
    $('cancelar-accept').checked = false;
    openModal('cancelar-modal');
  }

  function confirmarCancelacion() {
    if (!$('cancelar-accept').checked) { toast('Debes aceptar la política de retención para cancelar.'); return; }
    var btn = document.querySelector('[data-action="cancelar-confirmar"]');
    var id = btn ? btn.dataset.id : null;
    if (!id) {
      // Última reserva marcada: re-deriva del modal abierto
      var card = document.querySelector('[data-reserva-card]');
      id = card ? card.dataset.id : null;
    }
    closeModal('cancelar-modal');
    toast('Reserva cancelada. Revisa el estado del reembolso en tu detalle.');
    renderRentas(rentaTab);
  }

  function calificarReserva(id) {
    var r = null;
    FE.getReservations().forEach(function (x) { if (x.id === id) r = x; });
    if (r) FE.update('reservations', id, { reviewDada: true });
    closeModal();
    toast('¡Gracias por tu reseña! (demo)');
    renderRentas(rentaTab);
  }

  /* ============================================================
     CHAT (MU-012..15) — lista + hilo + voz + llamada
     ============================================================ */
  var chatConvActual = null;
  var voiceTimer = null;
  var voiceSeconds = 0;
  var callTimer = null;

  function chatConversaciones() {
    var u = FE.getCurrentUser() || { id: 'demo-usuario' };
    return FE.get('conversations').filter(function (c) {
      return c.participantes.indexOf(u.id) !== -1;
    });
  }

  function renderChatList() {
    var list = $('chat-list-items');
    var vacio = $('chat-list-vacio');
    if (!list) return;
    var convs = chatConversaciones();
    list.innerHTML = convs.map(function (c) {
      var rowActive = chatConvActual && chatConvActual.id === c.id;
      return (
        '<button type="button" data-thread-id="' + c.id + '" class="w-full flex items-start gap-md px-lg py-md text-left border-b border-outline-variant/50 transition-colors ' +
        (rowActive ? 'bg-surface-container-low' : 'hover:bg-surface-container-low') + '">' +
        '<span class="w-10 h-10 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 font-label-md text-label-md">' + escapeHtml((c.titulo || 'S').slice(0, 1).toUpperCase()) + '</span>' +
        '<span class="flex-1 min-w-0">' +
        '<span class="block font-label-md text-label-md text-on-surface font-semibold truncate">' + escapeHtml(c.titulo) + '</span>' +
        '<span class="block font-body-md text-body-md text-on-surface-variant truncate">' + escapeHtml(c.ultimoMensaje || '') + '</span>' +
        '</span>' +
        (c.noLeidos > 0 ? '<span class="shrink-0 bg-error text-on-error font-label-sm text-[10px] px-2 py-0.5 rounded-full">' + c.noLeidos + '</span>' : '') +
        '</button>'
      );
    }).join('');
    if (vacio) vacio.classList.toggle('hidden', convs.length > 0);
  }

  function selectChatThread(id) {
    var conv = null;
    FE.get('conversations').forEach(function (c) { if (c.id === id) conv = c; });
    if (!conv) return;
    chatConvActual = conv;
    FE.update('conversations', id, { noLeidos: 0 });
    renderChatList();
    renderChatThread();
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

  function renderChatThread() {
    var conv = chatConvActual;
    var title = $('chat-thread-title');
    var subject = $('chat-thread-subject');
    var messagesEl = $('chat-messages');
    if (!title || !messagesEl) return;

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
    subject.textContent = 'Proveedor de ' + conv.titulo;
    var u = FE.getCurrentUser() || { id: 'demo-usuario' };
    messagesEl.innerHTML = mensajesDe(conv.id).map(function (m) {
      var sent = m.de !== u.id && m.de !== (u.rol === 'usuario' ? 'proveedor' : 'usuario') && (m.de === 'usuario' || m.de === 'proveedor')
        ? false
        : m.de === (u.rol === 'usuario' ? 'usuario' : 'proveedor');
      var isMine = (u.rol === 'usuario' && m.de === 'usuario') || (u.rol === 'proveedor' && m.de === 'proveedor');
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

  function sendChatMessage() {
    var conv = chatConvActual;
    var input = $('chat-input');
    if (!conv || !input) return;
    var text = input.value.trim();
    if (!text) return;
    var u = FE.getCurrentUser() || { id: 'demo-usuario' };
    var de = u.rol === 'usuario' ? 'usuario' : 'proveedor';
    var msg = { id: 'msg-' + Date.now(), convId: conv.id, de: de, texto: text, leido: false, leidoEn: null };
    FE.set('messages', msg);
    FE.update('conversations', conv.id, { ultimoMensaje: text });
    input.value = '';
    renderChatThread();

    // Respuesta simulada temporizada (real-time simulado; MU-012)
    var respuestas = [
      'Gracias por tu mensaje, te confirmo en breve.',
      'Claro, con gusto te ayudo con esa consulta.',
      'Perfecto, queda registrado. ¿Algo más?',
      'Te comparto la disponibilidad más adelante hoy.'
    ];
    setTimeout(function () {
      var resp = respuestas[Math.floor(Math.random() * respuestas.length)];
      var deOtro = de === 'usuario' ? 'proveedor' : 'usuario';
      var nuevo = { id: 'msg-' + Date.now(), convId: conv.id, de: deOtro, texto: resp, leido: false, leidoEn: null };
      FE.set('messages', nuevo);
      // Marca el anterior como leído
      var msgs = mensajesDe(conv.id);
      var last = msgs[msgs.length - 2];
      if (last) FE.update('messages', last.id, { leido: true, leidoEn: new Date().toISOString() });
      renderChatThread();
    }, 1400);
  }

  /* ---------- Notas de voz ≤2 min (MU-013) ---------- */
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
    if (voiceSeconds >= 2 && chatConvActual) {
      var u = FE.getCurrentUser() || { id: 'demo-usuario' };
      var de = u.rol === 'usuario' ? 'usuario' : 'proveedor';
      var duracion = Math.min(voiceSeconds, 120);
      var msg = { id: 'msg-' + Date.now(), convId: chatConvActual.id, de: de, notaVoz: { duracionSec: duracion }, leido: false, leidoEn: null };
      FE.set('messages', msg);
      FE.update('conversations', chatConvActual.id, { ultimoMensaje: 'Nota de voz (' + duracion + 's)' });
      renderChatThread();
    }
  }

  /* ---------- Llamada simulada Agora (MU-015) ---------- */
  function callStart() {
    if (!chatConvActual) return;
    $('call-titulo').textContent = chatConvActual.titulo;
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

  /* ============================================================
     NORMATIVA UX (MU-017/018) — consentimiento, cookies, ARCO, verificación
     ============================================================ */
  function primerUso() {
    var u = FE.getCurrentUser();
    if (u && !u.consentPrivacidad) {
      openModal('privacidad-modal');
    } else if (u && u.cookiePref === undefined) {
      var b = $('cookies-banner');
      if (b) b.classList.remove('hidden');
    }
  }

  function aceptarPrivacidad() {
    var u = FE.getCurrentUser();
    if (!$('privacidad-accept').checked) { toast('Debes aceptar el aviso de privacidad.'); return; }
    var user = FE.get('users').filter(function (x) { return x.id === u.id; })[0] || u;
    FE.update('users', user.id, { consentPrivacidad: true });
    closeModal('privacidad-modal');
    var b = $('cookies-banner');
    if (b) b.classList.remove('hidden');
  }

  function cookiesSet(pref) {
    var u = FE.getCurrentUser();
    if (u) {
      var user = FE.get('users').filter(function (x) { return x.id === u.id; })[0];
      if (user) FE.update('users', user.id, { cookiePref: pref });
    }
    var b = $('cookies-banner');
    if (b) b.classList.add('hidden');
    toast(pref === 'aceptadas' ? 'Preferencias de cookies guardadas.' : 'Se usarán solo cookies necesarias.');
  }

  function enviarARCO() {
    var derecho = $('arco-derecho').value;
    var correo = $('arco-correo').value.trim();
    var motivo = $('arco-motivo').value.trim();
    var err = $('arco-error');
    if (!correo || !motivo) {
      if (err) { err.textContent = 'Completa el correo y la descripción de tu solicitud.'; err.classList.remove('hidden'); }
      return;
    }
    if (err) err.classList.add('hidden');
    closeModal('arco-modal');
    toast('Solicitud ARCO (' + derecho + ') enviada. Te contactaremos en 15 días hábiles.');
  }

  function verificarCapturar() {
    if (!$('verificar-consent').checked) { toast('Debes aceptar el consentimiento.'); return; }
    $('verificar-paso-1').classList.add('hidden');
    $('verificar-paso-2').classList.remove('hidden');
  }

  function verificarEnviar() {
    $('verificar-paso-2').classList.add('hidden');
    $('verificar-paso-3').classList.remove('hidden');
    var u = FE.getCurrentUser();
    if (u) FE.update('users', u.id, { verificado: true, badges: ['identidad-verificada'] });
    renderPerfil();
  }

  /* ============================================================
     PERFIL (sesión)
     ============================================================ */
  function renderPerfil(user) {
    var u = user || FE.getCurrentUser();
    if (!u) return;
    var nombreEl = $('perfil-nombre');
    var emailEl = $('perfil-email');
    if (nombreEl && u.nombre) nombreEl.textContent = u.nombre;
    if (emailEl && u.email) emailEl.textContent = u.email;

    var verificado = !!u.verificado;
    var badge = $('perfil-badge');
    if (badge) {
      badge.classList.toggle('inline-flex', verificado);
      badge.classList.toggle('hidden', !verificado);
    }
    var estado = $('perfil-estado');
    if (estado) estado.textContent = verificado ? 'Estado: Verificada' : 'Estado: Pendiente';
    updateNotifBadges();
  }

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action], [data-nav], [data-open-detail], [data-slot], [data-category], [data-chip-close], [data-fav], [data-tab], [data-thread-id], [data-reserva-slot], [data-reserva-card], [data-extra], [data-reserva-extra]');
    if (!target) return;

    if (target.hasAttribute('data-nav')) {
      event.preventDefault();
      navigate(target.dataset.nav);
      return;
    }

    if (target.hasAttribute('data-open-detail')) {
      openDetalle(target.dataset.id);
      return;
    }

    if (target.hasAttribute('data-fav')) {
      event.preventDefault();
      event.stopPropagation();
      toggleFav(target.dataset.id);
      return;
    }

    if (target.hasAttribute('data-category')) {
      selectCategory(target);
      return;
    }

    if (target.hasAttribute('data-chip-close')) {
      target.remove();
      return;
    }

    if (target.hasAttribute('data-tab')) {
      selectRentaTab(target);
      return;
    }

    if (target.hasAttribute('data-slot')) {
      document.querySelectorAll('#time-slots [data-slot]').forEach(function (slot) {
        slot.className = SLOT_OFF;
      });
      target.className = SLOT_ON;
      return;
    }

    if (target.hasAttribute('data-reserva-slot')) {
      document.querySelectorAll('#reserva-slots [data-reserva-slot]').forEach(function (slot) {
        slot.className = SLOT_OFF;
      });
      target.className = SLOT_ON;
      return;
    }

    if (target.hasAttribute('data-thread-id')) {
      selectChatThread(target.dataset.threadId);
      return;
    }

    if (target.hasAttribute('data-reserva-card')) {
      renderReservaDetalle(target.dataset.id);
      return;
    }

    var action = target.dataset.action;
    switch (action) {
      case 'focus-search':
        var input = $('search-input') || $('busqueda-input');
        if (input) input.focus();
        break;
      case 'back-inicio':
        navigate('inicio');
        break;
      case 'rentar':
        iniciarReserva();
        break;
      case 'contactar':
        if (servicioActual) {
          // Asegura conversación con el proveedor del servicio
          var convs = FE.get('conversations');
          var conv = null;
          convs.forEach(function (c) { if (c.servicioId === servicioActual.id && c.clienteId === (FE.getCurrentUser() || { id: 'demo-usuario' }).id) conv = c; });
          if (conv) {
            chatConvActual = conv;
            navigate('chat');
            selectChatThread(conv.id);
          } else {
            navigate('chat');
            selectChatThread(convs[0] ? convs[0].id : null);
          }
        } else {
          navigate('chat');
        }
        break;
      case 'modal-close':
        closeModal('alcohol-modal');
        break;
      case 'modal-continuar':
        setDraft({ alcoholAceptado: true });
        closeModal('alcohol-modal');
        toast('Reserva continúa sin alcohol.');
        // Tras confirmar el pago con alcohol aceptado → contrato (salón) o confirmación
        if (servicioActual && servicioActual.categoria === 'salones') {
          mostrarPaso(5);
        } else {
          mostrarPaso(6);
        }
        break;
      case 'modal-cancelar':
        closeModal('alcohol-modal');
        toast('Cancelar reserva: aplica la política de cancelación del proveedor.');
        mostrarPaso(3);
        break;
      case 'limpiar':
        clearSearch();
        navigate('inicio');
        break;
      case 'leer-mas':
        var p = $('detail-descripcion');
        if (p) p.classList.remove('text-clamp-3');
        target.remove();
        break;
      case 'gallery-prev':
        shiftGallery(-1);
        break;
      case 'gallery-next':
        shiftGallery(1);
        break;
      case 'detail-fav':
        if (servicioActual) toggleFav(servicioActual.id);
        break;
      case 'ir-inicio':
        navigate('inicio');
        break;
      case 'ir-notificaciones':
        navigate('notificaciones');
        break;
      case 'fav-ordenar':
        toast('Orden de favoritos guardado (demo).');
        break;

      /* Reserva */
      case 'reserva-back':
        navigate('detalle');
        break;
      case 'reserva-prev':
        var dPrev = getDraft();
        mostrarPaso(Math.max(1, dPrev.paso - 1));
        break;
      case 'reserva-next':
        var d = getDraft();
        var sig = d.paso + 1;
        if (d.paso === 1 && !validarPaso1()) return;
        if (d.paso === 5) {
          if (!$('reserva-contrato-check').checked) { toast('Debes confirmar el contrato físico.'); return; }
        }
        // Salta contrato si no es salón
        var visibles = pasosVisibles();
        if (servicioActual && servicioActual.categoria !== 'salones' && sig === 5) sig = 6;
        if (sig <= visibles.length) mostrarPaso(sig);
        break;
      case 'reserva-pagar':
        if (validarPaso4()) {
          // MU-009: prompt de alcohol antes del contrato (sin cancelación automática)
          var dPag = getDraft();
          if (!dPag.alcoholAceptado) {
            openModal('alcohol-modal');
          } else if (servicioActual && servicioActual.categoria === 'salones') {
            mostrarPaso(5);
          } else {
            mostrarPaso(6);
          }
        }
        break;
      case 'reserva-confirmar':
        reservaConfirmar();
        break;
      case 'abrir-tc':
        openModal('tc-modal');
        break;
      case 'tc-cerrar':
        closeModal('tc-modal');
        break;

      /* Rentas */
      case 'reserva-ver':
        renderReservaDetalle(target.dataset.id);
        break;
      case 'reserva-cancelar':
        abrirCancelar(target.dataset.id);
        break;
      case 'cancelar-cerrar':
        closeModal('cancelar-modal');
        break;
      case 'cancelar-confirmar':
        if (!$('cancelar-accept').checked) { toast('Debes aceptar la política de retención.'); return; }
        var idCanc = document.querySelector('#cancelar-modal');
        // re-deriva del detalle abierto
        var modalDet = $('reserva-detalle-modal');
        var cancelBtn = modalDet ? modalDet.querySelector('[data-action="reserva-cancelar"]') : null;
        if (cancelBtn) {
          FE.getReservations().forEach(function (x) { if (x.id === cancelBtn.dataset.id) x.estado = 'cancelada'; });
          var r2 = null;
          FE.getReservations().forEach(function (x) { if (x.id === cancelBtn.dataset.id) r2 = x; });
          if (r2) FE.update('reservations', r2.id, { estado: 'cancelada', reembolso: 'Reembolso parcial según política del proveedor (demo).' });
        }
        closeModal('cancelar-modal');
        closeModal('reserva-detalle-modal');
        toast('Reserva cancelada.');
        renderRentas(rentaTab);
        break;
      case 'reserva-calificar':
        calificarReserva(target.dataset.id);
        break;

      /* Chat */
      case 'chat-back':
        resetChatMobile();
        break;
      case 'chat-send':
        sendChatMessage();
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

      /* Notificaciones */
      case 'notif-toggle':
        toggleNotif(target.dataset.id);
        break;
      case 'notif-marcar-todas':
        marcarTodasLeidas();
        break;

      /* Normativa UX */
      case 'privacidad-aceptar':
        aceptarPrivacidad();
        break;
      case 'cookies-aceptar':
        cookiesSet('aceptadas');
        break;
      case 'cookies-rechazar':
        cookiesSet('necesarias');
        break;
      case 'abrir-arco':
        openModal('arco-modal');
        break;
      case 'arco-cerrar':
        closeModal('arco-modal');
        break;
      case 'arco-enviar':
        enviarARCO();
        break;
      case 'abrir-verificar':
        $('verificar-paso-1').classList.remove('hidden');
        $('verificar-paso-2').classList.add('hidden');
        $('verificar-paso-3').classList.add('hidden');
        openModal('verificar-modal');
        break;
      case 'verificar-cerrar':
        closeModal('verificar-modal');
        break;
      case 'verificar-capturar':
        verificarCapturar();
        break;
      case 'verificar-enviar':
        verificarEnviar();
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

  document.addEventListener('input', function (event) {
    if (event.target.id === 'search-input' || event.target.id === 'busqueda-input') {
      renderServices();
    }
    if (event.target.hasAttribute('data-reserva-extra')) {
      var draft = getDraft();
      var extras = draft.extras.slice();
      var idx = extras.indexOf(event.target.dataset.reservaExtra);
      if (event.target.checked && idx === -1) extras.push(event.target.dataset.reservaExtra);
      if (!event.target.checked && idx !== -1) extras.splice(idx, 1);
      setDraft({ extras: extras });
      renderResumenReserva();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Enter' && event.target && event.target.id === 'chat-input') {
      event.preventDefault();
      sendChatMessage();
    }
  });

  /* ---------- Re-render tras login/registro (fe:session-changed) ---------- */
  document.addEventListener('fe:session-changed', function (event) {
    renderPerfil(event.detail);
    renderServices();
    updateNotifBadges();
    primerUso();
  });

  /* ---------- 401 → login (FEAPI delegado a auth.js) ---------- */

  /* ---------- Init ----------
     El gate de auth.js está visible al cargar si no hay sesión; los
     requests protegidos NO se lanzan sin sesión (evita que el 401 del
     render inicial limpie la sesión recién creada tras el login). */
  if (FE.getCurrentUser()) {
    renderServices();
  }
  updateNotifBadges();
  renderPerfil();
  navigate('inicio');
  primerUso();
})();
