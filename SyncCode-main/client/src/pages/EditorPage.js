import React, { useState, useRef, useEffect } from 'react';
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

const ACTIONS = {
  JOIN: 'join', JOINED: 'joined', DISCONNECTED: 'disconnected',
  CODE_CHANGE: 'code-change', SYNC_CODE: 'sync-code',
};

const LANGUAGES = [
  { label: 'C++',        value: 'cpp',        mode: 'text/x-c++src', ext: 'cpp', starter: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n' },
  { label: 'C',          value: 'c',          mode: 'text/x-csrc',   ext: 'c',   starter: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n' },
  { label: 'Python',     value: 'python',     mode: 'python',        ext: 'py',  starter: 'print("Hello, World!")\n' },
  { label: 'JavaScript', value: 'javascript', mode: 'javascript',    ext: 'js',  starter: 'console.log("Hello, World!");\n' },
  { label: 'Java',       value: 'java',       mode: 'text/x-java',   ext: 'java',starter: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n' },
  { label: 'Rust',       value: 'rust',       mode: 'rust',          ext: 'rs',  starter: 'fn main() {\n    println!("Hello, World!");\n}\n' },
  { label: 'Go',         value: 'go',         mode: 'text/x-go',     ext: 'go',  starter: 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n' },
  { label: 'Bash',       value: 'bash',       mode: 'shell',         ext: 'sh',  starter: '#!/bin/bash\necho "Hello, World!"\n' },
];

const getLang = (v) => LANGUAGES.find(l => l.value === v) || LANGUAGES[0];
const getIcon = (name) => {
  const m = { cpp:'🔵',c:'🔵',py:'🟡',js:'🟨',java:'☕',rs:'🟠',go:'🐹',sh:'⬛',txt:'📄',md:'📝' };
  return m[name.split('.').pop()] || '📄';
};

let _fid = 1;
const mkFile = (lang) => ({
  id: `f${_fid++}`, name: `solution.${lang.ext}`,
  lang: lang.value, code: lang.starter,
});

const EditorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const mode = location.state?.mode || 'practice';
  const username = location.state?.username || 'User';

  const [files, setFiles] = useState(() => [mkFile(getLang('cpp'))]);
  const [activeId, setActiveId] = useState(null);
  const [output, setOutput] = useState('');
  const [outputVisible, setOutputVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [aiVisible, setAiVisible] = useState(mode === 'practice');
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', text: 'Hi! Ask me anything about your code — I can help with debugging, explanations, or hints.', ts: Date.now() },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState('30');
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);

  const socketRef = useRef(null);
  const codeRef = useRef('');
  const aiEndRef = useRef(null);
  const timerRef = useRef(null);

  const curId = activeId || files[0]?.id;
  const activeFile = files.find(f => f.id === curId) || files[0];

  // Socket
  useEffect(() => {
    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000');
    socketRef.current = socket;
    socket.emit(ACTIONS.JOIN, { roomId, username });
    socket.on(ACTIONS.JOINED, ({ clients, username: u, socketId }) => {
      if (u !== username) toast.success(`${u} joined`);
      socket.emit(ACTIONS.SYNC_CODE, { code: codeRef.current, socketId });
    });
    socket.on(ACTIONS.CODE_CHANGE, ({ code }) => {
      if (code !== null) {
        codeRef.current = code;
        setFiles(prev => prev.map(f => f.id === curId ? { ...f, code } : f));
      }
    });
    socket.on(ACTIONS.DISCONNECTED, ({ username: u }) => toast(`${u} left`));
    socket.on('connect_error', () => { toast.error('Connection failed'); navigate('/home'); });
    return () => socket.disconnect();
  }, [roomId]);

  // Timer
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

  // AI scroll
  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [aiMessages]);

  const handleCodeChange = (val) => {
    codeRef.current = val;
    setFiles(prev => prev.map(f => f.id === curId ? { ...f, code: val } : f));
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: val });
  };

  const addFile = () => {
    const lang = getLang(activeFile?.lang || 'cpp');
    const f = mkFile(lang);
    setFiles(prev => [...prev, f]);
    setActiveId(f.id);
  };

  const closeFile = (e, id) => {
    e.stopPropagation();
    if (files.length === 1) { toast('Keep at least one file open'); return; }
    const idx = files.findIndex(f => f.id === id);
    const next = files.filter(f => f.id !== id);
    setFiles(next);
    if (id === curId) setActiveId(next[Math.max(0, idx - 1)].id);
  };

  const switchFile = (id) => {
    setActiveId(id);
    const f = files.find(f => f.id === id);
    if (f) codeRef.current = f.code;
  };

  const handleLangChange = (val) => {
    const lang = getLang(val);
    setFiles(prev => prev.map(f => f.id === curId ? { ...f, lang: val, name: `solution.${lang.ext}` } : f));
  };

  const runCode = async () => {
    setRunning(true);
    setOutputVisible(true);
    setOutput('');
    const lang = getLang(activeFile?.lang || 'cpp');
    try {
      const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const { data } = await axios.post(`${base}/api/v1/execute`, { code: codeRef.current, language: lang.value });
      setOutput(data.success ? (data.output || '(no output)') : `Error:\n${data.error || data.message}`);
    } catch {
      setOutput(`// Run requires the execute backend endpoint.\n// Language: ${lang.label}\n\n${codeRef.current}`);
    } finally { setRunning(false); }
  };

  const sendAI = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const msg = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: msg, ts: Date.now() }]);
    setAiLoading(true);
    try {
      const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const { data } = await axios.post(`${base}/api/v1/ai/suggest`, {
        prompt: `Current code (${activeFile?.lang || 'cpp'}):\n\`\`\`\n${codeRef.current}\n\`\`\`\n\nQuestion: ${msg}`,
      });
      setAiMessages(prev => [...prev, {
        role: 'assistant',
        text: data.success ? data.suggestion : 'Sorry, something went wrong.',
        ts: Date.now(),
      }]);
    } catch {
      setAiMessages(prev => [...prev, { role: 'assistant', text: 'Could not reach AI — check your backend.', ts: Date.now() }]);
    } finally { setAiLoading(false); }
  };

  const downloadFile = () => {
    if (!activeFile) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([activeFile.code], { type: 'text/plain' }));
    a.download = activeFile.name;
    a.click();
    toast.success('Downloaded!');
  };

  const startTimer = () => {
    const m = parseInt(timerMinutes, 10);
    if (isNaN(m) || m < 1) { toast.error('Enter a valid number of minutes'); return; }
    setTimerSecs(m * 60);
    setTimerStarted(true);
    setTimerRunning(true);
  };

  const fmt = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const timerClass = timerSecs < 60 ? 'danger' : timerSecs < 300 ? 'warning' : '';
  const isInterview = mode === 'interview';

  if (!location.state) { navigate('/'); return null; }

  return (
    <div className={`editor-shell${isInterview ? ' interview' : ''}`}>

      {/* ── Topbar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <button className="icon-btn" onClick={() => navigate('/home')}>⌂ Home</button>
          <div className="topbar-sep" />
          <span className="topbar-brand">Sync<span>Code</span></span>
          <span className={`mode-badge ${mode}`}>{isInterview ? 'Interview' : 'Practice'}</span>
        </div>

        <div className="topbar-center">
          <div className="file-tabs">
            {files.map(f => (
              <button key={f.id} className={`file-tab${f.id === curId ? ' active' : ''}`}
                onClick={() => switchFile(f.id)}>
                <span>{getIcon(f.name)}</span>
                <span>{f.name}</span>
                <span className="close-tab" onClick={e => closeFile(e, f.id)}>✕</span>
              </button>
            ))}
            <button className="add-file-btn" onClick={addFile} title="New file">+</button>
          </div>
        </div>

        <div className="topbar-right">
          <select className="lang-select" value={activeFile?.lang || 'cpp'}
            onChange={e => handleLangChange(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button className="run-btn" onClick={runCode} disabled={running}>
            {running ? <><span className="spinner" />Running…</> : '▶ Run'}
          </button>
          <button className="icon-btn" onClick={downloadFile}>↓ Save</button>
          {!isInterview && (
            <button className="icon-btn" onClick={() => setAiVisible(v => !v)}>
              {aiVisible ? '✦ AI on' : '✦ AI off'}
            </button>
          )}
          <button className="icon-btn" onClick={() => setOutputVisible(v => !v)}>
            {outputVisible ? '▼ Output' : '▲ Output'}
          </button>
        </div>
      </div>

      {/* ── Timer row (interview only) ── */}
      {isInterview && (
        <div className="timer-row">
          <span className="timer-label">TIMER</span>
          {!timerStarted ? (
            <>
              <input className="timer-input" type="number" min="1" max="180"
                value={timerMinutes} onChange={e => setTimerMinutes(e.target.value)} placeholder="min" />
              <span className="timer-label">min</span>
              <button className="timer-btn start" onClick={startTimer}>Start</button>
            </>
          ) : (
            <>
              <span className={`timer-display ${timerClass}`}>{fmt(timerSecs)}</span>
              <button className="timer-btn" onClick={() => setTimerRunning(v => !v)}>
                {timerRunning ? '⏸ Pause' : '▶ Resume'}
              </button>
              <button className="timer-btn" onClick={() => { setTimerStarted(false); setTimerRunning(false); setTimerSecs(0); }}>
                ↺ Reset
              </button>
            </>
          )}
          <div className="flex-spacer" />
          <span className="timer-label" style={{ color: 'var(--amber)' }}>🔒 AI locked</span>
        </div>
      )}

      {/* ── Gutter ── */}
      <div className="sidebar-gutter">
        <button className="gutter-btn" title="Files">📄</button>
        <button className={`gutter-btn${outputVisible ? ' active' : ''}`}
          onClick={() => setOutputVisible(v => !v)} title="Output">▶</button>
        {!isInterview && (
          <button className={`gutter-btn${aiVisible ? ' active' : ''}`}
            onClick={() => setAiVisible(v => !v)} title="AI">✦</button>
        )}
      </div>

      {/* ── Main ── */}
      <div className={`editor-main${aiVisible && !isInterview ? ' with-ai' : ''}${outputVisible ? ' with-output' : ''}`}>

        {/* Code editor */}
        <div className="code-editor-wrap">
          {activeFile ? (
            <CodeMirror
              value={activeFile.code}
              options={{
                mode: getLang(activeFile.lang).mode,
                theme: 'synccode',
                lineNumbers: true,
                autoCloseBrackets: true,
                matchBrackets: true,
                lineWrapping: false,
                indentUnit: 4,
                tabSize: 4,
                styleActiveLine: true,
                foldGutter: true,
                gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
                extraKeys: { 'Tab': 'indentMore', 'Shift-Tab': 'indentLess' },
              }}
              onBeforeChange={(_e, _d, val) => handleCodeChange(val)}
            />
          ) : (
            <div className="empty-editor">
              <span className="empty-icon">📄</span>
              <p>No file open</p>
            </div>
          )}
        </div>

        {/* Output panel */}
        {outputVisible && (
          <div className={`output-panel${aiVisible && !isInterview ? ' span-full' : ''}`}>
            <div className="output-header">
              <span>Output</span>
              <button className="icon-btn" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setOutput('')}>Clear</button>
            </div>
            <div className="output-body">
              {running
                ? <div className="output-spinner"><span className="spinner" />Running…</div>
                : output
                  ? output
                  : <span className="out-meta">Press ▶ Run to execute your code</span>
              }
            </div>
          </div>
        )}

        {/* AI panel — practice */}
        {!isInterview && aiVisible && (
          <div className="ai-panel">
            <div className="ai-panel-header">
              <span className="ai-title"><span className="ai-dot" />AI assistant</span>
              <button className="icon-btn" style={{ fontSize: 11, padding: '2px 6px' }}
                onClick={() => setAiMessages([{ role: 'assistant', text: 'Chat cleared. Ask me anything!', ts: Date.now() }])}>
                Clear
              </button>
            </div>
            <div className="ai-messages">
              {aiMessages.map((m, i) => (
                <div key={i} className={`ai-msg ${m.role}`}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
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
                placeholder="Ask about your code… (Enter to send)"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAI(); } }}
              />
              <button className="ai-send-btn" onClick={sendAI} disabled={!aiInput.trim() || aiLoading}>
                Send ↵
              </button>
            </div>
          </div>
        )}

        {/* AI panel — interview locked */}
        {isInterview && (
          <div className="ai-panel">
            <div className="ai-panel-header">
              <span className="ai-title"><span className="ai-locked-dot" />AI panel</span>
            </div>
            <div className="ai-locked-overlay">
              <div className="lock-icon">🔒</div>
              <p>AI is disabled in interview mode.</p>
              <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                Switch to Practice to get AI help.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorPage;