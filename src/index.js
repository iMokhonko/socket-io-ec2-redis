const express = require('express');
const expressServer = express();

const { createClient } = require('redis')
const { Server } = require('socket.io');
const { createShardedAdapter } = require('@socket.io/redis-adapter');

// =======
const createChannel = require('./actions/create-channel');
const createConversation = require('./actions/create-conversation');
const postMessagetoChannel = require('./actions/post-message-to-channel');
const postMessageToConversation = require('./actions/post-message-to-conversation');
const postMessageToUser = require('./actions/post-message-to-user');
const getConversationMessages = require('./user-actions/get-conversation-messages');

const getUserChats = require('./user-actions/getUserChats');

const pubClient = createClient({ 
  url: 'rediss://chat-websocket-messages-redis-adapter-rwzd07.serverless.euc1.cache.amazonaws.com:6379',
  tls: true
});
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => console.log('Redis Client Error', err));

const io = new Server({
  // include adapter only for non-development env
  ...(process.env.NODE_ENV !== 'development' && {
    adapter: createShardedAdapter(pubClient, subClient, {
      subscriptionMode: "dynamic"
    }),
  }),

  cors: {
    origin: 'http://localhost:8080',
    credentials: true
  }
});

(async () => {
  // connect to redis only in non-development env
  if(process.env.NODE_ENV !== 'development') {
    await Promise.all([
      pubClient.connect(),
      subClient.connect()
    ]);
  }

  const rooms = [];

  io.on("connection", async socket => {
    console.log('connected client', socket.handshake.auth.userId, socket.id);

    // disconnect event
    socket.on("disconnect", reason => console.log('disconnected client', reason, socket.id, rooms));

    const { userId = null } = socket?.handshake?.auth ?? {};

    socket.on('create-channel', createChannel);
    socket.on('create-conversation', createConversation);
    socket.on('post-message-to-channel', postMessagetoChannel);
    socket.on('post-message-to-conversation', postMessageToConversation);
    socket.on('post-message-to-user', ({ to, text }, callback) => postMessageToUser(socket, { to, from: userId, text }, callback));
    socket.on('get-conversation-messages', getConversationMessages);

    const userChats = await getUserChats(userId);

    // join socket to his conversation rooms
    // userChats.forEach(({ conversationId }) => socket.join(conversationId));
    
    // join this socket to his personal room
    // in this room all direct messages will be sent to this user
    socket.join(userId);

    socket.emit('update-user-chats', userChats)
  });

  io.listen(80);
})();

// for health checks
expressServer.get('/health', (_, res) => res.status(200).send("OK"));

expressServer.listen(3000, () => {
  console.log(`Server is running and listening at http://localhost:3000`);
});

