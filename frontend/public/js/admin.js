// ═══════════════════════════════════════════════════════════
// admin.js — Panel de Administración
// Laboratorio de Simulación Clínica — UniSimón Barranquilla
// ═══════════════════════════════════════════════════════════
// Maneja tres secciones:
//   📅 Horarios   — asignar grupos a labs en fechas concretas
//   🔬 Laboratorios — gestionar los labs del centro
//   👥 Grupos      — gestionar los grupos académicos
// ═══════════════════════════════════════════════════════════

// Datos en memoria (se cargan de la API al iniciar)
let laboratorios = [];
let grupos = [];
let horarios = [];
let filtroLabId = 'todos'; // filtro activo en la tabla de horarios

// ════════════════════════════════════════════════════════════
// SESIÓN Y NAVEGACIÓN
// ════════════════════════════════════════════════════════════

// Verifica que haya sesión activa; si no, redirige al login
async function verificarSesion() {
  const res = await fetch('/api/me');
  const data = await res.json();
  if (!data.loggedIn) { window.location.href = '/login'; return; }
  document.getElementById('admin-name').textContent = data.admin.nombre || data.admin.username;
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/login';
});

// Cambiar entre paneles (Horarios / Laboratorios / Grupos)
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const panel = item.dataset.panel;
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active-panel'));
    document.getElementById(`panel-${panel}`).classList.add('active-panel');
    // Cargar datos del panel seleccionado
    if (panel === 'horarios') cargarHorarios();
    if (panel === 'laboratorios') cargarLaboratorios();
    if (panel === 'grupos') cargarGrupos();
  });
});

// ════════════════════════════════════════════════════════════
// LABORATORIOS
// ════════════════════════════════════════════════════════════

async function cargarLaboratorios() {
  const res = await fetch('/api/laboratorios');
  laboratorios = await res.json();
  renderLabsGrid();
  llenarSelectLabs();    // actualiza el select del modal de horarios
  construirFiltros();    // actualiza los botones de filtro en la tabla
}

// Tarjetas de laboratorio con botones Editar / Eliminar
function renderLabsGrid() {
  const grid = document.getElementById('labs-grid');
  if (!laboratorios.length) {
    grid.innerHTML = `<p style="color:var(--gray-600);grid-column:1/-1;padding:32px 0">
      Sin laboratorios. Usa <strong>+ Nuevo Laboratorio</strong> para agregar.
    </p>`;
    return;
  }
  grid.innerHTML = laboratorios.map(lab => `
    <div class="group-card">
      <div class="group-card-header">
        <div class="group-name-row">
          <span style="font-size:1.2rem">🔬</span>
          <span class="group-card-name">${esc(lab.nombre)}</span>
        </div>
      </div>
      <div class="group-card-body">
        <div class="group-meta-item"><strong>📍 Ubicación:</strong> ${esc(lab.ubicacion || '—')}</div>
        <div class="group-meta-item"><strong>👥 Capacidad:</strong> ${lab.capacidad || '—'} puestos</div>
        ${lab.descripcion ? `<div class="group-meta-item" style="color:var(--gray-600);font-size:.8rem">${esc(lab.descripcion)}</div>` : ''}
      </div>
      <div class="group-card-actions">
        <button class="btn-accion btn-editar btn-full" onclick="abrirModalLab(${lab.id})">✏️ Editar</button>
        <button class="btn-accion btn-eliminar btn-full" onclick="confirmarEliminar('Eliminar laboratorio',
          '¿Eliminar <strong>${esc(lab.nombre)}</strong>? Se eliminarán también todos sus horarios.',
          () => eliminarLab(${lab.id}))">🗑 Eliminar</button>
      </div>
    </div>`).join('');
}

// Rellena el select de laboratorio en el modal de horarios
function llenarSelectLabs() {
  document.getElementById('horario-lab').innerHTML =
    '<option value="">— Seleccionar laboratorio —</option>' +
    laboratorios.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('');
}

// Botones de filtro rápido por lab en la tabla de horarios
function construirFiltros() {
  const cont = document.getElementById('lab-filter-btns');
  cont.innerHTML =
    `<button class="lab-filter-btn ${filtroLabId === 'todos' ? 'active' : ''}" data-lab="todos">Todos</button>` +
    laboratorios.map(l =>
      `<button class="lab-filter-btn ${filtroLabId == l.id ? 'active' : ''}" data-lab="${l.id}">${esc(l.nombre)}</button>`
    ).join('');

  cont.querySelectorAll('.lab-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cont.querySelectorAll('.lab-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroLabId = btn.dataset.lab === 'todos' ? 'todos' : Number(btn.dataset.lab);
      renderHorariosTabla();
    });
  });
}

