require('dotenv').config();
const http    = require('http');
const express = require('express');
const cors    = require('cors');
const ws      = require('./websocket');

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth',    require('./routes/auth.routes'));
app.use('/api/mesas',   require('./routes/mesas.routes'));
app.use('/api/catalogo',require('./routes/catalogo.routes'));
app.use('/api/mesero',  require('./routes/mesero.routes'));
app.use('/api/qr',      require('./routes/qr.routes'));
app.use('/api/sesion',  require('./routes/sesion.routes'));
app.use('/api/pedido',  require('./routes/pedido.routes'));
app.use('/api/cajero',  require('./routes/cajero.routes'));
app.use('/api/admin',   require('./routes/admin.routes'));
app.use('/api/export',    require('./routes/export.routes'));
app.use('/api/productos', require('./routes/productos.routes'));

app.get('/api/health', (_, res) => res.json({ status: 'OK', service: 'BaseMod API' }));

const server = http.createServer(app);
ws.init(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BaseMod API corriendo en http://localhost:${PORT}`);
  console.log(`🔌 WebSocket activo en ws://localhost:${PORT}`);
});
