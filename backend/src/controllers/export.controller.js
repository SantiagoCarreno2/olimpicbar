const ExcelJS     = require('exceljs');
const PDFDocument = require('pdfkit');
const pool        = require('../config/db');

/* ── Constantes de estilo ────────────────────────────────────── */
const GOLD        = 'FFE2B05F';
const GRAY_STRIPE = 'FFF5F5F5';

/* ── Helpers de estilo ───────────────────────────────────────── */
function applyBorder(row, includeEmpty = false) {
  row.eachCell({ includeEmpty }, cell => {
    cell.border = {
      top:    { style: 'thin' },
      left:   { style: 'thin' },
      bottom: { style: 'thin' },
      right:  { style: 'thin' },
    };
  });
}

function applyGoldHeader(row) {
  row.font      = { bold: true, color: { argb: 'FF000000' } };
  row.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBorder(row, true);
}

/* ── fetchReporteData: ejecuta los 5 queries en paralelo ─────── */
async function fetchReporteData(fecha_inicio, fecha_fin, id_sede) {
  /* 1. Resumen por sede */
  let resumenQ = `
    SELECT
      s.id_sede, s.nombre AS sede_nombre,
      COUNT(DISTINCT sm.id_sesion)                                                                    AS total_mesas_atendidas,
      COUNT(DISTINCT CASE WHEN dp.estado != 'Cancelado' THEN dp.id_detalle END)                      AS total_items,
      COALESCE(SUM(CASE WHEN dp.estado = 'Entregado' THEN dp.precio_unitario * dp.cantidad END), 0)  AS total_ingresos,
      COALESCE(AVG(sub.total_sesion), 0)                                                             AS ticket_promedio,
      COUNT(DISTINCT CASE WHEN dp.estado = 'Cancelado' THEN dp.id_detalle END)                       AS cancelaciones
    FROM sede s
    JOIN mesa m            ON m.id_sede  = s.id_sede
    JOIN sesion_mesa sm    ON sm.id_mesa = m.id_mesa AND DATE(sm.fecha_inicio) BETWEEN ? AND ?
    JOIN pedido p          ON p.id_sesion = sm.id_sesion
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
  const resumenP = [fecha_inicio, fecha_fin];
  if (id_sede) { resumenQ += ' AND s.id_sede = ?'; resumenP.push(id_sede); }
  resumenQ += ' GROUP BY s.id_sede, s.nombre ORDER BY s.id_sede';

  /* 2. Top 10 productos con categoría */
  let topQ = `
    SELECT pr.nombre, cat.nombre AS categoria,
           SUM(dp.cantidad) AS total_vendido,
           SUM(dp.precio_unitario * dp.cantidad) AS ingresos
    FROM detalle_pedido dp
    JOIN producto pr    ON pr.id_producto  = dp.id_producto
    JOIN categoria cat  ON cat.id_categoria = pr.id_categoria
    JOIN pedido p       ON p.id_pedido     = dp.id_pedido
    JOIN sesion_mesa sm ON sm.id_sesion    = p.id_sesion
    JOIN mesa m         ON m.id_mesa       = sm.id_mesa
    WHERE dp.estado = 'Entregado' AND DATE(sm.fecha_inicio) BETWEEN ? AND ?
  `;
  const topP = [fecha_inicio, fecha_fin];
  if (id_sede) { topQ += ' AND m.id_sede = ?'; topP.push(id_sede); }
  topQ += ' GROUP BY pr.id_producto, pr.nombre, cat.nombre ORDER BY total_vendido DESC LIMIT 10';

  /* 3. Cobros por método de pago */
  let cobrosQ = `
    SELECT
      pa.metodo,
      COUNT(*) AS cantidad,
      SUM(pa.monto) AS total,
      COUNT(CASE WHEN pa.modalidad = 'Individual' THEN 1 END) AS individuales,
      COUNT(CASE WHEN pa.modalidad = 'Grupal'     THEN 1 END) AS grupales
    FROM pago pa
    JOIN cuenta cu      ON cu.id_cuenta  = pa.id_cuenta
    JOIN sesion_mesa sm ON sm.id_sesion  = cu.id_sesion
    JOIN mesa m         ON m.id_mesa     = sm.id_mesa
    WHERE DATE(sm.fecha_inicio) BETWEEN ? AND ?
  `;
  const cobrosP = [fecha_inicio, fecha_fin];
  if (id_sede) { cobrosQ += ' AND m.id_sede = ?'; cobrosP.push(id_sede); }
  cobrosQ += ' GROUP BY pa.metodo';

  /* 4. Detalle por mesa */
  let detalleQ = `
    SELECT
      s.nombre    AS sede_nombre,
      m.numero    AS mesa_numero,
      sm.fecha_inicio, sm.fecha_fin,
      c.nombre_visible, c.rol_mesa,
      pr.nombre   AS producto,
      cat.nombre  AS categoria,
      dp.cantidad, dp.precio_unitario,
      (dp.cantidad * dp.precio_unitario) AS subtotal,
      dp.estado   AS estado_item,
      p.notas
    FROM sesion_mesa sm
    JOIN mesa m         ON m.id_mesa      = sm.id_mesa
    JOIN sede s         ON s.id_sede      = m.id_sede
    JOIN pedido p       ON p.id_sesion    = sm.id_sesion
    JOIN cliente c      ON c.id_cliente   = p.id_cliente
    JOIN detalle_pedido dp ON dp.id_pedido = p.id_pedido
    JOIN producto pr    ON pr.id_producto  = dp.id_producto
    JOIN categoria cat  ON cat.id_categoria = pr.id_categoria
    WHERE DATE(sm.fecha_inicio) BETWEEN ? AND ?
      AND dp.estado != 'Cancelado'
  `;
  const detalleP = [fecha_inicio, fecha_fin];
  if (id_sede) { detalleQ += ' AND m.id_sede = ?'; detalleP.push(id_sede); }
  detalleQ += ' ORDER BY s.id_sede, m.numero, sm.fecha_inicio, c.nombre_visible';

  /* 5. Ventas por categoría */
  let catQ = `
    SELECT cat.nombre AS categoria,
           COUNT(DISTINCT dp.id_detalle) AS items_vendidos,
           SUM(dp.cantidad) AS unidades,
           SUM(dp.precio_unitario * dp.cantidad) AS ingresos
    FROM detalle_pedido dp
    JOIN producto pr    ON pr.id_producto  = dp.id_producto
    JOIN categoria cat  ON cat.id_categoria = pr.id_categoria
    JOIN pedido p       ON p.id_pedido     = dp.id_pedido
    JOIN sesion_mesa sm ON sm.id_sesion    = p.id_sesion
    JOIN mesa m         ON m.id_mesa       = sm.id_mesa
    WHERE dp.estado = 'Entregado' AND DATE(sm.fecha_inicio) BETWEEN ? AND ?
  `;
  const catP = [fecha_inicio, fecha_fin];
  if (id_sede) { catQ += ' AND m.id_sede = ?'; catP.push(id_sede); }
  catQ += ' GROUP BY cat.id_categoria, cat.nombre ORDER BY ingresos DESC';

  const [[resumen], [top_productos], [cobros], [detalle], [cat_ventas]] = await Promise.all([
    pool.query(resumenQ,  resumenP),
    pool.query(topQ,      topP),
    pool.query(cobrosQ,   cobrosP),
    pool.query(detalleQ,  detalleP),
    pool.query(catQ,      catP),
  ]);

  return { resumen, top_productos, cobros, detalle, cat_ventas };
}

/* ── Exportar Excel ──────────────────────────────────────────── */
const exportarExcel = async (req, res) => {
  const { fecha_inicio, fecha_fin, id_sede } = req.query;
  if (!fecha_inicio || !fecha_fin)
    return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridos' });

  try {
    const { resumen, top_productos, cobros, detalle, cat_ventas } =
      await fetchReporteData(fecha_inicio, fecha_fin, id_sede);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OlimpicBar';
    workbook.created = new Date();

    /* ═══════════════════════════════════════════════════════════
       HOJA 1 — Resumen Ejecutivo
    ════════════════════════════════════════════════════════════ */
    const sh1 = workbook.addWorksheet('Resumen Ejecutivo');

    sh1.mergeCells('A1:F1');
    sh1.getCell('A1').value     = 'OlimpicBar - Reporte de Ventas';
    sh1.getCell('A1').font      = { bold: true, size: 16 };
    sh1.getCell('A1').alignment = { horizontal: 'center' };

    sh1.mergeCells('A2:F2');
    sh1.getCell('A2').value     = `Período: ${fecha_inicio} al ${fecha_fin}`;
    sh1.getCell('A2').alignment = { horizontal: 'center' };

    sh1.addRow([]);

    /* — Tabla ventas por sede — */
    applyGoldHeader(sh1.addRow(['Sede', 'Mesas Atendidas', 'Ítems Despachados', 'Total Ingresos', 'Ticket Promedio', 'Cancelaciones']));

    resumen.forEach(s => {
      const row = sh1.addRow([
        s.sede_nombre,
        parseInt(s.total_mesas_atendidas || 0),
        parseInt(s.total_items           || 0),
        parseFloat(s.total_ingresos      || 0),
        parseFloat(s.ticket_promedio     || 0),
        parseInt(s.cancelaciones         || 0),
      ]);
      row.getCell(4).numFmt = '$#,##0.00';
      row.getCell(5).numFmt = '$#,##0.00';
      applyBorder(row);
    });

    const totRow = sh1.addRow([
      'TOTAL',
      resumen.reduce((a, s) => a + parseInt(s.total_mesas_atendidas || 0), 0),
      resumen.reduce((a, s) => a + parseInt(s.total_items           || 0), 0),
      resumen.reduce((a, s) => a + parseFloat(s.total_ingresos      || 0), 0),
      '',
      resumen.reduce((a, s) => a + parseInt(s.cancelaciones         || 0), 0),
    ]);
    totRow.font = { bold: true };
    totRow.getCell(4).numFmt = '$#,##0.00';
    applyBorder(totRow);

    /* — Tabla métodos de pago — */
    sh1.addRow([]);
    sh1.addRow(['Métodos de Pago']).getCell(1).font = { bold: true, size: 12 };

    applyGoldHeader(sh1.addRow(['Método', 'Transacciones', 'Monto Total', 'Individuales', 'Grupales', '']));

    cobros.forEach(c => {
      const row = sh1.addRow([
        c.metodo,
        parseInt(c.cantidad     || 0),
        parseFloat(c.total      || 0),
        parseInt(c.individuales || 0),
        parseInt(c.grupales     || 0),
        '',
      ]);
      row.getCell(3).numFmt = '$#,##0.00';
      applyBorder(row);
    });

    if (cobros.length > 0) {
      const totCobros = sh1.addRow([
        'TOTAL',
        cobros.reduce((a, c) => a + parseInt(c.cantidad     || 0), 0),
        cobros.reduce((a, c) => a + parseFloat(c.total      || 0), 0),
        cobros.reduce((a, c) => a + parseInt(c.individuales || 0), 0),
        cobros.reduce((a, c) => a + parseInt(c.grupales     || 0), 0),
        '',
      ]);
      totCobros.font = { bold: true };
      totCobros.getCell(3).numFmt = '$#,##0.00';
      applyBorder(totCobros);

      const masUsado = cobros.reduce((a, b) =>
        parseInt(a.cantidad) >= parseInt(b.cantidad) ? a : b
      );
      sh1.addRow([]);
      const noteRow = sh1.addRow([
        `Método más usado: ${masUsado.metodo} (${masUsado.cantidad} transacciones)`,
      ]);
      noteRow.getCell(1).font = { italic: true, color: { argb: 'FF666666' } };
    }

    sh1.columns = [
      { width: 20 }, { width: 18 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 16 },
    ];

    /* ═══════════════════════════════════════════════════════════
       HOJA 2 — Detalle por Mesa
    ════════════════════════════════════════════════════════════ */
    const sh2 = workbook.addWorksheet('Detalle por Mesa');

    sh2.views     = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
    sh2.autoFilter = { from: 'A1', to: 'L1' };

    applyGoldHeader(sh2.addRow([
      'Sede', 'Mesa', 'Fecha apertura', 'Hora cierre',
      'Comensal', 'Rol', 'Producto', 'Categoría',
      'Cant.', 'Precio Unit.', 'Subtotal', 'Estado',
    ]));

    let subtotalSum = 0;

    detalle.forEach((d, idx) => {
      const row = sh2.addRow([
        d.sede_nombre,
        d.mesa_numero,
        d.fecha_inicio ? new Date(d.fecha_inicio) : null,
        d.fecha_fin    ? new Date(d.fecha_fin)    : null,
        d.nombre_visible,
        d.rol_mesa,
        d.producto,
        d.categoria,
        parseInt(d.cantidad       || 0),
        parseFloat(d.precio_unitario || 0),
        parseFloat(d.subtotal     || 0),
        d.estado_item,
      ]);

      row.getCell(3).numFmt  = 'dd/mm/yyyy hh:mm';
      row.getCell(4).numFmt  = 'dd/mm/yyyy hh:mm';
      row.getCell(10).numFmt = '$#,##0.00';
      row.getCell(11).numFmt = '$#,##0.00';

      if (idx % 2 === 0) {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY_STRIPE } };
        });
      }

      applyBorder(row, true);
      subtotalSum += parseFloat(d.subtotal || 0);
    });

    /* Fila total */
    const detTotal = sh2.addRow([
      '', '', '', '', '', '', '', '', '', 'TOTAL', subtotalSum, '',
    ]);
    detTotal.font = { bold: true };
    detTotal.getCell(10).alignment = { horizontal: 'right' };
    detTotal.getCell(11).numFmt   = '$#,##0.00';
    applyBorder(detTotal, true);

    sh2.columns = [
      { width: 15 }, { width: 8  }, { width: 18 }, { width: 15 },
      { width: 20 }, { width: 12 }, { width: 25 }, { width: 15 },
      { width: 8  }, { width: 14 }, { width: 14 }, { width: 12 },
    ];

    /* ═══════════════════════════════════════════════════════════
       HOJA 3 — Top Productos
    ════════════════════════════════════════════════════════════ */
    const sh3 = workbook.addWorksheet('Top Productos');

    const totalIngresosPeriodo = resumen.reduce((a, s) => a + parseFloat(s.total_ingresos || 0), 0);

    sh3.addRow(['Top 10 Productos más vendidos']).getCell(1).font = { bold: true, size: 14 };
    sh3.addRow([]);

    applyGoldHeader(sh3.addRow([
      'Producto', 'Categoría', 'Unidades Vendidas', 'Ingresos', '% del Total',
    ]));

    top_productos.forEach(p => {
      const pct = totalIngresosPeriodo > 0
        ? parseFloat(p.ingresos || 0) / totalIngresosPeriodo
        : 0;
      const row = sh3.addRow([
        p.nombre,
        p.categoria,
        parseInt(p.total_vendido || 0),
        parseFloat(p.ingresos    || 0),
        pct,
      ]);
      row.getCell(4).numFmt = '$#,##0.00';
      row.getCell(5).numFmt = '0.00%';
      applyBorder(row);
    });

    /* — Mini tabla ventas por categoría — */
    sh3.addRow([]);
    sh3.addRow([]);
    sh3.addRow(['Ventas por Categoría']).getCell(1).font = { bold: true, size: 12 };
    sh3.addRow([]);

    applyGoldHeader(sh3.addRow([
      'Categoría', 'Ítems Vendidos', 'Unidades', 'Ingresos', '',
    ]));

    cat_ventas.forEach(cat => {
      const row = sh3.addRow([
        cat.categoria,
        parseInt(cat.items_vendidos || 0),
        parseInt(cat.unidades       || 0),
        parseFloat(cat.ingresos     || 0),
        '',
      ]);
      row.getCell(4).numFmt = '$#,##0.00';
      applyBorder(row);
    });

    sh3.columns = [
      { width: 25 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 10 },
    ];

    /* — Enviar respuesta — */
    const nombreArchivo = `OlimpicBar_Reporte_${fecha_inicio}_${fecha_fin}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('ERROR exportarExcel:', err.message, err.stack);
    if (!res.headersSent)
      res.status(500).json({ error: 'Error al exportar Excel', detalle: err.message });
  }
};

