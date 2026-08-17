/* ============================================
   FiestaExpert — Centro de Socios (Proveedor)
   Dashboard de una sola pantalla. Vanilla JS.
   ============================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

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

  /* ---------- Event delegation ---------- */
  document.addEventListener('click', function (event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
      case 'toggle-proveedor':
        toggleProveedor(target);
        break;
      case 'nuevo-anuncio':
        alert('Nuevo Anuncio: demo sin flujo definido.');
        break;
      case 'aprobar':
        alert('Reserva de Boda Familia García aprobada (demo).');
        break;
      case 'ver-detalles':
        alert('Detalles de Boda Familia García (demo).');
        break;
      case 'reporte':
        alert('Reporte completo: demo sin flujo definido.');
        break;
      case 'placeholder':
        alert('Sección en construcción.');
        break;
      case 'logout':
        alert('Sesión cerrada (demo).');
        break;
    }
  });
})();
