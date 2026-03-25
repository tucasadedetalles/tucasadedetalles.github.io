// ============================================================
//  Tu Casa de Detalles — admin/script.js
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzqUSx96if9nNAyoVWeyKP7hvzVexv8e-I7W8l4ud30qfJXRf6qYF7p8xhTKxy6mMo/exec';

const CATEGORIAS = [
  'Accesorios Pelo',
  'Accesorios Invierno',
  'Morrales',
  'Libreria',
  'Llaveros',
  'Cuidado Personal',
  'Otros'
];

const PREFIJOS = {
  'Accesorios Pelo':     'ACP',
  'Accesorios Invierno': 'ACI',
  'Morrales':            'MOR',
  'Libreria':            'LIB',
  'Llaveros':            'LLA',
  'Cuidado Personal':    'CUI',
  'Otros':               'OTR'
};

// ── Estado global ────────────────────────────────────────────
let token       = localStorage.getItem('tcd_token') || '';
let seccionActual = 'dashboard';
let productosCache  = [];
let ventasCache     = [];
let gastosCache     = [];
let inventariosCache = [];

// ── Tema ─────────────────────────────────────────────────────
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

// ── API ──────────────────────────────────────────────────────
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

// ── Toast ────────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── Modal ────────────────────────────────────────────────────
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

// ── Formato ──────────────────────────────────────────────────
function formatPeso(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function fechaCorta(f) {
  if (!f) return '';
  const d = new Date(f);
  return d.toLocaleDateString('es-AR');
}

// ── Compresión de imagen a JPG ────────────────────────────────
function comprimirImagen(file, maxPx = 1200, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      // No es imagen — leer como base64 sin comprimir (PDF, etc.)
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

// ── Nav: eventos tras build ───────────────────────────────────
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
  if (btnClose)  btnClose.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  // Sincronizar ícono de tema
  const tema = localStorage.getItem('tcd_tema') || 'dark';
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = tema === 'dark' ? '☀' : '☾';
}

function navegarA(seccion) {
  seccionActual = seccion;

  // Secciones
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + seccion);
  if (sec) sec.classList.add('active');

  // Nav activo
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.section === seccion);
  });

  // Título topbar
  const labels = {
    dashboard: 'Dashboard', productos: 'Productos', inventarios: 'Inventarios',
    ventas: 'Ventas', gastos: 'Gastos', caja: 'Caja diaria',
    novedades: 'Novedades', config: 'Configuración'
  };
  document.getElementById('topbar-title').textContent = labels[seccion] || seccion;

  // Cerrar sidebar mobile
  document.getElementById('sidebar')?.classList.remove('open');

  // Cargar datos de la sección
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
  if (seccion === 'config')      await cargarConfig();
}

// ── LOGIN ────────────────────────────────────────────────────
async function login() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('btn-login');

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

// ── DASHBOARD ─────────────────────────────────────────────────
async function cargarDashboard() {
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

    // Stats
    const ventasHoy  = ventas.filter(v => v.fecha === hoy);
    const totalHoy   = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0);
    const gastosMes  = gastos
      .filter(g => String(g.fecha || '').startsWith(mesActual))
      .reduce((s, g) => s + Number(g.monto || 0), 0);
    const stockMin   = Number(localStorage.getItem('tcd_stock_min') || 3);
    const stockBajo  = productos.filter(p => Number(p.stock || 0) <= stockMin);

    document.getElementById('stat-ventas-hoy').textContent  = formatPeso(totalHoy);
    document.getElementById('stat-ventas-cant').textContent = ventasHoy.length + ' transacciones';
    document.getElementById('stat-gastos-mes').textContent  = formatPeso(gastosMes);
    document.getElementById('stat-saldo').textContent       = formatPeso(totalHoy - gastosMes);
    document.getElementById('stat-stock-bajo').textContent  = stockBajo.length;

    // Lista ventas hoy
    const listaV = document.getElementById('dash-ventas-lista');
    if (ventasHoy.length === 0) {
      listaV.innerHTML = '<div class="list-empty">Sin ventas registradas hoy</div>';
    } else {
      listaV.innerHTML = ventasHoy.slice(-5).reverse().map(v => `
        <div class="dash-list-item">
          <span class="dash-list-label">${v.notas || 'Venta'}</span>
          <span class="dash-list-valor">${formatPeso(v.total)}</span>
        </div>
      `).join('');
    }

    // Lista stock bajo
    const listaS = document.getElementById('dash-stock-lista');
    if (stockBajo.length === 0) {
      listaS.innerHTML = '<div class="list-empty">Todo el stock está bien</div>';
    } else {
      listaS.innerHTML = stockBajo.slice(0, 6).map(p => `
        <div class="dash-list-item">
          <span class="dash-list-label">${p.nombre} — ${p.variante || ''}</span>
          <span class="dash-list-stock low">${p.stock} unid.</span>
        </div>
      `).join('');
    }

  } catch (e) {
    console.error('Dashboard error:', e);
  }
}

