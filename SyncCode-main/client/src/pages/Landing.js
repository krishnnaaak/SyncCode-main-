import React from 'react';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="landingContainer">
      <h1>Sync<span>Code</span></h1>
      <p>A multi-mode coding platform — practice algorithms with AI, run live interview sessions, and build projects with your team in real time.</p>
      <div>
        <button onClick={() => navigate('/login')}>Login</button>
        <button onClick={() => navigate('/signup')}>Sign up free</button>
      </div>
      <div style={{ marginTop: '3rem', display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[
          { label: 'Interview Mode', desc: 'Timed rooms with live code sync' },
          { label: 'AI Assistant', desc: 'Context-aware pair programmer' },
          { label: 'Team Collab', desc: 'Shared file tree, real-time editing' },
        ].map(f => (
          <div key={f.label} style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: '16px 22px',
            textAlign: 'center',
            minWidth: 160,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{f.label}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Landing;