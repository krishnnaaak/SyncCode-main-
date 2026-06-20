import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import toast from 'react-hot-toast';

// Persist room history in localStorage
const ROOM_KEY = 'synccode_rooms';
const saveRoom = (roomId, mode, name) => {
  try {
    const rooms = JSON.parse(localStorage.getItem(ROOM_KEY) || '[]');
    const exists = rooms.find(r => r.roomId === roomId);
    if (!exists) {
      rooms.unshift({ roomId, mode, name, ts: Date.now() });
      localStorage.setItem(ROOM_KEY, JSON.stringify(rooms.slice(0, 10)));
    }
  } catch {}
};
const getRooms = () => {
  try { return JSON.parse(localStorage.getItem(ROOM_KEY) || '[]'); } catch { return []; }
};

const MODES = [
  { key: 'interview', label: 'Interview', desc: 'Solo practice with AI, or create a timed room with a real interviewer. AI is blocked in live rooms.', tag: 'AI + Room-based' },
  { key: 'collab', label: 'Team Collab', desc: 'Build a full project with your team in real time. File tree, live editor sync, AI assistant.', tag: 'Real-time' },
];

const Home = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [step, setStep] = useState('mode'); // 'mode' | 'room'
  const [selectedMode, setSelectedMode] = useState('');
  const [roomAction, setRoomAction] = useState(''); // 'solo' | 'create' | 'join'
  const [roomIdInput, setRoomIdInput] = useState('');
  const [recentRooms, setRecentRooms] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('synccode_user');
    if (stored) {
      try { setUserName(JSON.parse(stored).name || ''); } catch {}
    }
    setRecentRooms(getRooms());
  }, []);

  const handleLogout = async () => {
    try {
      const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      await axios.post(`${base}/api/v1/auth/logout`, {}, { withCredentials: true });
    } catch {}
    localStorage.removeItem('synccode_user');
    toast.success('Signed out');
    navigate('/login');
  };

  const selectMode = (mode) => {
    setSelectedMode(mode);
    setStep('room');
    setRoomAction('');
    setRoomIdInput('');
  };

  const goSolo = () => {
    const roomId = uuidv4();
    saveRoom(roomId, selectedMode, userName);
    if (selectedMode === 'interview') {
      navigate(`/interview/${roomId}`, { state: { username: userName || 'User', role: 'solo' } });
    } else {
      navigate(`/collab/${roomId}`, { state: { username: userName || 'User', solo: true } });
    }
  };

  const handleCreate = () => {
    const roomId = uuidv4();
    saveRoom(roomId, selectedMode, userName);
    toast.success('Room created — share the ID with others');
    if (selectedMode === 'interview') {
      navigate(`/interview/${roomId}`, { state: { username: userName || 'User', role: 'interviewer' } });
    } else {
      navigate(`/collab/${roomId}`, { state: { username: userName || 'User' } });
    }
  };

  const handleJoin = () => {
    if (!roomIdInput.trim()) { toast.error('Enter a Room ID'); return; }
    const id = roomIdInput.trim();
    saveRoom(id, selectedMode, userName);
    if (selectedMode === 'interview') {
      navigate(`/interview/${id}`, { state: { username: userName || 'User', role: 'candidate' } });
    } else {
      navigate(`/collab/${id}`, { state: { username: userName || 'User' } });
    }
  };

  const rejoinRoom = (room) => {
    if (room.mode === 'interview') {
      navigate(`/interview/${room.roomId}`, { state: { username: userName || 'User', role: 'candidate' } });
    } else {
      navigate(`/collab/${room.roomId}`, { state: { username: userName || 'User' } });
    }
  };

  // ── Room setup screen ──
  if (step === 'room') {
    const isInterview = selectedMode === 'interview';
    return (
      <div className="home-screen">
        <div className="home-user-bar">
          <button className="btn-ghost" onClick={() => setStep('mode')}>← Back</button>
          <button className="btn-ghost" onClick={handleLogout}>Sign out</button>
        </div>

        <div className="home-logo">
          <h1>Sync<span>Code</span></h1>
          <p>{isInterview ? 'Interview mode' : 'Team collab'}</p>
        </div>

        {!roomAction ? (
          <div className="room-action-cards">
            <div className="room-action-card" onClick={goSolo}>
              <div className="rac-icon">person</div>
              <h4>Solo {isInterview ? 'practice' : 'workspace'}</h4>
              <p>{isInterview ? 'Practice alone with AI help and a timer' : 'Work on your own project with AI'}</p>
            </div>
            <div className="room-action-card" onClick={handleCreate}>
              <div className="rac-icon">add</div>
              <h4>Create room</h4>
              <p>{isInterview ? 'Start an interview room — share the ID with your candidate' : 'Start a collab room — invite teammates'}</p>
            </div>
            <div className="room-action-card" onClick={() => setRoomAction('join')}>
              <div className="rac-icon">link</div>
              <h4>Join room</h4>
              <p>Enter a Room ID to join an existing session</p>
            </div>
          </div>
        ) : (
          <div className="room-join-form">
            <div className="form-field-home">
              <label>ROOM ID</label>
              <input placeholder="Paste the Room ID here" value={roomIdInput}
                onChange={e => setRoomIdInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()} autoFocus />
            </div>
            <button className="btn-action accent" onClick={handleJoin}>Join room</button>
            <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setRoomAction('')}>← Back</button>
          </div>
        )}

        {recentRooms.filter(r => r.mode === selectedMode).length > 0 && (
          <div className="recent-rooms">
            <div className="recent-rooms-title">Recent rooms</div>
            {recentRooms.filter(r => r.mode === selectedMode).slice(0, 3).map(r => (
              <div key={r.roomId} className="recent-room-item" onClick={() => rejoinRoom(r)}>
                <span className="rri-id">{r.roomId.slice(0, 16)}…</span>
                <span className="rri-time">{new Date(r.ts).toLocaleDateString()}</span>
                <span className="rri-rejoin">Rejoin</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Mode select screen ──
  return (
    <div className="home-screen">
      <div className="home-user-bar">
        {userName && <span>Hi, {userName}</span>}
        <button className="btn-ghost" onClick={handleLogout}>Sign out</button>
      </div>

      <div className="home-logo">
        <h1>Sync<span>Code</span></h1>
        <p>Choose a mode to get started</p>
      </div>

      <div className="home-cards">
        {MODES.map(m => (
          <div key={m.key} className={`mode-card ${m.key}`} onClick={() => selectMode(m.key)}>
            <div className="card-icon-text">{m.key === 'interview' ? 'Interview' : 'Collab'}</div>
            <h3>{m.label}</h3>
            <p>{m.desc}</p>
            <span className="card-tag">{m.tag}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;