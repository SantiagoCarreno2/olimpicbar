import { useEffect } from 'react';

export default function SesionTerminadaPage() {
  useEffect(() => {
    localStorage.removeItem('cliente_token');
    localStorage.removeItem('cliente_info');
  }, []);

  return (
    <div style={{ background: '#0D0D0D', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: '2rem' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>¡Gracias por tu visita!</h1>
      <p style={{ color: '#999', fontSize: '1rem' }}>Tu sesión ha terminado. Esperamos verte pronto en OlimpicBar.</p>
    </div>
  );
}
