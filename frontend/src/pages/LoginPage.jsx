import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';
import { useAuth } from '../context/AuthContext';

const ROLE_ROUTES = {
  Administrador: '/dashboard',
  Mesero:        '/mesero',
  Cajero:        '/cajero',
};

export default function LoginPage() {
  const [identifier,      setIdentifier]      = useState('');
  const [password,        setPassword]        = useState('');
  const [error,           setError]           = useState('');
  const [loading,         setLoading]         = useState(false);
  const [rolSeleccionado, setRolSeleccionado] = useState('Mesero');
  const [showPassword,    setShowPassword]    = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);

  const navigate  = useNavigate();
  const location  = useLocation();
  const { login } = useAuth();

  const sessionExpired = new URLSearchParams(location.search).get('expired') === '1';

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await authService.login(identifier, password);
      login(data.usuario, data.token);
      setIntentosFallidos(0);
      const destino = ROLE_ROUTES[data.usuario.rol] || '/dashboard';
      navigate(destino);
    } catch (err) {
      setIntentosFallidos(prev => prev + 1);
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const isMobile = window.innerWidth <= 768;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr',
        gap: '0',
        width: '100%',
        maxWidth: '900px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>

        {/* ── Columna izquierda — formulario ── */}
        <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Logo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--gold-muted), var(--gold))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(201,168,76,0.3)',
            }}>
              <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '28px', fontWeight: '700', color: '#0A0A0A' }}>OB</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)' }}>OlimpicBar</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Panel de operaciones</div>
            </div>
          </div>

          {/* Selector de rol */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>TU ROL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {[
                { rol: 'Mesero', icon: '👤', desc: 'Mesas y pedidos' },
                { rol: 'Cajero', icon: '💳', desc: 'Cobros e inventario' },
                { rol: 'Admin',  icon: '⚙️', desc: 'Control total' },
              ].map(({ rol, icon, desc }) => (
                <button
                  key={rol}
                  onClick={() => setRolSeleccionado(rol)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: `1px solid ${rolSeleccionado === rol ? 'var(--gold)' : 'var(--border)'}`,
                    background: rolSeleccionado === rol ? 'rgba(201,168,76,0.1)' : 'var(--bg-elevated)',
                    color: rolSeleccionado === rol ? 'var(--gold)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>{icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600' }}>{rol}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Campos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Usuario</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px' }}>👤</span>
                <input
                  className="input-base"
                  style={{ paddingLeft: '36px' }}
                  placeholder={
                    rolSeleccionado === 'Mesero' ? 'mesero01.chapinero' :
                    rolSeleccionado === 'Cajero' ? 'cajero01.chapinero' :
                    'admin01.chapinero'
                  }
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px' }}>🔒</span>
                <input
                  className="input-base"
                  type={showPassword ? 'text' : 'password'}
                  style={{ paddingLeft: '36px', paddingRight: '40px' }}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
                <button
                  onClick={() => setShowPassword(p => !p)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px' }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>

          {/* Indicador de intentos */}
          {intentosFallidos > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: i <= intentosFallidos ? 'var(--error)' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {intentosFallidos} / 5 intentos · Bloqueo en {5 - intentosFallidos}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(184,84,80,0.1)', border: '1px solid rgba(184,84,80,0.3)',
              color: 'var(--error)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Botón */}
          <button
            className="btn-gold"
            onClick={handleLogin}
            disabled={loading}
            style={{ width: '100%', padding: '14px', fontSize: '14px', borderRadius: '10px' }}
          >
            {loading ? 'Verificando...' : 'Ingresar al panel'}
          </button>

          {/* Footer */}
          <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
            BaseMod Software © 2026
          </div>
        </div>

        {/* ── Columna derecha — panel informativo (solo desktop) ── */}
        {!isMobile && (
          <div style={{
            background: 'linear-gradient(145deg, #141414, #0A0A0A)',
            borderLeft: '1px solid var(--border)',
            padding: '3rem 2rem',
            display: 'flex', flexDirection: 'column', gap: '1.5rem',
          }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--gold)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '8px' }}>SERÁS REDIRIGIDO A:</div>
            </div>

            {[
              { rol: 'Mesero', icon: '🍽️', color: '#C9A84C', titulo: 'Panel Mesero',         subtitulo: 'Rol seleccionado',          desc: 'Pedidos en tiempo real, cambio de estados e historial de tu turno.' },
              { rol: 'Cajero', icon: '💳', color: '#4A9B6F', titulo: 'Panel Cajero',         subtitulo: 'Cobros e inventario',        desc: 'Cuentas abiertas, cobros y re-stock de emergencia.' },
              { rol: 'Admin',  icon: '⚙️', color: '#7B68EE', titulo: 'Panel Administrador', subtitulo: 'Control total multi-sede',   desc: 'Reportes, inventario, empleados y configuración de sedes.' },
            ].map(({ rol, icon, color, titulo, subtitulo, desc }) => (
              <div key={rol} style={{
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${rolSeleccionado === rol ? color + '40' : 'var(--border)'}`,
                background: rolSeleccionado === rol ? color + '12' : 'var(--bg-card)',
                transition: 'all 0.3s',
                opacity: rolSeleccionado === rol ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: color + '20', border: `1px solid ${color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                    flexShrink: 0,
                  }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: rolSeleccionado === rol ? 'var(--text-primary)' : 'var(--text-muted)' }}>{titulo}</div>
                    <div style={{ fontSize: '11px', color: rolSeleccionado === rol ? color : 'var(--text-muted)' }}>{subtitulo}</div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}

            {/* Aviso de sesión expirada */}
            {sessionExpired && (
              <div style={{
                padding: '12px 14px', borderRadius: '8px',
                background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)',
                marginTop: 'auto',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: '600', marginBottom: '4px' }}>Tu sesión ha expirado.</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>Inicia sesión nuevamente para continuar. Las sesiones expiran tras 8 horas de inactividad.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
