const router = require('express').Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/export.controller');

router.use(verificarToken);
router.use(verificarRol('Administrador', 'Cajero'));

router.get('/reporte/excel', ctrl.exportarExcel);
router.get('/reporte/pdf',   ctrl.exportarPDF);
router.post('/cierre/excel', ctrl.exportarCierreExcel);

module.exports = router;
