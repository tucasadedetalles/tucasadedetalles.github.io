// ============================================================
//  Tu Casa de Detalles — admin/script.js v2
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzqUSx96if9nNAyoVWeyKP7hvzVexv8e-I7W8l4ud30qfJXRf6qYF7p8xhTKxy6mMo/exec';

const CATEGORIAS = [
  'Accesorios Pelo','Accesorios Invierno','Morrales',
  'Libreria','Llaveros','Cuidado Personal','Otros'
];

const PREFIJOS = {
  'Accesorios Pelo':'ACP','Accesorios Invierno':'ACI','Morrales':'MOR',
  'Libreria':'LIB','Llaveros':'LLA','Cuidado Personal':'CUI','Otros':'OTR'
};

// ── Estado global ────────────────────────────────────────────
let token            = localStorage.getItem('tcd_token') || '';
let seccionActual    = 'dashboard';
let productosCache   = [];
let ventasCache      = [];
let gastosCache      = [];
let inventariosCache = [];

// Estado del selector de venta
let ventaItems       = [];   // items seleccionados en el modal de venta

// Estado del resumen mensual
let resumenMesOffset = 0;    // 0 = mes actual, -1 = mes anterior, etc.

// ══════════════════════════════════════════════════════════════
//  TEMA
// ══════════════════════════════════════════════════════════════
function initTema() {
  const guardado = localStorage.getItem('tcd_tema') || 'dark';
  setTema(guardado);
}

function setTema(tema) {
  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add('theme-' + tema);
  localStorage.setItem('tcd_tema', tema);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = tema === 'dark' ? '☀' : '☾';
}

function toggleTema() {
  const actual = localStorage.getItem('tcd_tema') || 'dark';
  setTema(actual === 'dark' ? 'light' : 'dark');
}

// ══════════════════════════════════════════════════════════════
//  API
// ══════════════════════════════════════════════════════════════
async function apiGet(params) {
  const url = GAS_URL + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

async function apiPost(data) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify({ ...data, token })
  });
  return res.json();
}

// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

function abrirModal(titulo, bodyHTML, footerHTML) {
  document.getElementById('modal-title').textContent = titulo;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-footer').innerHTML = footerHTML || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function cerrarModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
  document.getElementById('modal-footer').innerHTML = '';
}

function setLoading(seccion, loading) {
  const sec = document.getElementById('sec-' + seccion);
  if (!sec) return;
  let overlay = sec.querySelector('.loading-overlay');
  if (loading) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div>';
      sec.style.position = 'relative';
      sec.appendChild(overlay);
    }
  } else {
    if (overlay) overlay.remove();
  }
}

function formatPeso(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function normalizarFecha(f) {
  if (!f) return '';
  // Si es Date object de Sheets o string con hora, extraer solo YYYY-MM-DD
  const s = String(f);
  // Formato ISO: 2026-03-26T00:00:00.000Z
  if (s.includes('T')) return s.split('T')[0];
  // Formato con espacio: 2026-03-26 00:00:00
  if (s.includes(' ') && s.match(/^\d{4}-\d{2}-\d{2}/)) return s.substring(0, 10);
  // Ya es YYYY-MM-DD
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
  // Fecha de Excel como número (días desde 1900)
  if (s.match(/^\d+$/)) {
    const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  return s.substring(0, 10);
}

function horaAhora() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════
//  IMAGEN — compresión a JPG
// ══════════════════════════════════════════════════════════════
function comprimirImagen(file, maxPx = 1200, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else       { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ══════════════════════════════════════════════════════════════
//  NAV
// ══════════════════════════════════════════════════════════════
function bindNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(el => {
    el.addEventListener('click', () => navegarA(el.dataset.section));
  });

  document.querySelectorAll('.panel-link[data-section]').forEach(el => {
    el.addEventListener('click', () => navegarA(el.dataset.section));
  });

  const btnTheme  = document.getElementById('btn-theme');
  const btnLogout = document.getElementById('btn-logout');
  const btnClose  = document.getElementById('btn-sidebar-close');

  if (btnTheme)  btnTheme.addEventListener('click', toggleTema);
  if (btnLogout) btnLogout.addEventListener('click', logout);
  if (btnClose)  btnClose.addEventListener('click', cerrarSidebar);

  // Overlay invisible — click fuera cierra la sidebar en mobile
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99;display:none;';
    overlay.addEventListener('click', cerrarSidebar);
    document.body.appendChild(overlay);
  }

  const tema = localStorage.getItem('tcd_tema') || 'dark';
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = tema === 'dark' ? '☀' : '☾';
}

function cerrarSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  const ov = document.getElementById('sidebar-overlay');
  if (ov) ov.style.display = 'none';
}

function abrirSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  const ov = document.getElementById('sidebar-overlay');
  if (ov) ov.style.display = 'block';
}

function navegarA(seccion) {
  seccionActual = seccion;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec-' + seccion)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.section === seccion);
  });
  const labels = {
    dashboard:'Dashboard', productos:'Productos', inventarios:'Inventarios',
    ventas:'Ventas', gastos:'Gastos', caja:'Caja diaria',
    novedades:'Novedades', fotos:'Fotos', calculadora:'Calculadora',
    resumen:'Resumen mensual', config:'Configuración'
  };
  document.getElementById('topbar-title').textContent = labels[seccion] || seccion;
  cerrarSidebar();
  cargarSeccion(seccion);
}

async function cargarSeccion(seccion) {
  if (seccion === 'dashboard')   await cargarDashboard();
  if (seccion === 'productos')   await cargarProductos();
  if (seccion === 'inventarios') await cargarInventarios();
  if (seccion === 'ventas')      await cargarVentas();
  if (seccion === 'gastos')      await cargarGastos();
  if (seccion === 'caja')        await cargarCaja();
  if (seccion === 'novedades')   await cargarNovedades();
  if (seccion === 'fotos')       await cargarFotos();
  if (seccion === 'resumen')     await cargarResumen();
  if (seccion === 'config')      await cargarConfig();
  if (seccion === 'calculadora') initCalculadora();
}

// ══════════════════════════════════════════════════════════════
//  LOGIN
// ══════════════════════════════════════════════════════════════
async function login() {
  const u   = document.getElementById('login-user').value.trim();
  const p   = document.getElementById('login-pass').value.trim();
  const btn = document.getElementById('btn-login');
  if (!u || !p) { mostrarLoginError('Completá usuario y contraseña'); return; }
  btn.textContent = 'Ingresando...';
  btn.disabled = true;
  try {
    const res = await apiGet({ action: 'login', u, p });
    if (res.ok && res.rol === 'admin') {
      token = res.token;
      localStorage.setItem('tcd_token', token);
      mostrarApp();
    } else {
      mostrarLoginError(res.error || 'Usuario o contraseña incorrectos');
    }
  } catch (e) {
    mostrarLoginError('Error de conexión. Intentá de nuevo.');
  } finally {
    btn.textContent = 'Ingresar';
    btn.disabled = false;
  }
}

function mostrarLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function mostrarApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  bindNav();
  initTema();
  cargarSeccion('dashboard');
  // Precargar inventarios y productos en background para que estén disponibles
  // al abrir el modal de venta desde cualquier sección
  apiGet({ action: 'getInventarios', token }).then(res => {
    inventariosCache = res.data || [];
  }).catch(() => {});
  apiGet({ action: 'getAll', hoja: 'productos', token }).then(res => {
    productosCache = res.data || [];
  }).catch(() => {});
}

function logout() {
  token = '';
  localStorage.removeItem('tcd_token');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
async function cargarDashboard() {
  setLoading('dashboard', true);
  try {
    const [rProd, rVentas, rGastos] = await Promise.all([
      apiGet({ action: 'getAll', hoja: 'productos', token }),
      apiGet({ action: 'getAll', hoja: 'ventas',    token }),
      apiGet({ action: 'getAll', hoja: 'gastos',    token })
    ]);

    const productos = rProd.data   || [];
    const ventas    = rVentas.data  || [];
    const gastos    = rGastos.data  || [];
    const hoy       = fechaHoy();
    const mesActual = hoy.substring(0, 7);

    const ventasHoy = ventas.filter(v => normalizarFecha(v.fecha) === hoy);
    const totalHoy  = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0);
    const gastosMes = gastos
      .filter(g => normalizarFecha(String(g.fecha || '')).startsWith(mesActual))
      .reduce((s, g) => s + Number(g.monto || 0), 0);
    const stockMin  = Number(localStorage.getItem('tcd_stock_min') || 3);
    const stockBajo = productos.filter(p => Number(p.stock || 0) <= Number(stockMin));

    document.getElementById('stat-ventas-hoy').textContent  = formatPeso(totalHoy);
    document.getElementById('stat-ventas-cant').textContent = ventasHoy.length + ' transacciones';
    document.getElementById('stat-gastos-mes').textContent  = formatPeso(gastosMes);
    document.getElementById('stat-saldo').textContent       = formatPeso(totalHoy - gastosMes);
    document.getElementById('stat-stock-bajo').textContent  = stockBajo.length;

    const listaV = document.getElementById('dash-ventas-lista');
    listaV.innerHTML = ventasHoy.length === 0
      ? '<div class="list-empty">Sin ventas registradas hoy</div>'
      : ventasHoy.slice(-5).reverse().map(v => `
          <div class="dash-list-item">
            <span class="dash-list-label">${v.notas || 'Venta'} ${v.hora ? '· ' + v.hora : ''}</span>
            <span class="dash-list-valor">${formatPeso(v.total)}</span>
          </div>`).join('');

    const listaS = document.getElementById('dash-stock-lista');
    listaS.innerHTML = stockBajo.length === 0
      ? '<div class="list-empty">Todo el stock está bien</div>'
      : stockBajo.slice(0, 6).map(p => `
          <div class="dash-list-item">
            <span class="dash-list-label">${p.nombre} ${p.variante ? '— ' + p.variante : ''}</span>
            <span class="dash-list-stock ${Number(p.stock) === 0 ? 'out' : 'low'}">${p.stock} unid.</span>
          </div>`).join('');
  } catch (e) {
    console.error('Dashboard error:', e);
  } finally {
    setLoading('dashboard', false);
  }
}

// ══════════════════════════════════════════════════════════════
//  PRODUCTOS
// ══════════════════════════════════════════════════════════════
async function cargarProductos() {
  setLoading('productos', true);
  try {
    const res = await apiGet({ action: 'getAll', hoja: 'productos', token });
    productosCache = res.data || [];
    renderProductos(productosCache);
    document.getElementById('prod-search').oninput   = () => filtrarProductos();
    document.getElementById('prod-filter-cat').onchange = () => filtrarProductos();
  } finally {
    setLoading('productos', false);
  }
}

