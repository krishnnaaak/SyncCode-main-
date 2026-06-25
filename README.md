# SyncCode

A multi-mode collaborative coding platform with real-time code synchronization, role-based interview rooms, and an AI coding assistant.

**Live:** [https://synccode-frontend-dhg7.onrender.com] &nbsp;|&nbsp; **Backend:** [https://synccode-m6fs.onrender.com]

---

## What it does

SyncCode has two modes, each built for a different use case:

**Interview + Practice Mode** — Create a timed room as an interviewer and share the room ID with a candidate. Both see the same code in real time. The AI assistant is intentionally disabled in live rooms so the candidate solves the problem themselves. Solo practice mode enables the AI for self-guided prep.

**Team Collab** — A shared workspace with a recursive file tree (files and folders), multi-file editing, and syntax highlighting that switches automatically based on file extension. The file tree persists across page refreshes via localStorage.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 17, React Router v6, CodeMirror 5 |
| Real-time | Socket.IO v4 (WebSocket) |
| Backend | Node.js, Express 5 |
| Database | MongoDB + Mongoose |
| Auth | JWT in httpOnly cookies, bcrypt |
| AI | Groq API — Llama 3.3 70B |
| Deployment | Render |

---

## Features

- Real-time code sync across all users in a room
- Role-based Interview mode: solo practice, interviewer, or candidate
- Countdown timer for interview sessions (configurable, pause/resume)
- AI coding assistant — context-aware (sends current code with every message)
- AI disabled automatically in live interview rooms
- Team Collab with recursive file tree — create, rename, delete files and folders
- Syntax highlighting for C++, C, Python, JavaScript, Java, Rust, Go, and more
- JWT authentication with httpOnly cookies
- Protected routes with server-side session verification
- Password strength meter on signup
- Room history — rejoin recent rooms from the home screen
- Toast notifications for join, leave, and error events

---

## How it works

### Real-time sync
Every room has a unique ID (UUID). When a user joins, the server maps their socket ID to their username and broadcasts the updated participant list to all room members. When someone types, the code change is emitted to the server, which rebroadcasts it to all other clients in the room — excluding the sender.

When a new user joins mid-session, the server sends a SYNC_CODE event directly to their socket so they immediately receive the current code state.

### Authentication
Signup hashes passwords with bcrypt (10 salt rounds). Login signs a 7-day JWT containing the user's ID and email. The token is stored in an httpOnly cookie — inaccessible to JavaScript, preventing XSS token theft. Every protected route hits a server endpoint to verify the JWT before rendering.

### AI proxy
All AI requests go through the Express backend. The Groq API key lives only in the server's environment variables. The frontend sends prompts to `/api/v1/ai/suggest`, and the backend forwards them to Groq with the key attached. This means the API key is never visible in browser DevTools.

---

## Known limitations

- **No conflict resolution:** If two users type simultaneously, the last emission wins. A production implementation would use Operational Transformation or CRDTs.
- **File tree is local:** The Collab file tree persists in localStorage per browser — not synced to MongoDB, so collaborators on different machines start from default files until code changes sync via Socket.IO.
- **In-memory room state:** The socket-to-username map lives in server memory. It clears on server restart. A production system would use Redis.
- **No code execution endpoint in this repo:** The execute button calls an external sandbox API configured separately.

---

## Running locally

**Prerequisites:** Node.js, MongoDB

```bash
# Backend
cd backend
cp .env.example .env       # fill in DATABASE_URL, JWT_SECRET, AI_API_KEY
npm install
npm run dev                # runs on port 4000

# Frontend (new terminal)
cd client
npm install
npm start                  # runs on port 3000
```

**Environment variables:**
```
# backend/.env
PORT=4000
DATABASE_URL=mongodb://localhost:27017/synccode
JWT_SECRET=your_secret
AI_API_KEY=your_groq_api_key
CLIENT_URL=http://localhost:3000

# client/.env
REACT_APP_BACKEND_URL=http://localhost:4000
REACT_APP_SOCKET_URL=http://localhost:4000
```

---

## Project structure

```
SyncCode/
├── backend/
│   ├── index.js              # Express server + Socket.IO engine
│   ├── Actions.js            # Socket event name constants
│   ├── config/database.js    # MongoDB connection
│   ├── models/User.js        # User schema
│   ├── Controller/Auth.js    # signup, login, logout
│   ├── middleware/auth.js    # JWT verification
│   └── routes/
│       ├── user.js           # auth endpoints
│       └── ai.js             # Groq AI proxy
└── client/
    ├── server.js             # Production: serves build + Socket.IO
    └── src/
        ├── App.js            # Routes
        ├── socket.js         # Socket.IO client init
        ├── pages/
        │   ├── Landing.js
        │   ├── Login.js / Signup.js
        │   ├── Home.js           # Mode + room selection
        │   ├── InterviewPage.js  # Interview + practice mode
        │   ├── CollabPage.js     # Team collab with file tree
        │   └── EditorPage.js     # General editor
        └── components/
            ├── ProtectedRoute.js
            ├── AIExplainer.js    # Code analysis panel
            └── CodeExecutor.js   # Run code button
```
