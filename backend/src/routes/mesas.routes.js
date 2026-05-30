const router = require('express').Router();
const { ocuparMesa, getMesa, getMesaByToken } = require('../controllers/mesas.controller');
router.get('/token/:token', getMesaByToken);
router.get('/:mesaId', getMesa);
router.put('/:mesaId/ocupar', ocuparMesa);
module.exports = router;