function filtrarProductos() {
  const q   = document.getElementById('prod-search').value.toLowerCase();
  const cat = document.getElementById('prod-filter-cat').value;
  renderProductos(productosCache.filter(p => {
    const matchQ   = !q   || p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
    const matchCat = !cat || p.categoria === cat;
    return matchQ && matchCat;
  }));
}

function renderProductos(lista) {
  const grid = document.getElementById('productos-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="list-empty" style="grid-column:1/-1;padding:2rem">Sin productos cargados aún</div>';
    return;
  }
  const stockMin = Number(localStorage.getItem('tcd_stock_min') || 3);
  grid.innerHTML = lista.map(p => {
    const stock    = Number(p.stock || 0);
    const stockCls = stock === 0 ? 'out' : stock <= stockMin ? 'low' : 'ok';
    const stockTxt = stock === 0 ? 'Sin stock' : stock + ' unid.';
    const prefijo  = PREFIJOS[p.categoria] || 'OTR';
    return `
      <div class="prod-card" data-id="${p.id}">
        <div class="prod-card-img" onclick="editarProducto('${p.id}')">
          ${p.foto ? `<img src="${p.foto}" alt="${p.nombre}" loading="lazy" />` : '📦'}
        </div>
        <div class="prod-card-body">
          <div class="prod-card-codigo">
            ${p.codigo || ''}
            <span class="cat-badge cat-${prefijo}">${p.categoria || ''}</span>
          </div>
          <div class="prod-card-nombre">${p.nombre || ''}</div>
          <div class="prod-card-variante">${p.variante || ''}</div>
          <div class="prod-card-row">
            <div class="prod-card-precio">${formatPeso(p.precioVenta)}</div>
            <span class="prod-card-stock ${stockCls}">${stockTxt}</span>
          </div>
          <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
            <label class="toggle-wrap" title="Visible en tienda">
              <input type="checkbox" ${p.visible === 'true' || p.visible === true ? 'checked' : ''}
                onchange="toggleVisible('${p.id}', this.checked)" />
              <span class="toggle-track"></span>
            </label>
            <span class="toggle-label" style="font-size:11px">Visible en tienda</span>
          </div>
        </div>
        <div class="prod-card-footer">
          <button class="btn-icon" onclick="editarProducto('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon danger" onclick="confirmarEliminar('productos','${p.id}','${p.foto || ''}','producto')" title="Eliminar">✕</button>
        </div>
      </div>`;
  }).join('');
}

async function toggleVisible(id, visible) {
  await apiPost({ action: 'actualizarCampo', hoja: 'productos', id, campo: 'visible', valor: String(visible) });
}

// Modal producto — foto integrada
function modalProducto(prod = null) {
  const esNuevo = !prod;
  const cats    = CATEGORIAS.map(c => `<option${prod?.categoria === c ? ' selected' : ''}>${c}</option>`).join('');

  abrirModal(esNuevo ? 'Nuevo producto' : 'Editar producto', `
    <div class="field">
      <label>Categoría</label>
      <select id="mp-cat" class="input-select" onchange="actualizarCodigoProd()">${cats}</select>
    </div>
    <div class="field">
      <label>Código (auto)</label>
      <input type="text" id="mp-codigo" class="input-text" value="${prod?.codigo || ''}"
        readonly style="opacity:.6;cursor:not-allowed" />
    </div>
    <div class="field">
      <label>Nombre</label>
      <input type="text" id="mp-nombre" class="input-text" value="${prod?.nombre || ''}" />
    </div>
    <div class="field">
      <label>Variante (color, talle, modelo)</label>
      <input type="text" id="mp-variante" class="input-text" value="${prod?.variante || ''}" />
    </div>
    <div class="field">
      <label>
        Descripción
        <button class="btn-gemini" type="button" onclick="generarDescripcion()">✦ Gemini</button>
      </label>
      <textarea id="mp-descripcion" class="input-text" rows="3">${prod?.descripcion || ''}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
      <div class="field">
        <label>Precio venta</label>
        <input type="number" id="mp-pventa" class="input-text" value="${prod?.precioVenta || ''}" />
      </div>
      <div class="field">
        <label>Precio costo</label>
        <input type="number" id="mp-pcosto" class="input-text" value="${prod?.precioCosto || ''}" />
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
      <div class="field">
        <label>Stock</label>
        <input type="number" id="mp-stock" class="input-text" value="${prod?.stock || 0}" />
      </div>
      <div class="field">
        <label>Stock mínimo</label>
        <input type="number" id="mp-stock-min" class="input-text" value="${prod?.stockMinimo || 3}" />
      </div>
    </div>
    <div style="display:flex;gap:1.2rem;flex-wrap:wrap">
      <label class="toggle-wrap">
        <input type="checkbox" id="mp-visible"
          ${prod?.visible === 'true' || prod?.visible === true ? 'checked' : ''} />
        <span class="toggle-track"></span>
        <span class="toggle-label">Visible en tienda</span>
      </label>
      <label class="toggle-wrap">
        <input type="checkbox" id="mp-destacado"
          ${prod?.destacado === 'true' || prod?.destacado === true ? 'checked' : ''} />
        <span class="toggle-track"></span>
        <span class="toggle-label">Destacado</span>
      </label>
    </div>
    <div class="field">
      <label>Fotos del producto (hasta 4)</label>
      <div class="fotos-slots">
        ${['foto','foto2','foto3','foto4'].map((slot, i) => {
          const url = prod?.[slot] || '';
          return `
            <div class="foto-slot" id="slot-wrap-${slot}">
              <div class="foto-slot-num">${i + 1}</div>
              ${url
                ? `<div class="foto-slot-preview">
                    <img src="${url}" alt="foto ${i+1}" />
                    <button class="foto-slot-del" type="button"
                      onclick="eliminarSlotFoto('${prod?.id || ''}','${slot}','${url}')">✕</button>
                   </div>`
                : `<label class="foto-slot-empty">
                    <input type="file" accept="image/*" data-slot="${slot}"
                      onchange="previsualizarSlot(this)" />
                    <span class="foto-slot-icon">+</span>
                   </label>`
              }
            </div>`;
        }).join('')}
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin-top:6px">
        Solo la foto 1 se sube automáticamente al guardar. Las fotos 2-4 se suben al tocar cada slot.
      </p>
      <button class="btn-gemini" type="button" id="btn-gemini-foto"
        onclick="analizarFotoConGemini()"
        style="margin-top:8px;width:100%">
        ✦ Analizar foto 1 con Gemini
      </button>
      <div id="gemini-foto-estado" style="font-size:12px;color:var(--text-muted);margin-top:4px;text-align:center"></div>
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarProducto('${prod?.id || ''}','${prod?.foto || ''}','${prod?.foto2 || ''}','${prod?.foto3 || ''}','${prod?.foto4 || ''}')">Guardar</button>
  `);

  if (esNuevo) actualizarCodigoProd();
}

async function actualizarCodigoProd() {
  const cat = document.getElementById('mp-cat')?.value;
  if (!cat) return;
  const res = await apiGet({ action: 'siguienteCodigo', hoja: 'productos', categoria: cat });
  const inp = document.getElementById('mp-codigo');
  if (inp) inp.value = res.codigo || '';
}

function previsualizarSlot(input) {
  const slot = input.dataset.slot;
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;

  const wrap = input.closest('.foto-slot');
  if (!wrap) return;

  // Reemplazar el label por preview con botón borrar (temporal hasta guardar)
  const url = URL.createObjectURL(file);
  wrap.querySelector('.foto-slot-empty').outerHTML = `
    <div class="foto-slot-preview">
      <img src="${url}" alt="nueva foto" />
      <button class="foto-slot-del" type="button"
        onclick="limpiarSlotNuevo(this,'${slot}')">✕</button>
    </div>`;
}

function limpiarSlotNuevo(btn, slot) {
  const wrap = btn.closest('.foto-slot');
  if (!wrap) return;
  const i = ['foto','foto2','foto3','foto4'].indexOf(slot);
  wrap.querySelector('.foto-slot-preview').outerHTML = `
    <label class="foto-slot-empty">
      <input type="file" accept="image/*" data-slot="${slot}"
        onchange="previsualizarSlot(this)" />
      <span class="foto-slot-icon">+</span>
    </label>`;
}

async function eliminarSlotFoto(prodId, slot, fotoUrl) {
  if (!prodId) return; // producto nuevo, solo limpiar UI
  const wrap = document.getElementById('slot-wrap-' + slot);
  const i = ['foto','foto2','foto3','foto4'].indexOf(slot);
  const res = await apiPost({ action: 'eliminarFotoSlot', hoja: 'productos', id: prodId, slot, fotoUrl });
  if (res.ok) {
    toast('Foto eliminada');
    if (wrap) wrap.querySelector('.foto-slot-preview').outerHTML = `
      <label class="foto-slot-empty">
        <input type="file" accept="image/*" data-slot="${slot}"
          onchange="previsualizarSlot(this)" />
        <span class="foto-slot-icon">+</span>
      </label>`;
    // Actualizar cache
    const prod = productosCache.find(p => p.id === prodId);
    if (prod) prod[slot] = '';
  } else {
    toast(res.error || 'Error al eliminar', 'error');
  }
}

function previsualizarFotoProd(input) {
  // Mantener por compatibilidad con Gemini
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
}

async function analizarFotoConGemini() {
  // Busca la foto del slot principal
  const slotInput = document.querySelector('.foto-slot input[data-slot="foto"]');
  const estado    = document.getElementById('gemini-foto-estado');
  const btn       = document.getElementById('btn-gemini-foto');

  if (!slotInput?.files[0]) {
    toast('Primero seleccioná la foto 1', 'error'); return;
  }

  const categoria = document.getElementById('mp-cat')?.value || '';
  btn.textContent = '...analizando';
  btn.disabled    = true;
  if (estado) estado.textContent = 'Gemini está analizando la imagen...';

  try {
    const b64 = await comprimirImagen(slotInput.files[0]);
    const res = await apiPost({ action: 'geminiAnalizarFoto', b64, categoria });

    if (res.ok) {
      const campNombre = document.getElementById('mp-nombre');
      const campDesc   = document.getElementById('mp-descripcion');
      const campVar    = document.getElementById('mp-variante');
      if (campNombre && !campNombre.value && res.nombre)   campNombre.value = res.nombre;
      if (campDesc   && !campDesc.value   && res.descripcion) campDesc.value = res.descripcion;
      if (campVar    && !campVar.value    && res.variante) campVar.value    = res.variante;
      await actualizarCodigoProd();
      if (estado) estado.textContent = '✓ Gemini completó nombre, descripción y variante';
      toast('Foto analizada con Gemini');
    } else {
      if (estado) estado.textContent = res.error || 'Error al analizar';
      toast(res.error || 'Gemini no pudo analizar la foto', 'error');
    }
  } catch(e) {
    if (estado) estado.textContent = 'Error de conexión';
    toast('Error al analizar', 'error');
  } finally {
    btn.textContent = '✦ Analizar foto 1 con Gemini';
    btn.disabled    = false;
  }
}

