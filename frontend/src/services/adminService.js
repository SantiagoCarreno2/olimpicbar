import api from './api';

export const adminService = {
  getDashboard:   ()                          => api.get('/admin/dashboard'),
  getReporte:     (params)                    => api.get('/admin/reporte', { params }),
  getUsuarios:    ()                          => api.get('/admin/usuarios'),
  crearUsuario:   (data)                      => api.post('/admin/usuarios', data),
  toggleUsuario:  (id)                        => api.patch(`/admin/usuarios/${id}/toggle`),
  resetPassword:  (id, nueva_password)        => api.patch(`/admin/usuarios/${id}/reset-password`, { nueva_password }),
  getSedes:       ()                          => api.get('/admin/sedes'),
  getRoles:       ()                          => api.get('/admin/roles'),
  exportarExcel:  (params)                    => api.get('/export/reporte/excel', { params, responseType: 'blob' }),
  exportarPDF:    (params)                    => api.get('/export/reporte/pdf',   { params, responseType: 'blob' }),
};
