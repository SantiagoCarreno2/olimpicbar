const pool = require('../config/db');
const { broadcast } = require('../websocket');

const crearPedido = async (req, res) => {
  const { id_cliente, id_sesion, id_sede } = req.cliente;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'El pedido debe tener al menos un ítem' });

  for (const item of items) {
    if (!item.id_producto || !item.cantidad || item.cantidad < 1)
      return res.status(400).json({ error: 'Cada ítem necesita id_producto y cantidad >= 1' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Valida productos y obtiene precios
    const ids = items.map(i => i.id_producto);
    const [productos] = await conn.query(
      `SELECT id_producto, precio_venta FROM producto WHERE id_producto IN (${ids.map(() => '?').join(',')}) AND visible=1`,
      ids
    );

    if (productos.length !== ids.length)
      return res.status(400).json({ error: 'Uno o más productos no están disponibles' });

    const precioMap = Object.fromEntries(productos.map(p => [p.id_producto, p.precio_venta]));

    const [pedidoResult] = await conn.query(
      "INSERT INTO pedido (estado, id_sesion, id_cliente) VALUES ('Activo', ?, ?)",
      [id_sesion, id_cliente]
    );
    const id_pedido = pedidoResult.insertId;

    for (const item of items) {
      await conn.query(
        "INSERT INTO detalle_pedido (cantidad, precio_unitario, estado, id_pedido, id_producto) VALUES (?, ?, 'Pendiente', ?, ?)",
        [item.cantidad, precioMap[item.id_producto], id_pedido, item.id_producto]
      );
    }

    await conn.commit();

    broadcast({ tipo: 'NUEVO_PEDIDO', id_sesion, id_sede });

    res.status(201).json({ id_pedido, items_creados: items.length });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al crear pedido' });
  } finally {
    conn.release();
  }
};

const getMisPedidos = async (req, res) => {
  const { id_cliente, id_sesion } = req.cliente;

  try {
    const [rows] = await pool.query(
      `SELECT dp.id_detalle, dp.cantidad, dp.precio_unitario, dp.estado,
              pr.nombre AS producto_nombre
       FROM detalle_pedido dp
       JOIN pedido p   ON p.id_pedido   = dp.id_pedido
       JOIN producto pr ON pr.id_producto = dp.id_producto
       WHERE p.id_cliente = ? AND p.id_sesion = ? AND p.estado = 'Activo'
       ORDER BY dp.fecha_estado DESC`,
      [id_cliente, id_sesion]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

module.exports = { crearPedido, getMisPedidos };
