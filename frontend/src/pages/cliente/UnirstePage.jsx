import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sesionService } from '../../services/sesionService';

export default function UnirstePage() {
  const { token_invitacion } = useParams();
  const navigate = useNavigate();

  const [estado,   setEstado]   = useState('cargando');
  const [infoMesa, setInfoMesa] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [nombre,   setNombre]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const [inputErr, setInputErr] = useState('');

  useEffect(() => {
    sesionService.unirse(token_invitacion)
      .then(({ data }) => { setInfoMesa(data); setEstado('ok'); })
      .catch(err => {
        setEstado('error');
        setErrorMsg(err.response?.data?.error || 'Este enlace ya no es válido. Solicita uno nuevo al Dueño de Mesa.');
      });
  }, [token_invitacion]);

  const handleUnirse = async (e) => {
    e.preventDefault();
    if (nombre.trim().length < 2) { setInputErr('Mínimo 2 caracteres'); return; }
    setInputErr('');
    setLoading(true);
    try {
      const { data } = await sesionService.registrarCliente(
        infoMesa.id_sesion,
        nombre.trim(),
        token_invitacion,
      );
      const qr_codigo = data.mesa.qr_codigo;
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
      setInputErr(err.response?.data?.error || 'Error al unirse');
    } finally {
      setLoading(false);
    }
  };

  if (estado === 'cargando') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center', gap: 16 }}>
        <span style={{ fontSize: 48 }}>🔗</span>
        <h2 style={{ color: 'var(--text)', fontWeight: 600, fontSize: 18, margin: 0 }}>Enlace inválido</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, maxWidth: 280 }}>{errorMsg}</p>
      </div>
    );
  }

  const { mesa } = infoMesa;
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ width: 384, height: 384, background: 'var(--gold)', opacity: 0.05, borderRadius: '50%', filter: 'blur(80px)' }} />
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 384 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, marginBottom: 16 }}>
            <span style={{ color: 'var(--gold)', fontSize: 22, fontWeight: 700 }}>OB</span>
          </div>
          <h1 className="font-display" style={{ color: 'var(--text)', fontSize: 28, fontWeight: 700, margin: 0 }}>OlimpicBar</h1>
          <p style={{ color: 'var(--gold)', fontSize: 14, marginTop: 4, fontWeight: 500 }}>
            Uniéndote a Mesa {mesa.numero} · {mesa.sede_nombre}
          </p>
        </div>

        <div className="card" style={{ padding: 32 }}>
          <form onSubmit={handleUnirse} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                ¿Cómo te llamamos?
              </label>
              <input
                className="input-base"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tu nombre"
                maxLength={30}
                required
                style={{ width: '100%' }}
              />
              {inputErr && <p style={{ color: 'var(--error, #ef4444)', fontSize: 12, marginTop: 4, margin: '4px 0 0' }}>{inputErr}</p>}
            </div>

            <button
              type="submit"
              className="btn-gold"
              disabled={loading}
              style={{ width: '100%', padding: '12px' }}
            >
              {loading ? 'Uniéndome...' : 'Unirme a la mesa'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
