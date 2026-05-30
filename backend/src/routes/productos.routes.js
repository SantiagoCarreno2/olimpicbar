const router  = require('express').Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const multer   = require('multer');
const upload   = multer({ storage: multer.memoryStorage() });
const ctrl     = require('../controllers/productos.controller');

router.use(verificarToken);
router.use(verificarRol('Administrador'));

/* Static paths must come before parameterized ones */
router.get('/',                          ctrl.getProductos);
router.post('/',                         ctrl.crearProducto);

router.get('/inventario',                ctrl.getInventarioAdmin);
router.get('/inventario/plantilla',      ctrl.generarPlantilla);
router.put('/inventario/:id_inventario', ctrl.actualizarInventario);
router.post('/inventario/importar',      upload.single('archivo'), ctrl.importarInventarioExcel);

router.put('/:id_producto',              ctrl.actualizarProducto);
router.patch('/:id_producto/toggle',     ctrl.toggleVisible);
router.delete('/:id_producto',           ctrl.eliminarProducto);

module.exports = router;
