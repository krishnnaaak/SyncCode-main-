const express = require('express');
const app = express();
const http = require('http');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require('socket.io');
const ACTIONS = require('./Actions');

require("dotenv").config();

const server = http.createServer(app);

const PORT = process.env.PORT || 4000;

// ✅ Socket.IO with CORS
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://localhost:5000",
            "https://code-sync-part-1-1.onrender.com",
            "https://synccode-frontend-dhg7.onrender.com"
        ],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// ✅ Express CORS
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5000",
        "https://code-sync-part-1-1.onrender.com",
        "https://synccode-frontend-dhg7.onrender.com"
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['set-cookie']
}));

app.use(express.json());
app.use(cookieParser());

require("./config/database").connect();

// ✅ Routes
const user = require("./routes/user");
app.use("/api/v1/auth", user);

const aiRoutes = require('./routes/ai');
app.use('/api/v1/ai', aiRoutes);


app.get("/", (req, res) => {
    res.send("<h1>Auth App</h1>");
});

// ✅ Socket.IO logic
const userSocketMap = {};

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => ({
            socketId,
            username: userSocketMap[socketId],
        })
    );
}

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
    });
});

// ✅ Use server.listen instead of app.listen
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
