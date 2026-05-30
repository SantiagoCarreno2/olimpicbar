const router = require('express').Router();
const { verificarTokenCliente } = require('../middleware/clienteAuth.middleware');
const ctrl = require('../controllers/pedido.controller');

router.use(verificarTokenCliente);
router.post('/',             ctrl.crearPedido);
router.get('/mis-pedidos',   ctrl.getMisPedidos);

module.exports = router;
