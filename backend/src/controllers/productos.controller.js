const pool = require('../config/db');
const XLSX = require('xlsx');

/* ── getProductos ─────────────────────────────────────────────── */
const getProductos = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id_producto, p.nombre, p.descripcion, p.precio_venta, p.costo,
             p.imagen_url, p.visible, p.id_categoria, p.fecha_creacion,
             cat.nombre AS categoria_nombre
      FROM producto p
      JOIN categoria cat ON cat.id_categoria = p.id_categoria
      ORDER BY cat.id_categoria, p.nombre
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

/* ── crearProducto ────────────────────────────────────────────── */
const crearProducto = async (req, res) => {
  const { nombre, descripcion, precio_venta, costo, imagen_url, visible, id_categoria } = req.body;

  if (!nombre?.trim())    return res.status(400).json({ error: 'El nombre es requerido' });
  if (!precio_venta || Number(precio_venta) <= 0)
    return res.status(400).json({ error: 'El precio de venta debe ser mayor a 0' });
  if (!id_categoria)      return res.status(400).json({ error: 'La categoría es requerida' });

  try {
    const [result] = await pool.query(
      `INSERT INTO producto (nombre, descripcion, precio_venta, costo, imagen_url, visible, id_categoria)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre.trim(),
        descripcion || null,
        Number(precio_venta),
        costo ? Number(costo) : null,
        imagen_url || null,
        visible !== undefined ? (visible ? 1 : 0) : 1,
        Number(id_categoria),
      ]
    );

    const id_producto = result.insertId;

    await pool.query(
      `INSERT INTO inventario (id_producto, stock_actual, stock_minimo, stock_maximo, id_sede)
       VALUES (?, 0, 5, 200, 1), (?, 0, 5, 200, 2), (?, 0, 5, 200, 3)`,
      [id_producto, id_producto, id_producto]
    );

    const [[producto]] = await pool.query(
      `SELECT p.*, cat.nombre AS categoria_nombre
       FROM producto p JOIN categoria cat ON cat.id_categoria = p.id_categoria
       WHERE p.id_producto = ?`,
      [id_producto]
    );

    res.status(201).json(producto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

/* ── actualizarProducto ───────────────────────────────────────── */
const actualizarProducto = async (req, res) => {
  const { id_producto } = req.params;
  const { nombre, descripcion, precio_venta, costo, imagen_url, visible, id_categoria } = req.body;

  if (!nombre?.trim())  return res.status(400).json({ error: 'El nombre es requerido' });
  if (!precio_venta || Number(precio_venta) <= 0)
    return res.status(400).json({ error: 'El precio de venta debe ser mayor a 0' });
  if (!id_categoria)    return res.status(400).json({ error: 'La categoría es requerida' });

  try {
    await pool.query(
      `UPDATE producto
       SET nombre=?, descripcion=?, precio_venta=?, costo=?, imagen_url=?, visible=?, id_categoria=?
       WHERE id_producto=?`,
      [
        nombre.trim(),
        descripcion || null,
        Number(precio_venta),
        costo ? Number(costo) : null,
        imagen_url || null,
        visible !== undefined ? (visible ? 1 : 0) : 1,
        Number(id_categoria),
        id_producto,
      ]
    );

    const [[producto]] = await pool.query(
      `SELECT p.*, cat.nombre AS categoria_nombre
       FROM producto p JOIN categoria cat ON cat.id_categoria = p.id_categoria
       WHERE p.id_producto = ?`,
      [id_producto]
    );

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(producto);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

/* ── toggleVisible ────────────────────────────────────────────── */
const toggleVisible = async (req, res) => {
  const { id_producto } = req.params;
  try {
    await pool.query(
      'UPDATE producto SET visible = NOT visible WHERE id_producto=?',
      [id_producto]
    );
    const [[p]] = await pool.query('SELECT visible FROM producto WHERE id_producto=?', [id_producto]);
    if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ visible: p.visible });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar visibilidad' });
  }
};

/* ── eliminarProducto ─────────────────────────────────────────── */
const eliminarProducto = async (req, res) => {
  const { id_producto } = req.params;
  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM detalle_pedido dp
       JOIN pedido p ON p.id_pedido = dp.id_pedido
       WHERE dp.id_producto = ? AND dp.estado NOT IN ('Entregado','Cancelado')`,
      [id_producto]
    );

    if (total > 0)
      return res.status(409).json({ error: 'No se puede eliminar un producto con pedidos activos' });

    await pool.query('DELETE FROM inventario WHERE id_producto=?', [id_producto]);
    await pool.query('DELETE FROM producto WHERE id_producto=?', [id_producto]);

    res.json({ mensaje: 'Producto eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

/* ── getInventarioAdmin ───────────────────────────────────────── */
const getInventarioAdmin = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id_producto, p.nombre, cat.nombre AS categoria,
             i.id_inventario, i.stock_actual, i.stock_minimo, i.stock_maximo, i.id_sede,
             s.nombre AS sede_nombre,
             CASE WHEN i.stock_actual <= i.stock_minimo        THEN 'critico'
                  WHEN i.stock_actual <= i.stock_minimo * 2    THEN 'bajo'
                  ELSE 'ok' END AS estado_stock
      FROM inventario i
      JOIN producto p   ON p.id_producto   = i.id_producto
      JOIN categoria cat ON cat.id_categoria = p.id_categoria
      JOIN sede s        ON s.id_sede       = i.id_sede
      ORDER BY s.id_sede, cat.nombre, p.nombre
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
};

/* ── actualizarInventario ─────────────────────────────────────── */
const actualizarInventario = async (req, res) => {
  const { id_inventario } = req.params;
  const { stock_minimo, stock_maximo } = req.body;

  if (stock_minimo === undefined || stock_minimo < 0)
    return res.status(400).json({ error: 'stock_minimo debe ser >= 0' });
  if (!stock_maximo || Number(stock_maximo) <= Number(stock_minimo))
    return res.status(400).json({ error: 'stock_maximo debe ser mayor que stock_minimo' });

  try {
    await pool.query(
      'UPDATE inventario SET stock_minimo=?, stock_maximo=? WHERE id_inventario=?',
      [Number(stock_minimo), Number(stock_maximo), id_inventario]
    );
    res.json({ mensaje: 'Inventario actualizado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar inventario' });
  }
};

/* ── importarInventarioExcel ──────────────────────────────────── */
const importarInventarioExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const headers  = rows[0].map(h => h.toString().toLowerCase().trim());
    const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== ''));

    const errores     = [];
    const operaciones = [];

    for (let index = 0; index < dataRows.length; index++) {
      const row = dataRows[index];
      const getVal = (nombre) => {
        const idx = headers.indexOf(nombre);
        return idx >= 0 ? row[idx] : undefined;
      };

      const nombreProducto = (getVal('nombre_producto') || '').toString().trim();

      // Saltar filas totalmente vacías
      const todosVacios = [getVal('nombre_producto'), getVal('id_sede'), getVal('stock_actual')]
        .every(v => !v || v.toString().trim() === '');
      if (todosVacios) continue;

      // Saltar filas de notas/comentarios de la plantilla
      if (!nombreProducto || nombreProducto.startsWith('-') || nombreProducto.toUpperCase().startsWith('NOTA')) continue;

      const id_sede        = parseInt(getVal('id_sede'));
      const stock_actual   = parseInt(getVal('stock_actual'));
      const stock_minimo   = parseInt(getVal('stock_minimo'));
      const stock_maximo   = parseInt(getVal('stock_maximo'));
      const modo           = (getVal('modo') || 'reemplazar').toString().toLowerCase().trim();

      if (!nombreProducto) {
        errores.push({ fila: index + 2, motivo: 'nombre_producto vacío' });
        continue;
      }
      if (!id_sede || ![1, 2, 3].includes(id_sede)) {
        errores.push({ fila: index + 2, motivo: `id_sede inválido: "${getVal('id_sede')}" — debe ser 1, 2 o 3` });
        continue;
      }
      if (!['reemplazar', 'sumar'].includes(modo)) {
        errores.push({ fila: index + 2, motivo: `modo inválido: "${modo}" — debe ser "reemplazar" o "sumar"` });
        continue;
      }
      if (isNaN(stock_actual) || stock_actual < 0) {
        errores.push({ fila: index + 2, motivo: `stock_actual inválido: "${getVal('stock_actual')}"` });
        continue;
      }
      if (modo === 'sumar' && stock_actual === 0) {
        errores.push({ fila: index + 2, motivo: 'En modo sumar, stock_actual debe ser mayor a 0' });
        continue;
      }
      if (isNaN(stock_minimo) || stock_minimo < 0) {
        errores.push({ fila: index + 2, motivo: 'stock_minimo inválido' });
        continue;
      }
      if (isNaN(stock_maximo) || stock_maximo <= stock_minimo) {
        errores.push({ fila: index + 2, motivo: 'stock_maximo debe ser mayor que stock_minimo' });
        continue;
      }

      const [productos] = await pool.query(
        'SELECT id_producto FROM producto WHERE LOWER(TRIM(nombre)) = LOWER(?)',
        [nombreProducto]
      );
      if (!productos.length) {
        errores.push({ fila: index + 2, motivo: `Producto no encontrado: "${nombreProducto}"` });
        continue;
      }

      const [inv] = await pool.query(
        'SELECT id_inventario FROM inventario WHERE id_producto = ? AND id_sede = ?',
        [productos[0].id_producto, id_sede]
      );
      if (!inv.length) {
        errores.push({ fila: index + 2, motivo: `No existe inventario para "${nombreProducto}" en sede ${id_sede}` });
        continue;
      }

      operaciones.push({
        id_inventario: inv[0].id_inventario,
        stock_actual, stock_minimo, stock_maximo, modo,
      });
    }

    if (errores.length > 0)
      return res.status(400).json({ error: 'No se importó ningún registro', errores });

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      let modo_reemplazar = 0;
      let modo_sumar      = 0;

      for (const op of operaciones) {
        if (op.modo === 'sumar') {
          await conn.query(
            'UPDATE inventario SET stock_actual = stock_actual + ?, stock_minimo = ?, stock_maximo = ? WHERE id_inventario = ?',
            [op.stock_actual, op.stock_minimo, op.stock_maximo, op.id_inventario]
          );
          modo_sumar++;
        } else {
          await conn.query(
            'UPDATE inventario SET stock_actual = ?, stock_minimo = ?, stock_maximo = ? WHERE id_inventario = ?',
            [op.stock_actual, op.stock_minimo, op.stock_maximo, op.id_inventario]
          );
          modo_reemplazar++;
        }
      }

      await conn.commit();
      conn.release();
      res.json({ importados: operaciones.length, modo_reemplazar, modo_sumar, errores: [] });
    } catch (txErr) {
      await conn.rollback();
      conn.release();
      res.status(500).json({ error: 'Error al importar', detalle: txErr.message });
    }
  } catch (err) {
    console.error('ERROR importarInventarioExcel:', err.message);
    res.status(500).json({ error: 'Error al leer el archivo', detalle: err.message });
  }
};

