const router = require('express').Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/admin.controller');

router.use(verificarToken);
router.use(verificarRol('Administrador'));

router.get('/dashboard',                      ctrl.getDashboard);
router.get('/reporte',                        ctrl.getReporte);
router.get('/usuarios',                       ctrl.getUsuarios);
router.post('/usuarios',                      ctrl.crearUsuario);
router.patch('/usuarios/:id/toggle',          ctrl.toggleUsuario);
router.patch('/usuarios/:id/reset-password',  ctrl.resetPassword);
router.get('/sedes',                          ctrl.getSedes);
router.get('/roles',                          ctrl.getRoles);

/* ── Demo bcrypt (Algoritmo Encriptación) ── */
router.post('/demo-hash', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ error: 'Texto requerido' });
  try {
    const inicio = Date.now();
    const hash   = await bcrypt.hash(texto, 10);
    const tiempo = Date.now() - inicio;
    res.json({ hash, tiempo_ms: tiempo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
