import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { qrService } from '../../services/sesionService';

function QRModal({ data, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, margin: 0 }}>QR Generado</p>
            <h3 className="font-display" style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: 0 }}>
              Mesa {data.mesa.numero}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Imagen QR — fondo blanco para legibilidad */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
          <img src={data.qr_imagen} alt="QR Code" style={{ width: 192, height: 192 }} />
        </div>

        {/* Código */}
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 16px', marginBottom: 12, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>Código</p>
          <p style={{ color: 'var(--gold)', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, margin: 0 }}>{data.qr_codigo}</p>
        </div>

        {/* Badge intentos */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className={`badge ${data.intentos > 1 ? 'badge-warning' : 'badge-success'}`}>
            {data.intentos > 1
              ? `${data.intentos} intentos — colisiones detectadas`
              : '1 intento — Algoritmo Backtracking'}
          </span>
          {data.intentos > 1 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '6px 0 0' }}>
              Se detectaron colisiones y se regeneró automáticamente
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <a href={data.qr_imagen} download={`qr-mesa-${data.mesa.numero}.png`}
            className="btn-gold" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}>
            Descargar PNG
          </a>
          <button onClick={onClose} className="btn-ghost" style={{ flex: 1 }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function QRPage() {
  const [mesas,     setMesas]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [generando, setGenerando] = useState(null);

  useEffect(() => {
    qrService.getMesas()
      .then(({ data }) => setMesas(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGenerar = async (id_mesa) => {
    setGenerando(id_mesa);
    try {
      const { data } = await qrService.generarQR(id_mesa);
      setModal(data);
      setMesas(prev => prev.map(m =>
        m.id_mesa === id_mesa
          ? { ...m, qr_codigo: data.qr_codigo, qr_activo: 1 }
          : m
      ));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al generar QR');
    } finally {
      setGenerando(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header className="panel-header">
        <div style={{ maxWidth: 896, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600, margin: 0 }}>Administración</p>
            <h1 className="font-display" style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, margin: 0 }}>Gestión de QR</h1>
          </div>
          <Link to="/dashboard" className="btn-ghost" style={{ fontSize: 13 }}>← Volver</Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: 896, width: '100%', margin: '0 auto', padding: '1.5rem' }}>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 144 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {mesas.map(mesa => {
              const ocupada = mesa.estado === 'Ocupada';
              const busy    = generando === mesa.id_mesa;

              return (
                <div key={mesa.id_mesa}
                  className={ocupada ? 'card-occupied' : 'card'}
                  style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <span className="font-display" style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {mesa.numero}
                    </span>
                    {ocupada
                      ? <span className="badge badge-warning">EN USO</span>
                      : mesa.qr_activo
                        ? <span className="badge badge-gold">QR ACTIVO</span>
                        : <span className="badge badge-muted">SIN QR</span>
                    }
                  </div>

                  {ocupada ? (
                    <button disabled className="btn-ghost"
                      style={{ width: '100%', fontSize: 12, opacity: 0.35, cursor: 'not-allowed', fontFamily: 'inherit' }}>
                      Mesa en uso
                    </button>
                  ) : mesa.qr_activo ? (
                    <button onClick={() => handleGenerar(mesa.id_mesa)} disabled={busy}
                      className="btn-ghost"
                      style={{ width: '100%', fontSize: 12, fontFamily: 'inherit' }}>
                      {busy ? 'Generando…' : 'Regenerar'}
                    </button>
                  ) : (
                    <button onClick={() => handleGenerar(mesa.id_mesa)} disabled={busy}
                      className="btn-outline"
                      style={{ width: '100%', fontSize: 12, fontFamily: 'inherit' }}>
                      {busy ? 'Generando…' : 'Generar QR'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {modal && <QRModal data={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
