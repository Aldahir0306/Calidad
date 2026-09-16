/* ==================================================================
   SIVER — Backend simulado (datos en memoria, sin persistencia real)
   Estructuras alineadas al esquema de Actividad3.sql
================================================================== */

const IGV = 0.18;

let ESTADOS_ORDEN = ["Registrado","Diagnosticado","En Reparación","Finalizado","Entregado"];

let db = {
  roles: [
    {id:1, nombre:"Administrador"},
    {id:2, nombre:"Vendedor"},
    {id:3, nombre:"Técnico"},
    {id:4, nombre:"Almacenero"},
  ],
  usuarios: [
    {id:1, nombre:"Bryam Abanto", email:"admin@refricentro.pe", passwordHash:"admin123", rolId:1, activo:true},
    {id:2, nombre:"Ruth Alvarez", email:"vendedor@refricentro.pe", passwordHash:"venta123", rolId:2, activo:true},
    {id:3, nombre:"Luigi Peregrino", email:"almacen@refricentro.pe", passwordHash:"almacen123", rolId:4, activo:true},
    {id:4, nombre:"César Ortiz", email:"tecnico@refricentro.pe", passwordHash:"tecnico123", rolId:3, activo:true},
  ],
  categorias: [
    {id:1, nombre:"Compresores"},
    {id:2, nombre:"Termostatos"},
    {id:3, nombre:"Gas Refrigerante"},
    {id:4, nombre:"Repuestos varios"},
  ],
  proveedores: [
    {id:1, nombre:"Import. Frío Norte SAC", ruc:"20481223456"},
    {id:2, nombre:"Distribuidora Andina EIRL", ruc:"20558891122"},
  ],
  productos: [
    {id:1, nombre:"Compresor 1/4 HP", categoriaId:1, proveedorId:1, precio:280.00, stock:6, stockMinimo:3},
    {id:2, nombre:"Termostato universal VT9", categoriaId:2, proveedorId:2, precio:45.50, stock:2, stockMinimo:5},
    {id:3, nombre:"Gas R134a (kg)", categoriaId:3, proveedorId:1, precio:60.00, stock:12, stockMinimo:4},
    {id:4, nombre:"Filtro secador universal", categoriaId:4, proveedorId:2, precio:18.00, stock:20, stockMinimo:6},
    {id:5, nombre:"Cable termofusible", categoriaId:4, proveedorId:2, precio:9.90, stock:3, stockMinimo:5},
  ],
  clientes: [
    {id:1, nombre:"María Chávez", tipo:"Hogar", documento:"41223345"},
    {id:2, nombre:"Restaurante El Fogón SAC", tipo:"Restaurante", documento:"20601122334", ruc:"20601122334"},
  ],
  movimientos: [],
  ventas: [],
  detalleVentas: [],
  ordenes: [],
  seq: {usuario:5, cliente:3, producto:6, categoria:5, proveedor:3, movimiento:1, venta:1, orden:1},
};

let session = null;        // usuario autenticado actualmente
let currentRole = null;
let currentView = "dashboard";
let ventaCart = []; // {productoId, cantidad}

/* -------------------- Autenticación (CA-01, CA-02, CA-03, CA-06) -------------------- */
function attemptLogin(){
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const box = document.getElementById('loginErrorBox');
  box.innerHTML = "";

  const user = db.usuarios.find(u => u.email.toLowerCase() === email);
  if(!user || user.passwordHash !== password){
    box.innerHTML = `<div class="login-error">Credenciales incorrectas.</div>`;
    return;
  }
  if(!user.activo){
    box.innerHTML = `<div class="login-error">El usuario está inactivo. Contacta al administrador.</div>`;
    return;
  }
  session = user;
  currentRole = nombreRol(user.rolId);
  currentView = "dashboard";
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sessionUserLabel').textContent = `${user.nombre} · ${currentRole}`;
  renderShell();
  renderView();
}
function logout(){
  session = null; currentRole = null;
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginErrorBox').innerHTML = '';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
}

/* -------------------- Utilidades -------------------- */
function money(n){ return "S/ " + n.toFixed(2); }
function toast(msg, isErr){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = "toast show" + (isErr ? " err" : "");
  clearTimeout(t._h);
  t._h = setTimeout(()=> t.classList.remove('show'), 2600);
}
function findById(arr, id){ return arr.find(x => x.id === id); }
function nombreRol(rolId){ return findById(db.roles, rolId)?.nombre || "—"; }
function nombreCategoria(id){ return findById(db.categorias, id)?.nombre || "—"; }
function nombreProveedor(id){ return findById(db.proveedores, id)?.nombre || "—"; }
function nombreProducto(id){ return findById(db.productos, id)?.nombre || "—"; }
function nombreCliente(id){ return findById(db.clientes, id)?.nombre || "—"; }

