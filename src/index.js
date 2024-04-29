// const { createClient } = require('redis')
const { Server } = require('socket.io');
// const { createShardedAdapter } = require('@socket.io/redis-adapter');

// const pubClient = createClient({ 
//   url: 'rediss://sockets-adapter-rwzd07.serverless.euc1.cache.amazonaws.com:6379',
//   tls: true
// });
// const subClient = pubClient.duplicate();

// pubClient.on('error', (err) => console.log('Redis Client Error', err));

  // const randomNumber = Math.floor(Math.random() * (3100 - 3000 + 1)) + 3000;
  // console.log(randomNumber);

const io = new Server({
  // adapter: createShardedAdapter(pubClient, subClient, {
  //   subscriptionMode: "dynamic"
  // }),

  cors: {
    origin: ['http://localhost:8080']
  }
});

(async () => {
  // await Promise.all([
  //   pubClient.connect(),
  //   subClient.connect()
  // ]);

  const rooms = [];

  io.on("connection", socket => {
    console.log('connected client', socket.id);

    socket.joinedRooms = new Set();

    socket.on("disconnect", reason => {
      Array.from(socket.joinedRooms).forEach(socketJoinedRoomName => {
        const roomIndex = rooms.findIndex(({ name }) => name === socketJoinedRoomName);

        if(roomIndex !== -1) {
          const connectedSocketIndex = rooms[roomIndex].connectedSockets.findIndex(socketId => socketId === socket.id);

          rooms[roomIndex].connectedSockets.splice(connectedSocketIndex, 1);

          if(!rooms[roomIndex].connectedSockets.length) {
            rooms.splice(roomIndex, 1); // remove empty room
          }
        }
      })

      console.log('disconnected client', reason, socket.id, rooms);
    });

    socket.on('message', ({ text, roomName } = {}, callback) => {
      socket.to(roomName).emit('message', { text, roomName, name: socket.id });

      callback({ status: 'ok' });
    });

    socket.on('join-room', (payload, callback) => {
      const existingRoomIndex = rooms.findIndex(({ name }) => name === payload.roomName);

      if(existingRoomIndex === -1) {
        rooms.push({ name: payload.roomName, connectedSockets: [socket.id] });
      } else {
        rooms[existingRoomIndex].connectedSockets.push(socket.id);
      }

      socket.joinedRooms.add(payload.roomName);

      console.log('join-room', `${socket.id} -> ${payload.roomName}`, rooms);
      
      socket.join(payload.roomName);

      callback({ status: 'ok', joinedRooms: Array.from(socket.joinedRooms) });
    });

    socket.on('leave-room', (payload, callback) => {
      const existingRoomIndex = rooms.findIndex(({ name }) => name === payload.roomName);

      if(existingRoomIndex !== -1) {
        const connectedSocketIndex = rooms[existingRoomIndex].connectedSockets.findIndex(socketId => socketId === socket.id);
        
        if(connectedSocketIndex !== -1) {
          rooms[existingRoomIndex].connectedSockets.splice(connectedSocketIndex, 1);

          // check if room is empty
          if(!rooms[existingRoomIndex].connectedSockets.length) {
            rooms.splice(existingRoomIndex, 1); // remove empty room
          }
        }
      }

      socket.joinedRooms.delete(payload.roomName);

      console.log('leave-room', `${payload.roomName} -> ${socket.id}`, rooms);

      socket.leave(payload.roomName);

      callback({ status: 'ok', joinedRooms: Array.from(socket.joinedRooms) });
    });
  });

  io.listen(3000);
})();

