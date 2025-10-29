const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
// Render usa a variável de ambiente PORT, se não existir, usa 3000
const port = process.env.PORT || 3000; 

// Serve o arquivo index.html como a página principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Lógica do Socket.IO (comunicação em tempo real)
io.on('connection', (socket) => {
  console.log('Um usuário se conectou.');

  // Quando o cliente envia uma mensagem de chat
  socket.on('chat message', (msg) => {
    // Envia a mensagem para todos os clientes conectados
    io.emit('chat message', msg);
    console.log('Mensagem: ' + msg);
  });

  // Quando o usuário se desconecta
  socket.on('disconnect', () => {
    console.log('Um usuário se desconectou.');
  });
});

// Inicia o servidor na porta definida
http.listen(port, () => {
  console.log(`Servidor de Chat iniciado na porta: ${port}`);
});
