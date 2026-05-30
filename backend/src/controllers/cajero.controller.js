const pool = require('../config/db');
const { broadcast } = require('../websocket');

/* ── Lista cuentas abiertas ──────────────────────────────────── */
const getCuentasAbiertas = async (req, res) => {
  const { id_sede } = req.usuario;
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id_mesa, m.numero,
         s.id_sesion, s.fecha_inicio,
         COUNT(DISTINCT c.id_cliente) AS total_comensales,
         GROUP_CONCAT(DISTINCT c.nombre_visible ORDER BY c.id_cliente SEPARATOR ', ') AS nombres_preview,
         (
           SELECT COALESCE(SUM(dp2.precio_unitario * dp2.cantidad), 0)
           FROM pedido p2
           JOIN detalle_pedido dp2 ON dp2.id_pedido = p2.id_pedido
           WHERE p2.id_sesion = s.id_sesion
             AND dp2.estado = 'Entregado'
         ) AS total_entregado,
         (
           SELECT COUNT(*)
           FROM pedido p2
           JOIN detalle_pedido dp2 ON dp2.id_pedido = p2.id_pedido
           WHERE p2.id_sesion = s.id_sesion
             AND dp2.estado IN ('Pendiente', 'Alistando')
         ) AS items_activos
       FROM mesa m
       JOIN sesion_mesa s ON s.id_mesa = m.id_mesa AND s.estado = 'Activa'
       JOIN cliente c ON c.id_sesion = s.id_sesion
       WHERE m.id_sede = ? AND m.estado = 'Ocupada'
       GROUP BY m.id_mesa, m.numero, s.id_sesion, s.fecha_inicio
       ORDER BY total_entregado DESC`,
      [id_sede]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cuentas' });
  }
};

/* ── Desglose por comensal ───────────────────────────────────── */
const getDesgloseMesa = async (req, res) => {
  const { id_sesion } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT
         c.id_cliente, c.nombre_visible, c.rol_mesa,
         dp.id_detalle, dp.cantidad, dp.precio_unitario, dp.estado,
         pr.nombre AS producto_nombre,
         (dp.precio_unitario * dp.cantidad) AS subtotal,
         CASE WHEN EXISTS (
           SELECT 1 FROM cuenta cu
           WHERE cu.id_cliente = c.id_cliente AND cu.estado = 'Cobrada'
         ) THEN 1 ELSE 0 END AS ya_cobrado
       FROM cliente c
       JOIN pedido p          ON p.id_cliente  = c.id_cliente  AND p.id_sesion = c.id_sesion AND p.estado  = 'Activo'
       JOIN detalle_pedido dp ON dp.id_pedido  = p.id_pedido   AND dp.estado = 'Entregado'
       JOIN producto pr       ON pr.id_producto = dp.id_producto
       WHERE c.id_sesion = ?
       ORDER BY c.nombre_visible, pr.nombre`,
      [id_sesion]
    );

    // Agrupa por cliente
    const mapa = {};
    for (const row of rows) {
      if (!mapa[row.id_cliente]) {
        mapa[row.id_cliente] = {
          id_cliente:     row.id_cliente,
          nombre_visible: row.nombre_visible,
          rol_mesa:       row.rol_mesa,
          ya_cobrado:     row.ya_cobrado === 1,
          items:          [],
          total_personal: 0,
        };
      }
      mapa[row.id_cliente].items.push({
        id_detalle:      row.id_detalle,
        producto_nombre: row.producto_nombre,
        cantidad:        row.cantidad,
        precio_unitario: row.precio_unitario,
        subtotal:        Number(row.subtotal),
      });
      mapa[row.id_cliente].total_personal += Number(row.subtotal);
    }

    res.json(Object.values(mapa));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener desglose' });
  }
};