// ── PRODUCTOS ─────────────────────────────────────────────────
async function cargarProductos() {
  const res = await apiGet({ action: 'getAll', hoja: 'productos', token });
  productosCache = res.data || [];
  renderProductos(productosCache);

  document.getElementById('prod-search').oninput = () => filtrarProductos();
  document.getElementById('prod-filter-cat').onchange = () => filtrarProductos();
}

function filtrarProductos() {
  const q   = document.getElementById('prod-search').value.toLowerCase();
  const cat = document.getElementById('prod-filter-cat').value;
  const filtrados = productosCache.filter(p => {
    const matchQ   = !q   || p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
    const matchCat = !cat || p.categoria === cat;
    return matchQ && matchCat;
  });
  renderProductos(filtrados);
}

function renderProductos(lista) {
  const grid = document.getElementById('productos-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="list-empty" style="grid-column:1/-1;padding:2rem">Sin productos cargados aún</div>';
    return;
  }
  const stockMin = Number(localStorage.getItem('tcd_stock_min') || 3);
  grid.innerHTML = lista.map(p => {
    const stock   = Number(p.stock || 0);
    const stockCls = stock === 0 ? 'out' : stock <= stockMin ? 'low' : 'ok';
    const stockTxt = stock === 0 ? 'Sin stock' : stock + ' unid.';
    const prefijo  = PREFIJOS[p.categoria] || 'OTR';
    const fotoHTML = p.foto
      ? `<div class="prod-card-img"><img src="${p.foto}" alt="${p.nombre}" loading="lazy" /></div>`
      : `<div class="prod-card-img">📦</div>`;
    return `
      <div class="prod-card" data-id="${p.id}">
        ${fotoHTML}
        <div class="prod-card-body">
          <div class="prod-card-codigo">${p.codigo || ''} <span class="cat-badge cat-${prefijo}">${p.categoria || ''}</span></div>
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
            <span class="toggle-label" style="font-size:11px">Visible</span>
          </div>
        </div>
        <div class="prod-card-footer">
          <button class="btn-icon" onclick="editarProducto('${p.id}')" title="Editar">✎</button>
          <button class="btn-icon" onclick="subirFotoProducto('${p.id}','${p.categoria}')" title="Foto">🖼</button>
          <button class="btn-icon danger" onclick="eliminarProducto('${p.id}','${p.foto || ''}')" title="Eliminar">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleVisible(id, visible) {
  await apiPost({ action: 'actualizarCampo', hoja: 'productos', id, campo: 'visible', valor: String(visible) });
}

function modalProducto(prod = null) {
  const esNuevo = !prod;
  const cats    = CATEGORIAS.map(c => `<option${prod?.categoria === c ? ' selected' : ''}>${c}</option>`).join('');
  abrirModal(esNuevo ? 'Nuevo producto' : 'Editar producto', `
    <div class="field">
      <label>Categoría</label>
      <select id="mp-cat" class="input-select" onchange="actualizarCodigoProd()">${cats}</select>
    </div>
    <div class="field">
      <label>Código</label>
      <input type="text" id="mp-codigo" class="input-text" value="${prod?.codigo || ''}" readonly
        style="opacity:.6;cursor:not-allowed" />
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
      <label>Descripción <button class="btn-gemini" type="button" onclick="generarDescripcion()">✦ Gemini</button></label>
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
    <label class="toggle-wrap">
      <input type="checkbox" id="mp-visible" ${prod?.visible === 'true' || prod?.visible === true ? 'checked' : ''} />
      <span class="toggle-track"></span>
      <span class="toggle-label">Visible en la tienda</span>
    </label>
    <label class="toggle-wrap">
      <input type="checkbox" id="mp-destacado" ${prod?.destacado === 'true' || prod?.destacado === true ? 'checked' : ''} />
      <span class="toggle-track"></span>
      <span class="toggle-label">Destacado</span>
    </label>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarProducto('${prod?.id || ''}')">Guardar</button>
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

async function guardarProducto(idExistente) {
  const fila = {
    id:          idExistente || 'PRD-' + Date.now(),
    codigo:      document.getElementById('mp-codigo').value,
    nombre:      document.getElementById('mp-nombre').value,
    categoria:   document.getElementById('mp-cat').value,
    variante:    document.getElementById('mp-variante').value,
    descripcion: document.getElementById('mp-descripcion').value,
    precioVenta: document.getElementById('mp-pventa').value,
    precioCosto: document.getElementById('mp-pcosto').value,
    stock:       document.getElementById('mp-stock').value,
    stockMinimo: document.getElementById('mp-stock-min').value,
    visible:     document.getElementById('mp-visible').checked ? 'true' : 'false',
    destacado:   document.getElementById('mp-destacado').checked ? 'true' : 'false',
    foto:        '',
    creadoEn:    idExistente ? '' : fechaHoy()
  };
  if (!fila.nombre) { toast('El nombre es obligatorio', 'error'); return; }
  const res = await apiPost({ action: 'guardar', hoja: 'productos', fila });
  if (res.ok) {
    cerrarModal();
    toast('Producto guardado');
    await cargarProductos();
  } else {
    toast(res.error || 'Error al guardar', 'error');
  }
}

function editarProducto(id) {
  const prod = productosCache.find(p => p.id === id);
  if (prod) modalProducto(prod);
}

function subirFotoProducto(id, categoria) {
  abrirModal('Subir foto', `
    <div class="foto-upload-area" id="foto-drop">
      <input type="file" id="foto-input" accept="image/*" onchange="previsualizarFoto(this)" />
      <div class="foto-upload-icon">🖼</div>
      <div class="foto-upload-text">Hacé clic o arrastrá una imagen<br><small>Se convierte automáticamente a JPG</small></div>
    </div>
    <img id="foto-preview-img" class="foto-preview hidden" alt="preview" />
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="confirmarSubidaFoto('${id}','${categoria}','productos')">Subir</button>
  `);
}

function previsualizarFoto(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('foto-preview-img');
  if (file.type.startsWith('image/')) {
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.classList.remove('hidden');
  }
}

async function confirmarSubidaFoto(id, categoria, hoja) {
  const input = document.getElementById('foto-input');
  if (!input?.files[0]) { toast('Seleccioná un archivo', 'error'); return; }
  const file = input.files[0];
  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Subiendo...';
  btn.disabled = true;
  try {
    const b64 = await comprimirImagen(file);
    const res = await apiPost({ action: 'subirFoto', hoja, id, b64, nombre: id, categoria });
    if (res.ok) {
      cerrarModal();
      toast('Foto subida');
      if (hoja === 'productos') await cargarProductos();
      if (hoja === 'novedades') await cargarNovedades();
    } else {
      toast(res.error || 'Error al subir', 'error');
    }
  } catch (e) {
    toast('Error al procesar la imagen', 'error');
  } finally {
    btn.textContent = 'Subir';
    btn.disabled = false;
  }
}

function eliminarProducto(id, fotoUrl) {
  abrirModal('Eliminar producto', `
    <p style="color:var(--text-secondary)">¿Seguro que querés eliminar este producto? Esta acción no se puede deshacer.</p>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" style="background:var(--coral)" onclick="confirmarEliminarProducto('${id}','${fotoUrl}')">Eliminar</button>
  `);
}

async function confirmarEliminarProducto(id, fotoUrl) {
  const res = await apiPost({ action: 'eliminarConFoto', hoja: 'productos', id, fotoUrl });
  if (res.ok) {
    cerrarModal();
    toast('Producto eliminado');
    await cargarProductos();
  } else {
    toast(res.error || 'Error al eliminar', 'error');
  }
}

// ── INVENTARIOS ───────────────────────────────────────────────
async function cargarInventarios() {
  const res = await apiGet({ action: 'getInventarios', token });
  inventariosCache = res.data || [];
  renderInventarios(inventariosCache);
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
      <div class="inv-card-prefijo">Prefijo: ${inv.prefijo} · Hoja: ${inv.hojaId}</div>
      <div class="inv-card-actions">
        <button class="btn-secondary" onclick="abrirInventario('${inv.hojaId}','${inv.nombre}')">Ver items</button>
        <button class="btn-icon danger" onclick="eliminarInventarioModal('${inv.hojaId}')">✕</button>
      </div>
    </div>
  `).join('');
}

function modalNuevoInventario() {
  abrirModal('Nuevo inventario', `
    <div class="field">
      <label>Nombre</label>
      <input type="text" id="inv-nombre" class="input-text" placeholder="Ej: Temporada Verano" />
    </div>
    <div class="field">
      <label>Prefijo (3 letras)</label>
      <input type="text" id="inv-prefijo" class="input-text" placeholder="Ej: VER" maxlength="5" style="text-transform:uppercase" />
    </div>
    <label class="toggle-wrap">
      <input type="checkbox" id="inv-privado" />
      <span class="toggle-track"></span>
      <span class="toggle-label">Inventario privado (solo visible en admin)</span>
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
  if (res.ok) {
    cerrarModal();
    toast('Inventario creado');
    await cargarInventarios();
  } else {
    toast(res.error || 'Error al crear', 'error');
  }
}

async function abrirInventario(hojaId, nombre) {
  const res = await apiGet({ action: 'getAll', hoja: hojaId, token });
  const items = res.data || [];
  abrirModal('Inventario: ' + nombre, `
    <button class="btn-primary" style="margin-bottom:1rem" onclick="modalNuevoItemInventario('${hojaId}')">+ Agregar item</button>
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
              <td><button class="btn-icon danger" onclick="eliminarItemInv('${hojaId}','${it.id}')">✕</button></td>
            </tr>
          `).join('')}</tbody>
        </table>`
    }
  `);
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
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarItemInventario('${hojaId}')">Guardar</button>
  `);
}

async function guardarItemInventario(hojaId) {
  const res1 = await apiGet({ action: 'siguienteCodigo', hoja: hojaId });
  const fila = {
    id:        'IT-' + Date.now(),
    codigo:    res1.codigo || '',
    nombre:    document.getElementById('ii-nombre').value,
    categoria: document.getElementById('ii-cat').value,
    cantidad:  document.getElementById('ii-cant').value,
    notas:     document.getElementById('ii-notas').value,
    foto: '', visible: 'true', creadoEn: fechaHoy()
  };
  const res = await apiPost({ action: 'guardar', hoja: hojaId, fila });
  if (res.ok) { cerrarModal(); toast('Item guardado'); }
  else toast(res.error || 'Error', 'error');
}

async function eliminarItemInv(hojaId, id) {
  const res = await apiPost({ action: 'eliminar', hoja: hojaId, id });
  if (res.ok) { cerrarModal(); toast('Item eliminado'); }
  else toast(res.error || 'Error', 'error');
}

function eliminarInventarioModal(hojaId) {
  abrirModal('Eliminar inventario', `
    <p style="color:var(--text-secondary)">¿Eliminar este inventario y todos sus items? También podés borrar las fotos del Drive.</p>
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
  if (res.ok) {
    cerrarModal();
    toast('Inventario eliminado');
    await cargarInventarios();
  } else {
    toast(res.error || 'Error', 'error');
  }
}

// ── VENTAS ────────────────────────────────────────────────────
async function cargarVentas() {
  const fecha = document.getElementById('ventas-fecha').value || fechaHoy();
  document.getElementById('ventas-fecha').value = fecha;
  const res = await apiGet({ action: 'getAll', hoja: 'ventas', token });
  ventasCache = (res.data || []).filter(v => v.fecha === fecha);
  renderTablaVentas(ventasCache);
}

function renderTablaVentas(lista) {
  const wrap = document.getElementById('ventas-tabla');
  if (!lista.length) {
    wrap.innerHTML = '<div class="list-empty" style="padding:2rem">Sin ventas para esta fecha</div>';
    return;
  }
  wrap.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Hora</th><th>Productos</th><th>Total</th><th>Pago</th><th>Canal</th><th>Comprobante</th><th></th></tr></thead>
      <tbody>${lista.map(v => `
        <tr>
          <td>${v.hora || ''}</td>
          <td>${v.notas || ''}</td>
          <td>${formatPeso(v.total)}</td>
          <td>${v.medioPago || ''}</td>
          <td>${v.canal || ''}</td>
          <td>${v.comprobante
            ? `<a href="${v.comprobante}" target="_blank" style="color:var(--azul)">Ver</a>`
            : '—'}</td>
          <td><button class="btn-icon danger" onclick="eliminarVenta('${v.id}','${v.comprobante || ''}')">✕</button></td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;
}

function modalNuevaVenta() {
  abrirModal('Registrar venta', `
    <div class="field">
      <label>Descripción / productos</label>
      <input type="text" id="vta-notas" class="input-text" placeholder="Ej: 2x gomitas, 1x vinchas" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.8rem">
      <div class="field">
        <label>Total</label>
        <input type="number" id="vta-total" class="input-text" placeholder="0" />
      </div>
      <div class="field">
        <label>Medio de pago</label>
        <select id="vta-pago" class="input-select">
          <option>Efectivo</option>
          <option>Transferencia</option>
          <option>MercadoPago</option>
        </select>
      </div>
    </div>
    <div class="field">
      <label>Canal</label>
      <select id="vta-canal" class="input-select">
        <option>Local</option>
        <option>Web</option>
        <option>WhatsApp</option>
      </select>
    </div>
    <div class="field">
      <label>Comprobante (imagen o PDF)</label>
      <div class="foto-upload-area">
        <input type="file" id="vta-comprobante" accept="image/*,application/pdf"
          onchange="previsualizarComprobante(this)" />
        <div class="foto-upload-icon">📎</div>
        <div class="foto-upload-text">Opcional — imagen o PDF</div>
      </div>
      <img id="vta-comp-preview" class="foto-preview hidden" alt="preview" style="margin-top:6px" />
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarVenta()">Registrar</button>
  `);
}

function previsualizarComprobante(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('vta-comp-preview');
  if (file.type.startsWith('image/') && preview) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  }
}

async function guardarVenta() {
  const total = document.getElementById('vta-total').value;
  if (!total) { toast('Ingresá el total', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const id    = 'VTA-' + Date.now();
    const fecha = fechaHoy();
    const hora  = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    // Subir comprobante si hay
    let compUrl = '';
    const fileInput = document.getElementById('vta-comprobante');
    if (fileInput?.files[0]) {
      const b64 = await comprimirImagen(fileInput.files[0]);
      const resComp = await apiPost({
        action: 'subirComprobante',
        id, b64,
        nombre: id,
        fecha,
        tipo: 'venta'
      });
      if (resComp.ok) compUrl = resComp.url;
    }

    const fila = {
      id, fecha, hora,
      productos:  '',
      total,
      medioPago:  document.getElementById('vta-pago').value,
      canal:      document.getElementById('vta-canal').value,
      notas:      document.getElementById('vta-notas').value,
      comprobante: compUrl
    };

    const res = await apiPost({ action: 'guardar', hoja: 'ventas', fila });
    if (res.ok) {
      cerrarModal();
      toast('Venta registrada');
      await cargarVentas();
    } else {
      toast(res.error || 'Error', 'error');
    }
  } finally {
    btn.textContent = 'Registrar';
    btn.disabled = false;
  }
}

async function eliminarVenta(id, comprobante) {
  const res = await apiPost({ action: 'eliminarConFoto', hoja: 'ventas', id, fotoUrl: comprobante });
  if (res.ok) { toast('Venta eliminada'); await cargarVentas(); }
  else toast(res.error || 'Error', 'error');
}

// ── GASTOS ────────────────────────────────────────────────────
async function cargarGastos() {
  const fecha = document.getElementById('gastos-fecha').value || fechaHoy();
  document.getElementById('gastos-fecha').value = fecha;
  const res = await apiGet({ action: 'getAll', hoja: 'gastos', token });
  gastosCache = (res.data || []).filter(g => g.fecha === fecha);
  renderTablaGastos(gastosCache);
}

function renderTablaGastos(lista) {
  const wrap = document.getElementById('gastos-tabla');
  if (!lista.length) {
    wrap.innerHTML = '<div class="list-empty" style="padding:2rem">Sin gastos para esta fecha</div>';
    return;
  }
  wrap.innerHTML = `
    <table class="tabla">
      <thead><tr><th>Tipo</th><th>Descripción</th><th>Proveedor</th><th>Monto</th><th>Comprobante</th><th></th></tr></thead>
      <tbody>${lista.map(g => `
        <tr>
          <td>${g.tipo || ''}</td>
          <td>${g.descripcion || ''}</td>
          <td>${g.proveedor || ''}</td>
          <td>${formatPeso(g.monto)}</td>
          <td>${g.comprobante
            ? `<a href="${g.comprobante}" target="_blank" style="color:var(--azul)">Ver</a>`
            : '—'}</td>
          <td><button class="btn-icon danger" onclick="eliminarGasto('${g.id}','${g.comprobante || ''}')">✕</button></td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;
}

function modalNuevoGasto() {
  abrirModal('Registrar gasto', `
    <div class="field">
      <label>Tipo</label>
      <select id="gto-tipo" class="input-select">
        <option>Compra de mercadería</option>
        <option>Packaging</option>
        <option>Transporte</option>
        <option>Otro</option>
      </select>
    </div>
    <div class="field">
      <label>Descripción</label>
      <input type="text" id="gto-desc" class="input-text" placeholder="Ej: Compra gomitas mayorista" />
    </div>
    <div class="field">
      <label>Proveedor</label>
      <input type="text" id="gto-prov" class="input-text" />
    </div>
    <div class="field">
      <label>Monto</label>
      <input type="number" id="gto-monto" class="input-text" placeholder="0" />
    </div>
    <div class="field">
      <label>Comprobante (imagen o PDF)</label>
      <div class="foto-upload-area">
        <input type="file" id="gto-comprobante" accept="image/*,application/pdf"
          onchange="previsualizarComprobanteGasto(this)" />
        <div class="foto-upload-icon">📎</div>
        <div class="foto-upload-text">Ticket, factura o foto — opcional</div>
      </div>
      <img id="gto-comp-preview" class="foto-preview hidden" alt="preview" style="margin-top:6px" />
    </div>
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="guardarGasto()">Registrar</button>
  `);
}

function previsualizarComprobanteGasto(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('gto-comp-preview');
  if (file.type.startsWith('image/') && preview) {
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
  }
}

async function guardarGasto() {
  const monto = document.getElementById('gto-monto').value;
  if (!monto) { toast('Ingresá el monto', 'error'); return; }

  const btn = document.querySelector('#modal-footer .btn-primary');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    const id    = 'GTO-' + Date.now();
    const fecha = fechaHoy();

    let compUrl = '';
    const fileInput = document.getElementById('gto-comprobante');
    if (fileInput?.files[0]) {
      const b64 = await comprimirImagen(fileInput.files[0]);
      const resComp = await apiPost({
        action: 'subirComprobante',
        id, b64,
        nombre: id,
        fecha,
        tipo: 'gasto'
      });
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
      toast('Gasto registrado');
      await cargarGastos();
    } else {
      toast(res.error || 'Error', 'error');
    }
  } finally {
    btn.textContent = 'Registrar';
    btn.disabled = false;
  }
}

async function eliminarGasto(id, comprobante) {
  const res = await apiPost({ action: 'eliminarConFoto', hoja: 'gastos', id, fotoUrl: comprobante });
  if (res.ok) { toast('Gasto eliminado'); await cargarGastos(); }
  else toast(res.error || 'Error', 'error');
}

// ── CAJA ──────────────────────────────────────────────────────
async function cargarCaja() {
  const fecha = document.getElementById('caja-fecha').value || fechaHoy();
  document.getElementById('caja-fecha').value = fecha;

  const [rV, rG] = await Promise.all([
    apiGet({ action: 'getAll', hoja: 'ventas', token }),
    apiGet({ action: 'getAll', hoja: 'gastos', token })
  ]);

  const ventas = (rV.data || []).filter(v => v.fecha === fecha);
  const gastos = (rG.data || []).filter(g => g.fecha === fecha);

  const totalV = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalG = gastos.reduce((s, g) => s + Number(g.monto || 0), 0);

  document.getElementById('caja-ingresos').textContent    = formatPeso(totalV);
  document.getElementById('caja-gastos-total').textContent = formatPeso(totalG);
  document.getElementById('caja-saldo-total').textContent  = formatPeso(totalV - totalG);

  // Detalle ventas
  const dv = document.getElementById('caja-ventas-detalle');
  dv.innerHTML = ventas.length
    ? ventas.map(v => `<div class="dash-list-item"><span>${v.notas || 'Venta'}</span><span>${formatPeso(v.total)}</span></div>`).join('')
    : '<div class="list-empty">Sin ventas</div>';

  // Detalle gastos
  const dg = document.getElementById('caja-gastos-detalle');
  dg.innerHTML = gastos.length
    ? gastos.map(g => `<div class="dash-list-item"><span>${g.descripcion || g.tipo}</span><span>${formatPeso(g.monto)}</span></div>`).join('')
    : '<div class="list-empty">Sin gastos</div>';
}

// ── NOVEDADES ─────────────────────────────────────────────────
async function cargarNovedades() {
  const res = await apiGet({ action: 'getAll', hoja: 'novedades', token });
  const lista = res.data || [];
  const grid = document.getElementById('novedades-grid');
  if (!lista.length) {
    grid.innerHTML = '<div class="list-empty" style="grid-column:1/-1;padding:2rem">Sin novedades cargadas</div>';
    return;
  }
  grid.innerHTML = lista.map(n => `
    <div class="prod-card">
      ${n.foto
        ? `<div class="prod-card-img"><img src="${n.foto}" alt="${n.titulo}" loading="lazy" /></div>`
        : `<div class="prod-card-img">📢</div>`}
      <div class="prod-card-body">
        <div class="prod-card-nombre">${n.titulo || ''}</div>
        <div class="prod-card-variante">${n.descripcion || ''}</div>
        <label class="toggle-wrap" style="margin-top:6px">
          <input type="checkbox" ${n.publico === 'true' || n.publico === true ? 'checked' : ''}
            onchange="togglePublicoNovedad('${n.id}', this.checked)" />
          <span class="toggle-track"></span>
          <span class="toggle-label" style="font-size:11px">Visible</span>
        </label>
      </div>
      <div class="prod-card-footer">
        <button class="btn-icon" onclick="subirFotoNovedad('${n.id}')" title="Foto">🖼</button>
        <button class="btn-icon danger" onclick="eliminarNovedad('${n.id}','${n.foto || ''}')">✕</button>
      </div>
    </div>
  `).join('');
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
      <input type="file" id="foto-input" accept="image/*" onchange="previsualizarFoto(this)" />
      <div class="foto-upload-icon">🖼</div>
      <div class="foto-upload-text">Hacé clic o arrastrá una imagen</div>
    </div>
    <img id="foto-preview-img" class="foto-preview hidden" alt="preview" />
  `, `
    <button class="btn-secondary" onclick="cerrarModal()">Cancelar</button>
    <button class="btn-primary" onclick="confirmarSubidaFoto('${id}','novedades','novedades')">Subir</button>
  `);
}

async function eliminarNovedad(id, fotoUrl) {
  const res = await apiPost({ action: 'eliminarConFoto', hoja: 'novedades', id, fotoUrl });
  if (res.ok) { toast('Novedad eliminada'); await cargarNovedades(); }
  else toast(res.error || 'Error', 'error');
}

// ── CONFIG ────────────────────────────────────────────────────
async function cargarConfig() {
  const res = await apiGet({ action: 'getConfig' });
  const cfg = res.data || {};
  document.getElementById('cfg-nombre').value    = cfg.nombreNegocio || '';
  document.getElementById('cfg-whatsapp').value  = cfg.whatsapp || '';
  document.getElementById('cfg-facebook').value  = cfg.facebook || '';
  document.getElementById('cfg-mp').value        = cfg.linkMP || '';
  document.getElementById('cfg-stock-min').value = cfg.stockMinAlerta || 3;
  localStorage.setItem('tcd_stock_min', cfg.stockMinAlerta || 3);
}

async function guardarConfig() {
  const campos = [
    { campo: 'nombreNegocio', val: document.getElementById('cfg-nombre').value },
    { campo: 'whatsapp',      val: document.getElementById('cfg-whatsapp').value },
    { campo: 'facebook',      val: document.getElementById('cfg-facebook').value },
    { campo: 'linkMP',        val: document.getElementById('cfg-mp').value },
    { campo: 'stockMinAlerta',val: document.getElementById('cfg-stock-min').value }
  ];

  const btn = document.getElementById('btn-guardar-config');
  btn.textContent = 'Guardando...';
  btn.disabled = true;

  try {
    for (const c of campos) {
      await apiPost({ action: 'guardarConfig', clave: c.campo, valor: c.val });
    }
    localStorage.setItem('tcd_stock_min', document.getElementById('cfg-stock-min').value);
    toast('Configuración guardada');
  } finally {
    btn.textContent = 'Guardar cambios';
    btn.disabled = false;
  }
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTema();

  // Login
  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  // Modal cerrar
  document.getElementById('modal-close').addEventListener('click', cerrarModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) cerrarModal();
  });

  // Menú mobile
  document.getElementById('btn-menu').addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  // Botones de sección
  document.getElementById('btn-nuevo-producto')?.addEventListener('click', () => modalProducto());
  document.getElementById('btn-nuevo-inventario')?.addEventListener('click', modalNuevoInventario);
  document.getElementById('btn-nueva-venta')?.addEventListener('click', modalNuevaVenta);
  document.getElementById('btn-nuevo-gasto')?.addEventListener('click', modalNuevoGasto);
  document.getElementById('btn-nueva-novedad')?.addEventListener('click', modalNuevaNovedad);
  document.getElementById('btn-guardar-config')?.addEventListener('click', guardarConfig);

  // Filtros con fecha
  document.getElementById('ventas-fecha')?.addEventListener('change', cargarVentas);
  document.getElementById('gastos-fecha')?.addEventListener('change', cargarGastos);
  document.getElementById('caja-fecha')?.addEventListener('change', cargarCaja);

  // Si hay token guardado, intentar restaurar sesión
  if (token) mostrarApp();

  // Bindear nav (ya fue construido por nav.js)
  bindNav();
});
