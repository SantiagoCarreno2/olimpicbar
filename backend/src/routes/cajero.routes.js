const router = require('express').Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/cajero.controller');

router.use(verificarToken);
router.use(verificarRol('Cajero', 'Administrador'));

router.get('/cuentas',                    ctrl.getCuentasAbiertas);
router.get('/sesion/:id_sesion/desglose', ctrl.getDesgloseMesa);
router.post('/cobro',                     ctrl.procesarCobro);
router.get('/inventario',                 ctrl.getProductosInventario);
router.post('/restock',                   ctrl.restock);
router.get('/preview-cierre',             ctrl.getPreviewCierre);
router.post('/cierre-jornada',            ctrl.cerrarJornada);

module.exports = router;
