const WebSocket = require('ws');

let wss = null;

const init = (server) => {
  wss = new WebSocket.Server({ server });
  wss.on('connection', (ws) => {
    console.log('🔌 Cliente WS conectado');
    ws.on('close', () => console.log('🔌 Cliente WS desconectado'));
  });
};

const broadcast = (data) => {
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
};

module.exports = { init, broadcast };
