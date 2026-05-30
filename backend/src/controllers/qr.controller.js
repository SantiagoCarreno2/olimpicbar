const QRCode = require('qrcode');
const { v4: uuid } = require('uuid');
const pool = require('../config/db');

const SEDE_CODIGOS = { 1: 'CHAP', 2: 'USAQ', 3: 'ZROS' };

/* ── Algoritmo Backtracking: genera código único con reintentos ─ */
const generarCodigoUnico = async (sedePrefix, numero, intentos = 0) => {
  if (intentos > 10)
    throw new Error('No se pudo generar un código único después de 10 intentos');

  const sufijo = uuid().substring(0, 8).toUpperCase();
  const codigo = `OB-${sedePrefix}-M${numero.toString().padStart(2, '0')}-${sufijo}`;

  const [[{ total }]] = await pool.query(
    'SELECT COUNT(*) as total FROM mesa WHERE qr_codigo = ?',
    [codigo]
  );

  if (total > 0) {
    // Backtracking: colisión detectada, intentar con otro UUID
    return generarCodigoUnico(sedePrefix, numero, intentos + 1);
  }

  return { codigo, intentos: intentos + 1 };
};

const generarQR = async (req, res) => {
  const { id_mesa } = req.params;
  const { id_sede: sede_usuario, rol } = req.usuario;

  try {
    const [[mesa]] = await pool.query(
      `SELECT m.id_mesa, m.numero, m.estado, m.id_sede, s.nombre AS sede_nombre
       FROM mesa m JOIN sede s ON s.id_sede = m.id_sede
       WHERE m.id_mesa = ?`,
      [id_mesa]
    );

    if (!mesa) return res.status(404).json({ error: 'Mesa no encontrada' });

    if (rol !== 'Administrador' && mesa.id_sede !== sede_usuario)
      return res.status(403).json({ error: 'No tienes acceso a esta mesa' });

    if (mesa.estado === 'Ocupada')
      return res.status(409).json({ error: 'No se puede regenerar el QR de una mesa ocupada' });

    await pool.query('UPDATE mesa SET qr_activo=0 WHERE id_mesa=?', [id_mesa]);

    const sede_codigo = SEDE_CODIGOS[mesa.id_sede] ?? `S${mesa.id_sede}`;
    const { codigo: qr_codigo, intentos } = await generarCodigoUnico(sede_codigo, mesa.numero);
    const qr_url    = `${process.env.FRONTEND_URL}/mesa/${qr_codigo}`;
    const qr_imagen = await QRCode.toDataURL(qr_url);

    await pool.query(
      'UPDATE mesa SET qr_codigo=?, qr_activo=1 WHERE id_mesa=?',
      [qr_codigo, id_mesa]
    );

    res.json({
      qr_codigo,
      qr_url,
      qr_imagen,
      intentos,
      mesa: { id_mesa: mesa.id_mesa, numero: mesa.numero, sede_nombre: mesa.sede_nombre },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar QR' });
  }
};

const getMesasConQR = async (req, res) => {
  const { id_sede: sede_token, rol } = req.usuario;
  const id_sede = rol === 'Administrador' && req.query.sede_id
    ? Number(req.query.sede_id)
    : sede_token;

  try {
    const [rows] = await pool.query(
      `SELECT m.id_mesa, m.numero, m.estado, m.qr_codigo, m.qr_activo, m.id_sede,
              s.nombre AS sede_nombre
       FROM mesa m JOIN sede s ON s.id_sede = m.id_sede
       WHERE m.id_sede = ?
       ORDER BY m.numero`,
      [id_sede]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mesas' });
  }
};

module.exports = { generarQR, getMesasConQR };
