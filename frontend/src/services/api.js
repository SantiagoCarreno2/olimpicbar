import axios from 'axios';

const api = axios.create({
  baseURL: 'http://192.168.1.12:4000/api',
});

// Interceptor para meter el Token en cada petición automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('basemod_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
};

export const catalogoService = {
  get:           (sedeId) => api.get(`/catalogo/${sedeId}`),
  getCategorias: ()       => api.get('/catalogo/categorias'),
};

export const mesasService = {
  getByToken: (token) => api.get(`/mesas/token/${token}`),
  ocupar:     (id)    => api.put(`/mesas/${id}/ocupar`),
  liberar:    (id)    => api.put(`/mesas/${id}/liberar`),
};

export default api;