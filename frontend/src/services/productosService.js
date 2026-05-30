import api from './api';

export const productosService = {
  getAll:     ()        => api.get('/productos'),
  getCategorias: ()     => api.get('/catalogo/categorias'),
  crear:      (data)    => api.post('/productos', data),
  actualizar: (id, data)=> api.put(`/productos/${id}`, data),
  toggleVisible: (id)   => api.patch(`/productos/${id}/toggle`),
  eliminar:   (id)      => api.delete(`/productos/${id}`),

  getInventario: ()     => api.get('/productos/inventario'),
  actualizarInventario: (id, data) => api.put(`/productos/inventario/${id}`, data),

  importarExcel: (archivo) => {
    const form = new FormData();
    form.append('archivo', archivo);
    return api.post('/productos/inventario/importar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  descargarPlantilla: () =>
    api.get('/productos/inventario/plantilla', { responseType: 'blob' }),
};
