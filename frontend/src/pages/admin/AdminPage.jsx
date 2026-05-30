import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import { useWebSocket } from '../../hooks/useWebSocket';
import api from '../../services/api';

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
    <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`} style={{ left: '50%', right: 'auto', transform: 'translateX(-50%)' }}>
      {toast.msg}
    </div>
  );
}

const labelCls = 'block text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-1.5';

/* ─── SedeCard ───────────────────────────────────────────────── */
function SedeCard({ sede }) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1.5rem',
      transition: 'all 0.3s',
      cursor: 'default',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Línea dorada superior */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: sede.mesas_ocupadas > 0
          ? 'linear-gradient(90deg, var(--gold-muted), var(--gold), var(--gold-muted))'
          : 'var(--border)',
      }} />

      {/* Nombre sede + badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
            {sede.sede_nombre}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sede.ubicacion}</div>
        </div>
        <span className={`badge ${sede.mesas_ocupadas > 0 ? 'badge-gold' : 'badge-muted'}`}>
          {sede.mesas_ocupadas > 0 ? 'OPERANDO' : 'SIN ACTIVIDAD'}
        </span>
      </div>

      {/* Métricas en grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>MESAS</div>
          <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
            {sede.mesas_ocupadas} <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif' }}>/ {sede.total_mesas}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>VENTAS HOY</div>
          <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--gold)', fontFamily: 'Playfair Display, serif' }}>
            ${parseFloat(sede.ventas_hoy || 0).toLocaleString('es-CO')}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>PENDIENTES</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '22px', fontWeight: '600', color: sede.items_pendientes > 0 ? 'var(--warning)' : 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
              {sede.items_pendientes}
            </span>
            {sede.items_pendientes > 0 && <div className="dot-pulse" />}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>SESIONES</div>
          <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--text-primary)', fontFamily: 'Playfair Display, serif' }}>
            {sede.sesiones_activas}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── GraficaBarrasReporte ───────────────────────────────────── */
function GraficaBarrasReporte({ titulo, datos, formatValue }) {
  if (!datos || datos.length === 0) return null;
  const maxVal = Math.max(...datos.map(d => d.value), 1);
  return (
    <div>
      {titulo && (
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
          {titulo}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {datos.map((d, i) => {
          const pct = (d.value / maxVal) * 100;
          return (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: i === 0 ? 'var(--gold)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatValue ? formatValue(d.value) : d.value}
                  {d.sub && <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 400 }}>{d.sub}</span>}
                </span>
              </div>
              <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: i === 0
                    ? 'linear-gradient(90deg, var(--gold-muted), var(--gold))'
                    : `rgba(201,168,76,${Math.max(0.25, 0.7 - i * 0.1)})`,
                  borderRadius: '3px',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── AdminPage ──────────────────────────────────────────────── */
export default function AdminPage() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { toast, show } = useToast();

  const today = new Date().toISOString().split('T')[0];
  const [tab, setTab] = useState('dashboard');

  /* Dashboard */
  const [dashboard,    setDashboard]    = useState([]);
  const [cargandoDash, setCargandoDash] = useState(false);
  const [countdown,    setCountdown]    = useState(30);

  /* Usuarios */
  const [usuarios,   setUsuarios]   = useState([]);
  const [roles,      setRoles]      = useState([]);
  const [cargandoU,  setCargandoU]  = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalReset, setModalReset] = useState(null);
  const [formNuevo,  setFormNuevo]  = useState({ nombre: '', username: '', correo: '', password: '', id_rol: '', id_sede: '' });
  const [formReset,  setFormReset]  = useState({ nueva: '', confirmar: '' });
  const [enviando,   setEnviando]   = useState(false);

  /* Sedes (compartido) */
  const [sedes, setSedes] = useState([]);

  /* Panel de usuarios para accesos rápidos */
  const [usuariosPanel, setUsuariosPanel] = useState([]);

  /* Seguridad */
  const [hashTexto,    setHashTexto]    = useState('');
  const [hashResult,   setHashResult]   = useState(null);
  const [hashLoading,  setHashLoading]  = useState(false);
  const [hashDual,     setHashDual]     = useState(null);
  const [hashDualLoad, setHashDualLoad] = useState(false);

  /* Reportes */
  const [fechaInicio,  setFechaInicio]  = useState(today);
  const [fechaFin,     setFechaFin]     = useState(today);
  const [filtroSede,   setFiltroSede]   = useState('');
  const [errorReporte, setErrorReporte] = useState(null);
  const [resumen,      setResumen]      = useState(null);
  const [topProductos, setTopProductos] = useState([]);
  const [generando,    setGenerando]    = useState(false);
  const [exportando,   setExportando]   = useState(null);

  /* Carga inicial */
  const cargarDashboard = useCallback(async () => {
    setCargandoDash(true);
    try {
      const { data } = await adminService.getDashboard();
      setDashboard(data);
    } catch { show('Error al cargar dashboard', 'error'); }
    finally { setCargandoDash(false); }
  }, []);

  const cargarSedes = useCallback(async () => {
    try {
      const { data } = await adminService.getSedes();
      setSedes(data);
    } catch {}
  }, []);

  const cargarUsuarios = useCallback(async () => {
    setCargandoU(true);
    try {
      const [{ data: u }, { data: r }] = await Promise.all([
        adminService.getUsuarios(),
        adminService.getRoles(),
      ]);
      setUsuarios(u);
      setRoles(r);
    } catch { show('Error al cargar usuarios', 'error'); }
    finally { setCargandoU(false); }
  }, []);

  /* Handlers seguridad */
  const handleHash = async (e) => {
    e.preventDefault();
    if (!hashTexto.trim()) return;
    setHashLoading(true);
    setHashResult(null);
    try {
      const { data } = await api.post('/admin/demo-hash', { texto: hashTexto });
      setHashResult(data);
    } catch (err) {
      show(err.response?.data?.error || 'Error al generar hash', 'error');
    } finally {
      setHashLoading(false);
    }
  };

  const handleHashDual = async () => {
    if (!hashTexto.trim()) return;
    setHashDualLoad(true);
    setHashDual(null);
    try {
      const [r1, r2] = await Promise.all([
        api.post('/admin/demo-hash', { texto: hashTexto }),
        api.post('/admin/demo-hash', { texto: hashTexto }),
      ]);
      setHashDual([r1.data.hash, r2.data.hash]);
    } catch {
      show('Error al demostrar aleatoriedad', 'error');
    } finally {
      setHashDualLoad(false);
    }
  };

  const getJWTInfo = () => {
    const token = localStorage.getItem('basemod_token');
    if (!token) return null;
    try {
      const [, payloadB64] = token.split('.');
      return { token, payload: JSON.parse(atob(payloadB64)) };
    } catch { return null; }
  };

  useEffect(() => {
    cargarDashboard();
    cargarSedes();
    adminService.getUsuarios().then(({ data }) => setUsuariosPanel(data)).catch(() => {});
  }, [cargarDashboard, cargarSedes]);
  useEffect(() => { if (tab === 'usuarios') cargarUsuarios(); }, [tab]);

  /* Countdown 30s auto-refresh */
  useEffect(() => {
    if (tab !== 'dashboard') return;
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { cargarDashboard(); return 30; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [tab, cargarDashboard]);

  /* WebSocket */
  useWebSocket(useCallback((msg) => {
    if (msg.tipo === 'ACTUALIZAR_MESAS') { cargarDashboard(); setCountdown(30); }
  }, [cargarDashboard]));

  /* Handlers usuarios */
  const handleCrear = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await adminService.crearUsuario(formNuevo);
      show('Usuario creado correctamente');
      setModalNuevo(false);
      setFormNuevo({ nombre: '', username: '', correo: '', password: '', id_rol: '', id_sede: '' });
      cargarUsuarios();
    } catch (err) {
      show(err.response?.data?.error || 'Error al crear usuario', 'error');
    } finally { setEnviando(false); }
  };

  const handleToggle = async (u) => {
    try {
      await adminService.toggleUsuario(u.id_usuario);
      setUsuarios(prev => prev.map(x => x.id_usuario === u.id_usuario ? { ...x, activo: x.activo ? 0 : 1 } : x));
    } catch (err) { show(err.response?.data?.error || 'Error', 'error'); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (formReset.nueva !== formReset.confirmar) { show('Las contraseñas no coinciden', 'error'); return; }
    try {
      await adminService.resetPassword(modalReset.id_usuario, formReset.nueva);
      show('Contraseña reseteada correctamente');
      setModalReset(null);
      setFormReset({ nueva: '', confirmar: '' });
    } catch (err) { show(err.response?.data?.error || 'Error', 'error'); }
  };

  /* Handler reporte */
  const handleReporte = async (e) => {
    e?.preventDefault?.();
    setErrorReporte(null);
    if (!fechaInicio || !fechaFin) { setErrorReporte('Selecciona ambas fechas.'); return; }
    if (fechaFin < fechaInicio) { setErrorReporte('La fecha fin debe ser igual o posterior a la fecha inicio.'); return; }
    const diffVal = Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24));
    if (diffVal > 90) { setErrorReporte('El período no puede superar 90 días.'); return; }
    setGenerando(true);
    try {
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };
      if (filtroSede) params.id_sede = filtroSede;
      const { data } = await adminService.getReporte(params);
      setResumen(data.resumen);
      setTopProductos(data.top_productos);
    } catch (err) { setErrorReporte(err.response?.data?.error || 'Error al generar reporte'); }
    finally { setGenerando(false); }
  };

  /* Exportar reporte */
  const descargarReporte = async (tipo) => {
    setExportando(tipo);
    try {
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };
      if (filtroSede) params.id_sede = filtroSede;
      const fn = tipo === 'excel' ? adminService.exportarExcel : adminService.exportarPDF;
      const { data } = await fn(params);
      const ext = tipo === 'excel' ? 'xlsx' : 'pdf';
      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `OlimpicBar_Reporte_${fechaInicio}_${fechaFin}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      show('Error al exportar', 'error');
    } finally {
      setExportando(null);
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const totalesReporte = resumen ? {
    ingresos:   resumen.reduce((s, r) => s + Number(r.total_ingresos), 0),
    mesas:      resumen.reduce((s, r) => s + Number(r.total_mesas_atendidas), 0),
    items:      resumen.reduce((s, r) => s + Number(r.total_items), 0),
    cancelac:   resumen.reduce((s, r) => s + Number(r.cancelaciones), 0),
    ticketProm: resumen.length
      ? resumen.reduce((s, r) => s + Number(r.ticket_promedio), 0) / resumen.length
      : 0,
  } : null;

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>

      <header style={{
        background: 'linear-gradient(135deg, #0A0A0A 0%, #141414 100%)',
        borderBottom: '1px solid #2A2A2A',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
             onClick={() => navigate('/dashboard')}>
          <div style={{
            width: '38px', height: '38px',
            borderRadius: '50%',
            border: '2px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #1C1C1C, #0A0A0A)',
            boxShadow: '0 0 12px rgba(201,168,76,0.2)',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '16px',
              fontWeight: '700',
              color: 'var(--gold)',
              letterSpacing: '-0.5px',
            }}>O</span>
          </div>
          <div>
            <div style={{
              fontFamily: 'Playfair Display, serif',
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              letterSpacing: '0.02em',
              lineHeight: 1.2,
            }}>OlimpicBar</div>
            <div style={{
              fontSize: '10px',
              color: 'var(--gold)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: '500',
              lineHeight: 1,
            }}>Sistema de Gestión</div>
          </div>
        </div>

        {/* Centro — info del usuario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px', height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--gold-muted), var(--gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '700', color: '#0A0A0A',
          }}>
            {usuario?.nombre?.charAt(0)?.toUpperCase() || 'A'}
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

        {/* Derecha — botón cerrar sesión */}
        <button className="btn-ghost" onClick={handleLogout} style={{ fontSize: '12px' }}>
          Cerrar sesión
        </button>
      </header>

      <nav style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        position: 'sticky',
        top: '64px',
        zIndex: 39,
      }}>
        {[
          { key: 'dashboard', label: 'Dashboard' },
          { key: 'usuarios',  label: 'Usuarios'  },
          { key: 'reportes',  label: 'Reportes'  },
          { key: 'qr',        label: 'QR & Mesas' },
          { key: 'productos', label: 'Productos'  },
          { key: 'seguridad', label: 'Seguridad'  },
        ].map(({ key, label }) => {
          const isNav = key === 'qr' || key === 'productos';
          const isActive = !isNav && tab === key;
          return (
            <button
              key={key}
              onClick={() => {
                if (key === 'qr') navigate('/admin/qr');
                else if (key === 'productos') navigate('/admin/productos');
                else setTab(key);
              }}
              style={{
                padding: '16px 24px',
                fontSize: '13px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
                marginBottom: '-1px',
              }}
              onMouseEnter={e => { if (!isActive) e.target.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { if (!isActive) e.target.style.color = 'var(--text-muted)'; }}
            >
              {label}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 16px' }}>

        {/* ═══════════ TAB DASHBOARD ═══════════ */}
        {tab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>Vista general</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>Actualiza en {countdown}s</span>
                <button onClick={() => { cargarDashboard(); setCountdown(30); }} disabled={cargandoDash} className="btn-ghost">
                  {cargandoDash ? 'Actualizando…' : '↻ Actualizar'}
                </button>
              </div>
            </div>

            {cargandoDash && dashboard.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '176px' }} />)}
              </div>
            ) : dashboard.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '64px 0' }}>No hay sedes activas.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.map(sede => <SedeCard key={sede.id_sede} sede={sede} />)}
              </div>
            )}

            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                ACCESO RÁPIDO A PANELES
              </div>

              {(() => {
                const sedes_ids = [...new Set(
                  usuariosPanel
                    .filter(u => u.activo && u.rol !== 'Administrador')
                    .map(u => u.id_sede)
                )];

                if (!sedes_ids.length) return (
                  <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No hay usuarios operativos activos.</p>
                );

                return sedes_ids.map(id_sede => {
                  const usuariosSede = usuariosPanel.filter(u => u.id_sede === id_sede && u.activo && u.rol !== 'Administrador');
                  if (!usuariosSede.length) return null;
                  const sedeNombre = usuariosSede[0]?.sede_nombre;

                  return (
                    <div key={id_sede} style={{ marginBottom: '1.5rem' }}>
                      <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: '600', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ height: '1px', width: '20px', background: 'var(--gold-muted)' }} />
                        {sedeNombre?.toUpperCase()}
                        <div style={{ height: '1px', flex: 1, background: 'var(--border)' }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {usuariosSede.map(u => (
                          <button
                            key={u.id_usuario}
                            onClick={() => {
                              if (u.rol === 'Mesero') navigate('/mesero');
                              if (u.rol === 'Cajero') navigate('/cajero');
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '8px',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = u.rol === 'Mesero' ? 'var(--gold-muted)' : 'var(--success)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                          >
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: u.rol === 'Mesero' ? 'rgba(201,168,76,0.2)' : 'rgba(74,155,111,0.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: '700',
                              color: u.rol === 'Mesero' ? 'var(--gold)' : 'var(--success)',
                            }}>
                              {u.nombre?.charAt(0) || u.username?.charAt(0)}
                            </div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ fontSize: '12px', fontWeight: '500', lineHeight: 1.2 }}>{u.username}</div>
                              <div style={{ fontSize: '10px', color: u.rol === 'Mesero' ? 'var(--gold)' : 'var(--success)', lineHeight: 1 }}>{u.rol}</div>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '4px' }}>→</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ═══════════ TAB USUARIOS ═══════════ */}
        {tab === 'usuarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>Usuarios</h2>
              <button onClick={() => setModalNuevo(true)} className="btn-gold">+ Nuevo usuario</button>
            </div>

            {cargandoU ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: '56px' }} />)}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <table className="table-base">
                  <thead>
                    <tr>
                      {['Nombre', 'Username', 'Rol', 'Sede', 'Estado', ''].map((h, i) => (
                        <th key={h} style={i === 5 ? { textAlign: 'right' } : {}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map(u => (
                      <tr key={u.id_usuario}>
                        <td style={{ fontWeight: 500 }}>{u.nombre}</td>
                        <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>{u.username}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{u.rol}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{u.sede_nombre}</td>
                        <td>
                          <span className={`badge ${u.activo ? 'badge-success' : 'badge-error'}`}>
                            {u.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              onClick={() => handleToggle(u)}
                              disabled={u.id_usuario === usuario?.id_usuario}
                              className="btn-ghost"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              {u.activo ? 'Desactivar' : 'Activar'}
                            </button>
                            <button onClick={() => setModalReset(u)} className="btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }}>
                              Reset pwd
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ TAB REPORTES ═══════════ */}
        {tab === 'reportes' && (() => {
          const diffDias = (fechaInicio && fechaFin)
            ? Math.round((new Date(fechaFin) - new Date(fechaInicio)) / (1000 * 60 * 60 * 24)) + 1
            : 0;
          const periodoLabel = fechaInicio === fechaFin
            ? fechaInicio
            : `${fechaInicio} — ${fechaFin}`;
          const sedeLabel = filtroSede
            ? (sedes.find(s => String(s.id_sede) === String(filtroSede))?.nombre || 'Sede')
            : 'Todas las sedes';

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>
                    Reportes de ventas
                  </h2>
                  {resumen && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {periodoLabel} · {sedeLabel}
                    </div>
                  )}
                </div>
                {resumen && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => descargarReporte('excel')} disabled={!!exportando} className="btn-ghost" style={{ fontSize: '12px' }}>
                      {exportando === 'excel' ? 'Descargando…' : '↓ Excel'}
                    </button>
                    <button
                      onClick={() => descargarReporte('pdf')}
                      disabled={!!exportando}
                      style={{ fontSize: '12px', padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(184,84,80,0.35)', background: 'rgba(184,84,80,0.08)', color: 'var(--error)', cursor: exportando ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: exportando ? 0.6 : 1 }}
                    >
                      {exportando === 'pdf' ? 'Descargando…' : '↓ PDF'}
                    </button>
                  </div>
                )}
              </div>

              {/* Filtros */}
              <div style={{
                background: 'linear-gradient(145deg, var(--bg-card), var(--bg-elevated))',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '20px',
              }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '16px' }}>
                  Período de análisis
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Desde</label>
                    <input type="date" value={fechaInicio} onChange={e => { setFechaInicio(e.target.value); setErrorReporte(null); }} className="input-base" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Hasta</label>
                    <input type="date" value={fechaFin} onChange={e => { setFechaFin(e.target.value); setErrorReporte(null); }} className="input-base" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Sede</label>
                    <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} className="select-base">
                      <option value="">Todas las sedes</option>
                      {sedes.map(s => <option key={s.id_sede} value={s.id_sede}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <button onClick={handleReporte} disabled={generando} className="btn-gold" style={{ alignSelf: 'flex-end' }}>
                    {generando ? 'Generando…' : 'Generar reporte'}
                  </button>
                </div>

                {errorReporte && (
                  <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(184,84,80,0.08)', border: '1px solid rgba(184,84,80,0.25)', borderRadius: '8px', color: 'var(--error)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚠</span> {errorReporte}
                  </div>
                )}
              </div>

              {/* Resultados */}
              {resumen && totalesReporte && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {/* Tarjetas de métricas */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                    {[
                      { label: 'Total ingresos',   value: `$${Number(totalesReporte.ingresos).toLocaleString('es-CO')}`,   gold: true,  sub: `${diffDias} día${diffDias !== 1 ? 's' : ''}` },
                      { label: 'Ticket promedio',  value: `$${Number(totalesReporte.ticketProm).toLocaleString('es-CO')}`,  sub: sedeLabel },
                      { label: 'Mesas atendidas',  value: totalesReporte.mesas,                                            sub: `${totalesReporte.items} ítems` },
                      { label: 'Ítems despachados', value: totalesReporte.items },
                      { label: 'Cancelaciones',    value: totalesReporte.cancelac, error: totalesReporte.cancelac > 0 },
                    ].map(({ label, value, gold, error, sub }) => (
                      <div key={label} style={{
                        background: gold
                          ? 'linear-gradient(145deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))'
                          : 'var(--bg-surface)',
                        border: `1px solid ${gold ? 'rgba(201,168,76,0.25)' : 'var(--border)'}`,
                        borderRadius: '12px',
                        padding: '18px 20px',
                        position: 'relative',
                        overflow: 'hidden',
                      }}>
                        {gold && (
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, var(--gold-muted), var(--gold), var(--gold-muted))' }} />
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>{label}</div>
                        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '700', color: gold ? 'var(--gold)' : error ? 'var(--error)' : 'var(--text-primary)', lineHeight: 1.1, marginBottom: sub ? '4px' : 0 }}>
                          {value}
                        </div>
                        {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Gráficas: top productos + comparación por sede */}
                  <div style={{ display: 'grid', gridTemplateColumns: resumen.length > 1 ? '1fr 1fr' : '1fr', gap: '16px' }}>
                    {topProductos.length > 0 && (
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                        <GraficaBarrasReporte
                          titulo="Top 5 productos más vendidos"
                          datos={topProductos.slice(0, 5).map(p => ({
                            label: p.nombre,
                            value: Number(p.total_vendido),
                            sub: `$${Number(p.ingresos).toLocaleString('es-CO')}`,
                          }))}
                          formatValue={v => `${v} und.`}
                        />
                      </div>
                    )}

                    {resumen.length > 1 && (
                      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
                        <GraficaBarrasReporte
                          titulo="Ingresos por sede"
                          datos={[...resumen]
                            .sort((a, b) => Number(b.total_ingresos) - Number(a.total_ingresos))
                            .map(r => ({
                              label: r.sede_nombre,
                              value: Number(r.total_ingresos),
                              sub: `${r.total_mesas_atendidas} mesas`,
                            }))}
                          formatValue={v => `$${Number(v).toLocaleString('es-CO')}`}
                        />
                      </div>
                    )}
                  </div>

                  {resumen.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      Sin datos para el período seleccionado.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ═══════════ TAB SEGURIDAD ═══════════ */}
        {tab === 'seguridad' && (() => {
          const jwtInfo = getJWTInfo();
          const now = Math.floor(Date.now() / 1000);
          const expiraPronto = jwtInfo && (jwtInfo.payload.exp - now) < 3600;
          const tokenValido  = jwtInfo && jwtInfo.payload.exp > now;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>Seguridad del Sistema</h2>
                <span className="badge badge-success">Sistema seguro</span>
              </div>

              {/* Sección A: bcrypt */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'var(--gold)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '2px' }}>Algoritmo Encriptación</p>
                    <h3 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Encriptación de contraseñas — bcrypt</h3>
                  </div>
                  <span className="badge badge-gold">bcryptjs · cost 10</span>
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                    bcrypt aplica una función de hashing adaptativa con <strong style={{ color: 'var(--text-primary)' }}>salt aleatorio</strong> y un factor de costo configurable.
                    Cada hash es único aunque la contraseña sea la misma.
                  </p>

                  <form onSubmit={handleHash} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label className={labelCls}>Simular hash de contraseña</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="text" value={hashTexto} onChange={e => setHashTexto(e.target.value)} placeholder="Escribe cualquier texto…" className="input-base" style={{ flex: 1 }} />
                        <button type="submit" disabled={hashLoading || !hashTexto.trim()} className="btn-gold">
                          {hashLoading ? 'Generando…' : 'Generar hash'}
                        </button>
                      </div>
                    </div>

                    {hashResult && (
                      <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Hash resultante</p>
                          <span className="badge badge-blue">{hashResult.tiempo_ms} ms</span>
                        </div>
                        <p style={{ color: 'var(--gold)', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all', lineHeight: 1.6 }}>{hashResult.hash}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                          El prefijo <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>$2a$10$</span> indica algoritmo bcrypt versión 2a con 10 rondas de salt.
                        </p>
                      </div>
                    )}
                  </form>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>Demostración de aleatoriedad del salt</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Genera el mismo texto dos veces y obtiene hashes distintos</p>
                      </div>
                      <button type="button" onClick={handleHashDual} disabled={hashDualLoad || !hashTexto.trim()} className="btn-ghost">
                        {hashDualLoad ? 'Generando…' : '× 2 Demostrar'}
                      </button>
                    </div>

                    {hashDual && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {hashDual.map((h, i) => (
                          <div key={i} style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '12px 16px' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Hash #{i + 1}</p>
                            <p style={{ color: 'var(--gold)', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{h}</p>
                          </div>
                        ))}
                        <p style={{ color: 'var(--success)', fontSize: '12px', textAlign: 'center', paddingTop: '4px', fontWeight: 600 }}>
                          ✓ Misma entrada, hashes completamente distintos — el salt garantiza unicidad
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sección B: JWT */}
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ color: 'var(--gold)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '2px' }}>Algoritmo Encriptación</p>
                    <h3 style={{ color: 'var(--text-primary)', fontWeight: 600 }}>JWT — Token de sesión activo</h3>
                  </div>
                  {jwtInfo && (
                    <span className={`badge ${!tokenValido ? 'badge-error' : expiraPronto ? 'badge-warning' : 'badge-success'}`}>
                      {!tokenValido ? 'Token expirado' : expiraPronto ? 'Próximo a expirar' : 'Token válido'}
                    </span>
                  )}
                </div>

                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {!jwtInfo ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No se encontró un token activo en esta sesión.</p>
                  ) : (
                    <>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                        El JWT está compuesto por <strong style={{ color: 'var(--text-primary)' }}>header.payload.firma</strong>.
                        El payload es visible (Base64) pero la firma es privada y no puede falsificarse sin la clave del servidor.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { label: 'Usuario', value: jwtInfo.payload.username },
                          { label: 'Nombre',  value: jwtInfo.payload.nombre   },
                          { label: 'Rol',     value: jwtInfo.payload.rol       },
                          { label: 'Sede',    value: jwtInfo.payload.sede_nombre ?? `ID ${jwtInfo.payload.id_sede}` },
                          { label: 'Emitido', value: new Date(jwtInfo.payload.iat * 1000).toLocaleString('es-CO') },
                          { label: 'Expira',  value: new Date(jwtInfo.payload.exp * 1000).toLocaleString('es-CO') },
                        ].map(({ label, value }) => (
                          <div key={label} style={{ background: 'var(--bg-elevated)', borderRadius: '6px', padding: '12px 16px' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>{label}</p>
                            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{value ?? '—'}</p>
                          </div>
                        ))}
                      </div>

                      <div style={{ background: 'var(--bg-elevated)', borderRadius: '8px', padding: '16px' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '8px' }}>
                          Token (header.payload — sin firma)
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all', lineHeight: 1.7 }}>
                          {jwtInfo.token.split('.').slice(0, 2).join('.')}
                          <span style={{ color: 'rgba(184,84,80,0.6)' }}>.{'<firma-privada>'}</span>
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '6px', padding: '12px 16px' }}>
                        <span style={{ color: 'var(--gold)', fontSize: '14px', marginTop: '1px' }}>⚠</span>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
                          El payload es legible por cualquiera con el token. <strong style={{ color: 'var(--text-primary)' }}>Nunca almacenar información sensible</strong> (contraseñas, números de tarjeta) en el payload JWT.
                          La seguridad proviene de que la firma no puede ser forjada sin la clave secreta del servidor.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </main>

      {/* ═══════════ MODAL: Nuevo usuario ═══════════ */}
      {modalNuevo && (
        <div className="modal-overlay" onClick={() => setModalNuevo(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '20px' }}>Nuevo usuario</h3>
            <form onSubmit={handleCrear} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className={labelCls}>Nombre completo</label>
                <input required value={formNuevo.nombre} onChange={e => setFormNuevo(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" className="input-base" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Username</label>
                  <input required value={formNuevo.username} onChange={e => setFormNuevo(p => ({ ...p, username: e.target.value }))} placeholder="cajero01.chap" className="input-base" />
                </div>
                <div>
                  <label className={labelCls}>Contraseña</label>
                  <input required type="password" value={formNuevo.password} onChange={e => setFormNuevo(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="input-base" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Correo <span style={{ textTransform: 'none', color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span></label>
                <input type="email" value={formNuevo.correo} onChange={e => setFormNuevo(p => ({ ...p, correo: e.target.value }))} placeholder="correo@ejemplo.com" className="input-base" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Rol</label>
                  <select required value={formNuevo.id_rol} onChange={e => setFormNuevo(p => ({ ...p, id_rol: e.target.value }))} className="select-base">
                    <option value="">Seleccionar…</option>
                    {roles.map(r => <option key={r.id_rol} value={r.id_rol}>{r.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Sede</label>
                  <select required value={formNuevo.id_sede} onChange={e => setFormNuevo(p => ({ ...p, id_sede: e.target.value }))} className="select-base">
                    <option value="">Seleccionar…</option>
                    {sedes.map(s => <option key={s.id_sede} value={s.id_sede}>{s.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                <button type="button" onClick={() => setModalNuevo(false)} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" disabled={enviando} className="btn-gold" style={{ flex: 1 }}>
                  {enviando ? 'Creando…' : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════ MODAL: Reset contraseña ═══════════ */}
      {modalReset && (
        <div className="modal-overlay" onClick={() => { setModalReset(null); setFormReset({ nueva: '', confirmar: '' }); }}>
          <div className="modal" style={{ maxWidth: '380px' }} onClick={e => e.stopPropagation()}>
            <h3 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700, marginBottom: '4px' }}>Reset contraseña</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
              {modalReset.nombre} · <span style={{ fontFamily: 'monospace' }}>{modalReset.username}</span>
            </p>
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className={labelCls}>Nueva contraseña</label>
                <input required type="password" value={formReset.nueva} onChange={e => setFormReset(p => ({ ...p, nueva: e.target.value }))} placeholder="••••••••" className="input-base" />
              </div>
              <div>
                <label className={labelCls}>Confirmar contraseña</label>
                <input required type="password" value={formReset.confirmar} onChange={e => setFormReset(p => ({ ...p, confirmar: e.target.value }))} placeholder="••••••••" className="input-base" />
              </div>
              <div style={{ display: 'flex', gap: '12px', paddingTop: '4px' }}>
                <button type="button" onClick={() => { setModalReset(null); setFormReset({ nueva: '', confirmar: '' }); }} className="btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-gold" style={{ flex: 1 }}>Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
