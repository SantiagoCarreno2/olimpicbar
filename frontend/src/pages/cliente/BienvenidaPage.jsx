import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sesionService } from '../../services/sesionService';

export default function BienvenidaPage() {
  const { qr_codigo } = useParams();
  const navigate = useNavigate();

  const [estado,     setEstado]     = useState('cargando');
  const [sesionData, setSesionData] = useState(null);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [nombre,     setNombre]     = useState('');
  const [loading,    setLoading]    = useState(false);
  const [inputError, setInputError] = useState('');

  const llamadaHecha = useRef(false);

  useEffect(() => {
    if (llamadaHecha.current) return;
    llamadaHecha.current = true;

    const iniciar = async () => {
      const info  = JSON.parse(localStorage.getItem('cliente_info') || '{}');
      const token = localStorage.getItem('cliente_token');
      if (token && info?.qr_codigo === qr_codigo && info?.id_sesion) {
        try {
          const { data } = await sesionService.verificarActiva(info.id_sesion);
          if (data.activa) { navigate(`/menu/${qr_codigo}`); return; }
        } catch {}
        localStorage.removeItem('cliente_token');
        localStorage.removeItem('cliente_info');
      }

      try {
        const { data } = await sesionService.iniciar(qr_codigo);
        setSesionData(data);
        setEstado('ok');
      } catch (err) {
        const status = err.response?.status;
        const msg    = err.response?.data?.error || 'Error de conexión';
        if (status === 409) { setEstado('ocupada'); setErrorMsg(msg); }
        else                { setEstado('error');   setErrorMsg(status === 404 ? 'QR inválido. Consulta con el personal.' : msg); }
      }
    };
    iniciar();
  }, [qr_codigo]);

  const handleIngresar = async (e) => {
    e.preventDefault();
    if (nombre.trim().length < 2) { setInputError('Mínimo 2 caracteres'); return; }
    setInputError('');
    setLoading(true);
    try {
      const { data } = await sesionService.registrarCliente(sesionData.id_sesion, nombre.trim());
      localStorage.setItem('cliente_token', data.token_cliente);
      localStorage.setItem('cliente_info', JSON.stringify({
        ...data.cliente,
        id_sesion:   data.sesion.id_sesion,
        numero:      data.mesa.numero,
        sede_nombre: data.mesa.sede_nombre,
        id_sede:     data.mesa.id_sede,
        qr_codigo,
      }));
      navigate(`/menu/${qr_codigo}`);
    } catch (err) {
      setInputError(err.response?.data?.error || 'Error al ingresar');
    } finally {
      setLoading(false);
    }
  };

  const pageBase = { minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' };

  if (estado === 'cargando') {
    return (
      <div style={pageBase}>
        <div style={{ width: '32px', height: '32px', border: '2px solid var(--gold-muted)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div style={{ ...pageBase, flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
        <span style={{ fontSize: '40px' }}>⚠</span>
        <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px' }}>QR no válido</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '280px' }}>{errorMsg}</p>
      </div>
    );
  }

  if (estado === 'ocupada') {
    return (
      <div style={{ ...pageBase, flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
        <span style={{ fontSize: '40px' }}>🔒</span>
        <h2 className="font-display" style={{ color: 'var(--text-primary)', fontSize: '22px' }}>Mesa en uso</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '280px', lineHeight: 1.6 }}>
          Esta mesa ya está en uso.<br />
          ¿Eres acompañante? Solicita el enlace al Dueño de Mesa.
        </p>
      </div>
    );
  }

  const { mesa } = sesionData;
  return (
    <div style={{ ...pageBase, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="fade-in" style={{ width: '100%', maxWidth: '340px', position: 'relative' }}>
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="font-display" style={{ color: 'var(--gold)', fontSize: '36px', fontWeight: 700, lineHeight: 1.1 }}>
            OlimpicBar
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
            {mesa.sede_nombre}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', letterSpacing: '0.05em' }}>
            Mesa <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{mesa.numero}</span>
          </p>
        </div>

        <div className="gold-divider" />

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.25rem' }}>
            Bienvenido — ¿Cómo te llamamos?
          </p>
          <form onSubmit={handleIngresar} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                maxLength={30}
                required
                className="input-base"
              />
              {inputError && <p style={{ color: '#E07874', fontSize: '12px', marginTop: '6px' }}>{inputError}</p>}
            </div>
            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
              {loading ? 'Ingresando…' : 'Ver el menú →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