/* ── Procesar cobro ──────────────────────────────────────────── */
const procesarCobro = async (req, res) => {
  const { id_sesion, modo, id_cliente, metodo_pago } = req.body;
  const { id_usuario, id_sede } = req.usuario;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const modalidad = modo === 'individual' ? 'Individual' : 'Grupal';

    // Verificar cobros duplicados antes de procesar
    if (modo === 'individual') {
      const [[{ total: yaCobrado }]] = await conn.query(
        `SELECT COUNT(*) AS total FROM cuenta
         WHERE id_cliente = ? AND id_sesion = ? AND estado = 'Cobrada'`,
        [id_cliente, id_sesion]
      );
      if (yaCobrado > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'Este comensal ya fue cobrado.' });
      }
    } else {
      const [clientesSesion] = await conn.query(
        'SELECT id_cliente FROM cliente WHERE id_sesion = ?', [id_sesion]
      );
      for (const cliente of clientesSesion) {
        const [[{ total: yaCobrado }]] = await conn.query(
          `SELECT COUNT(*) AS total FROM cuenta
           WHERE id_cliente = ? AND id_sesion = ? AND estado = 'Cobrada'`,
          [cliente.id_cliente, id_sesion]
        );
        if (yaCobrado > 0) {
          await conn.rollback();
          return res.status(409).json({
            error: 'Algunos comensales ya fueron cobrados. Usa cobro individual para los que faltan.',
          });
        }
      }
    }

    // Obtener clientes a cobrar con su total de ítems Entregados
    let clientes;
    if (modo === 'individual') {
      const [rows] = await conn.query(
        `SELECT c.id_cliente,
                COALESCE(SUM(dp.precio_unitario * dp.cantidad), 0) AS total
         FROM cliente c
         JOIN pedido p          ON p.id_cliente  = c.id_cliente AND p.estado = 'Activo'
         JOIN detalle_pedido dp ON dp.id_pedido  = p.id_pedido  AND dp.estado = 'Entregado'
         WHERE c.id_cliente = ? AND c.id_sesion = ?
         GROUP BY c.id_cliente`,
        [id_cliente, id_sesion]
      );
      clientes = rows;
    } else {
      const [rows] = await conn.query(
        `SELECT c.id_cliente,
                COALESCE(SUM(dp.precio_unitario * dp.cantidad), 0) AS total
         FROM cliente c
         JOIN pedido p          ON p.id_cliente  = c.id_cliente AND p.estado = 'Activo'
         JOIN detalle_pedido dp ON dp.id_pedido  = p.id_pedido  AND dp.estado = 'Entregado'
         WHERE c.id_sesion = ?
         GROUP BY c.id_cliente`,
        [id_sesion]
      );
      clientes = rows;
    }

    let total_cobrado = 0;

    // Para cada cliente: obtiene o crea la cuenta, luego registra el pago
    for (const cli of clientes) {
      const [[existente]] = await conn.query(
        'SELECT id_cuenta FROM cuenta WHERE id_sesion=? AND id_cliente=?',
        [id_sesion, cli.id_cliente]
      );

      let id_cuenta;
      if (existente) {
        await conn.query(
          "UPDATE cuenta SET total=?, estado='Cobrada', fecha_cierre=NOW() WHERE id_cuenta=?",
          [cli.total, existente.id_cuenta]
        );
        id_cuenta = existente.id_cuenta;
      } else {
        const [r] = await conn.query(
          "INSERT INTO cuenta (total, estado, fecha_cierre, id_sesion, id_cliente) VALUES (?, 'Cobrada', NOW(), ?, ?)",
          [cli.total, id_sesion, cli.id_cliente]
        );
        id_cuenta = r.insertId;
      }

      await conn.query(
        'INSERT INTO pago (monto, metodo, modalidad, id_cuenta, id_usuario) VALUES (?, ?, ?, ?, ?)',
        [cli.total, metodo_pago, modalidad, id_cuenta, id_usuario]
      );
      total_cobrado += Number(cli.total);
    }

    await conn.commit();
    broadcast({ tipo: 'ACTUALIZAR_MESAS', id_sede });
    res.json({ cobros_realizados: clientes.length, total_cobrado });
  } catch (err) {
    await conn.rollback();
    console.error('ERROR procesarCobro:', err.message, err.stack);
    res.status(500).json({ error: 'Error al procesar cobro', detalle: err.message });
  } finally {
    conn.release();
  }
};

