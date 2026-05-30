const jwt = require('jsonwebtoken');

const verificarToken = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'Token requerido' });

  const token = header.startsWith('Bearer ') ? header.slice(7) : header;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const verificarRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario?.rol))
    return res.status(403).json({ error: 'Acceso denegado' });
  next();
};

module.exports = { verificarToken, verificarRol };