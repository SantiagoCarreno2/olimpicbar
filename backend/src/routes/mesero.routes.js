const router = require('express').Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/mesero.controller');

router.use(verificarToken);
router.use(verificarRol('Mesero', 'Administrador'));

router.get('/mesas',                       ctrl.getMesasSede);
router.get('/sesion/:id_sesion/items',     ctrl.getPedidosMesa);
router.patch('/items/:id_detalle/estado',  ctrl.cambiarEstadoItem);
router.post('/sesion/:id_sesion/cerrar',   ctrl.cerrarMesa);

module.exports = router;
