import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { productosService } from '../../services/productosService';

/* ─── Toast ─────────────────────────────────────────────────── */
function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  return { toast, show };
}
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}
         style={{ left: '50%', right: 'auto', transform: 'translateX(-50%)' }}>
      {toast.msg}
    </div>
  );
}

/* ─── Label style helper ─────────────────────────────────────── */
const labelStyle = {
  display: 'block', color: 'var(--text-muted)', fontSize: 11,
  fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em',
};

/* ─── Badge de stock ─────────────────────────────────────────── */
function StockBadge({ estado }) {
  const cls = { ok: 'badge-success', bajo: 'badge-warning', critico: 'badge-error' };
  const labels = { ok: 'OK', bajo: 'Bajo', critico: 'Crítico' };
  return (
    <span className={`badge ${cls[estado] ?? 'badge-muted'}`}>
      {labels[estado] ?? estado}
    </span>
  );
}

/* ─── Thumbnail ──────────────────────────────────────────────── */
function Thumbnail({ src, nombre }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 18 }}>📦</span>
      </div>
    );
  }
  return (
    <img src={src} alt={nombre} onError={() => setErr(true)}
      style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--bg-elevated)' }} />
  );
}

/* ─── Modal crear / editar producto ─────────────────────────── */
const FORM_INIT = { nombre: '', descripcion: '', precio_venta: '', costo: '', imagen_url: '', visible: true, id_categoria: '' };

