import api from './api';

export const meseroService = {
  getMesas:      ()                    => api.get('/mesero/mesas'),
  getItems:      (id_sesion)           => api.get(`/mesero/sesion/${id_sesion}/items`),
  cambiarEstado: (id_detalle, estado)  => api.patch(`/mesero/items/${id_detalle}/estado`, { estado }),
  cerrarMesa:    (id_sesion)           => api.post(`/mesero/sesion/${id_sesion}/cerrar`),
};
