const pool = require('../config/db');
const { broadcast } = require('../websocket');

const FLUJO = ['Pendiente', 'Alistando', 'Entregado'];

const getMesasSede = async (req, res) => {
  const { id_sede } = req.usuario;
  try {
    const [rows] = await pool.query(
      `SELECT m.id_mesa, m.numero, m.estado,
              s.id_sesion, s.fecha_inicio,
              COUNT(DISTINCT c.id_cliente)                                        AS total_comensales,
              COUNT(DISTINCT dp.id_detalle)                                       AS total_items,
              SUM(CASE WHEN dp.estado = 'Pendiente' THEN 1 ELSE 0 END)           AS items_pendientes
       FROM mesa m
       LEFT JOIN sesion_mesa s  ON s.id_mesa   = m.id_mesa  AND s.estado = 'Activa'
       LEFT JOIN cliente c      ON c.id_sesion = s.id_sesion
       LEFT JOIN pedido p       ON p.id_sesion = s.id_sesion
       LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido AND dp.estado != 'Cancelado'
       WHERE m.id_sede = ?
       GROUP BY m.id_mesa, m.numero, m.estado, s.id_sesion, s.fecha_inicio
       ORDER BY m.numero`,
      [id_sede]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener mesas' });
  }
};

const getPedidosMesa = async (req, res) => {
  const { id_sesion } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
         c.id_cliente, c.nombre_visible, c.rol_mesa,
         dp.id_detalle, dp.cantidad, dp.precio_unitario, dp.estado, dp.fecha_estado,
         pr.nombre AS producto_nombre, pr.imagen_url,
         p.id_pedido, p.notas
       FROM cliente c
       JOIN pedido p           ON p.id_cliente  = c.id_cliente AND p.id_sesion = c.id_sesion
       JOIN detalle_pedido dp  ON dp.id_pedido  = p.id_pedido
       JOIN producto pr        ON pr.id_producto = dp.id_producto
       WHERE c.id_sesion = ? AND p.estado = 'Activo' AND dp.estado != 'Cancelado'
       ORDER BY c.nombre_visible, dp.fecha_estado ASC`,
      [id_sesion]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
};

const cambiarEstadoItem = async (req, res) => {
  const { id_detalle } = req.params;
  const { estado: nuevoEstado } = req.body;
  const { id_usuario, id_sede } = req.usuario;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query(
      'SELECT id_detalle, estado, cantidad, id_producto FROM detalle_pedido WHERE id_detalle = ?',
      [id_detalle]
    );
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'Ítem no encontrado' });
    }

    const estadoActual = item.estado;

    // Validar flujo
    if (nuevoEstado === 'Cancelado') {
      if (estadoActual !== 'Pendiente') {
        await conn.rollback();
        return res.status(400).json({ error: 'Solo se puede cancelar un ítem Pendiente' });
      }
    } else {
      const idxActual = FLUJO.indexOf(estadoActual);
      const idxNuevo  = FLUJO.indexOf(nuevoEstado);
      if (idxActual === -1 || idxNuevo === -1 || idxNuevo !== idxActual + 1) {
        await conn.rollback();
        return res.status(400).json({
          error: `Transición inválida: ${estadoActual} → ${nuevoEstado}`,
        });
      }
    }

    await conn.query(
      "UPDATE detalle_pedido SET estado = ?, fecha_estado = NOW() WHERE id_detalle = ?",
      [nuevoEstado, id_detalle]
    );

    // Descontar stock al entregar
    if (nuevoEstado === 'Entregado') {
      await conn.query(
        'UPDATE inventario SET stock_actual = stock_actual - ? WHERE id_producto = ? AND id_sede = ?',
        [item.cantidad, item.id_producto, id_sede]
      );
    }

    // Auditoría
    await conn.query(
      `INSERT INTO log_auditoria (accion, entidad, id_entidad, detalle, id_usuario, id_sede)
       VALUES ('CAMBIO_ESTADO_ITEM', 'detalle_pedido', ?, ?, ?, ?)`,
      [
        id_detalle,
        JSON.stringify({ estado_anterior: estadoActual, estado_nuevo: nuevoEstado }),
        id_usuario,
        id_sede,
      ]
    );

    await conn.commit();

    broadcast({ tipo: 'ACTUALIZAR_MESAS', id_sede });
    res.json({ id_detalle, estado: nuevoEstado });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar estado del ítem' });
  } finally {
    conn.release();
  }
};

const cerrarMesa = async (req, res) => {
  const { id_sesion } = req.params;
  const { id_sede } = req.usuario;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Verifica ítems sin terminar
    const [[{ pendientes }]] = await conn.query(
      `SELECT COUNT(*) AS pendientes
       FROM pedido p
       JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
       WHERE p.id_sesion = ? AND dp.estado IN ('Pendiente','Alistando')`,
      [id_sesion]
    );

    if (pendientes > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Aún hay ítems sin entregar' });
    }

    // Verificar que no haya clientes sin cobrar
    const [[{ total: sinCobrar }]] = await conn.query(`
      SELECT COUNT(*) AS total
      FROM cliente c
      WHERE c.id_sesion = ?
      AND NOT EXISTS (
        SELECT 1 FROM cuenta cu
        WHERE cu.id_cliente = c.id_cliente AND cu.estado = 'Cobrada'
      )
      AND EXISTS (
        SELECT 1 FROM pedido p
        JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
        WHERE p.id_cliente = c.id_cliente AND dp.estado = 'Entregado'
      )
    `, [id_sesion]);

    if (sinCobrar > 0) {
      await conn.rollback();
      return res.status(409).json({
        error: `Hay ${sinCobrar} comensal(es) con ítems entregados sin cobrar. El cajero debe registrar el pago antes de cerrar la mesa.`,
      });
    }

    await conn.query(
      "UPDATE sesion_mesa SET estado='Cerrada', fecha_fin=NOW() WHERE id_sesion=?",
      [id_sesion]
    );
    await conn.query(
      "UPDATE mesa SET estado='Libre' WHERE id_mesa = (SELECT id_mesa FROM sesion_mesa WHERE id_sesion=?)",
      [id_sesion]
    );

    await conn.commit();

    broadcast({ tipo: 'ACTUALIZAR_MESAS', id_sede });
    res.json({ mensaje: 'Mesa cerrada correctamente', id_sesion });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al cerrar mesa' });
  } finally {
    conn.release();
  }
};

module.exports = { getMesasSede, getPedidosMesa, cambiarEstadoItem, cerrarMesa };
