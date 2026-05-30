const jwt  = require('jsonwebtoken');
const pool = require('../config/db');
const { broadcast } = require('../websocket');

const iniciarSesion = async (req, res) => {
  const { qr_codigo } = req.params;

  try {
    const [[mesa]] = await pool.query(
      `SELECT m.*, s.nombre AS sede_nombre
       FROM mesa m JOIN sede s ON s.id_sede = m.id_sede
       WHERE m.qr_codigo = ? AND m.qr_activo = 1`,
      [qr_codigo]
    );

    if (!mesa)
      return res.status(404).json({ error: 'Este código QR no es válido. Consulta con el personal' });

    if (mesa.estado === 'Ocupada') {
      // Busca la sesión activa existente para devolver id_sesion al cliente
      const [[sesionExistente]] = await pool.query(
        "SELECT id_sesion FROM sesion_mesa WHERE id_mesa=? AND estado='Activa' LIMIT 1",
        [mesa.id_mesa]
      );
      return res.status(409).json({
        error:      'Esta mesa ya está en uso. Solicita el enlace al Dueño',
        mesa_info:  { numero: mesa.numero, sede_nombre: mesa.sede_nombre },
        id_sesion:  sesionExistente?.id_sesion ?? null,
      });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query("UPDATE mesa SET estado='Ocupada' WHERE id_mesa=?", [mesa.id_mesa]);

      const [result] = await conn.query(
        "INSERT INTO sesion_mesa (fecha_inicio, estado, total_sesion, id_mesa, id_usuario) VALUES (NOW(), 'Activa', 0, ?, 1)",
        [mesa.id_mesa]
      );
      const id_sesion = result.insertId;

      await conn.commit();

      broadcast({ tipo: 'ACTUALIZAR_MESAS', id_sede: mesa.id_sede });

      res.status(201).json({
        id_sesion,
        mesa: {
          id_mesa:     mesa.id_mesa,
          numero:      mesa.numero,
          sede_nombre: mesa.sede_nombre,
          id_sede:     mesa.id_sede,
        },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión de mesa' });
  }
};

const registrarCliente = async (req, res) => {
  const { id_sesion } = req.params;
  const { nombre_visible, token_invitacion } = req.body;

  if (!nombre_visible || nombre_visible.trim().length < 2 || nombre_visible.trim().length > 30)
    return res.status(400).json({ error: 'El nombre debe tener entre 2 y 30 caracteres' });

  const nombre = nombre_visible.trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[sesion]] = await conn.query(
      `SELECT s.id_sesion, s.estado, m.numero, m.id_sede, m.qr_codigo, sede.nombre AS sede_nombre
       FROM sesion_mesa s
       JOIN mesa m    ON m.id_mesa   = s.id_mesa
       JOIN sede      ON sede.id_sede = m.id_sede
       WHERE s.id_sesion = ?`,
      [id_sesion]
    );

    if (!sesion) {
      await conn.rollback();
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    if (sesion.estado !== 'Activa') {
      await conn.rollback();
      return res.status(409).json({ error: 'Esta sesión ya terminó' });
    }

    // Validate invite token BEFORE creating client (prevents race condition)
    if (token_invitacion) {
      const [[tokenRow]] = await conn.query(
        'SELECT id_cliente FROM cliente WHERE token_sesion=? AND token_usado=0 AND id_sesion=?',
        [token_invitacion, id_sesion]
      );
      if (!tokenRow) {
        await conn.rollback();
        return res.status(409).json({ error: 'Este enlace ya no es válido. Solicita uno nuevo al Dueño de Mesa.' });
      }
    }

    const [[{ total }]] = await conn.query(
      'SELECT COUNT(*) AS total FROM cliente WHERE id_sesion=?',
      [id_sesion]
    );

    if (total >= 10) {
      await conn.rollback();
      return res.status(409).json({ error: 'Esta mesa ha alcanzado su capacidad máxima' });
    }

    const rol_mesa = total === 0 ? 'Dueno' : 'Acompanante';

    const [result] = await conn.query(
      'INSERT INTO cliente (nombre_visible, rol_mesa, id_sesion) VALUES (?, ?, ?)',
      [nombre, rol_mesa, id_sesion]
    );
    const id_cliente = result.insertId;

    // Mark token as used atomically with client creation
    if (token_invitacion) {
      await conn.query(
        'UPDATE cliente SET token_usado=1 WHERE token_sesion=? AND token_usado=0',
        [token_invitacion]
      );
    }

    await conn.commit();

    const token_cliente = jwt.sign(
      { id_cliente, id_sesion: Number(id_sesion), nombre_visible: nombre, rol_mesa, id_sede: sesion.id_sede },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(201).json({
      token_cliente,
      cliente: { id_cliente, nombre_visible: nombre, rol_mesa },
      sesion:  { id_sesion: Number(id_sesion) },
      mesa:    { numero: sesion.numero, sede_nombre: sesion.sede_nombre, id_sede: sesion.id_sede, qr_codigo: sesion.qr_codigo },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al registrar cliente' });
  } finally {
    conn.release();
  }
};

const generarEnlaceInvitacion = async (req, res) => {
  const { id_cliente, id_sesion } = req.cliente;

  try {
    const [[cliente]] = await pool.query(
      'SELECT id_cliente, rol_mesa FROM cliente WHERE id_cliente=? AND id_sesion=?',
      [id_cliente, id_sesion]
    );

    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (cliente.rol_mesa !== 'Dueno')
      return res.status(403).json({ error: 'Solo el Dueño de Mesa puede generar invitaciones' });

    const token_invitacion = Math.random().toString(36).substring(2, 10).toUpperCase();

    await pool.query(
      'UPDATE cliente SET token_sesion=?, token_usado=0 WHERE id_cliente=?',
      [token_invitacion, id_cliente]
    );

    res.json({
      enlace:            `${process.env.FRONTEND_URL}/unirse/${token_invitacion}`,
      token_invitacion,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar enlace de invitación' });
  }
};

const unirseConEnlace = async (req, res) => {
  const { token_invitacion } = req.params;

  try {
    const [[row]] = await pool.query(
      `SELECT c.id_cliente, c.token_usado,
              s.id_sesion, s.estado,
              m.numero, m.id_sede, m.qr_codigo,
              sede.nombre AS sede_nombre
       FROM cliente c
       JOIN sesion_mesa s ON s.id_sesion = c.id_sesion
       JOIN mesa m        ON m.id_mesa   = s.id_mesa
       JOIN sede          ON sede.id_sede = m.id_sede
       WHERE c.token_sesion = ? AND c.token_usado = 0`,
      [token_invitacion]
    );

    if (!row)
      return res.status(404).json({ error: 'Este enlace ya no es válido. Solicita uno nuevo' });

    if (row.estado !== 'Activa')
      return res.status(409).json({ error: 'La sesión de esta mesa ya terminó' });

    res.json({
      id_sesion:         row.id_sesion,
      token_invitacion,
      mesa: {
        numero:      row.numero,
        sede_nombre: row.sede_nombre,
        id_sede:     row.id_sede,
        qr_codigo:   row.qr_codigo,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al procesar enlace de invitación' });
  }
};

const verificarSesionActiva = async (req, res) => {
  const { id_sesion } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT s.estado, m.estado AS mesa_estado
       FROM sesion_mesa s
       JOIN mesa m ON m.id_mesa = s.id_mesa
       WHERE s.id_sesion = ?`,
      [id_sesion]
    );
    if (!rows.length) return res.status(404).json({ activa: false, motivo: 'sesion_no_encontrada' });
    if (rows[0].estado !== 'Activa') return res.json({ activa: false, motivo: 'sesion_cerrada' });
    if (rows[0].mesa_estado !== 'Ocupada') return res.json({ activa: false, motivo: 'mesa_libre' });
    res.json({ activa: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { iniciarSesion, registrarCliente, generarEnlaceInvitacion, unirseConEnlace, verificarSesionActiva };
