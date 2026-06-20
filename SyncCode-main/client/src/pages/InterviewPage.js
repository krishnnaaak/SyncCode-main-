import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import axios from 'axios';
import { Controlled as CodeMirror } from 'react-codemirror2';

import 'codemirror/lib/codemirror.css';
import 'codemirror/mode/clike/clike';
import 'codemirror/mode/python/python';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/rust/rust';
import 'codemirror/mode/go/go';
import 'codemirror/mode/shell/shell';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/selection/active-line';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/foldgutter.css';
import 'codemirror/addon/fold/brace-fold';

const ACTIONS = { JOIN:'join', JOINED:'joined', DISCONNECTED:'disconnected', CODE_CHANGE:'code-change', SYNC_CODE:'sync-code' };

const LANGUAGES = [
  { label:'C++',   value:'cpp',   mode:'text/x-c++src', ext:'cpp', starter:'#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n' },
  { label:'C',     value:'c',     mode:'text/x-csrc',   ext:'c',   starter:'#include <stdio.h>\n\nint main() {\n    \n    return 0;\n}\n' },
  { label:'Python',value:'python',mode:'python',        ext:'py',  starter:'# Write your solution\n\n' },
  { label:'Java',  value:'java',  mode:'text/x-java',   ext:'java',starter:'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n' },
  { label:'JS',    value:'javascript',mode:'javascript',ext:'js',  starter:'// Write your solution\n\n' },
  { label:'Rust',  value:'rust',  mode:'rust',          ext:'rs',  starter:'fn main() {\n    \n}\n' },
  { label:'Go',    value:'go',    mode:'text/x-go',     ext:'go',  starter:'package main\n\nimport "fmt"\n\nfunc main() {\n    \n}\n' },
];

const getLang = v => LANGUAGES.find(l => l.value === v) || LANGUAGES[0];

const renderAIText = (text) => {
  const parts = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, match, key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={key++} style={{whiteSpace:'pre-wrap'}}>{text.slice(last, match.index)}</span>);
    parts.push(
      <pre key={key++} style={{background:'#0d0e12',borderRadius:6,padding:'10px 12px',fontFamily:'var(--font-mono)',fontSize:12,overflowX:'auto',margin:'6px 0',border:'1px solid rgba(255,255,255,0.08)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
        {match[1] && <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:4}}>{match[1]}</div>}
        {match[2].trim()}
      </pre>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={key++} style={{whiteSpace:'pre-wrap'}}>{text.slice(last)}</span>);
  return parts;
};

const InterviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const username = location.state?.username || 'User';
  const role = location.state?.role || 'solo'; // 'solo' | 'interviewer' | 'candidate'
  const isSolo = role === 'solo';
  const isInterviewer = role === 'interviewer';
  const aiEnabled = isSolo; // AI only in solo mode

  const [lang, setLang] = useState('cpp');
  const [code, setCode] = useState(() => getLang('cpp').starter);
  const [clients, setClients] = useState([]);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  // Timer
  const [timerMin, setTimerMin] = useState('30');
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const timerRef = useRef(null);

  // AI (solo only)
  const [aiMessages, setAiMessages] = useState([
    { role:'assistant', text:'Hi! I\'m here to help you prepare for coding interviews. Ask me about algorithms, time complexity, hints for problems, or code review.', ts: Date.now() }
  ]);
  const [aiHistory, setAiHistory] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiWidth, setAiWidth] = useState(300);
  const aiEndRef = useRef(null);

  // Resize
  const [ioPanelWidth, setIoPanelWidth] = useState(300);
  const isResizingIO = useRef(false);
  const isResizingAI = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const socketRef = useRef(null);
  const codeRef = useRef(code);

  useEffect(() => { codeRef.current = code; }, [code]);

  // Socket — always connect even in solo (for potential room share later)
  useEffect(() => {
    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000');
    socketRef.current = socket;
    socket.emit(ACTIONS.JOIN, { roomId, username });

    socket.on(ACTIONS.JOINED, ({ clients: c, username: u, socketId }) => {
      setClients(c);
      if (u !== username) toast.success(`${u} joined the room`);
      socket.emit(ACTIONS.SYNC_CODE, { code: codeRef.current, socketId });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ code: c }) => {
      if (c !== null) { codeRef.current = c; setCode(c); }
    });

    socket.on(ACTIONS.DISCONNECTED, ({ username: u, socketId }) => {
      toast(`${u} left`);
      setClients(prev => prev.filter(c => c.socketId !== socketId));
    });

    return () => socket.disconnect();
  }, [roomId, username]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSecs(s => {
          if (s <= 1) { clearInterval(timerRef.current); setTimerRunning(false); toast.error('Time is up!'); return 0; }
          return s - 1;
        });
      }, 1000);
    } else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);

  // IO resize
  const onResizeIO = useCallback(e => {
    isResizingIO.current = true; dragStartX.current = e.clientX; dragStartW.current = ioPanelWidth;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  }, [ioPanelWidth]);

  // AI resize
  const onResizeAI = useCallback(e => {
    isResizingAI.current = true; dragStartX.current = e.clientX; dragStartW.current = aiWidth;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  }, [aiWidth]);

  useEffect(() => {
    const onMove = e => {
      if (isResizingIO.current) {
        const d = dragStartX.current - e.clientX;
        setIoPanelWidth(Math.min(550, Math.max(180, dragStartW.current + d)));
      }
      if (isResizingAI.current) {
        const d = dragStartX.current - e.clientX;
        setAiWidth(Math.min(500, Math.max(200, dragStartW.current + d)));
      }
    };
    const onUp = () => {
      isResizingIO.current = false; isResizingAI.current = false;
      document.body.style.cursor = ''; document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const handleCodeChange = val => {
    codeRef.current = val; setCode(val);
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: val });
  };

  const handleLangChange = val => {
    setLang(val);
    const starter = getLang(val).starter;
    setCode(starter); codeRef.current = starter;
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: starter });
  };

  const runCode = async () => {
    setRunning(true); setOutput('');
    try {
      const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const { data } = await axios.post(`${base}/api/v1/execute`, {
        code: codeRef.current, language: lang, stdin: input,
      });
      setOutput(data.success ? (data.output || '(no output)') : `Error:\n${data.error || data.message}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message;
      setOutput(msg ? `Error:\n${msg}` : 'Execute endpoint not configured in backend.');
    } finally { setRunning(false); }
  };

  const copyRoomId = async () => {
    try { await navigator.clipboard.writeText(roomId); toast.success('Room ID copied!'); }
    catch { toast.error('Could not copy'); }
  };

  const startTimer = () => {
    const m = parseInt(timerMin, 10);
    if (isNaN(m) || m < 1) { toast.error('Enter valid minutes'); return; }
    setTimerSecs(m * 60); setTimerStarted(true); setTimerRunning(true);
  };

  const sendAI = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const msg = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: msg, ts: Date.now() }]);
    const userContent = {
      role: 'user',
      content: `My current code (${lang}):\n\`\`\`${lang}\n${codeRef.current}\n\`\`\`\n\n${msg}`
    };
    const newHistory = aiHistory.length === 0 ? [userContent] : [...aiHistory, { role: 'user', content: msg }];
    setAiLoading(true);
    try {
      const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const { data } = await axios.post(`${base}/api/v1/ai/suggest`, { messages: newHistory });
      if (data.success) {
        setAiHistory([...newHistory, { role: 'assistant', content: data.suggestion }]);
        setAiMessages(prev => [...prev, { role: 'assistant', text: data.suggestion, ts: Date.now() }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', text: 'Could not reach AI — check backend.', ts: Date.now() }]);
    } finally { setAiLoading(false); }
  };

  const fmt = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const timerClass = timerSecs < 60 ? 'danger' : timerSecs < 300 ? 'warning' : '';

  if (!location.state) { navigate('/'); return null; }

  return (
    <div className="interview-shell">
      {/* Topbar */}
      <div className="topbar-v2">
        <div className="topbar-left">
          <button className="icon-btn" onClick={() => navigate('/home')}>Home</button>
          <div className="topbar-sep" />
          <span className="topbar-brand">Sync<span>Code</span></span>
          <span className="mode-badge interview">{isSolo ? 'Practice' : 'Interview'}</span>
          {!isSolo && (
            <>
              <span className="room-pill">{roomId.slice(0,12)}…</span>
              <button className="icon-btn" onClick={copyRoomId}>Copy ID</button>
            </>
          )}
        </div>

        <div className="topbar-center">
          <div className="timer-inline">
            {!timerStarted ? (
              <>
                <span className="timer-label">TIMER</span>
                <input className="timer-input" type="number" min="1" max="180"
                  value={timerMin} onChange={e => setTimerMin(e.target.value)} placeholder="min" />
                <span className="timer-label">min</span>
                <button className="timer-btn start" onClick={startTimer}>Start</button>
              </>
            ) : (
              <>
                <span className={`timer-display ${timerClass}`}>{fmt(timerSecs)}</span>
                <button className="timer-btn" onClick={() => setTimerRunning(v => !v)}>
                  {timerRunning ? 'Pause' : 'Resume'}
                </button>
                <button className="timer-btn" onClick={() => { setTimerStarted(false); setTimerRunning(false); setTimerSecs(0); }}>Reset</button>
              </>
            )}
          </div>
        </div>

        <div className="topbar-right">
          <select className="lang-select" value={lang} onChange={e => handleLangChange(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button className="run-btn" onClick={runCode} disabled={running}>
            {running ? <><span className="spinner" />Running…</> : 'Run'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="interview-body">
        {/* Left: participants panel */}
        <div className="interview-users-panel">
          <div className="interview-users-title">PARTICIPANTS</div>
          <div className="interview-users-list">
            <div className="interview-user-item self">
              <span className="user-dot" />
              <span>{username}</span>
              <span className="role-tag">{isSolo ? 'Solo' : isInterviewer ? 'Interviewer' : 'Candidate'}</span>
            </div>
            {clients.filter(c => c.username !== username).map(c => (
              <div key={c.socketId} className="interview-user-item">
                <span className="user-dot" />
                <span>{c.username}</span>
              </div>
            ))}
          </div>
          {isSolo && (
            <div style={{ marginTop: 'auto', padding: '8px 0', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
              Solo mode — AI enabled
            </div>
          )}
          {!isSolo && (
            <div style={{ marginTop: 'auto', padding: '8px 0', fontSize: 11, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
              Live room — AI disabled
            </div>
          )}
        </div>

        {/* Center: code editor */}
        <div className="code-editor-wrap" style={{ flex: 1, minWidth: 0 }}>
          <CodeMirror
            value={code}
            options={{
              mode: getLang(lang).mode, theme: 'synccode',
              lineNumbers: true, autoCloseBrackets: true, matchBrackets: true,
              lineWrapping: false, indentUnit: 4, tabSize: 4, styleActiveLine: true,
              foldGutter: true,
              gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
              extraKeys: { 'Tab': 'indentMore', 'Shift-Tab': 'indentLess' },
            }}
            onBeforeChange={(_e, _d, val) => handleCodeChange(val)}
          />
        </div>

        {/* Resize handle before IO */}
        <div className="resize-handle" onMouseDown={onResizeIO} />

        {/* Right: I/O panel */}
        <div className="io-panel" style={{ width: ioPanelWidth }}>
          <div className="io-section">
            <div className="io-header"><span>INPUT</span></div>
            <textarea className="io-textarea" placeholder="stdin input..." value={input} onChange={e => setInput(e.target.value)} />
          </div>
          <div className="io-divider" />
          <div className="io-section">
            <div className="io-header">
              <span>OUTPUT</span>
              <button className="icon-btn" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setOutput('')}>Clear</button>
            </div>
            <div className="io-output">
              {running
                ? <div className="output-spinner"><span className="spinner" />Running…</div>
                : output
                  ? <span className={output.startsWith('Error') ? 'out-error' : ''}>{output}</span>
                  : <span className="out-meta">Output appears here after running</span>}
            </div>
          </div>
        </div>

        {/* AI panel — solo mode only */}
        {aiEnabled && (
          <>
            <div className="resize-handle" onMouseDown={onResizeAI} />
            <div className="ai-panel-v2" style={{ width: aiWidth }}>
              <div className="ai-panel-header">
                <span className="ai-title"><span className="ai-dot" />AI assistant</span>
                <button className="icon-btn" style={{ fontSize: 11, padding: '2px 6px' }}
                  onClick={() => { setAiMessages([{ role: 'assistant', text: 'Chat cleared.', ts: Date.now() }]); setAiHistory([]); }}>
                  Clear
                </button>
              </div>
              <div className="ai-messages">
                {aiMessages.map((m, i) => (
                  <div key={i} className={`ai-msg ${m.role}`}>
                    <div>{renderAIText(m.text)}</div>
                    <div className="ai-msg-time">{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="ai-msg assistant">
                    <div className="output-spinner"><span className="spinner" />Thinking…</div>
                  </div>
                )}
                <div ref={aiEndRef} />
              </div>
              <div className="ai-input-area">
                <textarea className="ai-textarea" rows={3}
                  placeholder="Ask for hints, explanations, code review…"
                  value={aiInput} onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI(); } }} />
                <button className="ai-send-btn" onClick={sendAI} disabled={!aiInput.trim() || aiLoading}>Send</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InterviewPage;