const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

/* ── Dashboard: métricas en tiempo real por sede ─────────────── */
const getDashboard = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        s.id_sede, s.nombre AS sede_nombre, s.ubicacion,
        COUNT(DISTINCT CASE WHEN m.estado = 'Ocupada' THEN m.id_mesa END)            AS mesas_ocupadas,
        COUNT(DISTINCT m.id_mesa)                                                     AS total_mesas,
        COUNT(DISTINCT CASE WHEN sm.estado = 'Activa' THEN sm.id_sesion END)         AS sesiones_activas,
        COALESCE(SUM(CASE WHEN dp.estado = 'Entregado' THEN dp.precio_unitario * dp.cantidad END), 0) AS ventas_hoy,
        COALESCE(SUM(CASE WHEN sm.estado = 'Activa' AND dp.estado = 'Pendiente' THEN 1 END), 0)      AS items_pendientes
      FROM sede s
      LEFT JOIN mesa m            ON m.id_sede   = s.id_sede
      LEFT JOIN sesion_mesa sm    ON sm.id_mesa  = m.id_mesa AND DATE(sm.fecha_inicio) = CURDATE()
      LEFT JOIN pedido p          ON p.id_sesion = sm.id_sesion
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido AND dp.estado != 'Cancelado'
      WHERE s.activa = 1
      GROUP BY s.id_sede, s.nombre, s.ubicacion
      ORDER BY s.id_sede
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Reporte de ventas por periodo y sede ────────────────────── */
const getReporte = async (req, res) => {
  const { fecha_inicio, fecha_fin, id_sede } = req.query;

  if (!fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridos' });

  try {
    let reporteQuery = `
      SELECT
        s.id_sede, s.nombre AS sede_nombre,
        COUNT(DISTINCT sm.id_sesion)                                                                    AS total_mesas_atendidas,
        COUNT(DISTINCT CASE WHEN dp.estado != 'Cancelado' THEN dp.id_detalle END)                      AS total_items,
        COALESCE(SUM(CASE WHEN dp.estado = 'Entregado' THEN dp.precio_unitario * dp.cantidad END), 0)  AS total_ingresos,
        COALESCE(AVG(sub.total_sesion), 0)                                                             AS ticket_promedio,
        COUNT(DISTINCT CASE WHEN dp.estado = 'Cancelado' THEN dp.id_detalle END)                       AS cancelaciones
      FROM sede s
      JOIN mesa m           ON m.id_sede  = s.id_sede
      JOIN sesion_mesa sm   ON sm.id_mesa = m.id_mesa AND DATE(sm.fecha_inicio) BETWEEN ? AND ?
      JOIN pedido p         ON p.id_sesion = sm.id_sesion
      JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      LEFT JOIN (
        SELECT p2.id_sesion, SUM(dp2.precio_unitario * dp2.cantidad) AS total_sesion
        FROM pedido p2
        JOIN detalle_pedido dp2 ON dp2.id_pedido = p2.id_pedido
        WHERE dp2.estado = 'Entregado'
        GROUP BY p2.id_sesion
      ) sub ON sub.id_sesion = sm.id_sesion
      WHERE s.activa = 1
    `;
    const params = [fecha_inicio, fecha_fin];

    if (id_sede) { reporteQuery += ' AND s.id_sede = ?'; params.push(id_sede); }
    reporteQuery += ' GROUP BY s.id_sede, s.nombre ORDER BY s.id_sede';

    let topQuery = `
      SELECT pr.nombre,
             SUM(dp.cantidad) AS total_vendido,
             SUM(dp.precio_unitario * dp.cantidad) AS ingresos
      FROM detalle_pedido dp
      JOIN producto pr    ON pr.id_producto = dp.id_producto
      JOIN pedido p       ON p.id_pedido    = dp.id_pedido
      JOIN sesion_mesa sm ON sm.id_sesion   = p.id_sesion
      JOIN mesa m         ON m.id_mesa      = sm.id_mesa
      WHERE dp.estado = 'Entregado' AND DATE(sm.fecha_inicio) BETWEEN ? AND ?
    `;
    const topParams = [fecha_inicio, fecha_fin];
    if (id_sede) { topQuery += ' AND m.id_sede = ?'; topParams.push(id_sede); }
    topQuery += ' GROUP BY pr.id_producto, pr.nombre ORDER BY total_vendido DESC LIMIT 5';

    const [[resumen], [top_productos]] = await Promise.all([
      pool.query(reporteQuery, params),
      pool.query(topQuery, topParams),
    ]);

    // Snapshot en reporte_ventas (falla en silencio si la tabla no existe)
    try {
      const totalIngresos = resumen.reduce((s, r) => s + Number(r.total_ingresos), 0);
      const totalMesas    = resumen.reduce((s, r) => s + Number(r.total_mesas_atendidas), 0);
      await pool.query(
        `INSERT INTO reporte_ventas (fecha_inicio, fecha_fin, total_ingresos, total_mesas_atendidas, id_sede, id_usuario)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [fecha_inicio, fecha_fin, totalIngresos, totalMesas, id_sede || null, req.usuario.id_usuario]
      );
    } catch {}

    res.json({ resumen, top_productos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Lista todos los usuarios ────────────────────────────────── */
const getUsuarios = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id_usuario, u.nombre, u.username, u.correo, u.activo,
             u.contrasena_tmp, u.intentos_login, u.bloqueado_hasta, u.fecha_creacion,
             r.nombre AS rol, s.nombre AS sede_nombre, u.id_rol, u.id_sede
      FROM usuario u
      JOIN rol  r ON r.id_rol  = u.id_rol
      JOIN sede s ON s.id_sede = u.id_sede
      ORDER BY s.id_sede, r.id_rol, u.nombre
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Crear usuario ───────────────────────────────────────────── */
const crearUsuario = async (req, res) => {
  const { nombre, username, correo, password, id_rol, id_sede } = req.body;

  if (!nombre || !username || !password || !id_rol || !id_sede)
    return res.status(400).json({ error: 'Faltan campos requeridos' });

  try {
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuario WHERE username = ?',
      [username]
    );
    if (total > 0) return res.status(409).json({ error: 'El username ya está en uso' });

    const hash = await bcrypt.hash(String(password), 10);

    const [result] = await pool.query(
      `INSERT INTO usuario (nombre, username, contrasena, correo, activo, contrasena_tmp, id_rol, id_sede)
       VALUES (?, ?, ?, ?, 1, 0, ?, ?)`,
      [nombre, username, hash, correo || null, id_rol, id_sede]
    );

    const [[nuevo]] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.username, r.nombre AS rol, s.nombre AS sede_nombre
       FROM usuario u
       JOIN rol  r ON r.id_rol  = u.id_rol
       JOIN sede s ON s.id_sede = u.id_sede
       WHERE u.id_usuario = ?`,
      [result.insertId]
    );

    res.status(201).json(nuevo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Activar / desactivar usuario ────────────────────────────── */
const toggleUsuario = async (req, res) => {
  const id_usuario = Number(req.params.id);

  if (id_usuario === req.usuario.id_usuario)
    return res.status(400).json({ error: 'No puedes desactivar tu propio usuario' });

  try {
    await pool.query('UPDATE usuario SET activo = NOT activo WHERE id_usuario = ?', [id_usuario]);
    const [[u]] = await pool.query('SELECT activo FROM usuario WHERE id_usuario = ?', [id_usuario]);
    res.json({ activo: !!u.activo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Reset contraseña ────────────────────────────────────────── */
const resetPassword = async (req, res) => {
  const id_usuario    = Number(req.params.id);
  const { nueva_password } = req.body;

  if (!nueva_password || String(nueva_password).length < 4)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });

  try {
    const hash = await bcrypt.hash(String(nueva_password), 10);
    await pool.query(
      'UPDATE usuario SET contrasena = ?, contrasena_tmp = 1 WHERE id_usuario = ?',
      [hash, id_usuario]
    );
    res.json({ mensaje: 'Contraseña reseteada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Lista sedes ─────────────────────────────────────────────── */
const getSedes = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_sede, nombre, ubicacion, activa FROM sede ORDER BY id_sede'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/* ── Lista roles ─────────────────────────────────────────────── */
const getRoles = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id_rol, nombre FROM rol ORDER BY id_rol');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getDashboard, getReporte, getUsuarios, crearUsuario, toggleUsuario, resetPassword, getSedes, getRoles };
