import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { catalogoService } from '../../services/api';
import { pedidoService, sesionService } from '../../services/sesionService';
import { useWebSocket } from '../../hooks/useWebSocket';

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
  return <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ bottom: '90px' }}>{toast.msg}</div>;
}

/* ─── Badge estado pedido ───────────────────────────────────── */
function EstadoBadge({ estado }) {
  const map = { Pendiente: 'badge-gold', Alistando: 'badge-blue', Entregado: 'badge-success', Cancelado: 'badge-error' };
  return <span className={`badge ${map[estado] ?? 'badge-muted'}`}>{estado}</span>;
}

/* ─── Tarjeta de producto ───────────────────────────────────── */
function ProductCard({ producto, cantidad, onAgregar, onMas, onMenos }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-gold)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Image */}
      <div style={{ height: '140px', overflow: 'hidden', background: 'var(--bg-elevated)', position: 'relative' }}>
        <img
          src={producto.imagen_url}
          alt={producto.nombre}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={e => { e.target.src = `https://placehold.co/400x300/1C1C1C/C9A84C?text=${encodeURIComponent(producto.nombre)}`; }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: '12px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '13px', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {producto.nombre}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: 1.4, marginBottom: '10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {producto.descripcion}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '14px' }}>
            ${Number(producto.precio_venta).toLocaleString('es-CO')}
          </span>

          {cantidad > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={onMenos} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px', minWidth: '16px', textAlign: 'center' }}>{cantidad}</span>
              <button onClick={onMas} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--gold)', border: 'none', color: '#0A0A0A', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
            </div>
          ) : (
            <button onClick={onAgregar} className="btn-gold" style={{ padding: '6px 14px', fontSize: '11px' }}>
              Agregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Drawer carrito ────────────────────────────────────────── */
function CarritoDrawer({ carrito, onClose, onCambiarCantidad, onConfirmar, enviando }) {
  const total = carrito.reduce((s, i) => s + i.precio_venta * i.cantidad, 0);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>Tu carrito</p>
            <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '20px' }}>{carrito.length} ítems</h2>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', lineHeight: 1 }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {carrito.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '3rem', fontSize: '13px' }}>Tu carrito está vacío.</p>
          ) : carrito.map(item => (
            <div key={item.id_producto} style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</p>
                <p style={{ color: 'var(--gold)', fontSize: '12px', fontWeight: 600, marginTop: '2px' }}>${Number(item.precio_venta * item.cantidad).toLocaleString('es-CO')}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => onCambiarCantidad(item.id_producto, -1)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '15px' }}>−</button>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{item.cantidad}</span>
                <button onClick={() => onCambiarCantidad(item.id_producto, 1)} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--gold)', border: 'none', color: '#0A0A0A', cursor: 'pointer', fontSize: '15px', fontWeight: 700 }}>+</button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total</span>
            <span className="font-display" style={{ color: 'var(--gold)', fontSize: '22px', fontWeight: 700 }}>${Number(total).toLocaleString('es-CO')}</span>
          </div>
          <button onClick={onConfirmar} disabled={enviando || carrito.length === 0} className="btn-gold" style={{ width: '100%', padding: '13px' }}>
            {enviando ? 'Enviando pedido…' : 'Confirmar pedido'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Drawer mis pedidos ────────────────────────────────────── */
function PedidosDrawer({ pedidos: misPedidos, clienteInfo, onClose, onActualizar, actualizando }) {
  const [generandoLink, setGenerandoLink] = useState(false);

  const totalPedido = misPedidos.reduce(
    (a, item) => a + item.precio_unitario * item.cantidad, 0
  );

  const compartirWhatsApp = async () => {
    setGenerandoLink(true);
    try {
      const { data } = await sesionService.generarEnlace();
      const waUrl = `https://wa.me/?text=${encodeURIComponent('Únete a mi mesa en OlimpicBar: ' + data.enlace)}`;
      window.open(waUrl, '_blank');
    } catch {
      alert('Error al generar enlace');
    } finally {
      setGenerandoLink(false);
    }
  };

  const ESTADOS_LABEL = ['Recibido', 'Alistando', 'Entregado'];
  const ESTADOS_COLOR = ['var(--warning)', '#5B9BD5', 'var(--success)'];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">

        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Mesa {clienteInfo?.numero} · Tu pedido
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 1.5s infinite' }} />
              En vivo
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', color: 'var(--text-primary)' }}>
              Seguimiento
            </div>
            <button onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Card resumen total */}
          <div style={{ margin: '1rem 1.5rem', padding: '14px', background: 'var(--bg-elevated)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total del pedido</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {misPedidos.length} ítem(s)
                </div>
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                ${totalPedido.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Lista vacía */}
          {misPedidos.length === 0 && (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 1.5rem', fontSize: '13px' }}>
              Aún no has pedido nada.
            </p>
          )}

          {/* Timeline de ítems */}
          {misPedidos.map(item => {
            const estadoActual = item.estado === 'Pendiente'  ? 0
                               : item.estado === 'Alistando'  ? 1
                               : item.estado === 'Entregado'  ? 2
                               : -1;
            const cancelado = item.estado === 'Cancelado';

            return (
              <div key={item.id_detalle} style={{
                margin: '0 1.5rem 12px',
                padding: '14px',
                background: 'var(--bg-card)',
                border: `1px solid ${item.estado === 'Alistando' ? 'rgba(91,155,213,0.3)' : 'var(--border)'}`,
                borderRadius: '12px',
              }}>
                {/* Nombre y precio */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {item.producto_nombre}
                    {item.cantidad > 1 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}> × {item.cantidad}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                    ${(item.precio_unitario * item.cantidad).toLocaleString('es-CO')}
                  </div>
                </div>

                {/* Etiqueta de estado */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: cancelado ? 0 : '12px' }}>
                  {cancelado ? (
                    <span style={{ fontSize: '12px', color: 'var(--error)', fontWeight: 600 }}>✕ Cancelado</span>
                  ) : item.estado === 'Entregado' ? (
                    <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>✓ Entregado</span>
                  ) : item.estado === 'Alistando' ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5B9BD5', fontWeight: 600 }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5B9BD5', animation: 'pulse 1.2s infinite' }} />
                      Alistando...
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>Pendiente</span>
                  )}
                </div>

                {/* Barra de progreso timeline */}
                {!cancelado && (
                  <div>
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                      {[0, 1, 2].map(idx => (
                        <div key={idx} style={{
                          flex: 1, height: '4px', borderRadius: '2px',
                          background: idx <= estadoActual ? ESTADOS_COLOR[idx] : 'var(--bg-elevated)',
                          transition: 'background 0.4s ease',
                        }} />
                      ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {ESTADOS_LABEL.map((est, idx) => (
                        <span key={est} style={{
                          fontSize: '10px',
                          color: idx <= estadoActual ? 'var(--text-secondary)' : 'var(--text-muted)',
                          fontWeight: idx === estadoActual ? 700 : 400,
                        }}>
                          {est}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Espaciado final */}
          <div style={{ height: '1rem' }} />
        </div>

        {/* Footer */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {clienteInfo?.rol_mesa === 'Dueno' && (
            <button onClick={compartirWhatsApp} disabled={generandoLink} className="btn-success" style={{ width: '100%' }}>
              {generandoLink ? 'Generando enlace…' : '📲 Invitar acompañante por WhatsApp'}
            </button>
          )}
          <button onClick={onActualizar} disabled={actualizando} className="btn-ghost" style={{ width: '100%' }}>
            {actualizando ? 'Actualizando…' : '↻ Actualizar'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Barra inferior ────────────────────────────────────────── */
function BarraCarrito({ carrito, onClick }) {
  const total    = carrito.reduce((s, i) => s + i.precio_venta * i.cantidad, 0);
  const numItems = carrito.reduce((s, i) => s + i.cantidad, 0);
  if (numItems === 0) return null;
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 20, padding: '0 1rem 1rem' }}>
      <button
        onClick={onClick}
        style={{ width: '100%', maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)', color: '#0A0A0A', fontWeight: 700, fontSize: '14px', borderRadius: '10px', padding: '14px 20px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}
      >
        <span style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '5px', padding: '2px 8px', fontSize: '12px' }}>{numItems}</span>
        <span>Ver carrito</span>
        <span>${Number(total).toLocaleString('es-CO')}</span>
      </button>
    </div>
  );
}

/* ─── Página principal ──────────────────────────────────────── */
export default function MenuPage() {
  const { qr_codigo } = useParams();
  const navigate      = useNavigate();
  const { toast, show } = useToast();

  const clienteInfo = (() => {
    try { return JSON.parse(localStorage.getItem('cliente_info')); } catch { return null; }
  })();

  useEffect(() => {
    const verificar = async () => {
      if (!clienteInfo || clienteInfo.qr_codigo !== qr_codigo) {
        navigate(`/mesa/${qr_codigo}`, { replace: true });
        return;
      }
      const id_sesion = clienteInfo?.id_sesion;
      if (!id_sesion) { navigate(`/mesa/${qr_codigo}`, { replace: true }); return; }
      try {
        const { data } = await sesionService.verificarActiva(id_sesion);
        if (!data.activa) {
          localStorage.removeItem('cliente_token');
          localStorage.removeItem('cliente_info');
          navigate('/sesion-terminada', { replace: true });
        }
      } catch {
        navigate('/sesion-terminada', { replace: true });
      }
    };
    verificar();
  }, [qr_codigo]);

  const [productos,             setProductos]             = useState([]);
  const [categorias,            setCategorias]            = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [pedidos,               setPedidos]               = useState([]);
  const [carrito,               setCarrito]               = useState([]);
  const [drawer,                setDrawer]                = useState(null);
  const [loadingProd,           setLoadingProd]           = useState(true);
  const [enviando,              setEnviando]              = useState(false);
  const [actualizando,          setActualizando]          = useState(false);

  const cargarPedidos = useCallback(async () => {
    setActualizando(true);
    try {
      const { data } = await pedidoService.misPedidos();
      setPedidos(data);
    } catch {
      show('Error al cargar pedidos', 'error');
    } finally {
      setActualizando(false);
    }
  }, []);

  useEffect(() => { cargarPedidos(); }, [cargarPedidos]);

  useWebSocket(useCallback((msg) => {
    if (msg.tipo === 'ACTUALIZAR_MESAS') {
      const info = JSON.parse(localStorage.getItem('cliente_info') || '{}');
      const id_sesion = info?.id_sesion;
      if (id_sesion) {
        sesionService.verificarActiva(id_sesion).then(({ data }) => {
          if (!data.activa) {
            localStorage.removeItem('cliente_token');
            localStorage.removeItem('cliente_info');
            navigate('/sesion-terminada', { replace: true });
          }
        }).catch(() => {});
      }
      cargarPedidos();
    }
  }, [cargarPedidos, qr_codigo]));

  useEffect(() => {
    if (!clienteInfo) return;
    Promise.all([
      catalogoService.get(clienteInfo.id_sede),
      catalogoService.getCategorias(),
    ])
      .then(([{ data: prods }, { data: cats }]) => {
        setProductos(Array.isArray(prods) ? prods : []);
        setCategorias(Array.isArray(cats)  ? cats  : []);
      })
      .catch(() => show('Error al cargar el menú', 'error'))
      .finally(() => setLoadingProd(false));
  }, []);

  const agregarAlCarrito = (producto) =>
    setCarrito(prev => {
      const ex = prev.find(i => i.id_producto === producto.id_producto);
      return ex
        ? prev.map(i => i.id_producto === producto.id_producto ? { ...i, cantidad: i.cantidad + 1 } : i)
        : [...prev, { id_producto: producto.id_producto, nombre: producto.nombre, precio_venta: producto.precio_venta, cantidad: 1 }];
    });

  const cambiarCantidad = (id_producto, delta) =>
    setCarrito(prev =>
      prev.map(i => i.id_producto === id_producto ? { ...i, cantidad: i.cantidad + delta } : i)
          .filter(i => i.cantidad > 0)
    );

  const confirmarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);
    try {
      await pedidoService.confirmar(carrito.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad })));
      setCarrito([]);
      show('¡Pedido enviado! El mesero lo está preparando');
      setDrawer('orders');
      cargarPedidos();
    } catch (err) {
      show(err.response?.data?.error || 'Error al confirmar pedido', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const productosFiltrados = categoriaSeleccionada === null
    ? productos
    : productos.filter(p => p.id_categoria === categoriaSeleccionada);
  const numCarrito = carrito.reduce((s, i) => s + i.cantidad, 0);

  if (!clienteInfo) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '80px' }}>
      {/* Header */}
      <header style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, padding: '12px 16px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              OlimpicBar · {clienteInfo.sede_nombre}
            </p>
            <h1 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '18px', lineHeight: 1.1 }}>
              Mesa {clienteInfo.numero}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            {/* Pedidos */}
            <button
              onClick={() => { setDrawer('orders'); cargarPedidos(); }}
              style={{ position: 'relative', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {pedidos.length > 0 && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '16px', height: '16px', background: 'var(--gold)', color: '#0A0A0A', fontSize: '9px', fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pedidos.length > 9 ? '9+' : pedidos.length}
                </span>
              )}
            </button>
            {/* Carrito */}
            <button
              onClick={() => setDrawer('cart')}
              style={{ position: 'relative', color: numCarrito > 0 ? 'var(--gold)' : 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}
            >
              <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {numCarrito > 0 && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '16px', height: '16px', background: 'var(--gold)', color: '#0A0A0A', fontSize: '9px', fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {numCarrito > 9 ? '9+' : numCarrito}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Categorías */}
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '10px' }}>
          <button
            onClick={() => setCategoriaSeleccionada(null)}
            style={{
              flexShrink: 0, padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
              background: categoriaSeleccionada === null ? 'var(--gold)' : 'var(--bg-elevated)',
              color:      categoriaSeleccionada === null ? '#0A0A0A'    : 'var(--text-secondary)',
              border:     categoriaSeleccionada === null ? '1px solid var(--gold)' : '1px solid var(--border)',
            }}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat.id_categoria}
              onClick={() => setCategoriaSeleccionada(cat.id_categoria)}
              style={{
                flexShrink: 0, padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                background: categoriaSeleccionada === cat.id_categoria ? 'var(--gold)' : 'var(--bg-elevated)',
                color:      categoriaSeleccionada === cat.id_categoria ? '#0A0A0A'    : 'var(--text-secondary)',
                border:     categoriaSeleccionada === cat.id_categoria ? '1px solid var(--gold)' : '1px solid var(--border)',
              }}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid productos */}
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '8px 16px 16px' }}>
        {loadingProd ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: '220px' }} />
            ))}
          </div>
        ) : productosFiltrados.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 0' }}>No hay productos disponibles.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {productosFiltrados.map(prod => {
              const enCarrito = carrito.find(i => i.id_producto === prod.id_producto);
              return (
                <ProductCard
                  key={prod.id_producto}
                  producto={prod}
                  cantidad={enCarrito?.cantidad ?? 0}
                  onAgregar={() => agregarAlCarrito(prod)}
                  onMas={() => cambiarCantidad(prod.id_producto, 1)}
                  onMenos={() => cambiarCantidad(prod.id_producto, -1)}
                />
              );
            })}
          </div>
        )}
      </main>

      {drawer === 'cart' && (
        <CarritoDrawer carrito={carrito} onClose={() => setDrawer(null)} onCambiarCantidad={cambiarCantidad} onConfirmar={confirmarPedido} enviando={enviando} />
      )}
      {drawer === 'orders' && (
        <PedidosDrawer pedidos={pedidos} clienteInfo={clienteInfo} onClose={() => setDrawer(null)} onActualizar={cargarPedidos} actualizando={actualizando} />
      )}

      <BarraCarrito carrito={carrito} onClick={() => setDrawer('cart')} />
      <Toast toast={toast} />
    </div>
  );
}