/* ── Exportar PDF ────────────────────────────────────────────── */
const exportarPDF = async (req, res) => {
  const { fecha_inicio, fecha_fin, id_sede } = req.query;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Fechas requeridas' });

  try {
    const { resumen, top_productos, cobros } = await fetchReporteData(fecha_inicio, fecha_fin, id_sede);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const nombreArchivo = `OlimpicBar_Reporte_${fecha_inicio}_${fecha_fin}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    doc.pipe(res);

    const GOLD  = '#E2B05F';
    const DARK  = '#1A1A1A';
    const GRAY  = '#666666';
    const WIDTH = 495;

    // ── HEADER ──────────────────────────────────────────────
    doc.rect(0, 0, 595, 80).fill(DARK);
    doc.fontSize(22).font('Helvetica-Bold').fillColor(GOLD)
       .text('OlimpicBar', 50, 20);
    doc.fontSize(11).font('Helvetica').fillColor('white')
       .text('Sistema de Gestión', 50, 46);
    doc.fontSize(11).fillColor(GOLD)
       .text('Reporte de Ventas', 350, 20, { width: 195, align: 'right' });
    doc.fontSize(9).fillColor('white')
       .text(`${fecha_inicio} al ${fecha_fin}`, 350, 40, { width: 195, align: 'right' });
    doc.fillColor('black');

    // ── LÍNEA DORADA ────────────────────────────────────────
    doc.y = 95;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(GOLD).lineWidth(2).stroke();
    doc.moveDown(0.8);

    // ── CARDS DE MÉTRICAS GLOBALES ───────────────────────────
    const totalVentas       = resumen.reduce((a, s) => a + parseFloat(s.total_ingresos      || 0), 0);
    const totalMesas        = resumen.reduce((a, s) => a + parseInt(s.total_mesas_atendidas  || 0), 0);
    const totalItems        = resumen.reduce((a, s) => a + parseInt(s.total_items            || 0), 0);
    const totalCancelaciones= resumen.reduce((a, s) => a + parseInt(s.cancelaciones          || 0), 0);
    const ticketProm        = totalMesas > 0 ? totalVentas / totalMesas : 0;

    const cards = [
      { label: 'Total Ventas',       value: `$${totalVentas.toLocaleString('es-CO')}`,                                    color: GOLD       },
      { label: 'Mesas Atendidas',    value: String(totalMesas),                                                            color: '#4CAF7D'  },
      { label: 'Ticket Promedio',    value: `$${ticketProm.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,        color: '#5B8DEF'  },
      { label: 'Ítems Despachados',  value: String(totalItems),                                                            color: '#9B59B6'  },
    ];

    const cardW   = 110;
    const cardH   = 55;
    const cardGap = 10;
    let cx = 50;
    const cy = doc.y;

    cards.forEach(card => {
      doc.rect(cx, cy, cardW, cardH).fillAndStroke('#F9F9F9', '#E0E0E0');
      doc.rect(cx, cy, cardW, 4).fill(card.color);
      doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(card.label, cx + 8, cy + 12, { width: cardW - 16 });
      doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text(card.value, cx + 8, cy + 26, { width: cardW - 16 });
      cx += cardW + cardGap;
    });

    doc.y = cy + cardH + 20;
    doc.fillColor('black');

    // ── TABLA POR SEDE ───────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Resumen por Sede', 50, doc.y);
    doc.moveDown(0.5);

    const colW    = [140, 75, 75, 105, 75, 75];
    const headers = ['Sede', 'Mesas', 'Ítems', 'Ingresos', 'T. Promedio', 'Cancelac.'];
    let rowY = doc.y;

    doc.rect(50, rowY, WIDTH, 20).fill(DARK);
    let hx = 50;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
    headers.forEach((h, i) => {
      doc.text(h, hx + 4, rowY + 5, { width: colW[i] - 8, align: i > 0 ? 'right' : 'left' });
      hx += colW[i];
    });
    rowY += 20;

    resumen.forEach((sede, idx) => {
      const bg = idx % 2 === 0 ? 'white' : '#F5F5F5';
      doc.rect(50, rowY, WIDTH, 18).fill(bg);
      const cols = [
        sede.sede_nombre,
        String(sede.total_mesas_atendidas || 0),
        String(sede.total_items           || 0),
        `$${parseFloat(sede.total_ingresos   || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
        `$${parseFloat(sede.ticket_promedio  || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
        String(sede.cancelaciones            || 0),
      ];
      let dx = 50;
      doc.fontSize(9).font('Helvetica').fillColor(DARK);
      cols.forEach((col, i) => {
        doc.text(col, dx + 4, rowY + 4, { width: colW[i] - 8, align: i > 0 ? 'right' : 'left' });
        dx += colW[i];
      });
      rowY += 18;
    });

    doc.rect(50, rowY, WIDTH, 20).fill(GOLD);
    const totals = [
      'TOTAL',
      String(totalMesas),
      String(totalItems),
      `$${totalVentas.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
      '',
      String(totalCancelaciones),
    ];
    let tx = 50;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK);
    totals.forEach((t, i) => {
      doc.text(t, tx + 4, rowY + 5, { width: colW[i] - 8, align: i > 0 ? 'right' : 'left' });
      tx += colW[i];
    });
    doc.y = rowY + 30;

    // ── MÉTODOS DE PAGO ──────────────────────────────────────
    if (cobros && cobros.length > 0) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Métodos de Pago', 50, doc.y);
      doc.moveDown(0.5);

      const metodoColW     = [150, 100, 120, 125];
      const metodoHeaders  = ['Método', 'Transacciones', 'Monto Total', 'Individuales / Grupales'];
      let mY = doc.y;

      doc.rect(50, mY, WIDTH, 20).fill(DARK);
      let mhx = 50;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
      metodoHeaders.forEach((h, i) => {
        doc.text(h, mhx + 4, mY + 5, { width: metodoColW[i] - 8 });
        mhx += metodoColW[i];
      });
      mY += 20;

      cobros.forEach((c, idx) => {
        const bg = idx % 2 === 0 ? 'white' : '#F5F5F5';
        doc.rect(50, mY, WIDTH, 18).fill(bg);
        const mcols = [
          c.metodo,
          String(c.cantidad),
          `$${parseFloat(c.total || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
          `${c.individuales} ind. / ${c.grupales} grup.`,
        ];
        let mdx = 50;
        doc.fontSize(9).font('Helvetica').fillColor(DARK);
        mcols.forEach((col, i) => {
          doc.text(col, mdx + 4, mY + 4, { width: metodoColW[i] - 8 });
          mdx += metodoColW[i];
        });
        mY += 18;
      });
      doc.y = mY + 20;
    }

    // ── TOP 10 PRODUCTOS ─────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor(DARK).text('Top 10 Productos', 50, doc.y);
    doc.moveDown(0.5);

    const topColW     = [200, 100, 100, 95];
    const topHeaders  = ['Producto', 'Categoría', 'Unidades', 'Ingresos'];
    let tY = doc.y;

    doc.rect(50, tY, WIDTH, 20).fill(DARK);
    let thx = 50;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('white');
    topHeaders.forEach((h, i) => {
      doc.text(h, thx + 4, tY + 5, { width: topColW[i] - 8, align: i > 1 ? 'right' : 'left' });
      thx += topColW[i];
    });
    tY += 20;

    top_productos.forEach((p, idx) => {
      const bg = idx % 2 === 0 ? 'white' : '#F5F5F5';
      doc.rect(50, tY, WIDTH, 18).fill(bg);
      const tcols = [
        `${idx + 1}. ${p.nombre}`,
        p.categoria || '-',
        String(p.total_vendido),
        `$${parseFloat(p.ingresos || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`,
      ];
      let tdx = 50;
      doc.fontSize(9).font('Helvetica').fillColor(DARK);
      tcols.forEach((col, i) => {
        doc.text(col, tdx + 4, tY + 4, { width: topColW[i] - 8, align: i > 1 ? 'right' : 'left' });
        tdx += topColW[i];
      });
      tY += 18;
    });
    doc.y = tY + 20;

    // ── FOOTER ───────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(GOLD).lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').fillColor(GRAY)
       .text(
         `Generado el ${new Date().toLocaleString('es-CO')} · OlimpicBar Sistema de Gestión · Confidencial`,
         50, doc.y, { align: 'center', width: WIDTH }
       );

    doc.end();
  } catch (err) {
    console.error('ERROR exportarPDF:', err.message, err.stack);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar PDF', detalle: err.message });
  }
};

