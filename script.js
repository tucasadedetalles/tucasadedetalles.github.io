// ============================================================
//  Tu Casa de Detalles — script.js (tienda pública)
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzqUSx96if9nNAyoVWeyKP7hvzVexv8e-I7W8l4ud30qfJXRf6qYF7p8xhTKxy6mMo/exec';

const PREFIJOS = {
  'Accesorios Pelo':     'ACP',
  'Accesorios Invierno': 'ACI',
  'Morrales':            'MOR',
  'Libreria':            'LIB',
  'Llaveros':            'LLA',
  'Cuidado Personal':    'CUI',
  'Otros':               'OTR'
};

// ── Estado ───────────────────────────────────────────────────
let productosCache = [];
let carrito        = JSON.parse(localStorage.getItem('tcd_carrito') || '[]');
let config         = {};
let filtroCat      = '';
let filtroQ        = '';

// ── API ──────────────────────────────────────────────────────
async function apiGet(params) {
  const url = GAS_URL + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

// ── Formato ──────────────────────────────────────────────────
function formatPeso(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

// ── Toast ────────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2800);
}

// ══════════════════════════════════════════════════════════════
//  CARRITO
// ══════════════════════════════════════════════════════════════

function guardarCarrito() {
  localStorage.setItem('tcd_carrito', JSON.stringify(carrito));
}

function totalCarrito() {
  return carrito.reduce((s, i) => s + Number(i.precio || 0), 0);
}

function agregarAlCarrito(prod) {
  carrito.push({
    id:       prod.id,
    nombre:   prod.nombre,
    variante: prod.variante || '',
    precio:   Number(prod.precioVenta || 0),
    foto:     prod.foto || ''
  });
  guardarCarrito();
  actualizarUICarrito();
  toast('¡Agregado al carrito! 🛍');
}

function quitarDelCarrito(index) {
  carrito.splice(index, 1);
  guardarCarrito();
  actualizarUICarrito();
  renderCarritoItems();
}

function actualizarUICarrito() {
  const cant = carrito.length;

  // Badge header
  if (window.actualizarBadgeCarrito) window.actualizarBadgeCarrito(cant);

  // Botón flotante
  const flotante = document.getElementById('carrito-flotante');
  const countEl  = document.getElementById('carrito-flotante-count');
  if (flotante) {
    if (cant > 0) {
      flotante.classList.remove('hidden');
    } else {
      flotante.classList.add('hidden');
    }
  }
  if (countEl) countEl.textContent = cant;

  // Total en panel
  const totalEl = document.getElementById('carrito-total');
  if (totalEl) totalEl.textContent = formatPeso(totalCarrito());
}

function renderCarritoItems() {
  const cont = document.getElementById('carrito-items');
  if (!cont) return;

  if (carrito.length === 0) {
    cont.innerHTML = '<div class="carrito-empty">Tu carrito está vacío 🛍</div>';
    return;
  }

  cont.innerHTML = carrito.map((item, i) => `
    <div class="carrito-item">
      <div class="carrito-item-img">
        ${item.foto
          ? `<img src="${item.foto}" alt="${item.nombre}" loading="lazy" />`
          : '📦'}
      </div>
      <div class="carrito-item-info">
        <div class="carrito-item-nombre">${item.nombre}</div>
        ${item.variante ? `<div class="carrito-item-variante">${item.variante}</div>` : ''}
        <div class="carrito-item-precio">${formatPeso(item.precio)}</div>
      </div>
      <button class="carrito-item-remove" onclick="quitarDelCarrito(${i})" title="Quitar">✕</button>
    </div>
  `).join('');
}

window.abrirCarrito = function () {
  renderCarritoItems();
  document.getElementById('carrito-panel')?.classList.remove('hidden');
  document.getElementById('carrito-overlay')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

function cerrarCarrito() {
  document.getElementById('carrito-panel')?.classList.add('hidden');
  document.getElementById('carrito-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Checkout WhatsApp ─────────────────────────────────────────
function checkoutWhatsApp() {
  if (carrito.length === 0) { toast('Tu carrito está vacío', 'error'); return; }
  const wa = config.whatsapp || '1167682727';
  const numero = String(wa).replace(/\D/g, '');
  const lineas = carrito.map(i =>
    `• ${i.nombre}${i.variante ? ' (' + i.variante + ')' : ''} — ${formatPeso(i.precio)}`
  );
  const total = formatPeso(totalCarrito());
  const msg = encodeURIComponent(
    '¡Hola! Quiero hacer el siguiente pedido:\n\n' +
    lineas.join('\n') +
    '\n\n*Total: ' + total + '*\n\n¿Está disponible?'
  );
  window.open(`https://wa.me/54${numero}?text=${msg}`, '_blank');
}

// ── Checkout MercadoPago ──────────────────────────────────────
function checkoutMP() {
  if (carrito.length === 0) { toast('Tu carrito está vacío', 'error'); return; }
  const link = config.linkMP || '';
  if (!link) {
    toast('MercadoPago no está configurado aún', 'error');
    return;
  }
  window.open(link, '_blank');
}

// ══════════════════════════════════════════════════════════════
//  NOVEDADES
// ══════════════════════════════════════════════════════════════

async function cargarNovedades() {
  try {
    const res   = await apiGet({ action: 'getNovedades' });
    const lista = res.data || [];
    const grid  = document.getElementById('novedades-grid');
    if (!grid) return;

    if (lista.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-light);font-size:14px">Pronto habrá novedades 🎉</p>';
      return;
    }

    grid.innerHTML = lista.map(n => `
      <div class="nov-card">
        <div class="nov-card-img">
          ${n.foto
            ? `<img src="${n.foto}" alt="${n.titulo}" loading="lazy" />`
            : '📢'}
        </div>
        <div class="nov-card-body">
          <div class="nov-card-titulo">${n.titulo || ''}</div>
          ${n.descripcion ? `<div class="nov-card-desc">${n.descripcion}</div>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error cargando novedades:', e);
  }
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO
// ══════════════════════════════════════════════════════════════

async function cargarProductos() {
  try {
    const res = await apiGet({ action: 'getProductos' });
    productosCache = res.data || [];

    // Destacados primero
    productosCache.sort((a, b) => {
      const aD = a.destacado === 'true' || a.destacado === true;
      const bD = b.destacado === 'true' || b.destacado === true;
      return bD - aD;
    });

    renderProductos();
  } catch (e) {
    console.error('Error cargando productos:', e);
    document.getElementById('productos-grid').innerHTML =
      '<p style="color:var(--text-light);padding:2rem;grid-column:1/-1">Error al cargar productos.</p>';
  }
}

function filtrarYRender() {
  renderProductos();
}

function renderProductos() {
  const grid    = document.getElementById('productos-grid');
  const emptyEl = document.getElementById('productos-empty');
  if (!grid) return;

  const lista = productosCache.filter(p => {
    const matchQ   = !filtroQ   || p.nombre?.toLowerCase().includes(filtroQ.toLowerCase());
    const matchCat = !filtroCat || p.categoria === filtroCat;
    return matchQ && matchCat;
  });

  if (lista.length === 0) {
    grid.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');

  grid.innerHTML = lista.map(p => {
    const prefijo   = PREFIJOS[p.categoria] || 'OTR';
    const destacado = p.destacado === 'true' || p.destacado === true;
    return `
      <div class="prod-card" onclick="abrirModalProducto('${p.id}')">
        <div class="prod-card-img">
          ${p.foto
            ? `<img src="${p.foto}" alt="${p.nombre}" loading="lazy" />`
            : '📦'}
          ${destacado ? '<span class="prod-card-destacado">Destacado</span>' : ''}
        </div>
        <div class="prod-card-body">
          <span class="prod-card-cat cat-${prefijo}">${p.categoria || ''}</span>
          <div class="prod-card-nombre">${p.nombre || ''}</div>
          ${p.variante ? `<div class="prod-card-variante">${p.variante}</div>` : ''}
          <div class="prod-card-footer-row">
            <span class="prod-card-precio">${formatPeso(p.precioVenta)}</span>
            <button class="btn-add-card" onclick="event.stopPropagation(); agregarDesdeCard('${p.id}')" title="Agregar al carrito">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function agregarDesdeCard(id) {
  const prod = productosCache.find(p => p.id === id);
  if (prod) agregarAlCarrito(prod);
}

window.limpiarFiltros = function () {
  filtroCat = '';
  filtroQ   = '';
  const searchEl = document.getElementById('filtro-search');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('.filtro-cat-item').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === '');
  });
  document.getElementById('filtro-cat-label').textContent = 'Todas las categorías';
  renderProductos();
};

// ══════════════════════════════════════════════════════════════
//  MODAL PRODUCTO
// ══════════════════════════════════════════════════════════════

function abrirModalProducto(id) {
  const p = productosCache.find(p => p.id === id);
  if (!p) return;

  const prefijo = PREFIJOS[p.categoria] || 'OTR';
  const waNum   = String(config.whatsapp || '1167682727').replace(/\D/g, '');
  const msgWA   = encodeURIComponent(
    `¡Hola! Me interesa este producto:\n*${p.nombre}*${p.variante ? ' — ' + p.variante : ''}\n¿Está disponible?`
  );
  const linkMP = config.linkMP || '';

  document.getElementById('modal-producto-inner').innerHTML = `
    <div class="modal-prod-img">
      ${p.foto
        ? `<img src="${p.foto}" alt="${p.nombre}" />`
        : '📦'}
    </div>
    <div class="modal-prod-body">
      <div class="modal-prod-cat">
        <span class="prod-card-cat cat-${prefijo}">${p.categoria || ''}</span>
      </div>
      <div class="modal-prod-nombre">${p.nombre || ''}</div>
      ${p.variante ? `<div class="modal-prod-variante">${p.variante}</div>` : ''}
      ${p.descripcion ? `<div class="modal-prod-desc">${p.descripcion}</div>` : ''}
      <div class="modal-prod-precio">${formatPeso(p.precioVenta)}</div>
      <div class="modal-prod-actions">
        <button class="btn-agregar-carrito" onclick="agregarAlCarrito(${JSON.stringify(p).replace(/"/g, '&quot;')}); cerrarModal()">
          🛍 Agregar al carrito
        </button>
        <div class="modal-prod-checkout">
          <a href="https://wa.me/54${waNum}?text=${msgWA}" target="_blank" class="btn-modal-wa">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Consultar
          </a>
          ${linkMP
            ? `<a href="${linkMP}" target="_blank" class="btn-modal-mp">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.75 16.5h-1.5v-5.25H9.75v-1.5h3v6.75zm-.75-8.25a1.125 1.125 0 110-2.25 1.125 1.125 0 010 2.25z"/>
                </svg>
                Pagar con MP
              </a>`
            : ''}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay')?.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  document.getElementById('modal-overlay')?.classList.add('hidden');
  document.body.style.overflow = '';
}

// ══════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════

async function cargarConfig() {
  try {
    const res = await apiGet({ action: 'getConfig' });
    config = res.data || {};

    // Links de contacto
    const wa = String(config.whatsapp || '1167682727').replace(/\D/g, '');
    const linkWA = document.getElementById('link-whatsapp');
    if (linkWA) linkWA.href = `https://wa.me/54${wa}`;

    const linkFB = document.getElementById('link-facebook');
    if (linkFB && config.facebook) {
      linkFB.href = config.facebook;
    } else if (linkFB) {
      linkFB.style.display = 'none';
    }

    // Título de la página
    if (config.nombreNegocio) document.title = config.nombreNegocio;
  } catch (e) {
    console.error('Error cargando config:', e);
  }
}

// ══════════════════════════════════════════════════════════════
//  FILTROS
// ══════════════════════════════════════════════════════════════

function initFiltros() {
  // Buscador
  const searchEl = document.getElementById('filtro-search');
  searchEl?.addEventListener('input', e => {
    filtroQ = e.target.value.trim();
    renderProductos();
  });

  // Dropdown categoría custom
  const btn      = document.getElementById('filtro-cat-btn');
  const dropdown = document.getElementById('filtro-cat-dropdown');

  btn?.addEventListener('click', e => {
    e.stopPropagation();
    dropdown?.classList.toggle('hidden');
    btn.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
    btn?.classList.remove('open');
  });

  document.querySelectorAll('.filtro-cat-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      filtroCat = item.dataset.cat;
      document.getElementById('filtro-cat-label').textContent =
        filtroCat || 'Todas las categorías';
      document.querySelectorAll('.filtro-cat-item').forEach(el =>
        el.classList.toggle('active', el.dataset.cat === filtroCat)
      );
      dropdown?.classList.add('hidden');
      btn?.classList.remove('open');
      renderProductos();
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {

  // Carrito
  document.getElementById('carrito-close')?.addEventListener('click', cerrarCarrito);
  document.getElementById('carrito-overlay')?.addEventListener('click', cerrarCarrito);
  document.getElementById('carrito-flotante')?.addEventListener('click', window.abrirCarrito);
  document.getElementById('btn-checkout-wa')?.addEventListener('click', checkoutWhatsApp);
  document.getElementById('btn-checkout-mp')?.addEventListener('click', checkoutMP);

  // Modal
  document.getElementById('modal-close')?.addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  // Filtros
  initFiltros();

  // Actualizar UI carrito desde localStorage
  actualizarUICarrito();

  // Cargar datos
  await cargarConfig();
  await Promise.all([cargarNovedades(), cargarProductos()]);
});
