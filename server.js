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
  // A cada nova conexão, o cliente pede para entrar na fila (via ready-for-new-partner no index.html)
  // Então, não precisamos chamar findPartner aqui diretamente.

  // ------------------------------------
  // 1. CHAT DE TEXTO
  // ------------------------------------
  socket.on('chat message', (msg) => {
    // Envia a mensagem para o parceiro
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('chat message', 'Stranger: ' + msg);
    } else {
      // Se não tem parceiro, envia a mensagem de volta para si mesmo (feedback)
      socket.emit('chat message', msg);
    }
  });

  // ------------------------------------
  // 2. SINALIZAÇÃO WEBRTC
  // ------------------------------------
  
  // Sinal enviado pelo cliente ao iniciar o WebRTC (para entrar na fila)
  socket.on('ready-for-new-partner', () => {
      // Garante que o usuário está na fila de espera
      if (!waitingUsers.includes(socket.id)) {
          waitingUsers.push(socket.id);
      }
      findPartner(socket);
  });
  
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
  // 3. LÓGICA DE PROCURAR NOVO PARCEIRO (Botão Next e Desconexão)
  // ------------------------------------
  socket.on('find-new-partner', () => {
    // Notifica o parceiro atual que o outro usuário saiu
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('user-disconnected', socket.id);
      
      const partnerSocket = io.sockets.sockets.get(socket.partnerId);
      if (partnerSocket) {
        partnerSocket.partnerId = null;
        // Coloca o parceiro na fila para encontrar outro
        waitingUsers.push(partnerSocket.id);
        findPartner(partnerSocket);
      }
    }
    // Remove o ID antigo e prepara para entrar na fila novamente (o cliente fará o ready-for-new-partner)
    socket.partnerId = null; 
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
  });

  socket.on('disconnect', () => {
    // Remove o usuário da lista de espera se estava esperando
    waitingUsers = waitingUsers.filter(id => id !== socket.id);

    // Se ele tinha um parceiro, notifica o parceiro
    if (socket.partnerId) {
      io.to(socket.partnerId).emit('user-disconnected', socket.id);
      const partnerSocket = io.sockets.sockets.get(socket.partnerId);
      if (partnerSocket) {
        partnerSocket.partnerId = null;
        // Coloca o parceiro na fila para encontrar outro
        waitingUsers.push(partnerSocket.id);
        findPartner(partnerSocket);
      }
    }
  });
});

// --- FUNÇÃO PARA ENCONTRAR PARCEIRO ---
function findPartner(currentSocket) {
  // 1. Limpa a lista de espera de qualquer ID que tenha se desconectado
  waitingUsers = waitingUsers.filter(id => io.sockets.sockets.has(id));

  // 2. Filtra por usuários que estão esperando, não são o próprio e não têm parceiro
  const availablePartners = waitingUsers.filter(
    id => id !== currentSocket.id && !io.sockets.sockets.get(id).partnerId
  );

  if (availablePartners.length > 0) {
    const partnerId = availablePartners[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (partnerSocket) {
      // 3. Conecta os dois
      currentSocket.partnerId = partnerId;
      partnerSocket.partnerId = currentSocket.id;

      // 4. Remove os dois da lista de espera
      waitingUsers = waitingUsers.filter(id => id !== currentSocket.id && id !== partnerId);

      // 5. Notifica os clientes para iniciar o WebRTC
      currentSocket.emit('user-connected', partnerId);
      partnerSocket.emit('user-connected', currentSocket.id);
    } else {
      // Se algo deu errado com o parceiro, limpa a lista e tenta de novo
      waitingUsers = waitingUsers.filter(id => id !== partnerId);
      findPartner(currentSocket);
    }
  } else {
    // Garante que o usuário atual está na lista de espera se não encontrou ninguém
    if (!waitingUsers.includes(currentSocket.id)) {
        waitingUsers.push(currentSocket.id);
    }
  }
}

// Inicia o servidor na porta definida
http.listen(port, () => {
  console.log(`Servidor de Chat WebRTC (Omegle) iniciado na porta: ${port}`);
});