function ProductoModal({ modal, categorias, onClose, onSaved, showToast }) {
  const [form, setForm]     = useState(modal.data ?? FORM_INIT);
  const [enviando, setEnv]  = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); if (k === 'imagen_url') setImgErr(false); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim())       return showToast('El nombre es requerido', 'error');
    if (!form.precio_venta || Number(form.precio_venta) <= 0)
      return showToast('El precio de venta debe ser mayor a 0', 'error');
    if (!form.id_categoria)        return showToast('Selecciona una categoría', 'error');
    setEnv(true);
    try {
      const payload = {
        ...form,
        precio_venta: Number(form.precio_venta),
        costo:        form.costo ? Number(form.costo) : null,
        id_categoria: Number(form.id_categoria),
      };
      let saved;
      if (modal.mode === 'crear') {
        const { data } = await productosService.crear(payload);
        saved = data;
        showToast('Producto creado correctamente');
      } else {
        const { data } = await productosService.actualizar(form.id_producto, payload);
        saved = data;
        showToast('Producto actualizado');
      }
      onSaved(saved, modal.mode);
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al guardar', 'error');
    } finally { setEnv(false); }
  };

  const hasPreview = form.imagen_url && !imgErr;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 className="font-display" style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0 }}>
            {modal.mode === 'crear' ? 'Nuevo producto' : 'Editar producto'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasPreview && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img src={form.imagen_url} alt="preview" onError={() => setImgErr(true)}
                style={{ height: 112, width: '100%', maxWidth: 280, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)' }} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Nombre *</label>
            <input required className="input-base" value={form.nombre}
              onChange={e => set('nombre', e.target.value)} placeholder="Ej: Mojito de Maracuyá"
              style={{ width: '100%' }} />
          </div>

          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea className="input-base" value={form.descripcion ?? ''}
              onChange={e => set('descripcion', e.target.value)}
              placeholder="Descripción breve…" rows={2}
              style={{ width: '100%', resize: 'none' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Precio venta * ($)</label>
              <input required type="number" min="0" step="0.01" className="input-base"
                value={form.precio_venta} onChange={e => set('precio_venta', e.target.value)}
                placeholder="0" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Costo ($)</label>
              <input type="number" min="0" step="0.01" className="input-base"
                value={form.costo ?? ''} onChange={e => set('costo', e.target.value)}
                placeholder="0" style={{ width: '100%' }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>URL imagen</label>
            <input className="input-base" value={form.imagen_url ?? ''}
              onChange={e => set('imagen_url', e.target.value)}
              placeholder="https://…" style={{ width: '100%' }} />
          </div>

          <div>
            <label style={labelStyle}>Categoría *</label>
            <select required className="select-base" value={form.id_categoria}
              onChange={e => set('id_categoria', e.target.value)} style={{ width: '100%' }}>
              <option value="">Seleccionar categoría…</option>
              {categorias.map(c => (
                <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-elevated)', borderRadius: 10, padding: '12px 16px' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, margin: 0 }}>Visible en el menú</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>Los clientes podrán ver y ordenar este producto</p>
            </div>
            <button type="button" onClick={() => set('visible', !form.visible)}
              style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: form.visible ? 'var(--gold)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: 2, width: 20, height: 20, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'transform 0.2s', transform: form.visible ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
            <button type="button" onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
            <button type="submit" disabled={enviando} className="btn-gold" style={{ flex: 1 }}>
              {enviando ? 'Guardando…' : modal.mode === 'crear' ? 'Crear producto' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Modal confirmar eliminación ────────────────────────────── */
function ConfirmEliminar({ producto, onConfirm, onClose, loading }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <h3 className="font-display" style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
          Eliminar producto
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 20px' }}>
          ¿Eliminar <strong style={{ color: 'var(--text-primary)' }}>{producto.nombre}</strong>?{' '}
          Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="btn-danger" style={{ flex: 1 }}>
            {loading ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
export default function ProductosPage() {
  const { toast, show } = useToast();
  const [tab, setTab]   = useState('productos');

  /* ─ Productos ─ */
  const [productos,   setProductos]   = useState([]);
  const [categorias,  setCategorias]  = useState([]);
  const [loadingP,    setLoadingP]    = useState(true);
  const [searchP,     setSearchP]     = useState('');
  const [catFiltro,   setCatFiltro]   = useState('');
  const [modal,       setModal]       = useState(null);
  const [confirmElim, setConfirmElim] = useState(null);
  const [eliminando,  setEliminando]  = useState(false);

  /* ─ Inventario ─ */
  const [inventario,   setInventario]   = useState([]);
  const [loadingI,     setLoadingI]     = useState(false);
  const [sedeI,        setSedeI]        = useState('');
  const [searchI,      setSearchI]      = useState('');
  const [editInv,      setEditInv]      = useState({});
  const [savingInv,    setSavingInv]    = useState(null);
  const [archivoExcel, setArchivoExcel] = useState(null);
  const [importando,   setImportando]   = useState(false);
  const [importResult, setImportResult] = useState(null);

  /* ─ Carga inicial ─ */
  useEffect(() => {
    Promise.all([productosService.getAll(), productosService.getCategorias()])
      .then(([{ data: p }, { data: c }]) => { setProductos(p); setCategorias(c); })
      .catch(() => show('Error al cargar productos', 'error'))
      .finally(() => setLoadingP(false));
  }, []);

  const cargarInventario = useCallback(async () => {
    setLoadingI(true);
    try {
      const { data } = await productosService.getInventario();
      setInventario(data);
    } catch { show('Error al cargar inventario', 'error'); }
    finally { setLoadingI(false); }
  }, []);

  useEffect(() => { if (tab === 'inventario') cargarInventario(); }, [tab, cargarInventario]);

  /* ─ Filtros ─ */
  const productosFiltrados = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(searchP.toLowerCase());
    const matchCat    = !catFiltro || p.id_categoria === Number(catFiltro);
    return matchSearch && matchCat;
  });

  const invFiltrado = inventario.filter(i => {
    const matchSede   = !sedeI   || i.id_sede === Number(sedeI);
    const matchSearch = !searchI || i.nombre.toLowerCase().includes(searchI.toLowerCase());
    return matchSede && matchSearch;
  });

  /* ─ Handlers productos ─ */
  const handleSaved = (saved, mode) => {
    if (mode === 'crear') {
      setProductos(prev => [...prev, saved]);
    } else {
      setProductos(prev => prev.map(p => p.id_producto === saved.id_producto ? saved : p));
    }
  };

  const handleToggleVisible = async (producto) => {
    try {
      const { data } = await productosService.toggleVisible(producto.id_producto);
      setProductos(prev => prev.map(p =>
        p.id_producto === producto.id_producto ? { ...p, visible: data.visible } : p
      ));
    } catch { show('Error al cambiar visibilidad', 'error'); }
  };

  const handleEliminar = async () => {
    setEliminando(true);
    try {
      await productosService.eliminar(confirmElim.id_producto);
      setProductos(prev => prev.filter(p => p.id_producto !== confirmElim.id_producto));
      show('Producto eliminado');
      setConfirmElim(null);
    } catch (err) {
      show(err.response?.data?.error || 'Error al eliminar', 'error');
    } finally { setEliminando(false); }
  };

  /* ─ Handlers inventario ─ */
  const startEdit = (inv) => {
    setEditInv(prev => ({
      ...prev,
      [inv.id_inventario]: { stock_minimo: inv.stock_minimo, stock_maximo: inv.stock_maximo },
    }));
  };

  const handleSaveInv = async (id_inventario) => {
    const edit = editInv[id_inventario];
    if (!edit) return;
    setSavingInv(id_inventario);
    try {
      await productosService.actualizarInventario(id_inventario, {
        stock_minimo: Number(edit.stock_minimo),
        stock_maximo: Number(edit.stock_maximo),
      });
      setInventario(prev => prev.map(i =>
        i.id_inventario === id_inventario
          ? { ...i, stock_minimo: Number(edit.stock_minimo), stock_maximo: Number(edit.stock_maximo) }
          : i
      ));
      setEditInv(prev => { const n = { ...prev }; delete n[id_inventario]; return n; });
      show('Inventario actualizado');
    } catch (err) {
      show(err.response?.data?.error || 'Error al guardar', 'error');
    } finally { setSavingInv(null); }
  };

  const handleImportar = async () => {
    if (!archivoExcel) return;
    setImportando(true);
    setImportResult(null);
    try {
      const { data } = await productosService.importarExcel(archivoExcel);
      setImportResult(data);
      if (!data.errores?.length) {
        await cargarInventario();
        show(`✓ ${data.importados} productos actualizados — ${data.modo_reemplazar} reemplazados, ${data.modo_sumar} sumados`);
      }
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.errores) {
        setImportResult(errData);
      } else {
        show(errData?.error || 'Error al importar', 'error');
      }
    } finally { setImportando(false); }
  };

  const handleDescargarPlantilla = async () => {
    try {
      const { data } = await productosService.descargarPlantilla();
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Inventario_OlimpicBar.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { show('Error al descargar plantilla', 'error'); }
  };

  /* ─ Margen ─ */
  const margen = (p) => {
    if (!p.costo || !p.precio_venta || p.precio_venta <= 0) return null;
    return ((Number(p.precio_venta) - Number(p.costo)) / Number(p.precio_venta) * 100);
  };
  const margenColor = (m) => {
    if (m === null) return 'var(--text-muted)';
    if (m > 50) return 'var(--success, #22c55e)';
    if (m > 30) return 'var(--gold)';
    return 'var(--error, #ef4444)';
  };

  /* ════════════════════════════════════════════════════════════ */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="panel-header">
        <div style={{ maxWidth: 1152, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, margin: 0 }}>Administración</p>
            <h1 className="font-display" style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: 0 }}>Gestión de Productos</h1>
          </div>
          <Link to="/dashboard" className="btn-ghost" style={{ fontSize: 13 }}>← Volver</Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="tab-bar">
        <div style={{ maxWidth: 1152, margin: '0 auto', display: 'flex', width: '100%' }}>
          {[
            { id: 'productos',  label: `Productos (${productos.length})` },
            { id: 'inventario', label: 'Inventario' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`tab-item${tab === t.id ? ' active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: 1152, width: '100%', margin: '0 auto', padding: '1.5rem' }}>

        {/* ══════════ TAB PRODUCTOS ══════════ */}
        {tab === 'productos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Controles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                <input className="input-base" value={searchP} onChange={e => setSearchP(e.target.value)}
                  placeholder="Buscar por nombre…" style={{ flex: 1, minWidth: 180, maxWidth: 280 }} />
                <select className="select-base" value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
                  style={{ minWidth: 160, maxWidth: 200 }}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => (
                    <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <button className="btn-gold"
                onClick={() => setModal({ mode: 'crear', data: { ...FORM_INIT } })}>
                + Nuevo producto
              </button>
            </div>

            {/* Tabla */}
            {loadingP ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
              </div>
            ) : productosFiltrados.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '64px 0' }}>
                {productos.length === 0 ? 'No hay productos registrados.' : 'Sin resultados para la búsqueda.'}
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-base" style={{ background: 'var(--bg-surface)' }}>
                  <thead>
                    <tr>
                      {['', 'Nombre', 'Categoría', 'Precio', 'Costo', 'Margen', 'Visible', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i >= 6 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {productosFiltrados.map(p => {
                      const m = margen(p);
                      return (
                        <tr key={p.id_producto}>
                          <td style={{ paddingRight: 4 }}>
                            <Thumbnail src={p.imagen_url} nombre={p.nombre} />
                          </td>
                          <td>
                            <p style={{ color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>{p.nombre}</p>
                            {p.descripcion && (
                              <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                {p.descripcion}
                              </p>
                            )}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{p.categoria_nombre}</td>
                          <td style={{ color: 'var(--gold)', fontWeight: 600 }}>
                            ${Number(p.precio_venta).toLocaleString('es-CO')}
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {p.costo ? `$${Number(p.costo).toLocaleString('es-CO')}` : '—'}
                          </td>
                          <td style={{ color: margenColor(m), fontWeight: 600, fontSize: 12 }}>
                            {m !== null ? `${m.toFixed(1)}%` : '—'}
                          </td>
                          <td>
                            <button onClick={() => handleToggleVisible(p)}
                              style={{ position: 'relative', width: 40, height: 20, borderRadius: 10, background: p.visible ? 'var(--gold)' : 'var(--border)', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}>
                              <span style={{ position: 'absolute', top: 2, left: 2, width: 16, height: 16, background: '#fff', borderRadius: '50%', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: 'transform 0.2s', transform: p.visible ? 'translateX(20px)' : 'translateX(0)' }} />
                            </button>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                              <button className="btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                                onClick={() => setModal({ mode: 'editar', data: { ...p } })}>
                                Editar
                              </button>
                              <button className="btn-danger" style={{ fontSize: 12, padding: '4px 10px' }}
                                onClick={() => setConfirmElim(p)}>
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════ TAB INVENTARIO ══════════ */}
        {tab === 'inventario' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Filtros */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <select className="select-base" value={sedeI} onChange={e => setSedeI(e.target.value)}
                style={{ minWidth: 180, maxWidth: 220 }}>
                <option value="">Todas las sedes</option>
                <option value="1">Chapinero</option>
                <option value="2">Usaquén</option>
                <option value="3">Zona Rosa</option>
              </select>
              <input className="input-base" value={searchI} onChange={e => setSearchI(e.target.value)}
                placeholder="Buscar producto…" style={{ flex: 1, minWidth: 180, maxWidth: 280 }} />
            </div>

            {/* Tabla inventario */}
            {loadingI ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table-base" style={{ background: 'var(--bg-surface)' }}>
                  <thead>
                    <tr>
                      {['Producto', 'Categoría', 'Sede', 'Stock actual', 'Stock mín.', 'Stock máx.', 'Estado', ''].map((h, i) => (
                        <th key={i} style={{ textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invFiltrado.map(inv => {
                      const editing = editInv[inv.id_inventario];
                      const busy    = savingInv === inv.id_inventario;
                      const stockColor = inv.estado_stock === 'critico' ? 'var(--error, #ef4444)'
                        : inv.estado_stock === 'bajo' ? 'var(--gold)' : 'var(--text-primary)';
                      return (
                        <tr key={inv.id_inventario}>
                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{inv.nombre}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{inv.categoria}</td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{inv.sede_nombre}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: stockColor }}>{inv.stock_actual}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {editing ? (
                              <input type="number" min="0" className="input-base"
                                value={editing.stock_minimo}
                                onChange={e => setEditInv(prev => ({ ...prev, [inv.id_inventario]: { ...prev[inv.id_inventario], stock_minimo: e.target.value } }))}
                                style={{ width: 64, textAlign: 'center', padding: '4px 8px' }} />
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>{inv.stock_minimo}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {editing ? (
                              <input type="number" min="0" className="input-base"
                                value={editing.stock_maximo}
                                onChange={e => setEditInv(prev => ({ ...prev, [inv.id_inventario]: { ...prev[inv.id_inventario], stock_maximo: e.target.value } }))}
                                style={{ width: 64, textAlign: 'center', padding: '4px 8px' }} />
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>{inv.stock_maximo}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <StockBadge estado={inv.estado_stock} />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {editing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                <button className="btn-outline" onClick={() => handleSaveInv(inv.id_inventario)}
                                  disabled={busy} style={{ fontSize: 11, padding: '3px 10px' }}>
                                  {busy ? '…' : 'Guardar'}
                                </button>
                                <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                                  onClick={() => setEditInv(prev => { const n = { ...prev }; delete n[inv.id_inventario]; return n; })}>
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                                onClick={() => startEdit(inv)}>
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {invFiltrado.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: '48px 0' }}>
                          {inventario.length === 0 ? 'No hay registros de inventario.' : 'Sin resultados.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Importación masiva ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--gold)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, margin: '0 0 2px' }}>Carga masiva</p>
                <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16, margin: 0 }}>Importación masiva de inventario</h3>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
                  Descarga la plantilla, completa los datos y súbela para actualizar el inventario de todas las sedes.
                  La importación es <strong style={{ color: 'var(--text-primary)' }}>todo-o-nada</strong>: si alguna fila tiene error no se importa ninguna.
                </p>

                {/* Paso 1 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                  <button className="btn-outline" onClick={handleDescargarPlantilla} style={{ fontSize: 13 }}>
                    Descargar plantilla Excel
                  </button>
                  <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: 0 }}>
                    Columna <strong style={{ color: 'var(--text-primary)' }}>"modo"</strong>:&nbsp;
                    <span style={{ color: 'var(--gold)', fontWeight: 600 }}>reemplazar</span> (conteo físico) o&nbsp;
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>sumar</span> (entrada de proveedor)
                  </p>
                </div>

                {/* Paso 2 — Seleccionar archivo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: archivoExcel ? 'var(--gold)' : 'var(--bg-elevated)',
                    border: `1px solid ${archivoExcel ? 'var(--gold)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: '700',
                    color: archivoExcel ? '#0A0A0A' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}>2</div>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 16px',
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${archivoExcel ? 'var(--gold-muted)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: archivoExcel ? 'var(--gold)' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                    flex: 1,
                  }}>
                    <span style={{ fontSize: '16px' }}>📎</span>
                    <span>{archivoExcel ? archivoExcel.name : 'Seleccionar archivo Excel (.xlsx)'}</span>
                    <input
                      type="file"
                      accept=".xlsx"
                      style={{ display: 'none' }}
                      onChange={e => { setArchivoExcel(e.target.files[0] || null); setImportResult(null); }}
                    />
                  </label>
                  {archivoExcel && (
                    <button onClick={() => { setArchivoExcel(null); setImportResult(null); }}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                      ×
                    </button>
                  )}
                </div>

                {/* Paso 3 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</span>
                  <button className="btn-gold" onClick={handleImportar} disabled={!archivoExcel || importando}>
                    {importando ? 'Importando…' : 'Importar'}
                  </button>
                </div>

                {/* Resultado */}
                {importResult && (
                  <div style={{ borderRadius: 10, padding: 16, background: importResult.errores?.length ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${importResult.errores?.length ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}` }}>
                    {importResult.errores?.length ? (
                      <>
                        <p style={{ color: 'var(--error, #ef4444)', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>
                          {importResult.errores.length} error{importResult.errores.length !== 1 ? 'es' : ''} — no se importó ningún registro
                        </p>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {importResult.errores.map((e, i) => (
                            <li key={i} style={{ color: 'var(--error, #ef4444)', fontSize: 11, fontFamily: 'monospace', opacity: 0.85 }}>
                              Fila {e.fila}: {e.motivo}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <p style={{ color: 'var(--success, #22c55e)', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                          ✓ {importResult.importados} producto{importResult.importados !== 1 ? 's' : ''} actualizados correctamente
                        </p>
                        <p style={{ color: 'var(--success, #22c55e)', fontSize: 12, opacity: 0.75, margin: 0 }}>
                          {importResult.modo_reemplazar} reemplazados · {importResult.modo_sumar} sumados
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {modal && (
        <ProductoModal modal={modal} categorias={categorias}
          onClose={() => setModal(null)} onSaved={handleSaved} showToast={show} />
      )}

      {confirmElim && (
        <ConfirmEliminar producto={confirmElim} onConfirm={handleEliminar}
          onClose={() => setConfirmElim(null)} loading={eliminando} />
      )}

      <Toast toast={toast} />
    </div>
  );
}
