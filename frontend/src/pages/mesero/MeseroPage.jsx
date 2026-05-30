import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { meseroService } from '../../services/meseroService';
import { useWebSocket } from '../../hooks/useWebSocket';

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
      {toast.msg}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: '140px' }} />
      ))}
    </div>
  );
}

function MesaCard({ mesa, onClick }) {
  const libre    = mesa.estado === 'Libre';
  const pendiente = Number(mesa.items_pendientes) > 0;

  return (
    <button
      onClick={libre ? undefined : onClick}
      disabled={libre}
      className={libre ? 'card' : 'card-occupied'}
      style={{ width: '100%', textAlign: 'left', cursor: libre ? 'default' : 'pointer', fontFamily: 'inherit' }}
    >
      <span className="font-display" style={{ display: 'block', fontSize: '40px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '12px' }}>
        {mesa.numero}
      </span>
      <span className={`badge ${libre ? 'badge-muted' : 'badge-gold'}`}>
        {mesa.estado}
      </span>
      {!libre && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
          <span>{mesa.total_comensales ?? 0} comensal{mesa.total_comensales !== 1 ? 'es' : ''}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {pendiente && <span className="dot-pulse" />}
            {mesa.items_pendientes ?? 0} pendiente{mesa.items_pendientes !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </button>
  );
}

function EstadoBadge({ estado }) {
  const map = {
    Pendiente: 'badge-warning',
    Alistando: 'badge-blue',
    Entregado: 'badge-success',
    Cancelado: 'badge-error',
  };
  return (
    <span className={`badge ${map[estado] ?? 'badge-muted'}`} style={estado === 'Cancelado' ? { textDecoration: 'line-through' } : {}}>
      {estado}
    </span>
  );
}

function MesaDrawer({ mesa, onClose, onRefreshMesas, showToast }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(null);

  const cargarItems = useCallback(async () => {
    if (!mesa?.id_sesion) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await meseroService.getItems(mesa.id_sesion);
      setItems(data);
    } catch {
      showToast('Error al cargar ítems', 'error');
    } finally {
      setLoading(false);
    }
  }, [mesa?.id_sesion]);

  useEffect(() => { cargarItems(); }, [cargarItems]);

  const cambiar = async (id_detalle, nuevoEstado) => {
    setWorking(id_detalle);
    try {
      await meseroService.cambiarEstado(id_detalle, nuevoEstado);
      showToast(`Ítem → ${nuevoEstado}`);
      await cargarItems();
      onRefreshMesas();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al cambiar estado', 'error');
    } finally {
      setWorking(null);
    }
  };

  const cerrar = async () => {
    try {
      await meseroService.cerrarMesa(mesa.id_sesion);
      showToast('Mesa cerrada correctamente');
      onRefreshMesas();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al cerrar mesa', 'error');
    }
  };

  const comensales = items.reduce((acc, item) => {
    const key = item.id_cliente;
    if (!acc[key]) acc[key] = { nombre: item.nombre_visible, rol: item.rol_mesa, items: [] };
    acc[key].items.push(item);
    return acc;
  }, {});

  const hayPendientes = items.some(i => i.estado === 'Pendiente' || i.estado === 'Alistando');

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div>
            <p style={{ color: 'var(--gold)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '2px' }}>Detalle</p>
            <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>Mesa {mesa.numero}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px', display: 'flex', alignItems: 'center' }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {!mesa?.id_sesion ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '160px', gap: '12px', textAlign: 'center' }}>
              <span style={{ fontSize: '32px' }}>📱</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                Esta mesa no tiene una sesión activa.<br />El cliente aún no ha escaneado el QR.
              </p>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px' }}>
              <div style={{ width: '32px', height: '32px', border: '2px solid var(--gold-muted)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : Object.keys(comensales).length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', paddingTop: '40px' }}>No hay ítems en esta mesa.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {Object.values(comensales).map((comensal) => (
                <div key={comensal.nombre}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'var(--gold)', fontSize: '11px', fontWeight: 700 }}>{comensal.nombre?.[0]?.toUpperCase() ?? '?'}</span>
                    </div>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{comensal.nombre}</span>
                    <span className="badge badge-muted">{comensal.rol}</span>
                  </div>

                  <div style={{ paddingLeft: '36px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {comensal.items.map((item) => {
                      const busy = working === item.id_detalle;
                      const done = item.estado === 'Entregado' || item.estado === 'Cancelado';
                      return (
                        <div key={item.id_detalle} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.producto_nombre}</p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                              x{item.cantidad} · ${Number(item.precio_unitario).toLocaleString('es-CO')}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                            <EstadoBadge estado={item.estado} />
                            {!done && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                {item.estado === 'Pendiente' && (
                                  <button
                                    disabled={busy}
                                    onClick={() => cambiar(item.id_detalle, 'Alistando')}
                                    style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: 'rgba(201,168,76,0.15)', color: 'var(--gold)', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1, fontFamily: 'inherit' }}
                                  >
                                    {busy ? '…' : '→ Alistando'}
                                  </button>
                                )}
                                {item.estado === 'Alistando' && (
                                  <button
                                    disabled={busy}
                                    onClick={() => cambiar(item.id_detalle, 'Entregado')}
                                    style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: 'rgba(74,155,111,0.15)', color: 'var(--success)', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1, fontFamily: 'inherit' }}
                                  >
                                    {busy ? '…' : '✓ Entregado'}
                                  </button>
                                )}
                                {item.estado === 'Pendiente' && (
                                  <button
                                    disabled={busy}
                                    onClick={() => cambiar(item.id_detalle, 'Cancelado')}
                                    style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'rgba(184,84,80,0.08)', color: 'var(--error)', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.4 : 1, fontFamily: 'inherit' }}
                                  >
                                    {busy ? '…' : '✕ Cancelar'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={cerrar}
            disabled={hayPendientes || loading}
            className="btn-gold"
            style={{ width: '100%', padding: '12px' }}
          >
            {hayPendientes ? 'Ítems pendientes — no se puede cerrar' : 'Cerrar Mesa'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Algoritmo QuickSort: ordena mesas por prioridad ───────── */
function quickSortMesas(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[Math.floor(arr.length / 2)];
  const prioridad = (mesa) => {
    if (mesa.estado !== 'Ocupada') return -1;
    return mesa.items_pendientes * 10 + mesa.total_comensales;
  };
  const izquierda = arr.filter(m => prioridad(m) >  prioridad(pivot));
  const centro    = arr.filter(m => prioridad(m) === prioridad(pivot));
  const derecha   = arr.filter(m => prioridad(m) <  prioridad(pivot));
  return [...quickSortMesas(izquierda), ...centro, ...quickSortMesas(derecha)];
}

export default function MeseroPage() {
  const { usuario, logout } = useAuth();
  const navigate            = useNavigate();
  const { toast, show }     = useToast();

  const [mesas,        setMesas]        = useState([]);
  const [loadingMesas, setLoadingMesas] = useState(true);
  const [mesaActiva,   setMesaActiva]   = useState(null);

  const cargarMesas = useCallback(async () => {
    try {
      const { data } = await meseroService.getMesas();
      setMesas(data);
    } catch {
      show('Error al cargar mesas', 'error');
    } finally {
      setLoadingMesas(false);
    }
  }, []);

  useEffect(() => { cargarMesas(); }, [cargarMesas]);

  useEffect(() => {
    const interval = setInterval(() => cargarMesas(), 10000);
    return () => clearInterval(interval);
  }, [cargarMesas]);

  useWebSocket(useCallback((msg) => {
    if (msg.tipo === 'ACTUALIZAR_MESAS') cargarMesas();
  }, [cargarMesas]));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      <header className="panel-header">
        <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'var(--gold)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
              Panel Mesero · {usuario?.sede_nombre ?? '—'}
            </p>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 600, lineHeight: 1.3 }}>
              {usuario?.nombre || usuario?.username}
            </h1>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="btn-danger" style={{ fontSize: '12px', padding: '8px 14px' }}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: '1024px', width: '100%', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Mesas</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            {mesas.filter(m => m.estado === 'Ocupada').length} ocupadas · {mesas.filter(m => m.estado === 'Libre').length} libres
          </span>
        </div>

        {loadingMesas ? (
          <SkeletonGrid />
        ) : mesas.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '80px 0', fontSize: '13px' }}>
            No hay mesas registradas para esta sede.
          </p>
        ) : (() => {
          const mesasOrdenadas = quickSortMesas(mesas);
          return (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '12px' }}>
                Ordenadas por prioridad (QuickSort)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {mesasOrdenadas.map(mesa => (
                  <MesaCard key={mesa.id_mesa} mesa={mesa} onClick={() => setMesaActiva(mesa)} />
                ))}
              </div>
            </>
          );
        })()}
      </main>

      {mesaActiva && (
        <MesaDrawer
          mesa={mesaActiva}
          onClose={() => setMesaActiva(null)}
          onRefreshMesas={cargarMesas}
          showToast={show}
        />
      )}

      <Toast toast={toast} />
    </div>
  );
}
