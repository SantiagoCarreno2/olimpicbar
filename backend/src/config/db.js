const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASS,
  database:           process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL conectado correctamente');
    conn.release();
  } catch (err) {
    console.error('❌ Error de conexión MySQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;