const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

const login = async (req, res) => {
  const identifier = req.body.email || req.body.username;
  const { password } = req.body;

  console.log('--- INTENTO DE LOGIN ---');
  console.log('Buscando usuario:', identifier);
  if (!identifier || !password) return res.status(400).json({ error: 'Usuario/email y contraseña requeridos' });

  try {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.username, u.correo, u.contrasena, u.activo,
              u.id_rol, u.id_sede,
              r.nombre AS rol,
              s.nombre AS sede_nombre
       FROM usuario u
       JOIN rol r ON u.id_rol = r.id_rol
       LEFT JOIN sede s ON u.id_sede = s.id_sede
       WHERE (u.correo = ? OR u.username = ?) AND u.activo = 1`,
      [identifier, identifier]
    );

    console.log('Usuario encontrado:', rows.length > 0 ? rows[0].username : 'NINGUNO');

    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const usuario = rows[0];

    console.log('Comparando password con hash:', usuario?.contrasena?.substring(0, 20));

    const passwordOk = await bcrypt.compare(password, usuario.contrasena);
    if (!passwordOk) {
      console.log('❌ ERROR: Contraseña incorrecta');
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nombre:     usuario.nombre,
        username:   usuario.username,
        correo:     usuario.correo,
        rol:        usuario.rol,
        id_sede:    usuario.id_sede,
        sede_nombre: usuario.sede_nombre,
      },
      process.env.JWT_SECRET || 'secret_provisorio',
      { expiresIn: process.env.JWT_EXPIRES || '8h' }
    );

    console.log('✅ LOGIN EXITOSO:', usuario.nombre);
    res.json({
      token,
      usuario: {
        id_usuario:  usuario.id_usuario,
        nombre:      usuario.nombre,
        username:    usuario.username,
        correo:      usuario.correo,
        rol:         usuario.rol,
        id_sede:     usuario.id_sede,
        sede_nombre: usuario.sede_nombre,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { login };
