/* ============================================
   FiestaExpert — SPA Cliente (Vanilla JS)
   Router + interacciones de la experiencia de
   usuario. Sin frameworks.
   ============================================ */
(function () {
  'use strict';

  /* ---------- Configuración de pantallas ---------- */
  const SCREENS = {
    inicio: { title: 'FiestaExpert - Inicio' },
    busqueda: { title: 'FiestaExpert - Búsqueda sin resultados' },
    detalle: { title: 'Salón Las Palmas - Detalle de Servicio' },
    reserva: { title: 'Resumen de Reserva - FiestaExpert' },
    rentas: { title: 'Mis Rentas - FiestaExpert' },
    perfil: { title: 'Perfil del Cliente' },
    favoritos: { title: 'Favoritos' },
    chat: { title: 'Chat' }
  };

  // Pantallas que ocultan el shell global (header/bottom-nav), como en las demos.
  const SUB_SCREENS = ['detalle', 'reserva'];

  const CLASSES = {
    MOB_ON: ['text-primary', 'bg-primary-fixed', 'rounded-full', 'px-4', 'py-1', 'scale-90'],
    MOB_OFF: ['text-on-surface-variant', 'hover:text-primary'],
    DESK_ON: ['text-primary', 'font-bold', 'bg-primary-fixed/20'],
    DESK_OFF: ['text-on-surface-variant', 'hover:bg-surface-container-low']
  };

  let current = 'inicio';

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);

  function allScreens() {
    return Array.prototype.slice.call(document.querySelectorAll('.screen'));
  }

  function desktopNavItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#app-desktopnav [data-nav]'));
  }

  function mobileNavItems() {
    return Array.prototype.slice.call(document.querySelectorAll('#app-bottomnav [data-nav]'));
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
  }

  function updateNavState() {
    mobileNavItems().forEach(function (item) {
      const active = item.dataset.nav === current;
      item.classList.remove.apply(item.classList, CLASSES.MOB_ON.concat(CLASSES.MOB_OFF));
      const icon = item.querySelector('.nav-icon');
      const label = item.querySelector('.nav-label');
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
      const active = item.dataset.nav === current;
      item.classList.remove.apply(item.classList, CLASSES.DESK_ON.concat(CLASSES.DESK_OFF));
      const icon = item.querySelector('.nav-icon');
      if (active) {
        item.classList.add.apply(item.classList, CLASSES.DESK_ON);
        if (icon) icon.style.fontVariationSettings = "'FILL' 1";
      } else {
        item.classList.add.apply(item.classList, CLASSES.DESK_OFF);
        if (icon) icon.style.fontVariationSettings = "'FILL' 0";
      }
    });
  }

  /* ---------- Modal de alcohol ---------- */
  function openModal() {
    $('alcohol-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    $('alcohol-modal').classList.add('hidden');
    document.body.style.overflow = '';
  }

  /* ---------- Toast ---------- */
  function toast(message) {
    const t = $('toast');
    t.textContent = message;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () {
      t.classList.add('hidden');
    }, 2600);
  }

  /* ---------- Búsqueda ---------- */
  function applySearch(query) {
    const q = query.trim().toLowerCase();
    const cards = document.querySelectorAll('[data-card]');
    let visible = 0;
    cards.forEach(function (card) {
      const name = (card.dataset.card || '').toLowerCase();
      const show = !q || name.indexOf(q) !== -1;
      card.classList.toggle('hidden', !show);
      if (show) visible += 1;
    });
    return visible;
  }

  function syncSearchFrom(input) {
    const other = input.id === 'search-input' ? $('busqueda-input') : $('search-input');
    if (other) other.value = input.value;
  }

  function handleSearchInput(input) {
    const query = input.value;
    syncSearchFrom(input);
    const visible = applySearch(query);
    if (query.trim() && visible === 0) {
      navigate('busqueda');
    } else if (visible > 0 && current === 'busqueda') {
      navigate('inicio');
    }
  }

  function clearSearch() {
    if ($('search-input')) $('search-input').value = '';
    if ($('busqueda-input')) $('busqueda-input').value = '';
    applySearch('');
  }

  /* ---------- Favorito (corazón) ---------- */
  function toggleFav(button) {
    const icon = button.querySelector('.material-symbols-outlined');
    const active = button.classList.toggle('text-error');
    if (icon) icon.style.fontVariationSettings = active ? "'FILL' 1" : "'FILL' 0";
  }

  /* ---------- Segment chips ---------- */
  const SEGMENT_ON =
    'whitespace-nowrap px-6 py-2 rounded-full bg-primary text-on-primary font-label-md shadow-sm';
  const SEGMENT_OFF =
    'whitespace-nowrap px-6 py-2 rounded-full bg-surface-container-lowest border border-outline-variant text-on-surface-variant font-label-md hover:bg-surface-container-low transition-colors';

  function selectSegment(button) {
    document.querySelectorAll('[data-segment]').forEach(function (seg) {
      seg.className = seg === button ? SEGMENT_ON : SEGMENT_OFF;
    });
  }

  /* ---------- Leer más ---------- */
  function expandDescription(button) {
    const container = $('description-container');
    if (!container) return;
    const paragraph = container.querySelector('p');
    if (paragraph) paragraph.classList.remove('text-clamp-3');
    button.remove();
  }

  /* ---------- Horarios ---------- */
  const SLOT_OFF =
    'py-2 px-3 border border-outline-variant rounded-lg font-label-md text-label-md text-on-surface text-center hover:bg-surface-container-low transition-colors';
  const SLOT_ON =
    'py-2 px-3 border-2 border-primary bg-primary/5 rounded-lg font-label-md text-label-md text-primary font-semibold text-center transition-colors';

  function selectSlot(button) {
    const slots = document.querySelectorAll('#time-slots [data-slot]');
    slots.forEach(function (slot) {
      slot.className = SLOT_OFF;
    });
    button.className = SLOT_ON;
  }

  /* ---------- Tabs de rentas ---------- */
  function selectRentaTab(button) {
    const tab = button.dataset.tab;
    document.querySelectorAll('.renta-tab').forEach(function (t) {
      const on = t === button;
      t.classList.toggle('text-primary', on);
      t.classList.toggle('border-b-2', on);
      t.classList.toggle('border-primary', on);
      t.classList.toggle('text-on-surface-variant', !on);
    });
    let any = false;
    document.querySelectorAll('[data-tab-group]').forEach(function (group) {
      const show = group.dataset.tabGroup === tab;
      group.classList.toggle('hidden', !show);
      if (show) any = true;
    });
    $('rentas-vacio').classList.toggle('hidden', any);
  }

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-action], [data-nav], [data-open-detail], [data-slot], [data-segment], [data-chip-close], [data-fav], [data-tab]');
    if (!target) return;

    // Navegación (nav desktop / bottom-nav)
    if (target.hasAttribute('data-nav')) {
      event.preventDefault();
      navigate(target.dataset.nav);
      return;
    }

    // Abrir detalle desde tarjeta de servicio
    if (target.hasAttribute('data-open-detail')) {
      navigate('detalle');
      return;
    }

    // Horarios
    if (target.hasAttribute('data-slot')) {
      selectSlot(target);
      return;
    }

    // Segment chips
    if (target.hasAttribute('data-segment')) {
      selectSegment(target);
      return;
    }

    // Cerrar chip de filtro activo
    if (target.hasAttribute('data-chip-close')) {
      target.remove();
      return;
    }

    // Favorito
    if (target.hasAttribute('data-fav')) {
      target.closest('button') && toggleFav(target.closest('button'));
      return;
    }

    // Tabs de rentas
    if (target.hasAttribute('data-tab')) {
      selectRentaTab(target);
      return;
    }

    const action = target.dataset.action;
    switch (action) {
      case 'focus-search':
        const input = $('search-input') || $('busqueda-input');
        if (input) input.focus();
        break;
      case 'back-inicio':
        navigate('inicio');
        break;
      case 'back-detalle':
        navigate('detalle');
        break;
      case 'rentar':
        navigate('reserva');
        break;
      case 'contactar':
        navigate('chat');
        break;
      case 'open-alcohol':
        openModal();
        break;
      case 'modal-close':
        closeModal();
        break;
      case 'modal-continuar':
        closeModal();
        toast('Reserva confirmada sin alcohol.');
        navigate('rentas');
        break;
      case 'modal-cancelar':
        closeModal();
        toast('Reserva cancelada.');
        navigate('inicio');
        break;
      case 'limpiar':
        clearSearch();
        navigate('inicio');
        break;
      case 'leer-mas':
        expandDescription(target);
        break;
      case 'placeholder':
        toast('Sección en construcción.');
        break;
      case 'logout':
        toast('Sesión cerrada (demo).');
        break;
    }
  });

  document.addEventListener('input', function (event) {
    if (event.target.id === 'search-input' || event.target.id === 'busqueda-input') {
      handleSearchInput(event.target);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();
  });

  /* ---------- Init ---------- */
  navigate('inicio');
})();
