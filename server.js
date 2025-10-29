const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000; 

// Serve o arquivo index.html como a página principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Lógica de SINALIZAÇÃO WebRTC e Chat de Texto
io.on('connection', (socket) => {
  // Logs de conexão e desconexão são mantidos aqui APENAS para seu controle no console do Render.
  // Se quiser removê-los, apague as duas linhas abaixo
  // console.log('Usuário conectado. ID:', socket.id);
  
  // ------------------------------------
  // 1. CHAT DE TEXTO
  // ------------------------------------
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });
  
  // ------------------------------------
  // 2. SINALIZAÇÃO WEBRTC
  // ------------------------------------
  // Envia o ID do novo usuário para todos (diz "ei, tem alguém aqui!")
  socket.broadcast.emit('user-connected', socket.id);

  // Recebe uma OFERTA de um usuário e a retransmite para o outro
  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message);
  });

  // Recebe uma RESPOSTA de um usuário e a retransmite para o outro
  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message);
  });

  // Recebe os CANDIDATOS ICE e os retransmite
  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message);
  });
  
  // Usuário se desconectou
  socket.on('disconnect', () => {
    // console.log('Usuário se desconectou.');
    // Notifica os outros que este usuário saiu
    socket.broadcast.emit('user-disconnected', socket.id);
  });
});

// Inicia o servidor na porta definida
http.listen(port, () => {
  console.log(`Servidor de Chat WebRTC iniciado na porta: ${port}`);
});
