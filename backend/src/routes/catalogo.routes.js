const router = require('express').Router();
const { getCatalogo, getCategorias } = require('../controllers/catalogo.controller');
router.get('/categorias', getCategorias);
router.get('/:sedeId',    getCatalogo);
module.exports = router;