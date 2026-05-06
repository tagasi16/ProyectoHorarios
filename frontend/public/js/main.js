// ═══════════════════════════════════════════════════
// main.js — Pantalla pública con rotación automática
// Universidad Simón Bolívar — Centro de Laboratorios
// ═══════════════════════════════════════════════════

const ROTACION_SEG = 30; 
const SUB_ROTACION_DIA_SEG = 5; 
const RECARGA_MIN = 5;
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

let laboratorios = [];
let horariosPorLab = {};
let idxActual = 0;
let diaIdxActual = 0; 
let timerRotacion = null;
let timerProgreso = null;
let segsProgreso = 0;

// ══════════════════════════════════════════════════
// RELOJ
// ══════════════════════════════════════════════════
function actualizarReloj() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById('clock');
    if(clockEl) clockEl.textContent = `${hh}:${mm}:${ss}`;
    
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const f = now.toLocaleDateString('es-CO', opts);
    const dateEl = document.getElementById('date-display');
    if(dateEl) dateEl.textContent = f.charAt(0).toUpperCase() + f.slice(1);
}
actualizarReloj();
setInterval(actualizarReloj, 1000);

// ══════════════════════════════════════════════════
// UTILIDADES DE FECHA
// ══════════════════════════════════════════════════
function obtenerFechaConOffset(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ══════════════════════════════════════════════════
// CARGAR DATOS
// ══════════════════════════════════════════════════
async function cargarDatos() {
    try {
        const [rLabs, rHors] = await Promise.all([
            fetch('/api/laboratorios'),
            fetch('/api/horarios')
        ]);
        laboratorios = await rLabs.json();
        const todos = await rHors.json();

        horariosPorLab = {};
        laboratorios.forEach(l => { horariosPorLab[l.id] = []; });
        todos.forEach(h => {
            if (horariosPorLab[h.laboratorio_id]) horariosPorLab[h.laboratorio_id].push(h);
        });

        construirDots();
        if (idxActual >= laboratorios.length) idxActual = 0;
        mostrarLab(idxActual);
    } catch (err) {
        console.error(err);
    }
}

function construirDots() {
    const dotsEl = document.getElementById('lab-dots');
    if(!dotsEl) return;
    dotsEl.innerHTML = laboratorios.map((_, i) =>
        `<div class="lab-dot ${i === idxActual ? 'activo' : ''}" id="dot-${i}"></div>`
    ).join('');
}

// ══════════════════════════════════════════════════
// MOSTRAR LABORATORIO
// ══════════════════════════════════════════════════
function mostrarLab(idx) {
    if (!laboratorios.length) return;
    const lab = laboratorios[idx];

    const fechaCalculada = obtenerFechaConOffset(diaIdxActual);
    const fechaObj = new Date(fechaCalculada + "T00:00:00");
    
    // 1=Lun, 2=Mar... 7=Dom (Para tu DB)
    let numeroDiaJS = fechaObj.getDay(); 
    const diaSemanaParaDB = numeroDiaJS === 0 ? 7 : numeroDiaJS;

    const opciones = { weekday: 'long', day: 'numeric', month: 'short' };
    const fechaLegible = fechaObj.toLocaleDateString('es-CO', opciones);

    document.getElementById('lab-nombre').textContent = lab.nombre;
    document.getElementById('lab-meta').innerHTML =
        `<span>📍 ${esc(lab.ubicacion || 'Sin ubicación')}</span>` +
        `<span style="color: #FFD700; font-weight: bold; border-left: 2px solid #555; padding-left: 10px; margin-left: 10px;">
            📅 ${fechaLegible.toUpperCase()}
         </span>`;

    document.querySelectorAll('.lab-dot').forEach((d, i) =>
        d.classList.toggle('activo', i === idx)
    );

    const body = document.getElementById('schedule-body');
    body.classList.add('saliendo');

    setTimeout(() => {
        const horariosDelLab = horariosPorLab[lab.id] || [];
        const filtrados = horariosDelLab.filter(h => parseInt(h.dia_semana) === diaSemanaParaDB);

        renderizarTabla(filtrados, fechaCalculada);
        
        body.classList.remove('saliendo');
        body.classList.add('entrando');
        setTimeout(() => body.classList.remove('entrando'), 350);
    }, 300);

    reiniciarProgreso();
}

// ══════════════════════════════════════════════════
// RENDERIZAR TABLA (CORREGIDO PARA TU IMAGEN)
// ══════════════════════════════════════════════════
function renderizarTabla(horarios, fechaVista) {
    const body = document.getElementById('schedule-body');
    if (!horarios.length) {
        body.innerHTML = '<div class="empty-state"><p>📭 Sin asignaciones para este día.</p></div>';
        return;
    }

    const now = new Date();
    const hoyISO = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    const horaAhora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const ordenados = [...horarios].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

    let html = '';
    ordenados.forEach((h, i) => {
        const esHoyReal = fechaVista === hoyISO;
        const enCurso = esHoyReal && horaAhora >= h.hora_inicio && horaAhora < h.hora_fin;
        const finalizado = esHoyReal && horaAhora >= h.hora_fin;
        
        // Obtener nombre del día desde el número (h.dia_semana)
        const nombreDia = DIAS_SEMANA[h.dia_semana === 7 ? 0 : h.dia_semana];

        let claseRow = 'schedule-row';
        if (enCurso) claseRow += ' en-curso';
        else if (finalizado) claseRow += ' pasado';

        html += `
            <div class="${claseRow}" style="animation-delay:${i * 45}ms">
                <div class="cell-dia">
                    <span class="dia-badge" style="background:${h.color || '#006633'}"></span>
                    <span>${nombreDia}</span>
                </div>
                <div class="cell-hora">
                    ${fmt(h.hora_inicio)} – ${fmt(h.hora_fin)}
                </div>
                <div class="cell-grupo">
                    <span class="grupo-name">${esc(h.grupo_nombre)}</span>
                </div>
                <div class="cell-docente">
                    ${esc(h.docente || '—')}
                </div>
                <div class="cell-materia">
                    ${esc(h.materia || '—')}
                </div>
                <div style="text-align:center">
                    ${enCurso ? 
                        '<span class="estado-badge estado-encurso">● En curso</span>' : 
                        '<span class="estado-badge estado-prog">Programado</span>'}
                </div>
            </div>`;
    });
    body.innerHTML = html;
}

// ══════════════════════════════════════════════════
// ROTACIÓN Y UTILIDADES
// ══════════════════════════════════════════════════
function iniciarRotacion() {
    if (timerRotacion) clearInterval(timerRotacion);
    timerRotacion = setInterval(() => {
        diaIdxActual++;
        if (diaIdxActual >= 6) { 
            diaIdxActual = 0; 
            idxActual = (idxActual + 1) % laboratorios.length;
        }
        mostrarLab(idxActual);
    }, SUB_ROTACION_DIA_SEG * 1000);
}

function reiniciarProgreso() {
    if (diaIdxActual !== 0) return;
    if (timerProgreso) clearInterval(timerProgreso);
    segsProgreso = 0;
    const barra = document.getElementById('lab-progreso');
    if (!barra) return;
    barra.style.transition = 'none';
    barra.style.width = '0%';
    timerProgreso = setInterval(() => {
        segsProgreso++;
        barra.style.transition = 'width 1s linear';
        barra.style.width = Math.min((segsProgreso / ROTACION_SEG) * 100, 100) + '%';
        if (segsProgreso >= ROTACION_SEG) clearInterval(timerProgreso);
    }, 1000);
}

function fmt(t) { return t ? t.substring(0, 5) : '—'; }
function esc(s) { return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''; }

cargarDatos();
iniciarRotacion();
setInterval(cargarDatos, RECARGA_MIN * 60 * 1000);