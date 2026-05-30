const pool = require('../config/db');

const getCatalogo = async (req, res) => {
  try {
    const { sedeId } = req.params;

    if (!sedeId || sedeId === 'all') {
      const [rows] = await pool.query(
        `SELECT p.id_producto, p.nombre, p.descripcion, p.precio_venta,
                p.costo, p.imagen_url, p.id_categoria
         FROM producto p
         WHERE p.visible = 1`
      );
      return res.json(rows);
    }

    const [rows] = await pool.query(
      `SELECT p.id_producto, p.nombre, p.descripcion, p.precio_venta,
              p.costo, p.imagen_url, p.id_categoria,
              i.stock_actual
       FROM producto p
       JOIN inventario i ON i.id_producto = p.id_producto
       WHERE p.visible = 1 AND i.id_sede = ?`,
      [sedeId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener catálogo' });
  }
};

const getCategorias = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id_categoria, c.nombre,
              COUNT(DISTINCT p.id_producto) as total_productos
       FROM categoria c
       JOIN producto p ON p.id_categoria = c.id_categoria
       WHERE p.visible = 1
       GROUP BY c.id_categoria, c.nombre
       ORDER BY c.id_categoria`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCatalogo, getCategorias };