/* ── Inventario ──────────────────────────────────────────────── */
const getProductosInventario = async (req, res) => {
  const { id_sede } = req.usuario;
  try {
    const [rows] = await pool.query(
      `SELECT p.id_producto, p.nombre,
              i.id_inventario, i.stock_actual, i.stock_minimo, i.stock_maximo,
              CASE WHEN i.stock_actual <= i.stock_minimo         THEN 'critico'
                   WHEN i.stock_actual <= i.stock_minimo * 2     THEN 'bajo'
                   ELSE 'ok' END AS estado_stock
       FROM producto p
       JOIN inventario i ON i.id_producto = p.id_producto
       WHERE i.id_sede = ? AND p.visible = 1
       ORDER BY p.nombre`,
      [id_sede]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
};

/* ── Restock ─────────────────────────────────────────────────── */
const restock = async (req, res) => {
  const { id_producto, cantidad } = req.body;
  const { id_usuario, id_sede } = req.usuario;

  if (!cantidad || cantidad <= 0)
    return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[inv]] = await conn.query(
      'SELECT id_inventario, stock_actual FROM inventario WHERE id_producto=? AND id_sede=?',
      [id_producto, id_sede]
    );
    if (!inv) {
      await conn.rollback();
      return res.status(404).json({ error: 'Producto no encontrado en inventario de esta sede' });
    }

    const stock_anterior = inv.stock_actual;
    const stock_resultante = stock_anterior + Number(cantidad);

    await conn.query(
      'UPDATE inventario SET stock_actual=? WHERE id_inventario=?',
      [stock_resultante, inv.id_inventario]
    );

    await conn.query(
      `INSERT INTO log_inventario
         (tipo_movimiento, cantidad, stock_anterior, stock_resultante, referencia, id_inventario, id_usuario)
       VALUES ('Entrada', ?, ?, ?, 'Restock manual cajero', ?, ?)`,
      [cantidad, stock_anterior, stock_resultante, inv.id_inventario, id_usuario]
    );

    const [[prod]] = await conn.query('SELECT nombre FROM producto WHERE id_producto=?', [id_producto]);
    await conn.commit();

    res.json({ stock_nuevo: stock_resultante, producto_nombre: prod?.nombre ?? '' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Error al hacer restock' });
  } finally {
    conn.release();
  }
};

/* ── Cierre de jornada ───────────────────────────────────────── */
const cerrarJornada = async (req, res) => {
  const id_sede    = req.usuario.id_sede;
  const id_usuario = req.usuario.id_usuario;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [mesasOcupadas] = await conn.query(
      `SELECT COUNT(*) as total FROM mesa WHERE id_sede = ? AND estado = 'Ocupada'`,
      [id_sede]
    );
    if (mesasOcupadas[0].total > 0) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        error: `Aún hay ${mesasOcupadas[0].total} mesa(s) ocupada(s). Ciérralas antes de cerrar la jornada.`
      });
    }

    const [resumen] = await conn.query(`
      SELECT
        COUNT(DISTINCT sm.id_sesion) as total_mesas,
        COUNT(DISTINCT CASE WHEN dp.estado != 'Cancelado' THEN dp.id_detalle END) as total_items,
        COUNT(DISTINCT CASE WHEN dp.estado = 'Cancelado'  THEN dp.id_detalle END) as total_cancelaciones,
        COALESCE(SUM(CASE WHEN dp.estado = 'Entregado' THEN dp.precio_unitario * dp.cantidad END), 0) as total_ventas
      FROM sesion_mesa sm
      JOIN mesa m ON m.id_mesa = sm.id_mesa
      LEFT JOIN pedido p ON p.id_sesion = sm.id_sesion
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      WHERE m.id_sede = ? AND DATE(sm.fecha_inicio) = CURDATE()
    `, [id_sede]);

    const [cobros] = await conn.query(`
      SELECT
        COUNT(CASE WHEN pa.modalidad = 'Individual' THEN 1 END) as cobros_individuales,
        COUNT(CASE WHEN pa.modalidad = 'Grupal'     THEN 1 END) as cobros_grupales
      FROM pago pa
      JOIN cuenta cu ON cu.id_cuenta = pa.id_cuenta
      JOIN sesion_mesa sm ON sm.id_sesion = cu.id_sesion
      JOIN mesa m ON m.id_mesa = sm.id_mesa
      WHERE m.id_sede = ? AND DATE(pa.fecha) = CURDATE()
    `, [id_sede]);

    const [topProductos] = await conn.query(`
      SELECT pr.nombre, SUM(dp.cantidad) as total_vendido,
             SUM(dp.precio_unitario * dp.cantidad) as ingresos
      FROM detalle_pedido dp
      JOIN producto pr ON pr.id_producto = dp.id_producto
      JOIN pedido p ON p.id_pedido = dp.id_pedido
      JOIN sesion_mesa sm ON sm.id_sesion = p.id_sesion
      JOIN mesa m ON m.id_mesa = sm.id_mesa
      WHERE dp.estado = 'Entregado' AND m.id_sede = ? AND DATE(sm.fecha_inicio) = CURDATE()
      GROUP BY pr.id_producto, pr.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `, [id_sede]);

    const datos = resumen[0];
    const ticket_promedio = datos.total_mesas > 0
      ? (datos.total_ventas / datos.total_mesas).toFixed(2)
      : 0;

    const fecha_inicio = new Date();
    fecha_inicio.setHours(0, 0, 0, 0);

    await conn.query(`
      INSERT INTO cierre_jornada
        (fecha_inicio, fecha_cierre, total_ventas, total_mesas, total_items,
         total_cancelaciones, cobros_individuales, cobros_grupales, ticket_promedio, id_sede, id_usuario)
      VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      fecha_inicio,
      datos.total_ventas,
      datos.total_mesas,
      datos.total_items,
      datos.total_cancelaciones,
      cobros[0].cobros_individuales || 0,
      cobros[0].cobros_grupales     || 0,
      ticket_promedio,
      id_sede,
      id_usuario,
    ]);

    await conn.commit();
    conn.release();

    res.json({
      mensaje: 'Jornada cerrada exitosamente',
      resumen: {
        total_ventas:        datos.total_ventas,
        total_mesas:         datos.total_mesas,
        total_items:         datos.total_items,
        total_cancelaciones: datos.total_cancelaciones,
        cobros_individuales: cobros[0].cobros_individuales || 0,
        cobros_grupales:     cobros[0].cobros_grupales     || 0,
        ticket_promedio,
        top_productos:       topProductos,
      },
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('ERROR cerrarJornada:', err.message, err.stack);
    res.status(500).json({ error: 'Error al cerrar jornada', detalle: err.message });
  }
};

/* ── Preview cierre (solo lectura) ──────────────────────────── */
const getPreviewCierre = async (req, res) => {
  const id_sede = req.usuario.id_sede;
  try {
    const [resumen] = await pool.query(`
      SELECT
        COUNT(DISTINCT sm.id_sesion) as total_mesas,
        COUNT(DISTINCT CASE WHEN dp.estado != 'Cancelado' THEN dp.id_detalle END) as total_items,
        COUNT(DISTINCT CASE WHEN dp.estado = 'Cancelado'  THEN dp.id_detalle END) as total_cancelaciones,
        COALESCE(SUM(CASE WHEN dp.estado = 'Entregado' THEN dp.precio_unitario * dp.cantidad END), 0) as total_ventas
      FROM sesion_mesa sm
      JOIN mesa m ON m.id_mesa = sm.id_mesa
      LEFT JOIN pedido p  ON p.id_sesion  = sm.id_sesion
      LEFT JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
      WHERE m.id_sede = ? AND DATE(sm.fecha_inicio) = CURDATE()
    `, [id_sede]);

    const [ventasPorHora] = await pool.query(`
      SELECT
        HOUR(dp.fecha_estado) as hora,
        SUM(dp.precio_unitario * dp.cantidad) as ventas
      FROM detalle_pedido dp
      JOIN pedido p       ON p.id_pedido   = dp.id_pedido
      JOIN sesion_mesa sm ON sm.id_sesion  = p.id_sesion
      JOIN mesa m         ON m.id_mesa     = sm.id_mesa
      WHERE dp.estado = 'Entregado' AND m.id_sede = ? AND DATE(sm.fecha_inicio) = CURDATE()
      GROUP BY HOUR(dp.fecha_estado)
      ORDER BY hora
    `, [id_sede]);

    const [topProductos] = await pool.query(`
      SELECT pr.nombre, SUM(dp.cantidad) as total_vendido,
             SUM(dp.precio_unitario * dp.cantidad) as ingresos
      FROM detalle_pedido dp
      JOIN producto pr    ON pr.id_producto = dp.id_producto
      JOIN pedido p       ON p.id_pedido    = dp.id_pedido
      JOIN sesion_mesa sm ON sm.id_sesion   = p.id_sesion
      JOIN mesa m         ON m.id_mesa      = sm.id_mesa
      WHERE dp.estado = 'Entregado' AND m.id_sede = ? AND DATE(sm.fecha_inicio) = CURDATE()
      GROUP BY pr.id_producto, pr.nombre
      ORDER BY total_vendido DESC
      LIMIT 5
    `, [id_sede]);

    const [cobros] = await pool.query(`
      SELECT
        COUNT(CASE WHEN pa.modalidad = 'Individual' THEN 1 END) as cobros_individuales,
        COUNT(CASE WHEN pa.modalidad = 'Grupal'     THEN 1 END) as cobros_grupales
      FROM pago pa
      JOIN cuenta cu      ON cu.id_cuenta  = pa.id_cuenta
      JOIN sesion_mesa sm ON sm.id_sesion  = cu.id_sesion
      JOIN mesa m         ON m.id_mesa     = sm.id_mesa
      WHERE m.id_sede = ? AND DATE(pa.fecha) = CURDATE()
    `, [id_sede]);

    const [cierreHoy] = await pool.query(
      `SELECT COUNT(*) as total FROM cierre_jornada WHERE id_sede = ? AND DATE(fecha_cierre) = CURDATE()`,
      [id_sede]
    );

    const [mesasOcupadas] = await pool.query(
      `SELECT COUNT(*) as total FROM mesa WHERE id_sede = ? AND estado = 'Ocupada'`,
      [id_sede]
    );

    const ticket_promedio = resumen[0].total_mesas > 0
      ? resumen[0].total_ventas / resumen[0].total_mesas
      : 0;

    res.json({
      resumen:         { ...resumen[0], ticket_promedio },
      ventas_por_hora: ventasPorHora,
      top_productos:   topProductos,
      cobros:          cobros[0],
      ya_cerrado:      cierreHoy[0].total > 0,
      mesas_ocupadas:  mesasOcupadas[0].total,
    });
  } catch (err) {
    console.error('ERROR getPreviewCierre:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCuentasAbiertas, getDesgloseMesa, procesarCobro, getProductosInventario, restock, cerrarJornada, getPreviewCierre };
