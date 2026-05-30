import api from './api';

const clienteToken   = () => localStorage.getItem('cliente_token');
const clienteHeaders = () => ({ 'x-cliente-token': clienteToken() });

export const sesionService = {
  iniciar:          (qr_codigo)                           => api.get(`/sesion/qr/${qr_codigo}`),
  registrarCliente: (id_sesion, nombre_visible, token_invitacion = null) =>
    api.post(`/sesion/${id_sesion}/cliente`, { nombre_visible, token_invitacion }),
  generarEnlace:    ()                                    => api.post('/sesion/invitacion', {}, { headers: clienteHeaders() }),
  unirse:           (token)                               => api.get(`/sesion/unirse/${token}`),
  verificarActiva:  (id_sesion)                           => api.get(`/sesion/${id_sesion}/verificar`),
};

export const pedidoService = {
  confirmar:   (items)  => api.post('/pedido',              { items },  { headers: clienteHeaders() }),
  misPedidos:  ()       => api.get('/pedido/mis-pedidos',               { headers: clienteHeaders() }),
};

export const qrService = {
  getMesas:   (sede_id) => api.get(`/qr/mesas${sede_id ? `?sede_id=${sede_id}` : ''}`),
  generarQR:  (id_mesa) => api.post(`/qr/mesas/${id_mesa}/generar`),
};