/* ── generarPlantilla ─────────────────────────────────────────── */
const generarPlantilla = async (req, res) => {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventario');

  sheet.columns = [
    { header: 'nombre_producto', key: 'nombre',       width: 30 },
    { header: 'id_sede',         key: 'id_sede',       width: 10 },
    { header: 'stock_actual',    key: 'stock_actual',  width: 15 },
    { header: 'stock_minimo',    key: 'stock_minimo',  width: 15 },
    { header: 'stock_maximo',    key: 'stock_maximo',  width: 15 },
    { header: 'modo',            key: 'modo',          width: 15 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2B05F' } };

  sheet.addRow({ nombre: 'Mojito de Maracuyá', id_sede: 1, stock_actual: 50, stock_minimo: 5,  stock_maximo: 200, modo: 'reemplazar' });
  sheet.addRow({ nombre: 'Águila',             id_sede: 2, stock_actual: 20, stock_minimo: 10, stock_maximo: 300, modo: 'sumar'      });
  sheet.addRow({ nombre: 'Alitas BBQ',         id_sede: 3, stock_actual: 30, stock_minimo: 5,  stock_maximo: 100, modo: 'reemplazar' });

  sheet.addRow([]);
  sheet.addRow(['NOTAS:']);
  sheet.addRow(['- id_sede: 1=Chapinero, 2=Usaquén, 3=Zona Rosa']);
  sheet.addRow(['- modo: "reemplazar" = establece el stock exacto | "sumar" = agrega al stock actual']);
  sheet.addRow(['- En modo sumar, stock_actual es la cantidad que ingresa al inventario']);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_Inventario_OlimpicBar.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
};

module.exports = {
  getProductos,
  crearProducto,
  actualizarProducto,
  toggleVisible,
  eliminarProducto,
  getInventarioAdmin,
  actualizarInventario,
  importarInventarioExcel,
  generarPlantilla,
};
