// ============================================================
//  Tu Casa de Detalles — nav.js (tienda pública)
//  Genera el header dinámicamente
// ============================================================

(function () {
  function buildNav() {
    const container = document.getElementById('nav-container');
    if (!container) return;

    container.innerHTML = `
      <header class="header">
        <div class="container header-inner">
          <a href="#inicio" class="header-logo">
            <span class="header-logo-icon">✦</span>
            <span class="header-logo-text">Tu Casa de Detalles</span>
          </a>

          <nav class="header-nav">
            <a href="#inicio">Inicio</a>
            <a href="#novedades">Novedades</a>
            <a href="#catalogo">Catálogo</a>
            <a href="#contacto">Contacto</a>
          </nav>

          <div class="header-actions">
            <button class="btn-theme-pub" id="btn-theme-pub" title="Cambiar tema">
              <span id="theme-icon-pub">☾</span>
            </button>
            <button class="btn-carrito-header" id="btn-carrito-header" title="Ver carrito">
              🛍
              <span class="carrito-count-badge" id="carrito-badge">0</span>
            </button>
            <a href="admin/" class="btn-admin-header">Admin</a>
            <button class="btn-menu-mobile" id="btn-menu-mobile">☰</button>
          </div>
        </div>

        <!-- Nav mobile -->
        <nav class="mobile-nav" id="mobile-nav">
          <a href="#inicio"    onclick="cerrarMobileNav()">Inicio</a>
          <a href="#novedades" onclick="cerrarMobileNav()">Novedades</a>
          <a href="#catalogo"  onclick="cerrarMobileNav()">Catálogo</a>
          <a href="#contacto"  onclick="cerrarMobileNav()">Contacto</a>
          <a href="admin/"     style="color:var(--bordo);font-weight:800">Admin ✦</a>
        </nav>
      </header>
    `;

    // Tema
    const tema = localStorage.getItem('tcd_tema_pub') || 'light';
    aplicarTema(tema);

    document.getElementById('btn-theme-pub')?.addEventListener('click', toggleTema);
    document.getElementById('btn-menu-mobile')?.addEventListener('click', toggleMobileNav);
    document.getElementById('btn-carrito-header')?.addEventListener('click', () => {
      if (window.abrirCarrito) window.abrirCarrito();
    });
  }

  function aplicarTema(tema) {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add('theme-' + tema);
    localStorage.setItem('tcd_tema_pub', tema);
    const icon = document.getElementById('theme-icon-pub');
    if (icon) icon.textContent = tema === 'dark' ? '☀' : '☾';
  }

  function toggleTema() {
    const actual = localStorage.getItem('tcd_tema_pub') || 'light';
    aplicarTema(actual === 'light' ? 'dark' : 'light');
  }

  function toggleMobileNav() {
    const nav = document.getElementById('mobile-nav');
    if (nav) nav.classList.toggle('open');
  }

  window.cerrarMobileNav = function () {
    document.getElementById('mobile-nav')?.classList.remove('open');
  };

  // Exponer función de actualización del badge del carrito
  window.actualizarBadgeCarrito = function (cantidad) {
    const badge = document.getElementById('carrito-badge');
    if (!badge) return;
    badge.textContent = cantidad;
    if (cantidad > 0) {
      badge.classList.add('bump');
      setTimeout(() => badge.classList.remove('bump'), 300);
    }
  };

  window.PubNav = { build: buildNav };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNav);
  } else {
    buildNav();
  }
})();
