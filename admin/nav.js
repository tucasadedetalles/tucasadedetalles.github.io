// ============================================================
//  Tu Casa de Detalles — admin/nav.js v3
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
    { section: 'calculadora', icon: '⊟', label: 'Calculadora' },
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
          <img src="../assets/logo.png" alt="Logo" class="sidebar-logo-img" />
          <span class="sidebar-logo-text">TCD</span>
          <button class="sidebar-close" id="btn-sidebar-close">✕</button>
        </div>

        <nav class="sidebar-nav">
          ${navItems}
        </nav>

        <div class="sidebar-ver-tienda">
          <a href="https://tucasadedetalles.github.io"
             target="_blank"
             class="btn-ver-tienda">
            <span class="nav-icon">🌐</span>
            <span class="nav-label">Ver tienda</span>
          </a>
        </div>

        <div class="sidebar-footer">
          <button class="btn-theme" id="btn-theme" title="Cambiar tema">
            <span id="theme-icon">☀</span>
          </button>
          <button class="btn-logout" id="btn-logout">Salir</button>
        </div>
      </aside>
    `;
  }

  window.AdminNav = { build: buildSidebar };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSidebar);
  } else {
    buildSidebar();
  }
})();
