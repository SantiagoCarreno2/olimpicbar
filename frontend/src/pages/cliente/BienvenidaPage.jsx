import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sesionService } from '../../services/sesionService';

const parseQR = (codigo) => {
  if (!codigo) return { sede: '...', mesa: '...', idCorto: '...' };
  const partes = codigo.split('-');
  const sedeMap = { CHAP: 'Chapinero', USAQ: 'Usaquén', ZROS: 'Zona Rosa' };
  return {
    sede:    sedeMap[partes[1]] || partes[1] || '...',
    mesa:    partes[2]?.replace('M', '') || '...',
    idCorto: partes[3]?.toLowerCase() || '...',
  };
};

const horaActual = () =>
  new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

export default function BienvenidaPage() {
  const { qr_codigo } = useParams();
  const navigate      = useNavigate();

  const [fase,            setFase]            = useState('verificando');
  const [progreso,        setProgreso]        = useState(0);
  const [sesionData,      setSesionData]      = useState(null);
  const [errorMsg,        setErrorMsg]        = useState('');
  const [mostrarCard,     setMostrarCard]     = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nombre,          setNombre]          = useState('');
  const [errorNombre,     setErrorNombre]     = useState('');
  const [loadingNombre,   setLoadingNombre]   = useState(false);
  const llamadaHecha = useRef(false);

  const qrInfo = parseQR(qr_codigo);

  useEffect(() => {
    if (llamadaHecha.current) return;
    llamadaHecha.current = true;

    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgreso(Math.min(p, 90));
      if (p >= 40) setMostrarCard(true);
      if (p >= 90) clearInterval(interval);
    }, 30);

    sesionService.iniciar(qr_codigo)
      .then(({ data }) => {
        clearInterval(interval);
        setProgreso(100);
        setSesionData(data);
        setTimeout(() => setFase('activa'), 500);
      })
      .catch(err => {
        clearInterval(interval);
        setProgreso(100);
        const status = err.response?.status;
        if (status === 409) setErrorMsg('Esta mesa ya está en uso. Solicita el enlace al Dueño de Mesa.');
        else                setErrorMsg('Este código QR no es válido. Consulta con el personal.');
        setTimeout(() => setFase('error'), 500);
      });

    return () => clearInterval(interval);
  }, [qr_codigo]);

  const handleRegistrar = async () => {
    const limpio = nombre.trim();
    if (limpio.length < 2)  { setErrorNombre('El nombre debe tener al menos 2 caracteres.'); return; }
    if (limpio.length > 30) { setErrorNombre('El nombre no puede superar 30 caracteres.');   return; }
    setErrorNombre('');
    setLoadingNombre(true);
    try {
      const { data } = await sesionService.registrarCliente(sesionData.id_sesion, limpio);
      localStorage.setItem('cliente_token', data.token_cliente);
      localStorage.setItem('cliente_info', JSON.stringify({
        ...data.cliente,
        id_sesion:   data.sesion?.id_sesion   ?? sesionData.id_sesion,
        numero:      data.mesa?.numero        ?? sesionData.mesa?.numero,
        sede_nombre: data.mesa?.sede_nombre   ?? sesionData.mesa?.sede_nombre,
        id_sede:     data.mesa?.id_sede       ?? sesionData.mesa?.id_sede,
        qr_codigo,
      }));
      navigate(`/menu/${qr_codigo}`);
    } catch (err) {
      setErrorNombre(err.response?.data?.error || 'Error al registrar. Intenta de nuevo.');
    } finally {
      setLoadingNombre(false);
    }
  };

  /* ── Colores de badge por fase ─────────────────────────────── */
  const badgeStyle = {
    verificando: { bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.35)',  color: 'var(--gold)',    label: 'VERIFICANDO' },
    activa:      { bg: 'rgba(74,155,111,0.12)',  border: 'rgba(74,155,111,0.35)',  color: 'var(--success)', label: 'SESIÓN ACTIVA' },
    error:       { bg: 'rgba(184,84,80,0.12)',   border: 'rgba(184,84,80,0.35)',   color: 'var(--error)',   label: 'ERROR' },
  }[fase] ?? {};

  const page = {
    minHeight: '100dvh',
    background: 'var(--bg-base)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.25rem',
    position: 'relative',
    overflow: 'hidden',
  };

  const mesaLabel = sesionData?.mesa?.numero    ?? qrInfo.mesa;
  const sedeLabel = sesionData?.mesa?.sede_nombre ?? qrInfo.sede;

  return (
    <div style={page}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '480px', height: '480px',
        background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Badge de estado */}
      <div style={{
        position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 14px',
        borderRadius: '999px',
        background: badgeStyle.bg,
        border: `1px solid ${badgeStyle.border}`,
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: badgeStyle.color,
          boxShadow: `0 0 6px ${badgeStyle.color}`,
          animation: fase === 'verificando' ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: badgeStyle.color }}>
          {badgeStyle.label}
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: '360px', position: 'relative', zIndex: 1 }}>

        {/* ══ FASE: VERIFICANDO ══════════════════════════════════ */}
        {fase === 'verificando' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '28px' }}>

            {/* Ícono QR con pulso */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                position: 'absolute',
                width: '100px', height: '100px', borderRadius: '50%',
                background: 'rgba(201,168,76,0.08)',
                animation: 'pulse 1.4s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute',
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'rgba(201,168,76,0.12)',
                animation: 'pulse 1.4s ease-in-out infinite 0.2s',
              }} />
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'var(--bg-card)',
                border: '2px solid var(--gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
                position: 'relative', zIndex: 1,
              }}>
                ▦
              </div>
            </div>

            {/* Texto */}
            <div style={{ textAlign: 'center' }}>
              <h1 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '26px', fontWeight: 700, lineHeight: 1.2 }}>
                Validando sesión…
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                Mesa <span style={{ color: 'var(--gold)' }}>{mesaLabel}</span>
                {' · '}
                <span style={{ color: 'var(--text-secondary)' }}>{sedeLabel}</span>
              </p>
            </div>

            {/* Barra de progreso */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                width: '100%', height: '4px',
                background: 'var(--bg-elevated)',
                borderRadius: '999px', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progreso}%`,
                  background: 'linear-gradient(90deg, var(--gold-muted), var(--gold))',
                  borderRadius: '999px',
                  transition: 'width 0.1s linear',
                  boxShadow: '0 0 8px rgba(201,168,76,0.5)',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                  AUTENTICANDO QR
                </span>
                <span style={{ fontSize: '10px', color: 'var(--gold)', fontWeight: 600 }}>
                  {progreso}%
                </span>
              </div>
            </div>

            {/* Card de datos de sesión */}
            {mostrarCard && (
              <div style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-gold)',
                borderRadius: '10px',
                overflow: 'hidden',
                animation: 'slideUp 0.35s ease-out',
              }}>
                <div style={{
                  padding: '8px 14px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--gold)' }}>
                    DATOS DE SESIÓN
                  </span>
                </div>
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'ID Sesión',    value: `sess_${qrInfo.idCorto}` },
                    { label: 'Mesa',         value: `${mesaLabel} — ${sedeLabel}` },
                    { label: 'Hora inicio',  value: horaActual() },
                    { label: 'Rol asignado', value: '👑 Dueño' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                        {label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, textAlign: 'right', fontFamily: 'monospace' }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ FASE: ACTIVA — confirmación ════════════════════════ */}
        {fase === 'activa' && !mostrarFormulario && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px',
            animation: 'bounceIn 0.5s cubic-bezier(0.36,0.07,0.19,0.97)',
          }}>
            {/* Check verde */}
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(74,155,111,0.12)',
              border: '2px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', color: 'var(--success)',
              boxShadow: '0 0 24px rgba(74,155,111,0.2)',
            }}>
              ✓
            </div>

            <div style={{ textAlign: 'center' }}>
              <h1 className="font-display" style={{ color: 'var(--success)', fontSize: '28px', fontWeight: 700 }}>
                ¡Sesión activa!
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                Mesa <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {sesionData?.mesa?.numero}
                </span>
                {' · '}
                {sesionData?.mesa?.sede_nombre}
              </p>
            </div>

            <div className="gold-divider" style={{ width: '100%' }} />

            <button
              className="btn-gold"
              onClick={() => setMostrarFormulario(true)}
              style={{ width: '100%', padding: '14px', fontSize: '14px' }}
            >
              Ver el Menú →
            </button>
          </div>
        )}

        {/* ══ FASE: ACTIVA — formulario de nombre ════════════════ */}
        {fase === 'activa' && mostrarFormulario && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0',
            animation: 'slideUp 0.3s ease-out',
          }}>
            {/* Branding */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h1 className="font-display" style={{ color: 'var(--gold)', fontSize: '36px', fontWeight: 700, lineHeight: 1.1 }}>
                OlimpicBar
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
                {sesionData?.mesa?.sede_nombre}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', letterSpacing: '0.05em' }}>
                Mesa <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{sesionData?.mesa?.numero}</span>
              </p>
            </div>

            <div className="gold-divider" />

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '2rem',
            }}>
              <p style={{
                color: 'var(--text-secondary)', fontSize: '12px',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: '1.25rem',
              }}>
                ¿Cómo te llamamos?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <input
                    type="text"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !loadingNombre && handleRegistrar()}
                    placeholder="Tu nombre"
                    maxLength={30}
                    autoFocus
                    className="input-base"
                  />
                  {errorNombre && (
                    <p style={{ color: 'var(--error)', fontSize: '12px', marginTop: '6px' }}>
                      {errorNombre}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRegistrar}
                  disabled={loadingNombre}
                  className="btn-gold"
                  style={{ width: '100%', padding: '12px', fontSize: '14px' }}
                >
                  {loadingNombre ? 'Ingresando…' : 'Ingresar al menú'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ FASE: ERROR ════════════════════════════════════════ */}
        {fase === 'error' && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', textAlign: 'center',
            animation: 'slideUp 0.35s ease-out',
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'rgba(184,84,80,0.12)',
              border: '2px solid var(--error)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '28px', color: 'var(--error)',
            }}>
              ✕
            </div>
            <div>
              <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 700 }}>
                {errorMsg.includes('uso') ? 'Mesa en uso' : 'QR no válido'}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', maxWidth: '280px', lineHeight: 1.6 }}>
                {errorMsg}
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0%   { opacity: 0; transform: scale(0.7); }
          60%  { opacity: 1; transform: scale(1.06); }
          80%  { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
