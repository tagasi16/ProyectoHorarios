// ═══════════════════════════════════════════════════════════
// server.js — Servidor Express con MySQL (Docker)
// Universidad Simón Bolívar — Centro de Laboratorios
// ═══════════════════════════════════════════════════════════

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dbPromise = require('./db');
let db;
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND = process.env.FRONTEND_DIR || path.join(__dirname, '../frontend');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(FRONTEND, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'unisimon_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 2 }
}));

// ── Páginas HTML ─────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND, 'views/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(FRONTEND, 'views/admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(FRONTEND, 'views/login.html')));

// ── Protección rutas admin ───────────────────────────────────
function soloAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.status(401).json({ error: 'No autorizado. Inicia sesión primero.' });
}

// ════════════════════════════════════════════════════════════
// AUTENTICACIÓN
// ════════════════════════════════════════════════════════════

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciales inválidas' });
    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin.password) || password === admin.password;
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
    req.session.admin = { id: admin.id, username: admin.username, nombre: admin.nombre };
    res.json({ success: true, nombre: admin.nombre });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

app.get('/api/me', (req, res) => res.json(
  req.session.admin ? { loggedIn: true, admin: req.session.admin } : { loggedIn: false }
));

// ════════════════════════════════════════════════════════════
// LABORATORIOS (Se mantiene igual)
// ════════════════════════════════════════════════════════════

app.get('/api/laboratorios', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM laboratorios WHERE activo = 1 ORDER BY nombre');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error al obtener laboratorios' }); }
});

app.post('/api/laboratorios', soloAdmin, async (req, res) => {
  const { nombre, ubicacion, capacidad, descripcion } = req.body;
  try {
    const [r] = await db.query(
      'INSERT INTO laboratorios (nombre, ubicacion, capacidad, descripcion) VALUES (?,?,?,?)',
      [nombre, ubicacion || '', capacidad || 0, descripcion || '']
    );
    const [nuevo] = await db.query('SELECT * FROM laboratorios WHERE id = ?', [r.insertId]);
    res.json(nuevo[0]);
  } catch (err) { res.status(500).json({ error: 'Error al crear laboratorio' }); }
});

app.put('/api/laboratorios/:id', soloAdmin, async (req, res) => {
  const { nombre, ubicacion, capacidad, descripcion } = req.body;
  try {
    await db.query(
      'UPDATE laboratorios SET nombre=?, ubicacion=?, capacidad=?, descripcion=? WHERE id=?',
      [nombre, ubicacion, capacidad, descripcion, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al actualizar laboratorio' }); }
});

app.delete('/api/laboratorios/:id', soloAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM laboratorios WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar laboratorio' }); }
});

// ════════════════════════════════════════════════════════════
// GRUPOS (Se mantiene igual)
// ════════════════════════════════════════════════════════════

app.get('/api/grupos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM grupos ORDER BY nombre');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Error al obtener grupos' }); }
});

app.post('/api/grupos', soloAdmin, async (req, res) => {
  const { nombre, docente, materia, color } = req.body;
  try {
    const [r] = await db.query(
      'INSERT INTO grupos (nombre, docente, materia, color) VALUES (?,?,?,?)',
      [nombre, docente || '', materia || '', color || '#006633']
    );
    const [nuevo] = await db.query('SELECT * FROM grupos WHERE id = ?', [r.insertId]);
    res.json(nuevo[0]);
  } catch (err) { res.status(500).json({ error: 'Error al crear grupo' }); }
});

app.put('/api/grupos/:id', soloAdmin, async (req, res) => {
  const { nombre, docente, materia, color } = req.body;
  try {
    await db.query('UPDATE grupos SET nombre=?, docente=?, materia=?, color=? WHERE id=?',
      [nombre, docente, materia, color, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al actualizar grupo' }); }
});

app.delete('/api/grupos/:id', soloAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM grupos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar grupo' }); }
});

// ════════════════════════════════════════════════════════════
// HORARIOS — LOGICA PURA DE DÍA DE LA SEMANA (Lunes-Domingo)
// ════════════════════════════════════════════════════════════

app.get('/api/horarios', async (req, res) => {
  try {
    const { laboratorio_id } = req.query;
    let sql = `
      SELECT h.id, h.laboratorio_id, h.grupo_id, h.dia_semana,
             DATE_FORMAT(h.hora_inicio, '%H:%i:%s') AS hora_inicio,
             DATE_FORMAT(h.hora_fin, '%H:%i:%s') AS hora_fin,
             l.nombre AS lab_nombre, l.ubicacion,
             g.nombre AS grupo_nombre, g.docente, g.materia, g.color
      FROM horarios h
      JOIN laboratorios l ON h.laboratorio_id = l.id
      JOIN grupos g ON h.grupo_id = g.id
    `;
    
    const params = [];
    if (laboratorio_id) { 
      sql += ' WHERE h.laboratorio_id = ?'; 
      params.push(laboratorio_id); 
    }
    
    sql += ' ORDER BY h.dia_semana, h.hora_inicio';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) { 
    res.status(500).json({ error: 'Error al obtener horarios' }); 
  }
});

app.post('/api/horarios', soloAdmin, async (req, res) => {
  const { laboratorio_id, grupo_id, dia_semana, hora_inicio, hora_fin } = req.body;
  try {
    // Validación de conflicto por día de la semana y rango de horas
    const [conflicto] = await db.query(
      'SELECT id FROM horarios WHERE laboratorio_id=? AND dia_semana=? AND hora_inicio < ? AND hora_fin > ?',
      [laboratorio_id, dia_semana, hora_fin, hora_inicio]
    );
    
    if (conflicto.length > 0) {
      return res.status(409).json({ error: 'Conflicto: El laboratorio ya está ocupado en ese día y horario.' });
    }

    const [r] = await db.query(
      'INSERT INTO horarios (laboratorio_id, grupo_id, dia_semana, hora_inicio, hora_fin) VALUES (?,?,?,?,?)',
      [laboratorio_id, grupo_id, dia_semana, hora_inicio, hora_fin]
    );
    
    res.json({ success: true, id: r.insertId });
  } catch (err) { 
    res.status(500).json({ error: 'Error al crear horario' }); 
  }
});

app.put('/api/horarios/:id', soloAdmin, async (req, res) => {
  const { laboratorio_id, grupo_id, dia_semana, hora_inicio, hora_fin } = req.body;
  try {
    // Validar conflictos ignorando el registro actual que estamos editando
    const [conflicto] = await db.query(
      'SELECT id FROM horarios WHERE laboratorio_id=? AND dia_semana=? AND hora_inicio < ? AND hora_fin > ? AND id != ?',
      [laboratorio_id, dia_semana, hora_fin, hora_inicio, req.params.id]
    );

    if (conflicto.length > 0) {
      return res.status(409).json({ error: 'Conflicto: El nuevo horario choca con uno existente.' });
    }

    await db.query(
      'UPDATE horarios SET laboratorio_id=?, grupo_id=?, dia_semana=?, hora_inicio=?, hora_fin=? WHERE id=?',
      [laboratorio_id, grupo_id, dia_semana, hora_inicio, hora_fin, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { 
    res.status(500).json({ error: 'Error al actualizar horario' }); 
  }
});

app.delete('/api/horarios/:id', soloAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM horarios WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Error al eliminar horario' }); }
});

// ════════════════════════════════════════════════════════════
// ARRANQUE
// ════════════════════════════════════════════════════════════
dbPromise.then(pool => {
  db = pool;
  app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📅 Centro de Laboratorios — Lógica de Días Semanales`);
  });
});