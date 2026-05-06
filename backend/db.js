// ═══════════════════════════════════════════════════════════
// db.js — Conexión a MySQL con Docker
// ═══════════════════════════════════════════════════════════
// Crea un pool de conexiones a MySQL y reintenta
// automáticamente si Docker aún está iniciando MySQL.
// ═══════════════════════════════════════════════════════════

const mysql = require('mysql2');
require('dotenv').config();

const MAX_REINTENTOS = 10;
const ESPERA_MS = 3000;

function crearPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'unisimon_lab',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10000,
  }).promise();
}

async function conectarConReintentos() {
  for (let i = 1; i <= MAX_REINTENTOS; i++) {
    try {
      const pool = crearPool();
      await pool.query('SELECT 1');
      console.log('✅ Conexión a MySQL establecida');
      return pool;
    } catch (err) {
      console.log(`⏳ MySQL no listo (intento ${i}/${MAX_REINTENTOS}). Reintentando en ${ESPERA_MS / 1000}s...`);
      if (i === MAX_REINTENTOS) { console.error('❌ No se pudo conectar a MySQL.'); process.exit(1); }
      await new Promise(r => setTimeout(r, ESPERA_MS));
    }
  }
}

// Exportar promesa del pool — server.js la resuelve antes de escuchar
module.exports = conectarConReintentos();