/* ── Exportar cierre de jornada a Excel ──────────────────────── */
const exportarCierreExcel = async (req, res) => {
  const {
    total_ventas, total_mesas, total_items, total_cancelaciones,
    cobros_individuales, cobros_grupales, ticket_promedio, top_productos = [],
  } = req.body;

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'OlimpicBar';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Cierre de Jornada');

    sheet.mergeCells('A1:B1');
    sheet.getCell('A1').value     = 'OlimpicBar - Cierre de Jornada';
    sheet.getCell('A1').font      = { bold: true, size: 16 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:B2');
    sheet.getCell('A2').value     = `Fecha: ${new Date().toLocaleDateString('es-CO')}`;
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.addRow([]);

    const datos = [
      ['Total ventas del día', parseFloat(total_ventas        || 0)],
      ['Mesas atendidas',      parseInt(total_mesas           || 0)],
      ['Ítems despachados',    parseInt(total_items           || 0)],
      ['Cancelaciones',        parseInt(total_cancelaciones   || 0)],
      ['Cobros individuales',  parseInt(cobros_individuales   || 0)],
      ['Cobros grupales',      parseInt(cobros_grupales       || 0)],
      ['Ticket promedio',      parseFloat(ticket_promedio     || 0)],
    ];

    datos.forEach(([label, val]) => {
      const row = sheet.addRow([label, val]);
      row.getCell(1).font = { bold: true };
      if (label.includes('ventas') || label.includes('promedio'))
        row.getCell(2).numFmt = '$#,##0.00';
      applyBorder(row);
    });

    if (top_productos.length > 0) {
      sheet.addRow([]);
      sheet.addRow(['Top Productos']).getCell(1).font = { bold: true, size: 12 };
      applyGoldHeader(sheet.addRow(['Producto', 'Unidades', 'Ingresos']));
      top_productos.forEach(p => {
        const row = sheet.addRow([p.nombre, p.total_vendido, parseFloat(p.ingresos || 0)]);
        row.getCell(3).numFmt = '$#,##0.00';
        applyBorder(row);
      });
    }

    sheet.columns = [{ width: 25 }, { width: 18 }, { width: 18 }];

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="OlimpicBar_Cierre_${fecha}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('ERROR exportarCierreExcel:', err.message);
    res.status(500).json({ error: 'Error al exportar cierre', detalle: err.message });
  }
};

module.exports = { exportarExcel, exportarPDF, exportarCierreExcel };