/* -------------------- Definición de módulos por rol -------------------- */
const MODULES = [
  {id:"dashboard", label:"Panel", icon:"◧", roles:["Administrador","Vendedor","Técnico","Almacenero"]},
  {id:"usuarios", label:"Usuarios", icon:"◑", roles:["Administrador"]},
  {id:"productos", label:"Productos", icon:"▤", roles:["Administrador","Almacenero"]},
  {id:"proveedores", label:"Proveedores", icon:"▥", roles:["Administrador","Almacenero"]},
  {id:"clientes", label:"Clientes", icon:"◍", roles:["Administrador","Vendedor"]},
  {id:"ventas", label:"Ventas", icon:"▧", roles:["Administrador","Vendedor"]},
  {id:"inventario", label:"Inventario", icon:"▦", roles:["Administrador","Almacenero"]},
  {id:"ordenes", label:"Órdenes de servicio", icon:"◫", roles:["Administrador","Técnico"]},
  {id:"reportes", label:"Reportes", icon:"▨", roles:["Administrador"]},
];

/* -------------------- Render: shell (sidebar / roles) -------------------- */
function renderShell(){
  const nav = document.getElementById('navModules');
  nav.innerHTML = MODULES.filter(m => m.roles.includes(currentRole)).map(m => `
    <button data-view="${m.id}" class="${m.id===currentView?'active':''}">
      <span class="ic">${m.icon}</span>${m.label}
    </button>
  `).join('');
  nav.querySelectorAll('button').forEach(b => {
    b.onclick = () => { currentView = b.dataset.view; renderShell(); renderView(); };
  });

  document.getElementById('viewTitle').textContent =
    MODULES.find(m => m.id === currentView)?.label || "Panel";
}

/* -------------------- Render: enrutador de vistas -------------------- */
function renderView(){
  const c = document.getElementById('content');
  const renderers = {
    dashboard: viewDashboard, usuarios: viewUsuarios, productos: viewProductos,
    proveedores: viewProveedores, clientes: viewClientes, ventas: viewVentas,
    inventario: viewInventario, ordenes: viewOrdenes, reportes: viewReportes,
  };
  c.innerHTML = (renderers[currentView] || viewDashboard)();
  bindViewEvents();
}

/* ==================================================================
   DASHBOARD
================================================================== */
function viewDashboard(){
  const stockBajo = db.productos.filter(p => p.stock <= p.stockMinimo);
  const ventasHoy = db.ventas.length;
  const ordenesAbiertas = db.ordenes.filter(o => o.estado !== "Entregado").length;
  return `
    <div class="view-head">
      <div>
        <h2>Panel general <span class="progress-tag">Implementación 50%</span></h2>
        <p>Resumen operativo de Refricentro Peregrino. Módulos activos según el rol seleccionado.</p>
      </div>
    </div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${db.productos.length}</div><div class="lbl">Productos registrados</div></div>
      <div class="stat ${stockBajo.length?'warn':''}"><div class="num">${stockBajo.length}</div><div class="lbl">Productos en stock bajo</div></div>
      <div class="stat"><div class="num">${db.clientes.length}</div><div class="lbl">Clientes registrados</div></div>
      <div class="stat"><div class="num">${ventasHoy}</div><div class="lbl">Ventas registradas</div></div>
      <div class="stat ${ordenesAbiertas?'warn':''}"><div class="num">${ordenesAbiertas}</div><div class="lbl">Órdenes de servicio abiertas</div></div>
    </div>
    <div class="panel">
      <h3>Alertas de stock mínimo</h3>
      ${stockBajo.length ? `
        <table><thead><tr><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th></tr></thead>
        <tbody>${stockBajo.map(p=>`<tr class="low-stock"><td>${p.nombre}</td><td>${p.stock}</td><td>${p.stockMinimo}</td></tr>`).join('')}</tbody></table>
      ` : `<div class="empty">No hay productos por debajo del stock mínimo.</div>`}
    </div>
    <div class="panel">
      <h3>Alcance implementado en esta entrega (Semana 5)</h3>
      <p style="font-size:13.5px;color:var(--muted);line-height:1.6;margin:0;">
        Se implementó de forma funcional el flujo completo de <strong>Ventas</strong> (verificación de stock,
        cálculo automático de IGV y emisión simulada de boleta/factura) y el flujo de
        <strong>Órdenes de Servicio</strong> con validación de secuencia de estados, junto con el CRUD básico
        de Usuarios, Productos, Categorías, Proveedores y Clientes, y un módulo inicial de Inventario y Reportes.
        Quedan pendientes para la siguiente entrega: edición/eliminación completa con restricciones de integridad,
        exportación real a PDF/Excel, autenticación real y persistencia en base de datos.
      </p>
    </div>
  `;
}

