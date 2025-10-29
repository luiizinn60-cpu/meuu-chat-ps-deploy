const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3000;

// Serve o arquivo index.html como a página principal
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Armazenar IDs de usuários que estão esperando por um parceiro
let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('Usuário conectado. ID:', socket.id);

  // Adiciona o usuário à lista de espera e tenta conectá-lo
  waitingUsers.push(socket.id);
  findPartner(socket);

  // ------------------------------------
  // 1. CHAT DE TEXTO
  // ------------------------------------
  socket.on('chat message', (msg) => {
    // Se tiver um parceiro, envia só pra ele. Senão, para todos.
    if (socket.partnerId) {
      socket.to(socket.partnerId).emit('chat message', msg);
    } else {
      // Caso não tenha parceiro (ainda), pode enviar para todos ou guardar
      io.emit('chat message', msg); 
    }
  });

  // ------------------------------------
  // 2. SINALIZAÇÃO WEBRTC
  // ------------------------------------
  socket.on('offer', (id, message) => {
    socket.to(id).emit('offer', socket.id, message);
  });

  socket.on('answer', (id, message) => {
    socket.to(id).emit('answer', socket.id, message);
  });

  socket.on('candidate', (id, message) => {
    socket.to(id).emit('candidate', socket.id, message);
  });

  // ------------------------------------
  // 3. LÓGICA DE PROCURAR NOVO PARCEIRO (Botão Next)
  // ------------------------------------
  socket.on('find-new-partner', () => {
    console.log(`Usuário ${socket.id} buscando novo parceiro.`);
    // Notifica o parceiro atual que o outro usuário se desconectou
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('user-disconnected', socket.id);
      // Remove o parceiro do lado dele também
      const partnerSocket = io.sockets.sockets.get(socket.partnerId);
      if (partnerSocket) {
        partnerSocket.partnerId = null;
      }
    }
    // Remove este usuário da lista de espera se já estiver
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
    socket.partnerId = null; // Limpa o parceiro deste socket
    waitingUsers.push(socket.id); // Adiciona na fila para encontrar novo
    findPartner(socket);
  });

  socket.on('disconnect', () => {
    console.log('Usuário desconectado. ID:', socket.id);
    // Remove o usuário da lista de espera
    waitingUsers = waitingUsers.filter(id => id !== socket.id);

    // Se ele tinha um parceiro, notifica o parceiro
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('user-disconnected', socket.id);
      const partnerSocket = io.sockets.sockets.get(socket.partnerId);
      if (partnerSocket) {
        partnerSocket.partnerId = null;
        // Coloca o parceiro na fila de espera para encontrar outro
        waitingUsers.push(partnerSocket.id);
        findPartner(partnerSocket);
      }
    }
  });
});

// --- FUNÇÃO PARA ENCONTRAR PARCEIRO ---
function findPartner(currentSocket) {
  // Filtra por usuários que não são o próprio e que não têm parceiro
  const availablePartners = waitingUsers.filter(
    id => id !== currentSocket.id && !io.sockets.sockets.get(id).partnerId
  );

  if (availablePartners.length > 0) {
    const partnerId = availablePartners[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (partnerSocket) {
      // Conecta os dois
      currentSocket.partnerId = partnerId;
      partnerSocket.partnerId = currentSocket.id;

      // Remove os dois da lista de espera
      waitingUsers = waitingUsers.filter(id => id !== currentSocket.id && id !== partnerId);

      // Notifica o cliente que encontrou um parceiro
      currentSocket.emit('user-connected', partnerId);
      partnerSocket.emit('user-connected', currentSocket.id);
      
      console.log(`Parceiro encontrado: ${currentSocket.id} <-> ${partnerId}`);
    } else {
      // Se o socket do parceiro não foi encontrado (desconectou), remove ele da lista
      waitingUsers = waitingUsers.filter(id => id !== partnerId);
      // Tenta novamente para o usuário atual
      findPartner(currentSocket);
    }
  } else {
    console.log(`Usuário ${currentSocket.id} esperando por parceiro...`);
    // O usuário permanece na lista de espera
  }
}


// Inicia o servidor na porta definida
http.listen(port, () => {
  console.log(`Servidor de Chat WebRTC (Omegle) iniciado na porta: ${port}`);
});
