const router = require('express').Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/qr.controller');

router.use(verificarToken);
router.get('/mesas',                    ctrl.getMesasConQR);
router.post('/mesas/:id_mesa/generar',  verificarRol('Administrador'), ctrl.generarQR);

module.exports = router;