/* ==================================================================
   USUARIOS  (HU-01)
================================================================== */
function viewUsuarios(){
  return `
    <div class="view-head">
      <div><h2>Gestión de usuarios</h2><p>Alta de usuarios con rol asignado. CA-01 a CA-09.</p></div>
    </div>
    <div class="panel">
      <h3>Nuevo usuario</h3>
      <div class="form-grid cols3">
        <div class="field"><label>Nombre completo</label><input id="u_nombre" placeholder="Nombre y apellido"></div>
        <div class="field"><label>Correo institucional</label><input id="u_email" placeholder="correo@refricentro.pe"></div>
        <div class="field"><label>Rol</label>
          <select id="u_rol">${db.roles.map(r=>`<option value="${r.id}">${r.nombre}</option>`).join('')}</select>
        </div>
      </div>
      <button class="btn" id="btnAddUsuario">Crear usuario</button>
    </div>
    <div class="panel">
      <h3>Usuarios registrados (${db.usuarios.length})</h3>
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          ${db.usuarios.map(u => `
            <tr>
              <td>${u.nombre}</td><td>${u.email}</td><td>${nombreRol(u.rolId)}</td>
              <td><span class="badge ${u.activo?'activo':'inactivo'}">${u.activo?'Activo':'Inactivo'}</span></td>
              <td><button class="btn secondary small" data-toggle-usuario="${u.id}">${u.activo?'Desactivar':'Activar'}</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==================================================================
   PRODUCTOS + CATEGORÍAS  (HU-02)
================================================================== */
function viewProductos(){
  return `
    <div class="view-head">
      <div><h2>Productos y categorías</h2><p>Catálogo de repuestos. CA-10 a CA-17.</p></div>
    </div>
    <div class="panel">
      <h3>Nuevo producto</h3>
      <div class="form-grid cols3">
        <div class="field"><label>Nombre</label><input id="p_nombre" placeholder="Nombre del producto"></div>
        <div class="field"><label>Categoría</label>
          <select id="p_cat">${db.categorias.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Proveedor</label>
          <select id="p_prov">${db.proveedores.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Precio (S/)</label><input id="p_precio" type="number" min="0" step="0.10"></div>
        <div class="field"><label>Stock inicial</label><input id="p_stock" type="number" min="0"></div>
        <div class="field"><label>Stock mínimo</label><input id="p_min" type="number" min="0" value="5"></div>
      </div>
      <button class="btn" id="btnAddProducto">Registrar producto</button>
    </div>
    <div class="panel">
      <h3>Nueva categoría</h3>
      <div class="form-grid">
        <div class="field"><label>Nombre de categoría</label><input id="c_nombre" placeholder="Ej: Válvulas"></div>
      </div>
      <button class="btn secondary" id="btnAddCategoria">Agregar categoría</button>
    </div>
    <div class="panel">
      <h3>Catálogo (${db.productos.length})</h3>
      <table>
        <thead><tr><th>Producto</th><th>Categoría</th><th>Proveedor</th><th>Precio</th><th>Stock</th></tr></thead>
        <tbody>
          ${db.productos.map(p => `
            <tr class="${p.stock<=p.stockMinimo?'low-stock':''}">
              <td>${p.nombre}</td><td>${nombreCategoria(p.categoriaId)}</td><td>${nombreProveedor(p.proveedorId)}</td>
              <td>${money(p.precio)}</td><td>${p.stock} ${p.stock<=p.stockMinimo?' · <span class="badge inactivo">bajo</span>':''}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==================================================================
   PROVEEDORES  (HU-03)
================================================================== */
function viewProveedores(){
  return `
    <div class="view-head">
      <div><h2>Proveedores</h2><p>Empresas que abastecen productos. CA-18 a CA-20.</p></div>
    </div>
    <div class="panel">
      <h3>Nuevo proveedor</h3>
      <div class="form-grid cols3">
        <div class="field"><label>Razón social</label><input id="pv_nombre" placeholder="Nombre comercial"></div>
        <div class="field"><label>RUC</label><input id="pv_ruc" placeholder="20XXXXXXXXX"></div>
        <div class="field"><label>Teléfono</label><input id="pv_tel" placeholder="Opcional"></div>
      </div>
      <button class="btn" id="btnAddProveedor">Registrar proveedor</button>
    </div>
    <div class="panel">
      <h3>Proveedores (${db.proveedores.length})</h3>
      <table>
        <thead><tr><th>Razón social</th><th>RUC</th><th>Productos asociados</th></tr></thead>
        <tbody>
          ${db.proveedores.map(p => `
            <tr><td>${p.nombre}</td><td class="mono">${p.ruc||'—'}</td>
            <td>${db.productos.filter(x=>x.proveedorId===p.id).length}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==================================================================
   CLIENTES  (HU-04)
================================================================== */
function viewClientes(){
  return `
    <div class="view-head">
      <div><h2>Clientes</h2><p>Registro diferenciado por tipo de cliente. CA-21 a CA-25.</p></div>
    </div>
    <div class="panel">
      <h3>Nuevo cliente</h3>
      <div class="form-grid cols3">
        <div class="field"><label>Nombre / razón social</label><input id="cl_nombre" placeholder="Nombre completo o empresa"></div>
        <div class="field"><label>Tipo de cliente</label>
          <select id="cl_tipo">
            <option>Hogar</option><option>Restaurante</option><option>Pequeña Industria</option><option>Técnico Independiente</option>
          </select>
        </div>
        <div class="field"><label>Documento (DNI o RUC)</label><input id="cl_doc" placeholder="Documento"></div>
      </div>
      <button class="btn" id="btnAddCliente">Registrar cliente</button>
    </div>
    <div class="panel">
      <h3>Clientes (${db.clientes.length})</h3>
      <table>
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Documento</th><th>Compras</th></tr></thead>
        <tbody>
          ${db.clientes.map(c => `
            <tr>
              <td>${c.nombre}</td>
              <td><span class="badge ${c.tipo==='Hogar'?'hogar':'empresa'}">${c.tipo}</span></td>
              <td class="mono">${c.documento}</td>
              <td>${db.ventas.filter(v=>v.clienteId===c.id).length}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ==================================================================
   VENTAS  (HU-05)
================================================================== */
function viewVentas(){
  const cartRows = ventaCart.map((line, idx) => {
    const p = findById(db.productos, line.productoId);
    return `
      <div class="cart-line">
        <span class="p-name">${p.nombre} <span style="color:var(--muted)">(stock: ${p.stock})</span></span>
        <input type="number" min="1" max="${p.stock}" value="${line.cantidad}" data-cart-qty="${idx}">
        <span class="mono" style="width:90px;text-align:right;">${money(p.precio*line.cantidad)}</span>
        <button class="btn secondary small" data-cart-remove="${idx}">Quitar</button>
      </div>`;
  }).join('') || `<div class="empty">Agrega productos al carrito de venta.</div>`;

  const subtotal = ventaCart.reduce((s,l)=> s + findById(db.productos,l.productoId).precio * l.cantidad, 0);
  const igv = subtotal * IGV;
  const total = subtotal + igv;

  return `
    <div class="view-head">
      <div><h2>Registro de ventas</h2><p>Verifica stock, calcula IGV y emite boleta o factura. CA-26 a CA-34.</p></div>
    </div>
    <div class="panel">
      <h3>Nueva venta</h3>
      <div class="form-grid">
        <div class="field">
          <label>Cliente</label>
          <select id="v_cliente">${db.clientes.map(c=>`<option value="${c.id}">${c.nombre} (${c.tipo})</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Agregar producto</label>
          <div style="display:flex;gap:8px;">
            <select id="v_producto" style="flex:1;">
              ${db.productos.filter(p=>p.stock>0).map(p=>`<option value="${p.id}">${p.nombre} — ${money(p.precio)} (stock ${p.stock})</option>`).join('')}
            </select>
            <button class="btn secondary" id="btnAddToCart">Agregar</button>
          </div>
        </div>
      </div>
      <div id="cartBox">${cartRows}</div>
      <div style="margin-top:10px;">
        <div class="cart-total"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div class="cart-total"><span>IGV (18%)</span><span>${money(igv)}</span></div>
        <div class="cart-total grand"><span>Total</span><span>${money(total)}</span></div>
      </div>
      <button class="btn" id="btnConfirmarVenta" ${ventaCart.length?'':'disabled'}>Confirmar venta y emitir comprobante</button>
    </div>
    <div class="panel">
      <h3>Ventas registradas (${db.ventas.length})</h3>
      ${db.ventas.length ? `
      <table>
        <thead><tr><th>N°</th><th>Cliente</th><th>Comprobante</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>
          ${db.ventas.slice().reverse().map(v => `
            <tr>
              <td class="mono">V-${String(v.id).padStart(3,'0')}</td>
              <td>${nombreCliente(v.clienteId)}</td>
              <td>${v.comprobante}${v.ruc?` · RUC ${v.ruc}`:''}</td>
              <td>${money(v.total)}</td>
              <td><span class="badge ${v.estado==='Anulada'?'inactivo':'activo'}">${v.estado}</span>
                ${v.estado==='Registrada'?`<button class="btn secondary small" style="margin-left:8px;" data-anular="${v.id}">Anular</button>`:''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>` : `<div class="empty">Aún no se han registrado ventas.</div>`}
    </div>
  `;
}

/* ==================================================================
   INVENTARIO  (HU-06)
================================================================== */
function viewInventario(){
  return `
    <div class="view-head">
      <div><h2>Inventario</h2><p>Movimientos de entrada, salida y ajuste. CA-35 a CA-41.</p></div>
    </div>
    <div class="panel">
      <h3>Registrar movimiento manual</h3>
      <div class="form-grid cols3">
        <div class="field"><label>Producto</label>
          <select id="m_producto">${db.productos.map(p=>`<option value="${p.id}">${p.nombre} (stock ${p.stock})</option>`).join('')}</select>
        </div>
        <div class="field"><label>Tipo</label>
          <select id="m_tipo"><option value="ENTRADA">Entrada (compra)</option><option value="AJUSTE">Ajuste / merma</option></select>
        </div>
        <div class="field"><label>Cantidad</label><input id="m_cantidad" type="number" min="1" value="1"></div>
        <div class="field full"><label>Observación</label><input id="m_obs" placeholder="Motivo del movimiento"></div>
      </div>
      <button class="btn" id="btnAddMovimiento">Registrar movimiento</button>
    </div>
    <div class="panel">
      <h3>Historial de movimientos (${db.movimientos.length})</h3>
      ${db.movimientos.length ? `
      <table>
        <thead><tr><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Observación</th></tr></thead>
        <tbody>
          ${db.movimientos.slice().reverse().map(m => `
            <tr><td>${nombreProducto(m.productoId)}</td><td>${m.tipo}</td><td>${m.cantidad}</td>
            <td>${m.stockAnterior}</td><td>${m.stockNuevo}</td><td>${m.observacion||'—'}</td></tr>`).join('')}
        </tbody>
      </table>` : `<div class="empty">No hay movimientos registrados todavía. Las ventas generan movimientos automáticos de salida.</div>`}
    </div>
  `;
}

/* ==================================================================
   ÓRDENES DE SERVICIO  (HU-07)
================================================================== */
function pipelineHTML(estadoActual){
  const idx = ESTADOS_ORDEN.indexOf(estadoActual);
  return `<div class="pipeline">${ESTADOS_ORDEN.map((e,i)=>{
    const cls = i < idx ? 'done' : (i===idx ? 'current' : '');
    return `<span class="pipe-step ${cls}">${e}</span>` + (i<ESTADOS_ORDEN.length-1?'<span class="pipe-arrow">→</span>':'');
  }).join('')}</div>`;
}
function viewOrdenes(){
  return `
    <div class="view-head">
      <div><h2>Órdenes de servicio técnico</h2><p>Secuencia obligatoria de estados. CA-42 a CA-51.</p></div>
    </div>
    <div class="panel">
      <h3>Nueva orden de servicio</h3>
      <div class="form-grid">
        <div class="field"><label>Cliente</label>
          <select id="o_cliente">${db.clientes.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Equipo</label><input id="o_equipo" placeholder="Ej: Refrigerador Samsung 300L"></div>
        <div class="field full"><label>Diagnóstico inicial / problema reportado</label><textarea id="o_desc" rows="2" placeholder="Descripción del problema"></textarea></div>
      </div>
      <button class="btn" id="btnAddOrden">Registrar orden</button>
    </div>
    <div class="panel">
      <h3>Órdenes (${db.ordenes.length})</h3>
      ${db.ordenes.length ? db.ordenes.slice().reverse().map(o => {
        const idx = ESTADOS_ORDEN.indexOf(o.estado);
        const siguiente = ESTADOS_ORDEN[idx+1];
        return `
        <div class="panel" style="margin-bottom:12px;background:var(--bg);">
          <div style="display:flex;justify-content:space-between;">
            <div>
              <strong>OS-${String(o.id).padStart(3,'0')}</strong> · ${nombreCliente(o.clienteId)} · ${o.equipo}
              <div style="color:var(--muted);font-size:12.5px;margin-top:2px;">${o.descripcion}</div>
            </div>
            ${siguiente ? `<button class="btn secondary small" data-avanzar-orden="${o.id}">Avanzar a "${siguiente}"</button>` : `<span class="badge fin">Ciclo completo</span>`}
          </div>
          ${pipelineHTML(o.estado)}
        </div>`;
      }).join('') : `<div class="empty">No hay órdenes de servicio registradas.</div>`}
    </div>
  `;
}

/* ==================================================================
   REPORTES  (HU-08)
================================================================== */
function viewReportes(){
  const porProducto = {};
  db.detalleVentas.forEach(d => { porProducto[d.productoId] = (porProducto[d.productoId]||0) + d.cantidad; });
  const topProductos = Object.entries(porProducto).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const totalVentas = db.ventas.filter(v=>v.estado!=='Anulada').reduce((s,v)=>s+v.total,0);

  return `
    <div class="view-head">
      <div><h2>Reportes gerenciales</h2><p>Versión inicial en pantalla — exportación a PDF/Excel pendiente para la siguiente entrega. CA-52 a CA-60.</p></div>
    </div>
    <div class="grid-stats">
      <div class="stat"><div class="num">${money(totalVentas)}</div><div class="lbl">Total vendido (no anuladas)</div></div>
      <div class="stat"><div class="num">${db.ventas.length}</div><div class="lbl">Ventas registradas</div></div>
      <div class="stat"><div class="num">${db.ordenes.filter(o=>o.estado==='Entregado').length}</div><div class="lbl">Órdenes cerradas</div></div>
    </div>
    <div class="panel">
      <h3>Productos más vendidos</h3>
      ${topProductos.length ? `
      <table><thead><tr><th>Producto</th><th>Unidades vendidas</th></tr></thead>
      <tbody>${topProductos.map(([id,cant])=>`<tr><td>${nombreProducto(Number(id))}</td><td>${cant}</td></tr>`).join('')}</tbody></table>
      ` : `<div class="empty">Aún no hay ventas para generar este reporte.</div>`}
    </div>
    <div class="panel">
      <h3>Inventario actual</h3>
      <table><thead><tr><th>Producto</th><th>Stock</th><th>Estado</th></tr></thead>
        <tbody>${db.productos.map(p=>`<tr><td>${p.nombre}</td><td>${p.stock}</td><td>${p.stock<=p.stockMinimo?'<span class="badge inactivo">Stock bajo</span>':'<span class="badge activo">Normal</span>'}</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="locked-note">Reportes de ventas por período/tipo de cliente, rotación de stock y exportación PDF/Excel quedan definidos como pendientes explícitos de esta entrega (50% de avance).</div>
  `;
}

/* ==================================================================
   EVENTOS por vista
================================================================== */
function bindViewEvents(){
  // USUARIOS
  const btnAddUsuario = document.getElementById('btnAddUsuario');
  if(btnAddUsuario) btnAddUsuario.onclick = () => {
    const nombre = document.getElementById('u_nombre').value.trim();
    const email = document.getElementById('u_email').value.trim();
    const rolId = Number(document.getElementById('u_rol').value);
    if(!nombre || !email){ toast('Completa nombre y correo.', true); return; }
    if(db.usuarios.some(u=>u.email===email)){ toast('El correo electrónico ya está registrado.', true); return; }
    db.usuarios.push({id: db.seq.usuario++, nombre, email, rolId, activo:true});
    toast('Usuario creado correctamente.');
    renderView();
  };
  document.querySelectorAll('[data-toggle-usuario]').forEach(b=>{
    b.onclick = () => {
      const u = findById(db.usuarios, Number(b.dataset.toggleUsuario));
      u.activo = !u.activo;
      toast(`Usuario ${u.activo?'activado':'desactivado'}.`);
      renderView();
    };
  });

  // PRODUCTOS / CATEGORÍAS
  const btnAddProducto = document.getElementById('btnAddProducto');
  if(btnAddProducto) btnAddProducto.onclick = () => {
    const nombre = document.getElementById('p_nombre').value.trim();
    const categoriaId = Number(document.getElementById('p_cat').value);
    const proveedorId = Number(document.getElementById('p_prov').value);
    const precio = parseFloat(document.getElementById('p_precio').value);
    const stock = parseInt(document.getElementById('p_stock').value);
    const stockMinimo = parseInt(document.getElementById('p_min').value) || 5;
    if(!nombre || isNaN(precio) || precio<0 || isNaN(stock) || stock<0){ toast('Revisa nombre, precio y stock.', true); return; }
    if(db.productos.some(p=>p.nombre.toLowerCase()===nombre.toLowerCase())){ toast('Ya existe un producto con ese nombre.', true); return; }
    db.productos.push({id: db.seq.producto++, nombre, categoriaId, proveedorId, precio, stock, stockMinimo});
    toast('Producto registrado.');
    renderView();
  };
  const btnAddCategoria = document.getElementById('btnAddCategoria');
  if(btnAddCategoria) btnAddCategoria.onclick = () => {
    const nombre = document.getElementById('c_nombre').value.trim();
    if(!nombre){ toast('Ingresa un nombre de categoría.', true); return; }
    db.categorias.push({id: db.seq.categoria++, nombre});
    toast('Categoría agregada.');
    renderView();
  };

  // PROVEEDORES
  const btnAddProveedor = document.getElementById('btnAddProveedor');
  if(btnAddProveedor) btnAddProveedor.onclick = () => {
    const nombre = document.getElementById('pv_nombre').value.trim();
    const ruc = document.getElementById('pv_ruc').value.trim();
    if(!nombre){ toast('Ingresa la razón social.', true); return; }
    db.proveedores.push({id: db.seq.proveedor++, nombre, ruc});
    toast('Proveedor registrado.');
    renderView();
  };

  // CLIENTES
  const btnAddCliente = document.getElementById('btnAddCliente');
  if(btnAddCliente) btnAddCliente.onclick = () => {
    const nombre = document.getElementById('cl_nombre').value.trim();
    const tipo = document.getElementById('cl_tipo').value;
    const documento = document.getElementById('cl_doc').value.trim();
    if(!nombre || !documento){ toast('Completa nombre y documento.', true); return; }
    if(tipo!=='Hogar' && documento.length!==11){ toast('Para clientes empresariales el RUC debe tener 11 dígitos.', true); return; }
    const cliente = {id: db.seq.cliente++, nombre, tipo, documento};
    if(tipo!=='Hogar') cliente.ruc = documento;
    db.clientes.push(cliente);
    toast('Cliente registrado.');
    renderView();
  };

  // VENTAS
  const btnAddToCart = document.getElementById('btnAddToCart');
  if(btnAddToCart) btnAddToCart.onclick = () => {
    const productoId = Number(document.getElementById('v_producto').value);
    const existing = ventaCart.find(l=>l.productoId===productoId);
    const p = findById(db.productos, productoId);
    const currentQty = existing ? existing.cantidad : 0;
    if(currentQty+1 > p.stock){ toast(`Stock insuficiente. Disponible: ${p.stock} unidades`, true); return; }
    if(existing) existing.cantidad++; else ventaCart.push({productoId, cantidad:1});
    renderView();
  };
  document.querySelectorAll('[data-cart-qty]').forEach(inp=>{
    inp.onchange = () => {
      const idx = Number(inp.dataset.cartQty);
      const line = ventaCart[idx];
      const p = findById(db.productos, line.productoId);
      let val = parseInt(inp.value);
      if(isNaN(val) || val<1) val = 1;
      if(val > p.stock){ toast(`Stock insuficiente. Disponible: ${p.stock} unidades`, true); val = p.stock; }
      line.cantidad = val;
      renderView();
    };
  });
  document.querySelectorAll('[data-cart-remove]').forEach(b=>{
    b.onclick = () => { ventaCart.splice(Number(b.dataset.cartRemove),1); renderView(); };
  });
  const btnConfirmarVenta = document.getElementById('btnConfirmarVenta');
  if(btnConfirmarVenta) btnConfirmarVenta.onclick = () => {
    const clienteId = Number(document.getElementById('v_cliente').value);
    const cliente = findById(db.clientes, clienteId);
    for(const line of ventaCart){
      const p = findById(db.productos, line.productoId);
      if(line.cantidad > p.stock){ toast(`Stock insuficiente para ${p.nombre}. Disponible: ${p.stock} unidades`, true); return; }
    }
    if(cliente.tipo !== 'Hogar' && !cliente.ruc){ toast('Cliente empresarial sin RUC: no se puede generar factura.', true); return; }
    const subtotal = ventaCart.reduce((s,l)=> s + findById(db.productos,l.productoId).precio * l.cantidad, 0);
    const igv = subtotal*IGV, total = subtotal+igv;
    const venta = {
      id: db.seq.venta++, clienteId, subtotal, igv, total, estado:'Registrada',
      comprobante: cliente.tipo==='Hogar' ? 'Boleta de Venta' : 'Factura',
      ruc: cliente.tipo==='Hogar' ? null : cliente.ruc,
    };
    db.ventas.push(venta);
    ventaCart.forEach(line => {
      const p = findById(db.productos, line.productoId);
      db.detalleVentas.push({ventaId:venta.id, productoId:p.id, cantidad:line.cantidad, precioUnitario:p.precio});
      const stockAnterior = p.stock;
      p.stock -= line.cantidad;
      db.movimientos.push({id:db.seq.movimiento++, productoId:p.id, tipo:'SALIDA', cantidad:line.cantidad, stockAnterior, stockNuevo:p.stock, observacion:`Venta V-${String(venta.id).padStart(3,'0')}`});
    });
    ventaCart = [];
    toast(`Venta registrada. ${venta.comprobante} emitida por ${money(total)}.`);
    renderView();
  };
  document.querySelectorAll('[data-anular]').forEach(b=>{
    b.onclick = () => {
      const v = findById(db.ventas, Number(b.dataset.anular));
      v.estado = 'Anulada';
      db.detalleVentas.filter(d=>d.ventaId===v.id).forEach(d=>{
        const p = findById(db.productos, d.productoId);
        const stockAnterior = p.stock;
        p.stock += d.cantidad;
        db.movimientos.push({id:db.seq.movimiento++, productoId:p.id, tipo:'ENTRADA', cantidad:d.cantidad, stockAnterior, stockNuevo:p.stock, observacion:`Anulación V-${String(v.id).padStart(3,'0')}`});
      });
      toast('Venta anulada. Stock restituido.');
      renderView();
    };
  });

  // INVENTARIO
  const btnAddMovimiento = document.getElementById('btnAddMovimiento');
  if(btnAddMovimiento) btnAddMovimiento.onclick = () => {
    const productoId = Number(document.getElementById('m_producto').value);
    const tipo = document.getElementById('m_tipo').value;
    const cantidad = parseInt(document.getElementById('m_cantidad').value);
    const observacion = document.getElementById('m_obs').value.trim();
    const p = findById(db.productos, productoId);
    if(isNaN(cantidad) || cantidad<=0){ toast('La cantidad debe ser mayor que cero.', true); return; }
    if(tipo==='AJUSTE' && cantidad > p.stock){ toast(`No puedes retirar más del stock disponible (${p.stock}).`, true); return; }
    const stockAnterior = p.stock;
    p.stock += (tipo==='ENTRADA' ? cantidad : -cantidad);
    db.movimientos.push({id:db.seq.movimiento++, productoId, tipo, cantidad, stockAnterior, stockNuevo:p.stock, observacion});
    toast('Movimiento registrado.');
    renderView();
  };

  // ÓRDENES DE SERVICIO
  const btnAddOrden = document.getElementById('btnAddOrden');
  if(btnAddOrden) btnAddOrden.onclick = () => {
    const clienteId = Number(document.getElementById('o_cliente').value);
    const equipo = document.getElementById('o_equipo').value.trim();
    const descripcion = document.getElementById('o_desc').value.trim();
    if(!equipo || !descripcion){ toast('Completa equipo y descripción del problema.', true); return; }
    db.ordenes.push({id: db.seq.orden++, clienteId, equipo, descripcion, estado:'Registrado', historial:[{estado:'Registrado', fecha:new Date().toISOString()}]});
    toast('Orden de servicio registrada.');
    renderView();
  };
  document.querySelectorAll('[data-avanzar-orden]').forEach(b=>{
    b.onclick = () => {
      const o = findById(db.ordenes, Number(b.dataset.avanzarOrden));
      const idx = ESTADOS_ORDEN.indexOf(o.estado);
      const siguiente = ESTADOS_ORDEN[idx+1];
      if(!siguiente){ toast('La orden ya completó su ciclo.', true); return; }
      o.estado = siguiente;
      o.historial.push({estado:siguiente, fecha:new Date().toISOString()});
      toast(`Orden OS-${String(o.id).padStart(3,'0')} avanzó a "${siguiente}".`);
      renderView();
    };
  });
}

/* ==================================================================
   INIT
================================================================== */
document.getElementById('btnLogin').onclick = attemptLogin;
document.getElementById('loginPassword').addEventListener('keydown', (e) => { if(e.key === 'Enter') attemptLogin(); });
document.getElementById('btnLogout').onclick = logout;