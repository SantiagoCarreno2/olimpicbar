import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cajeroService } from '../../services/cajeroService';
import api from '../../services/api';
import { useWebSocket } from '../../hooks/useWebSocket';

/* ─── Helpers ───────────────────────────────────────────────── */
function tiempoDesde(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 60000);
  if (diff < 60) return `hace ${diff} min`;
  const h = Math.floor(diff / 60);
  return `hace ${h}h ${diff % 60}m`;
}

const calcularTiempo = (fecha) => {
  const diff = Date.now() - new Date(fecha).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}min`;
};

function fmt(n) { return Number(n).toLocaleString('es-CO'); }

/* ─── Algoritmo Voraz: desglose de cambio en billetes/monedas ── */
function calcularCambio(montoPagado, totalCobro) {
  const denominaciones = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100];
  let cambio = montoPagado - totalCobro;
  const resultado = [];
  for (const denom of denominaciones) {
    const cantidad = Math.floor(cambio / denom);
    if (cantidad > 0) {
      resultado.push({ denominacion: denom, cantidad });
      cambio -= cantidad * denom;
      cambio = Math.round(cambio);
    }
  }
  return { cambio: montoPagado - totalCobro, desglose: resultado };
}

/* ─── Algoritmo Mochila 0/1: sugerencia óptima de re-stock ──── */
function sugerirRestock(productos, presupuesto) {
  const items = productos
    .filter(p => p.stock_actual <= p.stock_minimo * 2)
    .map(p => {
      const unidadesNecesarias = Math.max(1, p.stock_minimo * 2 - p.stock_actual);
      const costo = unidadesNecesarias * (p.costo || 5000);
      const valor = p.stock_actual <= p.stock_minimo ? unidadesNecesarias * 3 : unidadesNecesarias * 2;
      return { ...p, unidadesNecesarias, costo, valor };
    })
    .filter(p => p.costo <= presupuesto);

  const n = items.length;
  const W = Math.floor(presupuesto / 1000);
  const dp = Array(n + 1).fill(null).map(() => Array(W + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    const peso = Math.floor(items[i - 1].costo / 1000);
    const val  = items[i - 1].valor;
    for (let w = 0; w <= W; w++) {
      dp[i][w] = dp[i - 1][w];
      if (peso <= w) dp[i][w] = Math.max(dp[i][w], dp[i - 1][w - peso] + val);
    }
  }
  const seleccionados = [];
  let w = W;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      seleccionados.push(items[i - 1]);
      w -= Math.floor(items[i - 1].costo / 1000);
    }
  }
  const costoTotal = seleccionados.reduce((a, b) => a + b.costo, 0);
  return { seleccionados, costoTotal };
}

/* ─── Toast ─────────────────────────────────────────────────── */
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

/* ─── Badge stock ───────────────────────────────────────────── */
function StockBadge({ estado }) {
  const map   = { ok: 'badge-success', bajo: 'badge-warning', critico: 'badge-error' };
  const label = { ok: 'OK', bajo: 'Bajo', critico: 'Crítico' };
  return <span className={`badge ${map[estado] ?? 'badge-muted'}`}>{label[estado]}</span>;
}

const COLORS = ['#C9A84C', '#4A9B6F', '#7B68EE', '#E07874', '#5B9BD5', '#E0A050', '#9B59B6', '#1ABC9C'];

/* ─── PanelDesglose ─────────────────────────────────────────── */
function PanelDesglose({ mesa, onCobrado, showToast }) {
  const [desglose,        setDesglose]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [metodoPago,      setMetodoPago]      = useState('Efectivo');
  const [cobrando,        setCobrando]        = useState(false);
  const [montoPagado,     setMontoPagado]     = useState('');
  const [resultadoCambio, setResultadoCambio] = useState(null);
  const [errorCobro,      setErrorCobro]      = useState('');
  const [modoIndividual,  setModoIndividual]  = useState(false);

  const cargarDesglose = useCallback(() => {
    setLoading(true);
    setErrorCobro('');
    cajeroService.getDesglose(mesa.id_sesion)
      .then(({ data }) => setDesglose(data))
      .catch(() => showToast('Error al cargar desglose', 'error'))
      .finally(() => setLoading(false));
  }, [mesa.id_sesion]);

  useEffect(() => { cargarDesglose(); }, [cargarDesglose]);

  const cobrar = async (modo, id_cliente = null) => {
    setCobrando(true);
    setErrorCobro('');
    try {
      const { data } = await cajeroService.cobrar({
        id_sesion:   mesa.id_sesion,
        modo,
        id_cliente,
        metodo_pago: metodoPago,
      });
      showToast(`Cobro registrado ✓ — $${fmt(data.total_cobrado)}`);
      onCobrado();
      cargarDesglose();
      setModoIndividual(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al cobrar';
      if (err.response?.status === 409) setErrorCobro(msg);
      else showToast(msg, 'error');
    } finally {
      setCobrando(false);
    }
  };

  const calcularCambioVoraz = () => {
    const monto = Number(montoPagado);
    const totalGeneral = desglose.reduce((s, c) => s + c.total_personal, 0);
    if (monto < totalGeneral) { setResultadoCambio({ error: 'Monto insuficiente' }); return; }
    setResultadoCambio(calcularCambio(monto, totalGeneral));
  };

  const totalGeneral    = desglose.reduce((s, c) => s + c.total_personal, 0);
  const todosCobrados   = desglose.length > 0 && desglose.every(c => c.ya_cobrado);
  const hayAlgunCobrado = desglose.some(c => c.ya_cobrado);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', color: 'var(--text-primary)' }}>
              Mesa {mesa.numero}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {calcularTiempo(mesa.fecha_inicio)} · {mesa.total_comensales} {mesa.total_comensales === 1 ? 'persona' : 'personas'}
            </div>
          </div>
          <span className={`badge ${mesa.items_activos > 0 ? 'badge-warning' : 'badge-success'}`}>
            {mesa.items_activos > 0 ? 'Activa' : 'Por pagar'}
          </span>
        </div>
        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Total mesa</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: '700', color: 'var(--gold)' }}>
            ${loading ? fmt(mesa.total_entregado || 0) : fmt(totalGeneral)}
          </div>
        </div>
      </div>

      {/* Error cobro */}
      {errorCobro && (
        <div style={{ margin: '12px', background: 'rgba(184,84,80,0.1)', border: '1px solid rgba(184,84,80,0.3)', borderRadius: '6px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px', flexShrink: 0 }}>
          <span style={{ color: 'var(--error)', flexShrink: 0 }}>⚠</span>
          <p style={{ color: 'var(--error)', fontSize: '13px' }}>{errorCobro}</p>
        </div>
      )}

      {/* Desglose por persona */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
            <div style={{ width: '32px', height: '32px', border: '2px solid var(--gold-muted)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : desglose.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', paddingTop: '2rem' }}>No hay ítems entregados para cobrar.</p>
        ) : (
          <>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
              DESGLOSE POR PERSONA
            </div>

            {desglose.map((cliente, idx) => (
              <div key={cliente.id_cliente} style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: modoIndividual && !cliente.ya_cobrado ? '8px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: COLORS[idx % COLORS.length] + '30',
                      border: `2px solid ${COLORS[idx % COLORS.length]}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '700', color: COLORS[idx % COLORS.length],
                      flexShrink: 0,
                    }}>
                      {cliente.nombre_visible?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{cliente.nombre_visible}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cliente.rol_mesa === 'Dueno' ? 'Dueño' : 'Acompañante'}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: COLORS[idx % COLORS.length] }}>
                      ${fmt(cliente.total_personal)}
                    </div>
                    {cliente.ya_cobrado && (
                      <span style={{ fontSize: '10px', color: 'var(--success)' }}>✓ Cobrado</span>
                    )}
                  </div>
                </div>
                {modoIndividual && !cliente.ya_cobrado && (
                  <button
                    disabled={cobrando}
                    onClick={() => cobrar('individual', cliente.id_cliente)}
                    style={{
                      width: '100%', padding: '6px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                      background: COLORS[idx % COLORS.length] + '20',
                      border: `1px solid ${COLORS[idx % COLORS.length]}40`,
                      color: COLORS[idx % COLORS.length],
                      cursor: cobrando ? 'not-allowed' : 'pointer',
                      opacity: cobrando ? 0.4 : 1,
                      fontFamily: 'inherit',
                    }}
                  >
                    {cobrando ? 'Procesando…' : 'Cobrar'}
                  </button>
                )}
              </div>
            ))}

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
              {desglose.filter(c => c.ya_cobrado).length} ya cobrado · {desglose.filter(c => !c.ya_cobrado).length} pendiente(s)
            </div>
          </>
        )}
      </div>

      {/* Footer — método de pago + botones */}
      {!loading && desglose.length > 0 && (
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {/* Selector método de pago */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>MÉTODO DE PAGO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              {['Efectivo', 'Tarjeta', 'Transferencia'].map(m => (
                <button key={m} onClick={() => { setMetodoPago(m); setResultadoCambio(null); setMontoPagado(''); }} style={{
                  padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                  border: `1px solid ${metodoPago === m ? 'var(--gold)' : 'var(--border)'}`,
                  background: metodoPago === m ? 'rgba(201,168,76,0.1)' : 'var(--bg-elevated)',
                  color: metodoPago === m ? 'var(--gold)' : 'var(--text-muted)',
                  cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
                }}>{m}</button>
              ))}
            </div>
          </div>

          {/* Cambio voraz — solo si Efectivo y quedan por cobrar */}
          {metodoPago === 'Efectivo' && !todosCobrados && (
            <div style={{ marginBottom: '10px', padding: '10px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-gold)' }}>
              <div style={{ fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                CALCULAR CAMBIO (Algoritmo Voraz)
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input-base" type="number" placeholder="Monto recibido"
                       value={montoPagado} onChange={e => { setMontoPagado(e.target.value); setResultadoCambio(null); }}
                       style={{ fontSize: '13px' }} />
                <button className="btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '12px' }} onClick={calcularCambioVoraz}>
                  Calcular
                </button>
              </div>
              {resultadoCambio && !resultadoCambio.error && (
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: '600' }}>Cambio: ${fmt(resultadoCambio.cambio)}</span>
                  {resultadoCambio.desglose.length > 0 && (
                    <div style={{ marginTop: '4px', color: 'var(--text-muted)', fontSize: '11px' }}>
                      {resultadoCambio.desglose.map(d => `${d.cantidad}x $${fmt(d.denominacion)}`).join(' + ')}
                    </div>
                  )}
                  {resultadoCambio.desglose.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Sin cambio exacto.</p>
                  )}
                </div>
              )}
              {resultadoCambio?.error && <p style={{ color: 'var(--error)', fontSize: '12px', marginTop: '4px' }}>{resultadoCambio.error}</p>}
            </div>
          )}

          {/* Botones de cobro */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {todosCobrados ? (
              <div style={{ padding: '12px', background: 'rgba(74,155,111,0.1)', border: '1px solid rgba(74,155,111,0.3)', borderRadius: '8px', textAlign: 'center', color: 'var(--success)', fontSize: '13px', fontWeight: '600' }}>
                ✓ Mesa completamente cobrada
              </div>
            ) : (
              <>
                {!hayAlgunCobrado && (
                  <button className="btn-gold" style={{ width: '100%' }} disabled={cobrando}
                          onClick={() => cobrar('grupal')}>
                    {cobrando ? 'Procesando…' : 'Cobrar mesa completa'}
                  </button>
                )}
                <button className="btn-outline" style={{ width: '100%' }}
                        onClick={() => setModoIndividual(m => !m)}>
                  {modoIndividual ? 'Cancelar selección individual' : 'Cobro individual por persona'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Gráfica de barras (sin librerías) ─────────────────────── */
function GraficaBarras({ datos }) {
  if (!datos || datos.length === 0) return null;
  const maxVal      = Math.max(...datos.map(d => Number(d.ventas)), 1);
  const horasArr    = datos.map(d => Number(d.hora));
  const minH        = Math.min(...horasArr);
  const maxH        = Math.max(...horasArr);
  const horas       = Array.from({ length: maxH - minH + 1 }, (_, i) => i + minH);
  const datosMap    = Object.fromEntries(datos.map(d => [Number(d.hora), Number(d.ventas)]));

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px' }}>
      {horas.map(hora => {
        const val = datosMap[hora] || 0;
        const pct = (val / maxVal) * 100;
        return (
          <div key={hora} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '4px' }}>
            <div
              title={`${hora}:00 — $${val.toLocaleString('es-CO')}`}
              style={{
                width: '100%',
                height: `${Math.max(pct, 3)}%`,
                background: val > 0 ? 'linear-gradient(180deg, var(--gold), var(--gold-muted))' : 'var(--bg-elevated)',
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.5s ease',
                cursor: val > 0 ? 'pointer' : 'default',
              }}
            />
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', flexShrink: 0 }}>{hora}h</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Tab Inventario ────────────────────────────────────────── */
function TabInventario({ showToast }) {
  const [inventario,  setInventario]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [busqueda,    setBusqueda]    = useState('');
  const [qtys,        setQtys]        = useState({});
  const [restocking,  setRestocking]  = useState(null);
  const [presupuesto, setPresupuesto] = useState('');
  const [sugerencia,  setSugerencia]  = useState(null);

  const cargar = useCallback(() => {
    setLoading(true);
    cajeroService.getInventario()
      .then(({ data }) => setInventario(data))
      .catch(() => showToast('Error al cargar inventario', 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleRestock = async (prod) => {
    const cantidad = Number(qtys[prod.id_producto] ?? 1);
    if (!cantidad || cantidad <= 0) { showToast('Cantidad inválida', 'error'); return; }
    setRestocking(prod.id_producto);
    try {
      await cajeroService.restock(prod.id_producto, cantidad);
      showToast(`Stock actualizado: +${cantidad} unidades`);
      setQtys(prev => ({ ...prev, [prod.id_producto]: '' }));
      cargar();
    } catch (err) {
      showToast(err.response?.data?.error || 'Error al hacer restock', 'error');
    } finally {
      setRestocking(null);
    }
  };

  const filtrados = inventario.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Algoritmo Mochila */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{ flex: 1, fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Sugerencia de Re-stock · <span style={{ color: 'var(--gold)' }}>Algoritmo Mochila</span>
          </p>
          <span className="badge badge-gold">Knapsack</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="number" value={presupuesto} onChange={e => { setPresupuesto(e.target.value); setSugerencia(null); }}
                 placeholder="Presupuesto disponible ($)" className="input-base" style={{ flex: 1 }} />
          <button onClick={() => { const p = Number(presupuesto); if (!p || p <= 0) return; setSugerencia(sugerirRestock(inventario, p)); }}
                  className="btn-outline" style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
            Calcular
          </button>
        </div>
        {sugerencia && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sugerencia.seleccionados.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Sin productos críticos dentro del presupuesto.</p>
            ) : (
              <>
                {sugerencia.seleccionados.map(p => (
                  <div key={p.id_producto} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', background: 'var(--bg-card)', borderRadius: '6px', padding: '6px 12px' }}>
                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{p.nombre}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>+{p.unidadesNecesarias} uds</span>
                    <span style={{ color: 'var(--gold)', fontWeight: 600 }}>${fmt(p.costo)}</span>
                  </div>
                ))}
                <p style={{ fontSize: '12px', textAlign: 'right', color: 'var(--text-secondary)', paddingTop: '4px' }}>
                  Costo total: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>${fmt(sugerencia.costoTotal)}</span>
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Buscador */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
               placeholder="Buscar producto…" className="input-base" />
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '64px' }} />)
        ) : filtrados.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', paddingTop: '40px' }}>Sin resultados.</p>
        ) : filtrados.map(prod => (
          <div key={prod.id_producto} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prod.nombre}</p>
                <StockBadge estado={prod.estado_stock} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                Stock: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.stock_actual}</span>
                {' '}· Mín: {prod.stock_minimo} · Máx: {prod.stock_maximo}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <input type="number" min="1" value={qtys[prod.id_producto] ?? ''}
                     onChange={e => setQtys(prev => ({ ...prev, [prod.id_producto]: e.target.value }))}
                     placeholder="Qty" className="input-base" style={{ width: '64px', textAlign: 'center', padding: '6px 8px' }} />
              <button disabled={restocking === prod.id_producto} onClick={() => handleRestock(prod)}
                      className="btn-success" style={{ padding: '6px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                {restocking === prod.id_producto ? '…' : '+ Re-stock'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Tab Cuentas ───────────────────────────────────────────── */
function TabCuentas({ cuentas, loading, onCerrarJornada, onCobrado, showToast }) {
  const [ordenamiento,    setOrdenamiento]    = useState('mayor_total');
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);

  const mesaSeleccionadaId = mesaSeleccionada?.id_sesion;
  useEffect(() => {
    if (!mesaSeleccionadaId) return;
    const updated = cuentas.find(c => c.id_sesion === mesaSeleccionadaId);
    setMesaSeleccionada(updated ?? null);
  }, [cuentas, mesaSeleccionadaId]);

  const cuentasOrdenadas = [...cuentas].sort((a, b) => {
    switch (ordenamiento) {
      case 'mayor_total':   return parseFloat(b.total_entregado) - parseFloat(a.total_entregado);
      case 'menor_total':   return parseFloat(a.total_entregado) - parseFloat(b.total_entregado);
      case 'mas_tiempo':    return new Date(a.fecha_inicio) - new Date(b.fecha_inicio);
      case 'menos_tiempo':  return new Date(b.fecha_inicio) - new Date(a.fecha_inicio);
      default: return 0;
    }
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', padding: '1.5rem', height: 'calc(100vh - 130px)', minHeight: 0 }}>

      {/* ── Lista de mesas ── */}
      <div style={{ overflowY: 'auto', minHeight: 0 }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: 'var(--text-primary)', fontWeight: 600 }}>Cuentas Abiertas</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {cuentas.length} mesa{cuentas.length !== 1 ? 's' : ''} activa{cuentas.length !== 1 ? 's' : ''} · Actualizado en tiempo real
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select className="select-base" style={{ width: 'auto', fontSize: '12px' }}
                    value={ordenamiento} onChange={e => setOrdenamiento(e.target.value)}>
              <option value="mayor_total">Mayor total</option>
              <option value="menor_total">Menor total</option>
              <option value="mas_tiempo">Más tiempo abierta</option>
              <option value="menos_tiempo">Menos tiempo abierta</option>
            </select>
            <button
              onClick={onCerrarJornada}
              className="btn-ghost"
              style={{ whiteSpace: 'nowrap', fontSize: '12px' }}
            >
              Cierre de Jornada
            </button>
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
            Por pagar
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold)' }} />
            Activa
          </div>
        </div>

        {/* Grid de cards */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '180px' }} />)}
          </div>
        ) : cuentas.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', gap: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '40px' }}>✓</span>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No hay mesas abiertas.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {cuentasOrdenadas.map(cuenta => {
              const isSelected     = mesaSeleccionada?.id_sesion === cuenta.id_sesion;
              const tienePendientes = cuenta.items_activos > 0;
              const totalNum       = parseFloat(cuenta.total_entregado || 0);

              return (
                <div
                  key={cuenta.id_sesion}
                  onClick={() => setMesaSeleccionada(cuenta)}
                  style={{
                    background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'var(--gold)' : tienePendientes ? 'var(--border)' : 'rgba(74,155,111,0.4)'}`,
                    borderRadius: '12px',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Línea superior de color */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: tienePendientes ? 'var(--gold)' : 'var(--success)',
                  }} />

                  {/* Header de la card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      Mesa {cuenta.numero}
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px',
                      background: tienePendientes ? 'rgba(201,168,76,0.15)' : 'rgba(74,155,111,0.15)',
                      color: tienePendientes ? 'var(--gold)' : 'var(--success)',
                      border: `1px solid ${tienePendientes ? 'rgba(201,168,76,0.3)' : 'rgba(74,155,111,0.3)'}`,
                      letterSpacing: '0.05em',
                    }}>
                      {tienePendientes ? 'Activa' : 'Por pagar'}
                    </span>
                  </div>

                  {/* Tiempo */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {calcularTiempo(cuenta.fecha_inicio)}
                  </div>

                  {/* Total */}
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '700', color: 'var(--gold)', marginBottom: '12px' }}>
                    ${totalNum.toLocaleString('es-CO')}
                  </div>

                  {/* Comensales */}
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {cuenta.total_comensales} {cuenta.total_comensales === 1 ? 'persona' : 'personas'} · {cuenta.nombres_preview || 'Sin nombres'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Panel lateral ── */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'sticky',
        top: '130px',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 160px)',
      }}>
        {mesaSeleccionada ? (
          <PanelDesglose
            mesa={mesaSeleccionada}
            onCobrado={onCobrado}
            showToast={showToast}
          />
        ) : (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '40px', marginBottom: '1rem' }}>🧾</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Selecciona una mesa
            </div>
            <div style={{ fontSize: '12px' }}>
              Haz click en cualquier cuenta para ver el desglose y gestionar el cobro.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Página principal ──────────────────────────────────────── */
export default function CajeroPage() {
  const { usuario, logout } = useAuth();
  const navigate            = useNavigate();
  const { toast, show }     = useToast();

  const [tab,              setTab]              = useState('cuentas');
  const [cuentas,          setCuentas]          = useState([]);
  const [loadingC,         setLoadingC]         = useState(true);
  const [vistaCierre,      setVistaCierre]      = useState(false);
  const [previewCierre,    setPreviewCierre]    = useState(null);
  const [loadingPreview,   setLoadingPreview]   = useState(false);
  const [confirmTexto,     setConfirmTexto]     = useState('');
  const [mostrarConfirm,   setMostrarConfirm]   = useState(false);
  const [ejecutandoCierre, setEjecutandoCierre] = useState(false);
  const [resultadoCierre,  setResultadoCierre]  = useState(null);

  const cargarCuentas = useCallback(async () => {
    try {
      const { data } = await cajeroService.getCuentas();
      setCuentas(data);
    } catch {
      show('Error al cargar cuentas', 'error');
    } finally {
      setLoadingC(false);
    }
  }, []);

  useEffect(() => { cargarCuentas(); }, [cargarCuentas]);

  useEffect(() => {
    const id = setInterval(cargarCuentas, 15000);
    return () => clearInterval(id);
  }, [cargarCuentas]);

  useWebSocket(useCallback((msg) => {
    if (msg.tipo === 'ACTUALIZAR_MESAS') cargarCuentas();
  }, [cargarCuentas]));

  const abrirVistaCierre = async () => {
    setVistaCierre(true);
    setPreviewCierre(null);
    setResultadoCierre(null);
    setLoadingPreview(true);
    try {
      const { data } = await cajeroService.getPreviewCierre();
      setPreviewCierre(data);
    } catch {
      show('Error cargando preview de cierre', 'error');
      setVistaCierre(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const ejecutarCierre = async () => {
    setEjecutandoCierre(true);
    try {
      const { data } = await cajeroService.cerrarJornada();
      setResultadoCierre(data.resumen);
      setMostrarConfirm(false);
      setConfirmTexto('');
      setPreviewCierre(prev => ({ ...prev, ya_cerrado: true }));
      show('✓ Jornada cerrada exitosamente');
      cargarCuentas();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al cerrar jornada';
      show(msg, 'error');
      setMostrarConfirm(false);
    } finally {
      setEjecutandoCierre(false);
    }
  };

  const descargarPDFCierre = async () => {
    try {
      const { data } = await api.post('/export/cierre/excel', previewCierre.resumen, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data]));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `OlimpicBar_Cierre_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      show('Error al exportar', 'error');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header premium ── */}
      <header style={{
        background: 'linear-gradient(135deg, #0A0A0A 0%, #141414 100%)',
        borderBottom: '1px solid #2A2A2A',
        padding: '0 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: '64px',
        position: 'sticky', top: 0, zIndex: 40,
        flexShrink: 0,
      }}>
        {/* Izquierda: logo + PANEL CAJERO + sede */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '50%',
            border: '2px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1C1C1C, #0A0A0A)',
            boxShadow: '0 0 12px rgba(201,168,76,0.2)', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '13px', fontWeight: '700', color: 'var(--gold)' }}>OB</span>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', lineHeight: 1 }}>PANEL CAJERO</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '16px', fontWeight: '600', color: 'var(--gold)', lineHeight: 1.3 }}>
              {usuario?.sede_nombre ?? '—'}
            </div>
          </div>
        </div>

        {/* Centro: avatar + nombre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-muted), var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '700', color: '#0A0A0A',
          }}>
            {usuario?.nombre?.charAt(0)?.toUpperCase() || 'C'}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {usuario?.nombre || usuario?.username}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {usuario?.rol}
            </div>
          </div>
        </div>

        {/* Derecha: logout */}
        <button className="btn-ghost" onClick={() => { logout(); navigate('/login'); }} style={{ fontSize: '12px' }}>
          Cerrar sesión
        </button>
      </header>

      {/* ── Tab bar ── */}
      <div className="tab-bar" style={{ flexShrink: 0, position: 'sticky', top: '64px', zIndex: 39 }}>
        <div style={{ padding: '0 2rem', display: 'flex', alignItems: 'center', width: '100%' }}>
          {[['cuentas', 'Cuentas'], ['inventario', 'Inventario']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`tab-item ${tab === key ? 'active' : ''}`}>
              {label}
            </button>
          ))}
          {cuentas.length > 0 && (
            <div style={{ marginLeft: 'auto' }}>
              <span className="badge badge-gold">
                {cuentas.length} mesa{cuentas.length !== 1 ? 's' : ''} activa{cuentas.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'cuentas' ? (
          <TabCuentas
            cuentas={cuentas}
            loading={loadingC}
            onCerrarJornada={abrirVistaCierre}
            onCobrado={cargarCuentas}
            showToast={show}
          />
        ) : (
          <div style={{ maxWidth: '720px', width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TabInventario showToast={show} />
          </div>
        )}
      </div>

      {/* ── Vista fullscreen de cierre de jornada ── */}
      {vistaCierre && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--bg-base)',
          zIndex: 45, overflowY: 'auto',
          paddingTop: '64px',
        }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Cierre de Jornada
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · {usuario?.nombre || usuario?.username}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                <button className="btn-ghost" onClick={() => setVistaCierre(false)}>← Volver</button>
                {previewCierre && !previewCierre.ya_cerrado && (
                  <button className="btn-outline" onClick={descargarPDFCierre}>📄 Exportar Excel</button>
                )}
                {previewCierre && !previewCierre.ya_cerrado && previewCierre.mesas_ocupadas === 0 && (
                  <button className="btn-gold" onClick={() => setMostrarConfirm(true)}>
                    Ejecutar Cierre
                  </button>
                )}
              </div>
            </div>

            {/* Alertas */}
            {previewCierre?.ya_cerrado && (
              <div style={{ padding: '16px', background: 'rgba(184,84,80,0.1)', border: '1px solid rgba(184,84,80,0.3)', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '20px' }}>🔒</span>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--error)', marginBottom: '2px' }}>Jornada ya cerrada</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>El cierre de jornada ya fue ejecutado hoy para esta sede. Solo se permite un cierre por día.</div>
                </div>
              </div>
            )}

            {previewCierre?.mesas_ocupadas > 0 && !previewCierre?.ya_cerrado && (
              <div style={{ padding: '16px', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--gold)', marginBottom: '2px' }}>Hay {previewCierre.mesas_ocupadas} mesa(s) ocupada(s)</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Debes cerrar todas las mesas antes de ejecutar el cierre. El botón "Ejecutar Cierre" estará deshabilitado hasta que no haya mesas activas.</div>
                </div>
              </div>
            )}

            {resultadoCierre && (
              <div style={{ padding: '16px', background: 'rgba(74,155,111,0.1)', border: '1px solid rgba(74,155,111,0.3)', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '20px' }}>✓</span>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '2px' }}>Jornada cerrada exitosamente</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>El corte oficial del día ha sido registrado. Total ventas: <strong style={{ color: 'var(--gold)' }}>${fmt(resultadoCierre.total_ventas)}</strong></div>
                </div>
              </div>
            )}

            {loadingPreview ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontSize: '14px' }}>
                Cargando métricas del día...
              </div>
            ) : previewCierre && (
              <>
                {/* Métricas principales */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Total ventas</div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: '700', color: 'var(--gold)' }}>
                      ${parseFloat(previewCierre.resumen.total_ventas || 0).toLocaleString('es-CO')}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Mesas atendidas</div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {previewCierre.resumen.total_mesas}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Ítems despachados</div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {previewCierre.resumen.total_items}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Ticket promedio</div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: '700', color: 'var(--gold)' }}>
                      ${parseFloat(previewCierre.resumen.ticket_promedio || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Cancelaciones</div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: '700', color: previewCierre.resumen.total_cancelaciones > 0 ? 'var(--error)' : 'var(--text-primary)' }}>
                      {previewCierre.resumen.total_cancelaciones}
                    </div>
                  </div>
                </div>

                {/* Gráfica ventas por hora */}
                {previewCierre.ventas_por_hora?.length > 0 && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Ventas por franja horaria</div>
                    <GraficaBarras datos={previewCierre.ventas_por_hora} />
                  </div>
                )}

                {/* Top productos + Tipo de cobro */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  {/* Top 5 */}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' }}>Top 5 productos</div>
                    {previewCierre.top_productos.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sin ventas registradas hoy.</p>
                    ) : previewCierre.top_productos.map((p, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < previewCierre.top_productos.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '16px' }}>{i + 1}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{p.nombre}</span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: '600' }}>× {p.total_vendido}</span>
                      </div>
                    ))}
                  </div>

                  {/* Tipo de cobro */}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '1rem' }}>Tipo de cobro</div>
                    {(() => {
                      const ind   = previewCierre.cobros.cobros_individuales || 0;
                      const grup  = previewCierre.cobros.cobros_grupales     || 0;
                      const total = ind + grup;
                      const pctInd  = total > 0 ? Math.round((ind  / total) * 100) : 0;
                      const pctGrup = 100 - pctInd;
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>🟡 Individual ({ind})</span>
                            <span>⬜ Grupal ({grup})</span>
                          </div>
                          <div style={{ height: '12px', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-elevated)', marginBottom: '8px' }}>
                            <div style={{ height: '100%', width: `${pctInd}%`, background: 'linear-gradient(90deg, var(--gold-muted), var(--gold))', borderRadius: '6px', transition: 'width 0.8s ease' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span>{pctInd}% Individual</span>
                            <span>{pctGrup}% Grupal</span>
                          </div>
                          {total === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Sin cobros registrados hoy.</p>}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal confirmación cierre ── */}
      {mostrarConfirm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '420px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: 'var(--text-primary)', marginBottom: '8px' }}>
              ¿Confirmar cierre de jornada?
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Esta acción generará el corte oficial del día y <strong style={{ color: 'var(--error)' }}>no se puede deshacer</strong>. Solo se permite un cierre por día.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Escribe <strong style={{ color: 'var(--gold)' }}>CERRAR</strong> para confirmar:
              </div>
              <input
                className="input-base"
                placeholder="CERRAR"
                value={confirmTexto}
                onChange={e => setConfirmTexto(e.target.value.toUpperCase())}
                style={{ textAlign: 'center', letterSpacing: '0.2em', fontSize: '16px', fontWeight: '700' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-ghost" style={{ flex: 1 }}
                      onClick={() => { setMostrarConfirm(false); setConfirmTexto(''); }}>
                Cancelar
              </button>
              <button
                className="btn-gold"
                style={{ flex: 1, opacity: confirmTexto === 'CERRAR' ? 1 : 0.4 }}
                disabled={confirmTexto !== 'CERRAR' || ejecutandoCierre}
                onClick={ejecutarCierre}
              >
                {ejecutandoCierre ? 'Procesando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
