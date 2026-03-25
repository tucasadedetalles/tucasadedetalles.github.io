// ============================================================
//  Tu Casa de Detalles — admin/nav.js
//  Genera la sidebar del panel admin dinámicamente
// ============================================================

(function () {
  const NAV_ITEMS = [
    { section: 'dashboard',   icon: '⊞', label: 'Dashboard' },
    { section: 'productos',   icon: '◈', label: 'Productos' },
    { section: 'inventarios', icon: '▦', label: 'Inventarios' },
    { section: 'ventas',      icon: '◎', label: 'Ventas' },
    { section: 'gastos',      icon: '◐', label: 'Gastos' },
    { section: 'caja',        icon: '▣', label: 'Caja diaria' },
    { section: 'novedades',   icon: '◆', label: 'Novedades' },
    { section: 'config',      icon: '◉', label: 'Configuración' },
  ];

  function buildSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const navItems = NAV_ITEMS.map(item => `
      <a class="nav-item${item.section === 'dashboard' ? ' active' : ''}"
         data-section="${item.section}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      </a>
    `).join('');

    container.innerHTML = `
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-logo-icon">✦</span>
          <span class="sidebar-logo-text">TCD</span>
          <button class="sidebar-close" id="btn-sidebar-close">✕</button>
        </div>
        <nav class="sidebar-nav">
          ${navItems}
        </nav>
        <div class="sidebar-footer">
          <button class="btn-theme" id="btn-theme" title="Cambiar tema">
            <span id="theme-icon">☀</span>
          </button>
          <button class="btn-logout" id="btn-logout">Salir</button>
        </div>
      </aside>
    `;
  }

  // Exponer función para que script.js pueda re-bindear eventos tras build
  window.AdminNav = { build: buildSidebar };

  // Ejecutar al cargar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSidebar);
  } else {
    buildSidebar();
  }
})();