async function generarDescripcion() {
  const nombre    = document.getElementById('mp-nombre')?.value;
  const categoria = document.getElementById('mp-cat')?.value;
  const variante  = document.getElementById('mp-variante')?.value;
  if (!nombre) { toast('Ingresá el nombre primero', 'error'); return; }
  const btn = document.querySelector('.btn-gemini');
  btn.textContent = '...';
  btn.disabled = true;
  const res = await apiPost({ action: 'geminiDescripcion', nombre, categoria, variante });
  btn.textContent = '✦ Gemini';
  btn.disabled = false;
  if (res.ok) document.getElementById('mp-descripcion').value = res.descripcion;
  else toast('Gemini no respondió', 'error');
}

async function guardarProducto(idExistente, foto1Ant, foto2Ant, foto3Ant, foto4Ant) {
  const nombre = document.getElementById('mp-nombre').value;
  if (!nombre) { toast('El nombre es obligatorio', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const id  = idExistente || 'PRD-' + Date.now();
    const cat = document.getElementById('mp-cat').value;

    // Subir fotos de los slots que tengan archivo nuevo
    const slots    = ['foto','foto2','foto3','foto4'];
    const anteriores = [foto1Ant, foto2Ant, foto3Ant, foto4Ant];
    const urls     = [...anteriores];

    for (let i = 0; i < slots.length; i++) {
      const input = document.querySelector(`.foto-slot input[data-slot="${slots[i]}"]`);
      if (input?.files[0]) {
        const b64  = await comprimirImagen(input.files[0]);
        const resF = await apiPost({
          action: 'subirFotoSlot', hoja: 'productos',
          id, slot: slots[i], b64, nombre: id, categoria: cat
        });
        if (resF.ok) urls[i] = resF.url;
      }
    }

    const fila = {
      id,
      codigo:      document.getElementById('mp-codigo').value,
      nombre,
      categoria:   cat,
      variante:    document.getElementById('mp-variante').value,
      descripcion: document.getElementById('mp-descripcion').value,
      precioVenta: document.getElementById('mp-pventa').value,
      precioCosto: document.getElementById('mp-pcosto').value,
      stock:       document.getElementById('mp-stock').value,
      stockMinimo: document.getElementById('mp-stock-min').value,
      visible:     document.getElementById('mp-visible').checked ? 'true' : 'false',
      destacado:   document.getElementById('mp-destacado').checked ? 'true' : 'false',
      foto:        urls[0] || '',
      foto2:       urls[1] || '',
      foto3:       urls[2] || '',
      foto4:       urls[3] || '',
      creadoEn:    idExistente ? '' : fechaHoy()
    };

    const res = await apiPost({ action: 'guardar', hoja: 'productos', fila });
    if (res.ok) {
      cerrarModal();
      toast('Producto guardado');
      await cargarProductos();
    } else {
      toast(res.error || 'Error al guardar', 'error');
    }
  } finally {
    btn.textContent = 'Guardar';
    btn.disabled = false;
  }
}

function editarProducto(id) {
  const prod = productosCache.find(p => p.id === id);
  if (prod) modalProducto(prod);
}

// ══════════════════════════════════════════════════════════════
//  ELIMINAR GENÉRICO (con modal confirmación)
// ══════════════════════════════════════════════════════════════
function confirmarEliminar(hoja, id, fotoUrl, tipo) {
  abrirModal(`Eliminar ${tipo}`, `
    <p style="color:var(--text-secondary)">
      ¿Seguro que querés eliminar este ${tipo}? Esta acción no se puede deshacer.
    </p>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" style="background:var(--coral)"
      onclick="ejecutarEliminar('${hoja}','${id}','${fotoUrl}')">Eliminar</button>
  `);
}

async function ejecutarEliminar(hoja, id, fotoUrl) {
  const res = await apiPost({ action: 'eliminarConFoto', hoja, id, fotoUrl });
  if (res.ok) {
    cerrarModal();
    toast('Eliminado correctamente');
    if (hoja === 'productos') await cargarProductos();
    if (hoja === 'ventas')    await cargarVentas();
    if (hoja === 'gastos')    await cargarGastos();
    if (hoja === 'novedades') await cargarNovedades();
  } else {
    toast(res.error || 'Error al eliminar', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  INVENTARIOS
// ══════════════════════════════════════════════════════════════
async function cargarInventarios() {
  setLoading('inventarios', true);
  try {
    const res = await apiGet({ action: 'getInventarios', token });
    inventariosCache = res.data || [];
    renderInventarios(inventariosCache);
  } finally {
    setLoading('inventarios', false);
  }
}

function renderInventarios(lista) {
  const cont = document.getElementById('inventarios-lista');
  if (!lista.length) {
    cont.innerHTML = '<div class="list-empty">No hay inventarios creados</div>';
    return;
  }
  cont.innerHTML = lista.map(inv => `
    <div class="inv-card">
      <div class="inv-card-header">
        <span class="inv-card-nombre">${inv.nombre}</span>
        <span class="${inv.privado === 'true' ? 'inv-badge-privado' : 'inv-badge-publico'}">
          ${inv.privado === 'true' ? 'Privado' : 'Público'}
        </span>
      </div>
      <div class="inv-card-prefijo">Prefijo: ${inv.prefijo} · Creado: ${inv.creadoEn || ''}</div>
      <div class="inv-card-actions">
        <button class="btn-secondary" onclick="abrirInventario('${inv.hojaId}','${inv.nombre}')">Ver items</button>
        <button class="btn-icon danger" onclick="eliminarInventarioModal('${inv.hojaId}')">✕</button>
      </div>
    </div>`).join('');
}

function modalNuevoInventario() {
  abrirModal('Nuevo inventario', `
    <div class="field">
      <label>Nombre</label>
      <input type="text" id="inv-nombre" class="input-text" placeholder="Ej: Temporada Verano" />
    </div>
    <div class="field">
      <label>Prefijo (3 letras)</label>
      <input type="text" id="inv-prefijo" class="input-text" placeholder="Ej: VER"
        maxlength="5" style="text-transform:uppercase" />
    </div>
    <label class="toggle-wrap">
      <input type="checkbox" id="inv-privado" />
      <span class="toggle-track"></span>
      <span class="toggle-label">Privado (solo visible en admin)</span>
    </label>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="crearInventario()">Crear</button>
  `);
}

async function crearInventario() {
  const nombre  = document.getElementById('inv-nombre').value.trim();
  const prefijo = document.getElementById('inv-prefijo').value.trim().toUpperCase();
  const privado = document.getElementById('inv-privado').checked;
  if (!nombre || !prefijo) { toast('Completá nombre y prefijo', 'error'); return; }
  const res = await apiPost({ action: 'crearInventario', nombre, prefijo, privado });
  if (res.ok) { cerrarModal(); toast('Inventario creado'); await cargarInventarios(); }
  else toast(res.error || 'Error al crear', 'error');
}

async function abrirInventario(hojaId, nombre) {
  const res   = await apiGet({ action: 'getAll', hoja: hojaId, token });
  const items = res.data || [];
  abrirModal('Inventario: ' + nombre, `
    <button class="btn-primary" style="margin-bottom:1rem"
      onclick="modalNuevoItemInventario('${hojaId}')">+ Agregar item</button>
    ${items.length === 0
      ? '<div class="list-empty">Sin items aún</div>'
      : `<table class="tabla">
          <thead><tr><th>Código</th><th>Nombre</th><th>Categoría</th><th>Cantidad</th><th></th></tr></thead>
          <tbody>${items.map(it => `
            <tr>
              <td>${it.codigo || ''}</td>
              <td>${it.nombre || ''}</td>
              <td>${it.categoria || ''}</td>
              <td>${it.cantidad || 0}</td>
              <td>
                <button class="btn-icon danger"
                  onclick="ejecutarEliminar('${hojaId}','${it.id}','')">✕</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`
    }`);
}

function modalNuevoItemInventario(hojaId) {
  cerrarModal();
  abrirModal('Agregar item', `
    <div class="field">
      <label>Nombre</label>
      <input type="text" id="ii-nombre" class="input-text" />
    </div>
    <div class="field">
      <label>Categoría</label>
      <input type="text" id="ii-cat" class="input-text" />
    </div>
    <div class="field">
      <label>Cantidad</label>
      <input type="number" id="ii-cant" class="input-text" value="1" />
    </div>
    <div class="field">
      <label>Notas</label>
      <input type="text" id="ii-notas" class="input-text" />
    </div>
    <div class="field">
      <label>Foto (opcional)</label>
      <div class="foto-upload-area">
        <input type="file" id="ii-foto" accept="image/*"
          onchange="previsualizarFotoItem(this)" />
        <div class="foto-upload-icon">🖼</div>
        <div class="foto-upload-text">Hacé clic o arrastrá — se convierte a JPG</div>
      </div>
      <img id="ii-foto-preview" class="foto-preview hidden" alt="preview" />
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarItemInventario('${hojaId}')">Guardar</button>
  `);
}

function previsualizarFotoItem(input) {
  const file    = input.files[0];
  const preview = document.getElementById('ii-foto-preview');
  if (!file || !preview) return;
  if (file.type.startsWith('image/')) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  }
}

async function guardarItemInventario(hojaId) {
  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  try {
    const res1 = await apiGet({ action: 'siguienteCodigo', hoja: hojaId });
    const id   = 'IT-' + Date.now();
    let fotoUrl = '';

    const fileInput = document.getElementById('ii-foto');
    if (fileInput?.files[0]) {
      const cat  = document.getElementById('ii-cat').value || 'inventario';
      const b64  = await comprimirImagen(fileInput.files[0]);
      const resF = await apiPost({ action: 'subirFoto', hoja: hojaId, id, b64, nombre: id, categoria: cat });
      if (resF.ok) fotoUrl = resF.url;
    }

    const fila = {
      id,
      codigo:    res1.codigo || '',
      nombre:    document.getElementById('ii-nombre').value,
      categoria: document.getElementById('ii-cat').value,
      cantidad:  document.getElementById('ii-cant').value,
      notas:     document.getElementById('ii-notas').value,
      foto:      fotoUrl,
      visible:   'true',
      creadoEn:  fechaHoy()
    };
    const res = await apiPost({ action: 'guardar', hoja: hojaId, fila });
    if (res.ok) { cerrarModal(); toast('Item guardado'); }
    else toast(res.error || 'Error', 'error');
  } finally {
    btn.textContent = 'Guardar';
    btn.disabled = false;
  }
}

function eliminarInventarioModal(hojaId) {
  abrirModal('Eliminar inventario', `
    <p style="color:var(--text-secondary)">
      ¿Eliminar este inventario y todos sus items?
    </p>
    <label class="toggle-wrap" style="margin-top:.8rem">
      <input type="checkbox" id="inv-borrar-drive" />
      <span class="toggle-track"></span>
      <span class="toggle-label">Borrar fotos del Drive también</span>
    </label>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" style="background:var(--coral)"
      onclick="confirmarEliminarInventario('${hojaId}')">Eliminar</button>
  `);
}

async function confirmarEliminarInventario(hojaId) {
  const borrarDrive = document.getElementById('inv-borrar-drive').checked;
  const res = await apiPost({ action: 'eliminarInventario', hojaId, borrarDrive });
  if (res.ok) { cerrarModal(); toast('Inventario eliminado'); await cargarInventarios(); }
  else toast(res.error || 'Error', 'error');
}

// ══════════════════════════════════════════════════════════════
//  VENTAS
// ══════════════════════════════════════════════════════════════
async function cargarVentas() {
  const fecha = document.getElementById('ventas-fecha').value || fechaHoy();
  document.getElementById('ventas-fecha').value = fecha;
  setLoading('ventas', true);
  try {
    const res = await apiGet({ action: 'getAll', hoja: 'ventas', token });
    ventasCache = (res.data || []).filter(v => normalizarFecha(v.fecha) === fecha);
    renderTablaVentas(ventasCache);
  } finally {
    setLoading('ventas', false);
  }
}

function renderTablaVentas(lista) {
  const wrap = document.getElementById('ventas-tabla');
  if (!lista.length) {
    wrap.innerHTML = '<div class="list-empty" style="padding:2rem">Sin ventas para esta fecha</div>';
    return;
  }
  wrap.innerHTML = `
    <table class="tabla">
      <thead>
        <tr>
          <th>Hora</th><th>Descripción</th><th>Total</th>
          <th>Pago</th><th>Canal</th><th>Comprobante</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(v => `
          <tr>
            <td data-label="Hora">${v.hora || '—'}</td>
            <td data-label="Descripción">${v.notas || ''}</td>
            <td data-label="Total" style="font-weight:700;color:var(--verde)">${formatPeso(v.total)}</td>
            <td data-label="Pago">${v.medioPago || ''}</td>
            <td data-label="Canal">${v.canal || ''}</td>
            <td data-label="Comprobante">${v.comprobante
              ? `<a href="${v.comprobante}" target="_blank" style="color:var(--azul);font-weight:600">Ver</a>`
              : '—'}</td>
            <td class="td-acciones" style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn-icon" title="Editar"
                onclick="editarVenta('${v.id}')">✎</button>
              <button class="btn-icon" title="Recibo PDF" style="color:var(--bordo-soft)"
                onclick="generarRecibo('${v.id}')">⎙</button>
              <button class="btn-icon" title="Enviar por WhatsApp" style="color:#25D366"
                onclick="reciboWhatsApp('${v.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </button>
              <button class="btn-icon danger" title="Eliminar"
                onclick="confirmarEliminar('ventas','${v.id}','${v.comprobante || ''}','venta')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── Helpers de venta items ───────────────────────────────────
function calcTotalVenta() {
  return ventaItems.reduce((s, i) => s + (Number(i.precio) * Number(i.cantidad)), 0);
}

function renderVentaItems() {
  const lista = document.getElementById('vta-items-lista');
  const totalEl = document.getElementById('vta-total-live');
  if (!lista) return;

  if (ventaItems.length === 0) {
    lista.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin productos agregados</div>';
  } else {
    lista.innerHTML = ventaItems.map((it, idx) => `
      <div class="venta-item-row">
        <span class="venta-item-nombre" title="${it.nombre}${it.variante ? ' — '+it.variante : ''}">${it.nombre}${it.variante ? ' — '+it.variante : ''}</span>
        <span class="venta-item-precio">${formatPeso(it.precio)}</span>
        <div class="venta-item-cant">
          <button onclick="cambiarCantItem(${idx},-1)">−</button>
          <span>${it.cantidad}</span>
          <button onclick="cambiarCantItem(${idx},1)">+</button>
        </div>
        <button class="venta-item-del" onclick="quitarItem(${idx})">✕</button>
      </div>`).join('');
  }

  if (totalEl) {
    const t = calcTotalVenta();
    totalEl.querySelector('span:last-child').textContent = formatPeso(t);
    // Sincronizar campo total oculto
    const campTotal = document.getElementById('vta-total');
    if (campTotal) campTotal.value = t;
  }
}

function cambiarCantItem(idx, delta) {
  if (!ventaItems[idx]) return;
  ventaItems[idx].cantidad = Math.max(1, ventaItems[idx].cantidad + delta);
  renderVentaItems();
}

function quitarItem(idx) {
  ventaItems.splice(idx, 1);
  renderVentaItems();
}

function agregarItemDesdeSelector() {
  const catSel  = document.getElementById('vta-sel-cat');
  const prodSel = document.getElementById('vta-sel-prod');
  if (!prodSel?.value) { toast('Seleccioná un producto', 'error'); return; }

  const datos = JSON.parse(prodSel.value);
  // Si ya está, sumar cantidad
  const existente = ventaItems.find(i => i.id === datos.id && i.hoja === datos.hoja);
  if (existente) {
    existente.cantidad++;
  } else {
    ventaItems.push({ ...datos, cantidad: 1 });
  }
  renderVentaItems();
  prodSel.value = '';
}

async function cargarItemsCategoria() {
  const catSel  = document.getElementById('vta-sel-cat');
  const prodSel = document.getElementById('vta-sel-prod');
  if (!prodSel) return;

  const val = catSel?.value || '';
  prodSel.innerHTML = '<option value="">— Cargando... —</option>';

  if (!val) {
    prodSel.innerHTML = '<option value="">— Elegí un producto —</option>';
    return;
  }

  if (val === 'catalogo') {
    // Cargar catálogo si no está en cache
    if (!productosCache.length) {
      const res = await apiGet({ action: 'getAll', hoja: 'productos', token });
      productosCache = res.data || [];
    }
    prodSel.innerHTML = '<option value="">— Elegí un producto —</option>';
    productosCache.forEach(p => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({
        id: p.id, hoja: 'productos',
        nombre: p.nombre, variante: p.variante || '',
        precio: Number(p.precioVenta || 0)
      });
      opt.textContent = `[${p.codigo||''}] ${p.nombre}${p.variante?' — '+p.variante:''} · ${formatPeso(p.precioVenta)}`;
      prodSel.appendChild(opt);
    });
    if (!productosCache.length) {
      prodSel.innerHTML = '<option value="">Sin productos en el catálogo</option>';
    }
  } else {
    // Inventario dinámico — siempre fetch directo
    prodSel.innerHTML = '<option value="">— Cargando... —</option>';
    const res = await apiGet({ action: 'getAll', hoja: val, token });
    prodSel.innerHTML = '<option value="">— Elegí un producto —</option>';
    (res.data || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({
        id: p.id, hoja: val,
        nombre: p.nombre, variante: p.categoria || '',
        precio: Number(p.precio || p.precioVenta || 0)
      });
      opt.textContent = `${p.nombre}${p.categoria?' — '+p.categoria:''} · ${formatPeso(p.precio || p.precioVenta || 0)}`;
      prodSel.appendChild(opt);
    });
    if (!res.data?.length) {
      prodSel.innerHTML = '<option value="">Sin productos en este inventario</option>';
    }
  }
}

function editarVenta(id) {
  const v = ventasCache.find(v => v.id === id);
  if (v) modalNuevaVenta(v);
}

async function modalNuevaVenta(venta = null) {
  const esNueva  = !venta;

  // Asegurar que los caches estén cargados antes de abrir el modal
  if (esNueva) {
    const promesas = [];
    if (!productosCache.length)   promesas.push(apiGet({ action: 'getAll', hoja: 'productos', token }).then(r => { productosCache   = r.data || []; }));
    if (!inventariosCache.length) promesas.push(apiGet({ action: 'getInventarios', token }).then(r => { inventariosCache = r.data || []; }));
    if (promesas.length) await Promise.all(promesas);
  }
  const pagos    = ['Efectivo','Transferencia','MercadoPago'];
  const canales  = ['Local','Web','WhatsApp'];
  const optPagos = pagos.map(p => `<option${venta?.medioPago === p ? ' selected' : ''}>${p}</option>`).join('');
  const optCan   = canales.map(c => `<option${venta?.canal === c ? ' selected' : ''}>${c}</option>`).join('');

  // Reset items
  ventaItems = [];

  // Opciones de fuente: catálogo + inventarios
  const optFuentes = [
    `<option value="">— Fuente de producto —</option>`,
    `<option value="catalogo">Catálogo de productos</option>`,
    ...inventariosCache.map(inv =>
      `<option value="${inv.hojaId}">${inv.nombre}</option>`)
  ].join('');

  abrirModal(esNueva ? 'Registrar venta' : 'Editar venta', `
    ${esNueva ? `
    <div class="field">
      <label>Agregar productos</label>
      <div class="venta-agregar-selector">
        <select id="vta-sel-cat" class="input-select" onchange="cargarItemsCategoria()">
          ${optFuentes}
        </select>
        <select id="vta-sel-prod" class="input-select">
          <option value="">— Elegí un producto —</option>
        </select>
      </div>
      <button class="btn-secondary" type="button" onclick="agregarItemDesdeSelector()"
        style="width:100%;margin-top:6px">
        + Agregar al pedido
      </button>
    </div>
    <div class="field">
      <label>Productos del pedido</label>
      <div id="vta-items-lista" class="venta-items-lista">
        <div style="font-size:12px;color:var(--text-muted);padding:4px 0">Sin productos agregados</div>
      </div>
      <div class="venta-total-live" id="vta-total-live">
        <span>Total calculado</span>
        <span>${formatPeso(0)}</span>
      </div>
    </div>
    ` : ''}
    <div class="field">
      <label>${esNueva ? 'Notas / descripción (opcional)' : 'Descripción'}</label>
      <input type="text" id="vta-notas" class="input-text"
        placeholder="${esNueva ? 'Ej: envío, descuento aplicado...' : 'Descripción de la venta'}"
        value="${venta?.notas || ''}" />
    </div>
    <input type="hidden" id="vta-total" value="0" />
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
      ${esNueva ? `<div class="field">
        <label>Total $ <span style="font-size:11px;color:var(--text-muted)">(se calcula solo si agregás productos)</span></label>
        <input type="number" id="vta-total-edit" class="input-text"
          placeholder="0" oninput="document.getElementById('vta-total').value=this.value" />
      </div>` : `<div class="field">
        <label>Total $</label>
        <input type="number" id="vta-total-edit" class="input-text"
          placeholder="0" value="${venta?.total || ''}" />
      </div>`}
      <div class="field">
        <label>Medio de pago</label>
        <select id="vta-pago" class="input-select">${optPagos}</select>
      </div>
    </div>
    <div class="field">
      <label>Canal</label>
      <select id="vta-canal" class="input-select">${optCan}</select>
    </div>
    <div class="field">
      <label>Comprobante (imagen o PDF — opcional)</label>
      ${venta?.comprobante
        ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <a href="${venta.comprobante}" target="_blank"
              style="color:var(--azul);font-weight:600;font-size:13px">
              📎 Ver comprobante actual
            </a>
            <span style="font-size:12px;color:var(--text-muted)">— subí uno nuevo para reemplazarlo</span>
           </div>`
        : ''}
      <div class="foto-upload-area">
        <input type="file" id="vta-comprobante" accept="image/*,application/pdf"
          onchange="previsualizarComp('vta-comp-preview', this)" />
        <div class="foto-upload-icon">📎</div>
        <div class="foto-upload-text">${venta?.comprobante ? 'Reemplazar comprobante' : 'Ticket, captura o PDF'}</div>
      </div>
      <img id="vta-comp-preview" class="foto-preview hidden" alt="preview" />
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" id="btn-guardar-venta"
      data-id="${venta?.id || ''}"
      data-fecha="${normalizarFecha(venta?.fecha || '')}"
      data-hora="${venta?.hora || ''}"
      data-comp="${venta?.comprobante || ''}"
      onclick="guardarVentaDesdeModal()">
      ${esNueva ? 'Registrar venta' : 'Guardar cambios'}
    </button>
  `);
}

function guardarVentaDesdeModal() {
  const btn = document.getElementById('btn-guardar-venta');
  const id    = btn?.dataset.id    || '';
  const fecha = btn?.dataset.fecha || '';
  const hora  = btn?.dataset.hora  || '';
  const comp  = btn?.dataset.comp  || '';
  guardarVenta(id, fecha, hora, comp);
}

function previsualizarComp(previewId, input) {
  const file    = input.files[0];
  const preview = document.getElementById(previewId);
  if (!file || !preview) return;
  if (file.type.startsWith('image/')) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  }
}

async function guardarVenta(idExistente = '', fechaExistente = '', horaExistente = '', compExistente = '') {
  const esNueva = !idExistente;

  let total;
  if (esNueva) {
    // Si hay items del selector, el total viene de ellos
    if (ventaItems.length > 0) {
      total = calcTotalVenta();
    } else {
      // Venta manual — leer campo total visible
      total = Number(document.getElementById('vta-total-edit')?.value || 0);
    }
    // Si no hay items Y no hay nota, pedir que complete algo
    const notas = document.getElementById('vta-notas')?.value?.trim() || '';
    if (!total && !notas) {
      toast('Agregá al menos un producto o una descripción', 'error'); return;
    }
    // Si hay nota pero no total, pedir total
    if (!total && notas) {
      toast('Ingresá el total', 'error'); return;
    }
  } else {
    // Edición — leer campo visible vta-total-edit
    total = Number(document.getElementById('vta-total-edit')?.value || 0);
    if (!total) { toast('Ingresá el total', 'error'); return; }
  }

  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const id    = idExistente || 'VTA-' + Date.now();
    const fecha = fechaExistente || fechaHoy();
    const hora  = horaExistente  || horaAhora();
    let compUrl = compExistente;

    const fileInput = document.getElementById('vta-comprobante');
    if (fileInput?.files[0]) {
      const b64     = await comprimirImagen(fileInput.files[0]);
      const resComp = await apiPost({ action: 'subirComprobante', id, b64, nombre: id, fecha, tipo: 'venta' });
      if (resComp.ok) compUrl = resComp.url;
    }

    // Armar string de productos para el campo 'productos'
    const prodStr = ventaItems.length > 0
      ? ventaItems.map(i => `${i.cantidad}x ${i.nombre}${i.variante?' ('+i.variante+')':''}`).join(', ')
      : '';

    const notas = document.getElementById('vta-notas')?.value || '';

    const fila = {
      id, fecha, hora,
      productos:   prodStr,
      total,
      medioPago:   document.getElementById('vta-pago').value,
      canal:       document.getElementById('vta-canal').value,
      notas:       notas || prodStr,
      comprobante: compUrl
    };

    const res = await apiPost({ action: 'guardar', hoja: 'ventas', fila });
    if (!res.ok) { toast(res.error || 'Error al guardar', 'error'); return; }

    // Descontar stock si es venta nueva con items del catálogo/inventario
    if (esNueva && ventaItems.length > 0) {
      await apiPost({
        action: 'descontarStock',
        items:  ventaItems.map(i => ({ id: i.id, hoja: i.hoja, cantidad: i.cantidad }))
      });
    }

    cerrarModal();
    toast(esNueva ? 'Venta registrada' : 'Venta actualizada');
    ventaItems = [];
    await cargarVentas();
    // Refrescar productos si el stock cambió
    if (esNueva && ventaItems.length > 0) await cargarProductos();
  } finally {
    btn.textContent = idExistente ? 'Guardar cambios' : 'Registrar venta';
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  GASTOS
// ══════════════════════════════════════════════════════════════
async function cargarGastos() {
  const fecha = document.getElementById('gastos-fecha').value || fechaHoy();
  document.getElementById('gastos-fecha').value = fecha;
  setLoading('gastos', true);
  try {
    const res = await apiGet({ action: 'getAll', hoja: 'gastos', token });
    gastosCache = (res.data || []).filter(g => normalizarFecha(g.fecha) === fecha);
    renderTablaGastos(gastosCache);
  } finally {
    setLoading('gastos', false);
  }
}

function renderTablaGastos(lista) {
  const wrap = document.getElementById('gastos-tabla');
  if (!lista.length) {
    wrap.innerHTML = '<div class="list-empty" style="padding:2rem">Sin gastos para esta fecha</div>';
    return;
  }
  wrap.innerHTML = `
    <table class="tabla">
      <thead>
        <tr>
          <th>Tipo</th><th>Descripción</th><th>Proveedor</th>
          <th>Monto</th><th>Comprobante</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${lista.map(g => `
          <tr>
            <td data-label="Tipo">${g.tipo || ''}</td>
            <td data-label="Descripción">${g.descripcion || ''}</td>
            <td data-label="Proveedor">${g.proveedor || '—'}</td>
            <td data-label="Monto" style="font-weight:700;color:var(--coral)">${formatPeso(g.monto)}</td>
            <td data-label="Comprobante">${g.comprobante
              ? `<a href="${g.comprobante}" target="_blank" style="color:var(--azul);font-weight:600">Ver</a>`
              : '—'}</td>
            <td class="td-acciones" style="display:flex;gap:6px">
              <button class="btn-icon" title="Editar"
                onclick="editarGasto('${g.id}')">✎</button>
              <button class="btn-icon danger" title="Eliminar"
                onclick="confirmarEliminar('gastos','${g.id}','${g.comprobante || ''}','gasto')">✕</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function editarGasto(id) {
  const g = gastosCache.find(g => g.id === id);
  if (g) modalNuevoGasto(g);
}

function modalNuevoGasto(gasto = null) {
  const esNuevo = !gasto;
  const tipos   = ['Compra de mercadería','Packaging','Transporte','Otro'];
  const optTipo = tipos.map(t => `<option${gasto?.tipo === t ? ' selected' : ''}>${t}</option>`).join('');

  abrirModal(esNuevo ? 'Registrar gasto' : 'Editar gasto', `
    <div class="field">
      <label>Tipo</label>
      <select id="gto-tipo" class="input-select">${optTipo}</select>
    </div>
    <div class="field">
      <label>Descripción</label>
      <input type="text" id="gto-desc" class="input-text"
        placeholder="Ej: Compra gomitas mayorista"
        value="${gasto?.descripcion || ''}" />
    </div>
    <div class="field">
      <label>Proveedor</label>
      <input type="text" id="gto-prov" class="input-text"
        value="${gasto?.proveedor || ''}" />
    </div>
    <div class="field">
      <label>Monto $</label>
      <input type="number" id="gto-monto" class="input-text"
        placeholder="0" value="${gasto?.monto || ''}" />
    </div>
    <div class="field">
      <label>Comprobante (imagen o PDF — opcional)</label>
      ${gasto?.comprobante
        ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <a href="${gasto.comprobante}" target="_blank"
              style="color:var(--azul);font-weight:600;font-size:13px">
              📎 Ver comprobante actual
            </a>
            <span style="font-size:12px;color:var(--text-muted)">— subí uno nuevo para reemplazarlo</span>
           </div>`
        : ''}
      <div class="foto-upload-area">
        <input type="file" id="gto-comprobante" accept="image/*,application/pdf"
          onchange="previsualizarComp('gto-comp-preview', this)" />
        <div class="foto-upload-icon">📎</div>
        <div class="foto-upload-text">${gasto?.comprobante ? 'Reemplazar comprobante' : 'Ticket, factura o foto'}</div>
      </div>
      <img id="gto-comp-preview" class="foto-preview hidden" alt="preview" />
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" id="btn-guardar-gasto"
      data-id="${gasto?.id || ''}"
      data-fecha="${normalizarFecha(gasto?.fecha || '')}"
      data-comp="${gasto?.comprobante || ''}"
      onclick="guardarGastoDesdeModal()">
      ${esNuevo ? 'Registrar' : 'Guardar cambios'}
    </button>
  `);
}

function guardarGastoDesdeModal() {
  const btn  = document.getElementById('btn-guardar-gasto');
  const id   = btn?.dataset.id    || '';
  const fecha = btn?.dataset.fecha || '';
  const comp  = btn?.dataset.comp  || '';
  guardarGasto(id, fecha, comp);
}

async function guardarGasto(idExistente = '', fechaExistente = '', compExistente = '') {
  const monto = document.getElementById('gto-monto').value;
  if (!monto) { toast('Ingresá el monto', 'error'); return; }
  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  try {
    const esNuevo = !idExistente;
    const id      = idExistente || 'GTO-' + Date.now();
    const fecha   = fechaExistente || fechaHoy();
    let compUrl   = compExistente;

    const fileInput = document.getElementById('gto-comprobante');
    if (fileInput?.files[0]) {
      const b64     = await comprimirImagen(fileInput.files[0]);
      const resComp = await apiPost({ action: 'subirComprobante', id, b64, nombre: id, fecha: fechaHoy(), tipo: 'gasto' });
      if (resComp.ok) compUrl = resComp.url;
    }
    const fila = {
      id, fecha,
      tipo:        document.getElementById('gto-tipo').value,
      descripcion: document.getElementById('gto-desc').value,
      proveedor:   document.getElementById('gto-prov').value,
      monto,
      comprobante: compUrl
    };
    const res = await apiPost({ action: 'guardar', hoja: 'gastos', fila });
    if (res.ok) {
      cerrarModal();
      toast(esNuevo ? 'Gasto registrado' : 'Gasto actualizado');
      await cargarGastos();
    } else toast(res.error || 'Error', 'error');
  } finally {
    btn.textContent = idExistente ? 'Guardar cambios' : 'Registrar';
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  CAJA
// ══════════════════════════════════════════════════════════════
async function cargarCaja() {
  const fecha = document.getElementById('caja-fecha').value || fechaHoy();
  document.getElementById('caja-fecha').value = fecha;
  setLoading('caja', true);
  try {
    const [rV, rG] = await Promise.all([
      apiGet({ action: 'getAll', hoja: 'ventas', token }),
      apiGet({ action: 'getAll', hoja: 'gastos', token })
    ]);
    const ventas = (rV.data || []).filter(v => normalizarFecha(v.fecha) === fecha);
    const gastos = (rG.data || []).filter(g => normalizarFecha(g.fecha) === fecha);
    const totalV = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalG = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);

    document.getElementById('caja-ingresos').textContent    = formatPeso(totalV);
    document.getElementById('caja-gastos-total').textContent = formatPeso(totalG);
    const saldoEl = document.getElementById('caja-saldo-total');
    saldoEl.textContent = formatPeso(totalV - totalG);
    saldoEl.style.color = (totalV - totalG) >= 0 ? 'var(--verde)' : 'var(--coral)';

    const dv = document.getElementById('caja-ventas-detalle');
    dv.innerHTML = ventas.length
      ? ventas.map(v => `
          <div class="dash-list-item">
            <span>${v.hora ? v.hora + ' — ' : ''}${v.notas || 'Venta'}</span>
            <span style="font-weight:700;color:var(--verde)">${formatPeso(v.total)}</span>
          </div>`).join('')
      : '<div class="list-empty">Sin ventas</div>';

    const dg = document.getElementById('caja-gastos-detalle');
    dg.innerHTML = gastos.length
      ? gastos.map(g => `
          <div class="dash-list-item">
            <span>${g.descripcion || g.tipo}</span>
            <span style="font-weight:700;color:var(--coral)">${formatPeso(g.monto)}</span>
          </div>`).join('')
      : '<div class="list-empty">Sin gastos</div>';
  } finally {
    setLoading('caja', false);
  }
}

async function cerrarCaja() {
  const fecha  = document.getElementById('caja-fecha').value || fechaHoy();
  const totalV = document.getElementById('caja-ingresos').textContent;
  const totalG = document.getElementById('caja-gastos-total').textContent;
  const saldo  = document.getElementById('caja-saldo-total').textContent;

  abrirModal('Cerrar caja', `
    <p style="color:var(--text-secondary);margin-bottom:1rem">
      Vas a guardar el resumen del día <strong style="color:var(--text-primary)">${fecha}</strong>
      en la hoja Caja.
    </p>
    <div style="background:var(--bg-elevated);border-radius:var(--radius-sm);padding:1rem;display:flex;flex-direction:column;gap:6px">
      <div class="dash-list-item" style="padding:.3rem 0;border:none">
        <span>Ingresos</span><span style="color:var(--verde);font-weight:700">${totalV}</span>
      </div>
      <div class="dash-list-item" style="padding:.3rem 0;border:none">
        <span>Gastos</span><span style="color:var(--coral);font-weight:700">${totalG}</span>
      </div>
      <div class="dash-list-item" style="padding:.3rem 0;border:none;border-top:1px solid var(--border);margin-top:4px">
        <span style="font-weight:700">Saldo</span>
        <span style="font-weight:800;font-size:16px">${saldo}</span>
      </div>
    </div>
    <div class="field" style="margin-top:.8rem">
      <label>Notas del día (opcional)</label>
      <input type="text" id="caja-notas" class="input-text" placeholder="Ej: feria, día lento..." />
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="confirmarCierreCaja('${fecha}')">Confirmar cierre</button>
  `);
}

async function confirmarCierreCaja(fecha) {
  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  try {
    const totalV = Number(document.getElementById('caja-ingresos').textContent.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
    const totalG = Number(document.getElementById('caja-gastos-total').textContent.replace(/[^0-9,-]/g, '').replace(',', '.')) || 0;
    const fila = {
      id:          'CAJ-' + Date.now(),
      fecha,
      totalVentas: document.getElementById('caja-ingresos').textContent,
      totalGastos: document.getElementById('caja-gastos-total').textContent,
      saldo:       document.getElementById('caja-saldo-total').textContent,
      notas:       document.getElementById('caja-notas').value
    };
    const res = await apiPost({ action: 'guardar', hoja: 'caja', fila });
    if (res.ok) { cerrarModal(); toast('Caja cerrada y guardada'); }
    else toast(res.error || 'Error', 'error');
  } finally {
    btn.textContent = 'Confirmar cierre';
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  NOVEDADES
// ══════════════════════════════════════════════════════════════
async function cargarNovedades() {
  setLoading('novedades', true);
  try {
    const res   = await apiGet({ action: 'getAll', hoja: 'novedades', token });
    const lista = res.data || [];
    const grid  = document.getElementById('novedades-grid');
    if (!lista.length) {
      grid.innerHTML = '<div class="list-empty" style="grid-column:1/-1;padding:2rem">Sin novedades cargadas</div>';
      return;
    }
    grid.innerHTML = lista.map(n => `
      <div class="prod-card">
        <div class="prod-card-img" style="cursor:default">
          ${n.foto ? `<img src="${n.foto}" alt="${n.titulo}" loading="lazy" />` : '📢'}
        </div>
        <div class="prod-card-body">
          <div class="prod-card-nombre">${n.titulo || ''}</div>
          <div class="prod-card-variante">${n.descripcion || ''}</div>
          <label class="toggle-wrap" style="margin-top:6px">
            <input type="checkbox"
              ${n.publico === 'true' || n.publico === true ? 'checked' : ''}
              onchange="togglePublicoNovedad('${n.id}', this.checked)" />
            <span class="toggle-track"></span>
            <span class="toggle-label" style="font-size:11px">Visible</span>
          </label>
        </div>
        <div class="prod-card-footer">
          <button class="btn-icon" onclick="subirFotoNovedad('${n.id}')" title="Foto">🖼</button>
          <button class="btn-icon danger"
            onclick="confirmarEliminar('novedades','${n.id}','${n.foto || ''}','novedad')">✕</button>
        </div>
      </div>`).join('');
  } finally {
    setLoading('novedades', false);
  }
}

function modalNuevaNovedad() {
  abrirModal('Nueva novedad', `
    <div class="field">
      <label>Título</label>
      <input type="text" id="nov-titulo" class="input-text" />
    </div>
    <div class="field">
      <label>Descripción</label>
      <textarea id="nov-desc" class="input-text" rows="3"></textarea>
    </div>
    <label class="toggle-wrap">
      <input type="checkbox" id="nov-publico" checked />
      <span class="toggle-track"></span>
      <span class="toggle-label">Visible en la tienda</span>
    </label>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarNovedad()">Guardar</button>
  `);
}

async function guardarNovedad() {
  const titulo = document.getElementById('nov-titulo').value;
  if (!titulo) { toast('Ingresá un título', 'error'); return; }
  const fila = {
    id:          'NOV-' + Date.now(),
    titulo,
    descripcion: document.getElementById('nov-desc').value,
    foto:        '',
    publico:     document.getElementById('nov-publico').checked ? 'true' : 'false',
    creadoEn:    fechaHoy()
  };
  const res = await apiPost({ action: 'guardar', hoja: 'novedades', fila });
  if (res.ok) { cerrarModal(); toast('Novedad guardada'); await cargarNovedades(); }
  else toast(res.error || 'Error', 'error');
}

async function togglePublicoNovedad(id, publico) {
  await apiPost({ action: 'actualizarCampo', hoja: 'novedades', id, campo: 'publico', valor: String(publico) });
}

function subirFotoNovedad(id) {
  abrirModal('Subir foto de novedad', `
    <div class="foto-upload-area">
      <input type="file" id="foto-input-nov" accept="image/*"
        onchange="previsualizarFotoNov(this)" />
      <div class="foto-upload-icon">🖼</div>
      <div class="foto-upload-text">Hacé clic o arrastrá una imagen</div>
    </div>
    <img id="foto-preview-nov" class="foto-preview hidden" alt="preview" />
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="confirmarSubidaFotoNov('${id}')">Subir</button>
  `);
}

function previsualizarFotoNov(input) {
  const file    = input.files[0];
  const preview = document.getElementById('foto-preview-nov');
  if (!file || !preview) return;
  if (file.type.startsWith('image/')) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  }
}

async function confirmarSubidaFotoNov(id) {
  const input = document.getElementById('foto-input-nov');
  if (!input?.files[0]) { toast('Seleccioná un archivo', 'error'); return; }
  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Subiendo...';
  btn.disabled = true;
  try {
    const b64 = await comprimirImagen(input.files[0]);
    const res = await apiPost({ action: 'subirFoto', hoja: 'novedades', id, b64, nombre: id, categoria: 'novedades' });
    if (res.ok) { cerrarModal(); toast('Foto subida'); await cargarNovedades(); }
    else toast(res.error || 'Error al subir', 'error');
  } finally {
    btn.textContent = 'Subir';
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  FOTOS — subida masiva a Drive/Pendientes
// ══════════════════════════════════════════════════════════════
let fotosCache = [];

async function cargarFotos() {
  setLoading('fotos', true);
  try {
    const res  = await apiGet({ action: 'getFotosPendientes', token });
    fotosCache = res.data || [];
    renderFotos();
  } catch(e) {
    console.error('Error cargando fotos:', e);
  } finally {
    setLoading('fotos', false);
  }
}

function renderFotos() {
  const grid = document.getElementById('fotos-grid');
  if (!grid) return;

  if (fotosCache.length === 0) {
    grid.innerHTML = `
      <div class="list-empty" style="grid-column:1/-1;padding:3rem;text-align:center">
        <div style="font-size:36px;margin-bottom:1rem">📂</div>
        <p>No hay fotos pendientes. Subí fotos con el botón de arriba.</p>
      </div>`;
    return;
  }

  grid.innerHTML = fotosCache.map(f => `
    <div class="foto-card">
      <div class="foto-card-img">
        <img src="${f.url}" alt="${f.nombre}" loading="lazy" />
      </div>
      <div class="foto-card-body">
        <div class="foto-card-nombre">${f.nombre}</div>
        <div class="foto-card-acciones">
          <button class="btn-primary" style="font-size:12px;padding:.35rem .7rem"
            onclick="modalAsignarFoto('${f.url}','${encodeURIComponent(f.nombre)}')">
            Asignar
          </button>
          <button class="btn-icon danger"
            onclick="eliminarFotoPendiente('${f.url}')">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function subirFotosPendientes(input) {
  const files = Array.from(input.files);
  if (!files.length) return;

  const label = input.closest('label');
  const span  = label?.querySelector('span');
  if (span) span.textContent = `Subiendo 0/${files.length}...`;

  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      const b64    = await comprimirImagen(files[i]);
      const nombre = files[i].name.replace(/\.[^.]+$/, '') + '_' + Date.now();
      const res    = await apiPost({ action: 'subirFotoPendiente', b64, nombre });
      if (res.ok) ok++;
      if (span) span.textContent = `Subiendo ${i+1}/${files.length}...`;
    } catch(e) { console.error('Error subiendo', files[i].name, e); }
  }

  if (span) span.textContent = '+ Subir fotos';
  input.value = '';
  toast(`${ok} foto${ok !== 1 ? 's' : ''} subida${ok !== 1 ? 's' : ''}`);
  await cargarFotos();
}

function modalAsignarFoto(fotoUrl, fotoNombreEncoded) {
  const fotoNombre = decodeURIComponent(fotoNombreEncoded);
  if (!productosCache.length) {
    toast('Cargá la sección Productos primero', 'error'); return;
  }
  const opts = productosCache.map(p =>
    `<option value="${p.id}">[${p.codigo||''}] ${p.nombre}${p.variante?' — '+p.variante:''}</option>`
  ).join('');

  abrirModal('Asignar foto a producto', `
    <img src="${fotoUrl}"
      style="width:100%;max-height:200px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:1rem" />
    <div class="field">
      <label>Seleccioná el producto</label>
      <select id="asignar-prod-id" class="input-select">
        <option value="">— Elegí un producto —</option>
        ${opts}
      </select>
    </div>
    <p style="font-size:12px;color:var(--text-muted);margin-top:.5rem">
      La foto se moverá a la carpeta del producto automáticamente.
    </p>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary"
      onclick="confirmarAsignarFoto('${fotoUrl}','${fotoNombreEncoded}')">Asignar</button>
  `);
}

async function confirmarAsignarFoto(fotoUrl, fotoNombreEncoded) {
  const prodId = document.getElementById('asignar-prod-id').value;
  if (!prodId) { toast('Seleccioná un producto', 'error'); return; }

  const prod = productosCache.find(p => p.id === prodId);
  if (!prod)  { toast('Producto no encontrado', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Asignando...';
  btn.disabled = true;

  try {
    const res = await apiPost({
      action:     'asignarFoto',
      fotoUrl,
      fotoNombre: decodeURIComponent(fotoNombreEncoded),
      productoId: prodId,
      categoria:  prod.categoria || ''
    });
    if (res.ok) {
      cerrarModal();
      toast('Foto asignada al producto');
      await Promise.all([cargarFotos(), cargarProductos()]);
    } else {
      toast(res.error || 'Error al asignar', 'error');
    }
  } finally {
    btn.textContent = 'Asignar';
    btn.disabled = false;
  }
}

async function eliminarFotoPendiente(fotoUrl) {
  const res = await apiPost({ action: 'eliminarFotoPendiente', fotoUrl });
  if (res.ok) {
    toast('Foto eliminada');
    fotosCache = fotosCache.filter(f => f.url !== fotoUrl);
    renderFotos();
  } else {
    toast(res.error || 'Error', 'error');
  }
}

// ══════════════════════════════════════════════════════════════
//  RECIBOS — PDF y WhatsApp
// ══════════════════════════════════════════════════════════════

function construirDatosVenta(id) {
  // Busca en ventasCache, si no lo encuentra devuelve null
  const todas = ventasCache;
  return todas.find(v => v.id === id) || null;
}

async function generarRecibo(ventaId) {
  const v = ventasCache.find(v => v.id === ventaId);
  if (!v) { toast('Venta no encontrada', 'error'); return; }

  const btn = document.querySelector(`button[onclick="generarRecibo('${ventaId}')"]`);
  if (btn) { btn.textContent = '...'; btn.disabled = true; }

  try {
    // Parsear items del campo productos
    const items = parsearItemsVenta(v.productos || '', v.notas || '', v.total);

    const res = await apiPost({
      action:    'generarReciboPDF',
      id:        v.id,
      fecha:     normalizarFecha(v.fecha),
      hora:      v.hora || '',
      items,
      total:     v.total,
      medioPago: v.medioPago || '',
      canal:     v.canal || '',
      notas:     v.notas || ''
    });

    if (res.ok) {
      window.open(res.url, '_blank');
      toast('Recibo generado');
    } else {
      toast(res.error || 'Error al generar el recibo', 'error');
    }
  } finally {
    if (btn) { btn.textContent = '⎙'; btn.disabled = false; }
  }
}

async function reciboWhatsApp(ventaId) {
  const v = ventasCache.find(v => v.id === ventaId);
  if (!v) { toast('Venta no encontrada', 'error'); return; }

  const btn = document.querySelector(`button[onclick="reciboWhatsApp('${ventaId}')"]`);
  if (btn) { btn.disabled = true; }

  try {
    // Primero generar el PDF
    const items = parsearItemsVenta(v.productos || '', v.notas || '', v.total);
    const res = await apiPost({
      action:    'generarReciboPDF',
      id:        v.id,
      fecha:     normalizarFecha(v.fecha),
      hora:      v.hora || '',
      items,
      total:     v.total,
      medioPago: v.medioPago || '',
      canal:     v.canal || '',
      notas:     v.notas || ''
    });

    if (!res.ok) { toast(res.error || 'Error al generar el recibo', 'error'); return; }

    // Armar mensaje WA con el link del PDF
    const waNum = String(localStorage.getItem('tcd_whatsapp') || '1167682727').replace(/\D/g, '');
    const fecha = normalizarFecha(v.fecha);
    const msg = encodeURIComponent(
      `*Recibo de venta — Tu Casa de Detalles*\n` +
      `Fecha: ${fecha}${v.hora ? ' ' + v.hora : ''}\n` +
      `Total: $${Number(v.total).toLocaleString('es-AR')}\n` +
      `Pago: ${v.medioPago || ''}\n\n` +
      `📎 Ver recibo: ${res.url}`
    );
    window.open(`https://wa.me/54${waNum}?text=${msg}`, '_blank');
    toast('Abriendo WhatsApp...');
  } finally {
    if (btn) { btn.disabled = false; }
  }
}

function parsearItemsVenta(productos, notas, total) {
  // Intenta parsear "2x Producto (variante), 1x Otro"
  const items = [];
  if (productos) {
    const partes = productos.split(',');
    partes.forEach(p => {
      const m = p.trim().match(/^(\d+)x\s+(.+)$/);
      if (m) {
        items.push({ nombre: m[2].trim(), cantidad: parseInt(m[1]), precio: 0 });
      }
    });
  }
  // Si no se pudo parsear, usar notas como ítem genérico
  if (items.length === 0 && (notas || total)) {
    items.push({ nombre: notas || 'Productos varios', cantidad: 1, precio: Number(total || 0) });
  }
  return items;
}

// ══════════════════════════════════════════════════════════════
//  RESUMEN MENSUAL
// ══════════════════════════════════════════════════════════════

function getMesActual() {
  const d = new Date();
  d.setMonth(d.getMonth() + resumenMesOffset);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function getMesLabel() {
  const { year, month } = getMesActual();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${meses[month]} ${year}`;
}

function getMesPrefijo() {
  const { year, month } = getMesActual();
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

async function cargarResumen() {
  setLoading('resumen', true);
  actualizarLabelMes();
  try {
    const prefijo = getMesPrefijo();
    const [rV, rG] = await Promise.all([
      apiGet({ action: 'getAll', hoja: 'ventas', token }),
      apiGet({ action: 'getAll', hoja: 'gastos', token })
    ]);

    const ventas = (rV.data || []).filter(v => normalizarFecha(v.fecha).startsWith(prefijo));
    const gastos = (rG.data || []).filter(g => normalizarFecha(g.fecha).startsWith(prefijo));

    const totalV = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
    const totalG = gastos.reduce((s, g) => s + Number(g.monto  || 0), 0);
    const saldo  = totalV - totalG;

    document.getElementById('res-ingresos').textContent    = formatPeso(totalV);
    document.getElementById('res-gastos').textContent      = formatPeso(totalG);
    document.getElementById('res-ventas-cant').textContent = ventas.length + ' ventas';
    const saldoEl = document.getElementById('res-saldo');
    saldoEl.textContent = formatPeso(saldo);
    saldoEl.style.color = saldo >= 0 ? 'var(--verde)' : 'var(--coral)';

    // Agrupar por día
    const dias = {};
    ventas.forEach(v => {
      const d = normalizarFecha(v.fecha);
      if (!dias[d]) dias[d] = { ventas: 0, gastos: 0 };
      dias[d].ventas += Number(v.total || 0);
    });
    gastos.forEach(g => {
      const d = normalizarFecha(g.fecha);
      if (!dias[d]) dias[d] = { ventas: 0, gastos: 0 };
      dias[d].gastos += Number(g.monto || 0);
    });

    const filas = Object.keys(dias).sort().map(d => ({
      fecha:  d.split('-').reverse().join('/'),
      ventas: dias[d].ventas,
      gastos: dias[d].gastos,
      saldo:  dias[d].ventas - dias[d].gastos
    }));

    const wrap = document.getElementById('resumen-tabla');
    if (!wrap) return;

    if (filas.length === 0) {
      wrap.innerHTML = '<div class="list-empty" style="padding:2rem">Sin movimientos en este mes</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="tabla">
        <thead>
          <tr><th>Fecha</th><th>Ventas</th><th>Gastos</th><th>Saldo</th></tr>
        </thead>
        <tbody>
          ${filas.map(f => `
            <tr>
              <td data-label="Fecha">${f.fecha}</td>
              <td data-label="Ventas" style="color:var(--verde);font-weight:700">${formatPeso(f.ventas)}</td>
              <td data-label="Gastos" style="color:var(--coral);font-weight:700">${formatPeso(f.gastos)}</td>
              <td data-label="Saldo" style="font-weight:700;color:${f.saldo >= 0 ? 'var(--verde)' : 'var(--coral)'}">${formatPeso(f.saldo)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;

    // Guardar datos para el PDF
    window._resumenDatos = { filas, totalV, totalG, saldo, cantV: ventas.length };

  } finally {
    setLoading('resumen', false);
  }
}

function actualizarLabelMes() {
  const el = document.getElementById('resumen-mes-label');
  if (el) el.textContent = getMesLabel();
}

function cambiarMes(delta) {
  resumenMesOffset += delta;
  cargarResumen();
}

async function descargarResumenPDF() {
  const datos = window._resumenDatos;
  if (!datos) { toast('Cargá el resumen primero', 'error'); return; }

  const btn = document.getElementById('btn-descargar-resumen');
  if (btn) { btn.textContent = '...'; btn.disabled = true; }

  try {
    const res = await apiPost({
      action:      'generarResumenPDF',
      mes:         getMesPrefijo(),
      mesLabel:    getMesLabel(),
      filas:       datos.filas,
      totalVentas: datos.totalV,
      totalGastos: datos.totalG,
      saldo:       datos.saldo,
      cantVentas:  datos.cantV
    });

    if (res.ok) {
      window.open(res.url, '_blank');
      toast('PDF generado');
    } else {
      toast(res.error || 'Error al generar el PDF', 'error');
    }
  } finally {
    if (btn) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar PDF`;
      btn.disabled = false;
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  CALCULADORA
// ══════════════════════════════════════════════════════════════
let calcState = { display: '0', expr: '', operand: null, operator: null, newNum: true };

function initCalculadora() {
  calcRender();
}

function calcRender() {
  const disp = document.getElementById('calc-display');
  const expr = document.getElementById('calc-expr');
  if (disp) disp.textContent = calcState.display;
  if (expr) expr.textContent = calcState.expr;
}

function calcInput(key) {
  const s = calcState;

  if (key === 'AC') {
    calcState = { display: '0', expr: '', operand: null, operator: null, newNum: true };
    calcRender(); return;
  }

  if (key === '+/-') {
    s.display = String(parseFloat(s.display) * -1);
    calcRender(); return;
  }

  if (key === '%') {
    s.display = String(parseFloat(s.display) / 100);
    calcRender(); return;
  }

  if (['÷', '×', '−', '+'].includes(key)) {
    s.operand  = parseFloat(s.display);
    s.operator = key;
    s.expr     = s.display + ' ' + key;
    s.newNum   = true;
    calcRender(); return;
  }

  if (key === '=') {
    if (s.operator === null) return;
    const a = s.operand, b = parseFloat(s.display);
    let result;
    if (s.operator === '÷') result = b !== 0 ? a / b : 'Error';
    if (s.operator === '×') result = a * b;
    if (s.operator === '−') result = a - b;
    if (s.operator === '+') result = a + b;
    s.expr     = s.expr + ' ' + s.display + ' =';
    s.display  = result === 'Error' ? 'Error' : String(parseFloat(result.toFixed(10)));
    s.operand  = null;
    s.operator = null;
    s.newNum   = true;
    calcRender(); return;
  }

  if (key === '.') {
    if (s.newNum) { s.display = '0.'; s.newNum = false; calcRender(); return; }
    if (!s.display.includes('.')) s.display += '.';
    calcRender(); return;
  }

  // Número
  if (s.newNum || s.display === '0') {
    s.display = key;
    s.newNum  = false;
  } else {
    if (s.display.replace('-','').replace('.','').length < 12)
      s.display += key;
  }
  calcRender();
}

// Herramientas de negocio
function calcMargen() {
  const costo  = parseFloat(document.getElementById('mg-costo')?.value);
  const margen = parseFloat(document.getElementById('mg-margen')?.value);
  const el     = document.getElementById('mg-result');
  if (!el) return;
  if (isNaN(costo) || isNaN(margen)) { el.textContent = 'Ingresá costo y margen'; el.style.color = 'var(--coral)'; return; }
  const venta  = costo * (1 + margen / 100);
  el.style.color = 'var(--verde)';
  el.textContent = `Precio de venta: $${venta.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:2})} (ganancia: $${(venta-costo).toLocaleString('es-AR', {maximumFractionDigits:2})})`;
}

function calcDescuento() {
  const precio = parseFloat(document.getElementById('dc-precio')?.value);
  const desc   = parseFloat(document.getElementById('dc-desc')?.value);
  const el     = document.getElementById('dc-result');
  if (!el) return;
  if (isNaN(precio) || isNaN(desc)) { el.textContent = 'Ingresá precio y descuento'; el.style.color = 'var(--coral)'; return; }
  const final  = precio * (1 - desc / 100);
  el.style.color = 'var(--verde)';
  el.textContent = `Precio final: $${final.toLocaleString('es-AR', {minimumFractionDigits:0, maximumFractionDigits:2})} (ahorro: $${(precio-final).toLocaleString('es-AR', {maximumFractionDigits:2})})`;
}

function calcGanancia() {
  const venta = parseFloat(document.getElementById('gn-venta')?.value);
  const costo = parseFloat(document.getElementById('gn-costo')?.value);
  const el    = document.getElementById('gn-result');
  if (!el) return;
  if (isNaN(venta) || isNaN(costo)) { el.textContent = 'Ingresá venta y costo'; el.style.color = 'var(--coral)'; return; }
  const gan   = venta - costo;
  const pct   = venta > 0 ? (gan / venta * 100) : 0;
  el.style.color = gan >= 0 ? 'var(--verde)' : 'var(--coral)';
  el.textContent = `Ganancia: $${gan.toLocaleString('es-AR', {maximumFractionDigits:2})} (${pct.toFixed(1)}% sobre venta)`;
}

// ══════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════
async function cargarConfig() {
  const res = await apiGet({ action: 'getConfig' });
  const cfg = res.data || {};
  document.getElementById('cfg-nombre').value    = cfg.nombreNegocio || '';
  document.getElementById('cfg-whatsapp').value  = cfg.whatsapp || '';
  document.getElementById('cfg-facebook').value  = cfg.facebook || '';
  document.getElementById('cfg-instagram').value = cfg.instagram || '';
  document.getElementById('cfg-mp').value        = cfg.linkMP || '';
  document.getElementById('cfg-stock-min').value = cfg.stockMinAlerta || 3;
  localStorage.setItem('tcd_stock_min', cfg.stockMinAlerta || 3);
  if (cfg.whatsapp) localStorage.setItem('tcd_whatsapp', cfg.whatsapp);
}

async function guardarConfig() {
  const campos = [
    { clave: 'nombreNegocio', valor: document.getElementById('cfg-nombre').value },
    { clave: 'whatsapp',      valor: document.getElementById('cfg-whatsapp').value },
    { clave: 'facebook',      valor: document.getElementById('cfg-facebook').value },
    { clave: 'instagram',     valor: document.getElementById('cfg-instagram').value },
    { clave: 'linkMP',        valor: document.getElementById('cfg-mp').value },
    { clave: 'stockMinAlerta',valor: document.getElementById('cfg-stock-min').value }
  ];
  const btn = document.getElementById('btn-guardar-config');
  btn.textContent = 'Guardando...';
  btn.disabled = true;
  try {
    for (const c of campos) {
      await apiPost({ action: 'guardarConfig', clave: c.clave, valor: c.valor });
    }
    localStorage.setItem('tcd_stock_min', document.getElementById('cfg-stock-min').value);
    toast('Configuración guardada');
  } finally {
    btn.textContent = 'Guardar cambios';
    btn.disabled = false;
  }
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initTema();

  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  document.getElementById('modal-close').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  document.getElementById('btn-menu').addEventListener('click', abrirSidebar);

  document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => modalProducto());
  document.getElementById('btn-nuevo-inventario')?.addEventListener('click', modalNuevoInventario);
  document.getElementById('btn-nueva-venta')?.addEventListener('click', modalNuevaVenta);
  document.getElementById('btn-nuevo-gasto')?.addEventListener('click', modalNuevoGasto);
  document.getElementById('btn-nueva-novedad')?.addEventListener('click', modalNuevaNovedad);
  document.getElementById('btn-guardar-config')?.addEventListener('click', guardarConfig);
  document.getElementById('btn-caja-cerrar')?.addEventListener('click', cerrarCaja);
  document.getElementById('btn-ir-resumen')?.addEventListener('click', () => navegarA('resumen'));
  document.getElementById('btn-mes-prev')?.addEventListener('click', () => cambiarMes(-1));
  document.getElementById('btn-mes-next')?.addEventListener('click', () => cambiarMes(1));
  document.getElementById('btn-descargar-resumen')?.addEventListener('click', descargarResumenPDF);

  document.getElementById('ventas-fecha')?.addEventListener('change', cargarVentas);
  document.getElementById('gastos-fecha')?.addEventListener('change', cargarGastos);
  document.getElementById('caja-fecha')?.addEventListener('change', cargarCaja);

  if (token) mostrarApp();
  bindNav();
});