document.getElementById('btn-add-lab').addEventListener('click', () => abrirModalLab());

function abrirModalLab(id = null) {
  const esEdicion = !!id;
  document.getElementById('modal-lab-title').textContent = esEdicion ? 'Editar Laboratorio' : 'Nuevo Laboratorio';
  document.getElementById('btn-guardar-lab').textContent = esEdicion ? 'Actualizar' : 'Guardar';
  document.getElementById('form-lab').reset();
  document.getElementById('lab-id').value = '';

  if (esEdicion) {
    const lab = laboratorios.find(x => x.id === id);
    if (lab) {
      document.getElementById('lab-id').value = lab.id;
      document.getElementById('lab-nombre').value = lab.nombre;
      document.getElementById('lab-ubicacion').value = lab.ubicacion || '';
      document.getElementById('lab-capacidad').value = lab.capacidad || '';
      document.getElementById('lab-descripcion').value = lab.descripcion || '';
    }
  }
  document.getElementById('modal-lab').style.display = 'flex';
}

document.getElementById('form-lab').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('lab-id').value;
  const payload = {
    nombre: document.getElementById('lab-nombre').value,
    ubicacion: document.getElementById('lab-ubicacion').value,
    capacidad: document.getElementById('lab-capacidad').value,
    descripcion: document.getElementById('lab-descripcion').value,
  };
  const res = await fetch(
    id ? `/api/laboratorios/${id}` : '/api/laboratorios',
    { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  if (res.ok) {
    closeModal('modal-lab');
    toast(id ? '✅ Laboratorio actualizado' : '✅ Laboratorio creado', 'success');
    cargarLaboratorios(); cargarHorarios();
  } else {
    const d = await res.json(); toast(d.error || 'Error al guardar', 'error');
  }
});

async function eliminarLab(id) {
  const res = await fetch(`/api/laboratorios/${id}`, { method: 'DELETE' });
  if (res.ok) { toast('🗑 Laboratorio eliminado', 'success'); cargarLaboratorios(); cargarHorarios(); }
  else toast('Error al eliminar', 'error');
}

// ════════════════════════════════════════════════════════════
// GRUPOS
// ════════════════════════════════════════════════════════════

async function cargarGrupos() {
  const res = await fetch('/api/grupos');
  grupos = await res.json();
  renderGruposGrid();
  llenarSelectGrupos();
}

function renderGruposGrid() {
  const grid = document.getElementById('groups-grid');
  if (!grupos.length) {
    grid.innerHTML = `<p style="color:var(--gray-600);grid-column:1/-1;padding:32px 0">
      Sin grupos. Usa <strong>+ Nuevo Grupo</strong>.
    </p>`;
    return;
  }
  grid.innerHTML = grupos.map(g => `
    <div class="group-card">
      <div class="group-card-header">
        <div class="group-name-row">
          <span class="group-color-bar" style="background:${g.color}"></span>
          <span class="group-card-name">${esc(g.nombre)}</span>
        </div>
      </div>
      <div class="group-card-body">
        <div class="group-meta-item"><strong>Docente:</strong> ${esc(g.docente || '—')}</div>
        <div class="group-meta-item"><strong>Materia:</strong> ${esc(g.materia || '—')}</div>
      </div>
      <div class="group-card-actions">
        <button class="btn-accion btn-editar btn-full" onclick="abrirModalGrupo(${g.id})">✏️ Editar</button>
        <button class="btn-accion btn-eliminar btn-full" onclick="confirmarEliminar('Eliminar grupo',
          '¿Eliminar <strong>${esc(g.nombre)}</strong>? También se eliminarán sus horarios.',
          () => eliminarGrupo(${g.id}))">🗑 Eliminar</button>
      </div>
    </div>`).join('');
}

function llenarSelectGrupos() {
  document.getElementById('horario-grupo').innerHTML =
    '<option value="">— Seleccionar grupo —</option>' +
    grupos.map(g => `<option value="${g.id}">${esc(g.nombre)}</option>`).join('');
}

