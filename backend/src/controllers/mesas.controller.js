const pool = require('../config/db');

const ocuparMesa = async (req, res) => {
  const { mesaId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM mesa WHERE id_mesa = ?', [mesaId]);
    if (!rows.length)
      return res.status(404).json({ error: 'Mesa no encontrada' });

    if (rows[0].estado === 'Ocupada')
      return res.status(409).json({ error: 'Mesa ya está ocupada', mesa: rows[0] });

    await pool.query("UPDATE mesa SET estado = 'Ocupada' WHERE id_mesa = ?", [mesaId]);
    res.json({ mensaje: 'Mesa ocupada correctamente', mesaId, estado: 'Ocupada' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

const getMesa = async (req, res) => {
  const { mesaId } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT m.*, s.nombre AS sede_nombre
       FROM mesa m JOIN sede s ON m.id_sede = s.id_sede
       WHERE m.id_mesa = ?`,
      [mesaId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mesa no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
};

const getMesaByToken = async (req, res) => {
  const { token } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT m.*, s.nombre AS sede_nombre
       FROM mesa m JOIN sede s ON m.id_sede = s.id_sede
       WHERE m.qr_codigo = ?`,
      [token]
    );
    if (!rows.length) return res.status(404).json({ error: 'QR inválido' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
};

const liberarMesa = async (req, res) => {
  const { mesaId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM mesa WHERE id_mesa = ?', [mesaId]);
    if (!rows.length)
      return res.status(404).json({ error: 'Mesa no encontrada' });

    await pool.query("UPDATE mesa SET estado = 'Libre' WHERE id_mesa = ?", [mesaId]);
    res.json({ mensaje: 'Mesa liberada correctamente', mesaId, estado: 'Libre' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { ocuparMesa, getMesa, getMesaByToken, liberarMesa };
