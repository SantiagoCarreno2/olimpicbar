const router = require('express').Router();
const { verificarTokenCliente } = require('../middleware/clienteAuth.middleware');
const ctrl = require('../controllers/sesion.controller');

router.get('/qr/:qr_codigo',                ctrl.iniciarSesion);
router.post('/:id_sesion/cliente',          ctrl.registrarCliente);
router.post('/invitacion',                  verificarTokenCliente, ctrl.generarEnlaceInvitacion);
router.get('/unirse/:token_invitacion',     ctrl.unirseConEnlace);
router.get('/:id_sesion/verificar',        ctrl.verificarSesionActiva);

module.exports = router;