document.getElementById('btn-add-grupo').addEventListener('click', () => abrirModalGrupo());

function abrirModalGrupo(id = null) {
  const esEdicion = !!id;
  document.getElementById('modal-grupo-title').textContent = esEdicion ? 'Editar Grupo' : 'Nuevo Grupo';
  document.getElementById('btn-guardar-grupo').textContent = esEdicion ? 'Actualizar' : 'Guardar';
  document.getElementById('form-grupo').reset();
  document.getElementById('grupo-id').value = '';
  document.getElementById('grupo-color').value = '#006633';

  if (esEdicion) {
    const g = grupos.find(x => x.id === id);
    if (g) {
      document.getElementById('grupo-id').value = g.id;
      document.getElementById('grupo-nombre').value = g.nombre;
      document.getElementById('grupo-docente').value = g.docente || '';
      document.getElementById('grupo-materia').value = g.materia || '';
      document.getElementById('grupo-color').value = g.color || '#006633';
    }
  }
  document.getElementById('modal-grupo').style.display = 'flex';
}

document.querySelectorAll('.color-preset').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById('grupo-color').value = el.dataset.color;
  });
});

document.getElementById('form-grupo').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('grupo-id').value;
  const payload = {
    nombre: document.getElementById('grupo-nombre').value,
    docente: document.getElementById('grupo-docente').value,
    materia: document.getElementById('grupo-materia').value,
    color: document.getElementById('grupo-color').value,
  };
  const res = await fetch(
    id ? `/api/grupos/${id}` : '/api/grupos',
    { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  if (res.ok) {
    closeModal('modal-grupo');
    toast(id ? '✅ Grupo actualizado' : '✅ Grupo creado', 'success');
    cargarGrupos(); cargarHorarios();
  } else {
    const d = await res.json(); toast(d.error || 'Error al guardar', 'error');
  }
});

async function eliminarGrupo(id) {
  const res = await fetch(`/api/grupos/${id}`, { method: 'DELETE' });
  if (res.ok) { toast('🗑 Grupo eliminado', 'success'); cargarGrupos(); cargarHorarios(); }
  else toast('Error al eliminar', 'error');
}

// ════════════════════════════════════════════════════════════
// HORARIOS
// ════════════════════════════════════════════════════════════

async function cargarHorarios() {
  const res = await fetch('/api/horarios');
  horarios = await res.json();
  renderHorariosTabla();
  // Recargar selects por si hubo cambios en labs o grupos
  await Promise.all([cargarLaboratorios(), cargarGrupos()]);
}

function renderHorariosTabla() {
  const body = document.getElementById('horarios-table-body');
  const nombresDias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

  const visibles = filtroLabId === 'todos'
    ? horarios
    : horarios.filter(h => h.laboratorio_id === filtroLabId);

  if (!visibles.length) {
    body.innerHTML = `<div class="empty-state" style="padding:48px"><p>Sin asignaciones.</p></div>`;
    return;
  }

  // AHORA ordenamos por dia_semana (1, 2, 3...) y luego por hora
  const ordenados = [...visibles].sort((a, b) => 
    (a.dia_semana - b.dia_semana) || a.hora_inicio.localeCompare(b.hora_inicio)
  );

  body.innerHTML = ordenados.map(h => `
    <div class="admin-table-row">
      <div style="font-size:.85rem;font-weight:600;color:var(--gray-800)">
        🔬 ${esc(h.lab_nombre)}
      </div>
      <div class="grupo-chip">
        <span class="grupo-dot" style="background:${h.color || '#006633'}"></span>
        ${esc(h.grupo_nombre)}
      </div>
      <div class="cell-text">📅 ${nombresDias[h.dia_semana]}</div> 
      <div class="cell-text">${fmt(h.hora_inicio)}</div>
      <div class="cell-text">${fmt(h.hora_fin)}</div>
      <div class="action-btns">
        <button class="btn-accion btn-editar" onclick="abrirModalHorario(${h.id})">✏️ Editar</button>
        <button class="btn-accion btn-eliminar" onclick="confirmarEliminar('Eliminar asignación',
          '¿Eliminar la asignación de <strong>${esc(h.lab_nombre)} — ${nombresDias[h.dia_semana]}</strong>?',
          () => eliminarHorario(${h.id}))">🗑 Eliminar</button>
      </div>
    </div>`).join('');
}

