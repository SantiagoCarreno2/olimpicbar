const jwt = require('jsonwebtoken');

const verificarTokenCliente = (req, res, next) => {
  const header = req.headers['x-cliente-token'];
  if (!header) return res.status(401).json({ error: 'Token de cliente requerido' });
  try {
    req.cliente = jwt.verify(header, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token de cliente inválido o expirado' });
  }
};

module.exports = { verificarTokenCliente };
