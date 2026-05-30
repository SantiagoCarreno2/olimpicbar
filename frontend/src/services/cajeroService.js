import api from './api';

export const cajeroService = {
  getCuentas:    ()                        => api.get('/cajero/cuentas'),
  getDesglose:   (id_sesion)               => api.get(`/cajero/sesion/${id_sesion}/desglose`),
  cobrar:        (data)                    => api.post('/cajero/cobro', data),
  getInventario: ()                        => api.get('/cajero/inventario'),
  restock:       (id_producto, cantidad)   => api.post('/cajero/restock', { id_producto, cantidad }),
  cerrarJornada:    ()                      => api.post('/cajero/cierre-jornada'),
  getPreviewCierre: ()                      => api.get('/cajero/preview-cierre'),
};