document.getElementById('btn-add-horario').addEventListener('click', () => abrirModalHorario());

function abrirModalHorario(id = null) {
 const esEdicion = !!id;
  document.getElementById('modal-horario-title').textContent = esEdicion ? 'Editar Asignación' : 'Nueva Asignación';
  document.getElementById('btn-guardar-horario').textContent = esEdicion ? 'Actualizar' : 'Guardar';
  document.getElementById('form-horario').reset();
  document.getElementById('horario-id').value = '';

  if (esEdicion) {
    const h = horarios.find(x => x.id === id);
    if (h) {
      document.getElementById('horario-id').value = h.id;
      document.getElementById('horario-lab').value = h.laboratorio_id;
      document.getElementById('horario-grupo').value = h.grupo_id;
      // CAMBIO: Ahora usamos dia_semana en lugar de fecha
      document.getElementById('horario-dia').value = h.dia_semana; 
      document.getElementById('horario-inicio').value = h.hora_inicio.substring(0, 5);
      document.getElementById('horario-fin').value = h.hora_fin.substring(0, 5);
    }
  }
  document.getElementById('modal-horario').style.display = 'flex';
}

document.getElementById('form-horario').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('horario-id').value;
  
  // CORRECCIÓN AQUÍ: Cambiamos 'fecha' por 'dia_semana' y usamos el ID correcto
  const payload = {
    laboratorio_id: document.getElementById('horario-lab').value,
    grupo_id: document.getElementById('horario-grupo').value,
    dia_semana: document.getElementById('horario-dia').value, // <--- Antes decía 'fecha'
    hora_inicio: document.getElementById('horario-inicio').value,
    hora_fin: document.getElementById('horario-fin').value,
  };

  if (payload.hora_inicio >= payload.hora_fin) {
    toast('La hora de fin debe ser mayor a la de inicio', 'warning'); 
    return;
  }

  // Validación de que el día esté seleccionado
  if (!payload.dia_semana) {
    toast('Por favor selecciona un día de la semana', 'warning');
    return;
  }

  const res = await fetch(
    id ? `/api/horarios/${id}` : '/api/horarios',
    { 
      method: id ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload) 
    }
  );
  
  const data = await res.json();
  if (res.ok) {
    closeModal('modal-horario');
    toast(id ? '✅ Horario actualizado' : '✅ Horario creado', 'success');
    cargarHorarios();
  } else {
    toast(data.error || 'Error al guardar', 'error');
  }
});

async function eliminarHorario(id) {
  const res = await fetch(`/api/horarios/${id}`, { method: 'DELETE' });
  if (res.ok) { toast('🗑 Asignación eliminada', 'success'); cargarHorarios(); }
  else toast('Error al eliminar', 'error');
}

// ════════════════════════════════════════════════════════════
// MODAL DE CONFIRMACIÓN REUTILIZABLE
// ════════════════════════════════════════════════════════════
let _confirmCb = null; // callback a ejecutar si el usuario confirma

function confirmarEliminar(titulo, mensaje, callback) {
  document.getElementById('confirm-title').textContent = titulo;
  document.getElementById('confirm-msg').innerHTML = mensaje;
  _confirmCb = callback;
  document.getElementById('modal-confirm').style.display = 'flex';
}

document.getElementById('confirm-ok-btn').addEventListener('click', () => {
  closeModal('modal-confirm');
  if (typeof _confirmCb === 'function') _confirmCb();
  _confirmCb = null;
});

// ════════════════════════════════════════════════════════════
// UTILIDADES
// ════════════════════════════════════════════════════════════

// Cerrar modal al hacer clic fuera de él
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.style.display = 'none';
  });
});

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// Notificación temporal en la esquina inferior derecha
function toast(msg, tipo = 'success') {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.className = `toast ${tipo}`;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

// "07:00:00" → "07:00"
function fmt(t) { return t ? t.substring(0, 5) : '—'; }

// Evita inyección de HTML
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// "2026-03-31T00:00:00Z" → "Mar 31" (para la tabla del admin)
function fechaCorta(v) {
  if (!v) return '—';
  const d = new Date(v.toString().substring(0, 10) + 'T12:00:00');
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ════════════════════════════════════════════════════════════
// INICIO
// ════════════════════════════════════════════════════════════
verificarSesion().then(() => cargarHorarios());