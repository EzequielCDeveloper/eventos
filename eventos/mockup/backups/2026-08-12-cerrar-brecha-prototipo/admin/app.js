/* ============================================
   FiestaExpert — Panel de Admin (shell)
   Vanilla JS: estados activos de navegación y
   placeholders de pantallas no definidas.
   ============================================ */
(function () {
  'use strict';

  const CLASSES = {
    DESK_ON: ['bg-secondary-container', 'text-on-secondary-container', 'font-bold', 'translate-x-1'],
    DESK_OFF: ['text-on-surface-variant', 'hover:bg-surface-container-low', 'hover:bg-surface-container-high'],
    MOB_ON: ['text-primary', 'bg-primary-fixed', 'rounded-full', 'px-4', 'py-1', 'scale-90'],
    MOB_OFF: ['text-on-surface-variant', 'hover:text-primary']
  };

  function setActive(group, items, activeClasses, offClasses) {
    items.forEach(function (item) {
      const on = item.dataset.nav === 'panel'; // solo "Panel" es la pantalla real
      item.classList.remove.apply(item.classList, activeClasses.concat(offClasses));
      item.classList.add.apply(item.classList, on ? activeClasses : offClasses);
      const icon = item.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = on ? "'FILL' 1" : "'FILL' 0";
      const label = item.querySelector('span:not(.material-symbols-outlined)');
      if (label) label.classList.toggle('font-bold', on);
      void group;
    });
  }

  function updateNav() {
    setActive(null, Array.prototype.slice.call(document.querySelectorAll('.admin-nav')), CLASSES.DESK_ON, CLASSES.DESK_OFF);
    setActive(null, Array.prototype.slice.call(document.querySelectorAll('.admin-nav-mob')), CLASSES.MOB_ON, CLASSES.MOB_OFF);
  }

  document.addEventListener('click', function (event) {
    const nav = event.target.closest('[data-nav]');
    if (nav) {
      event.preventDefault();
      updateNav();
      return;
    }
    const target = event.target.closest('[data-action]');
    if (target && target.dataset.action === 'placeholder') {
      alert('Pantalla no definida (demo).');
    }
  });

  updateNav();
})();
