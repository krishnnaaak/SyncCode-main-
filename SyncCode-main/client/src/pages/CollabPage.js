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
import 'codemirror/mode/css/css';
import 'codemirror/mode/xml/xml';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/selection/active-line';

const ACTIONS = { JOIN:'join', JOINED:'joined', DISCONNECTED:'disconnected', CODE_CHANGE:'code-change', SYNC_CODE:'sync-code' };

const MODE_MAP = { js:'javascript',jsx:'javascript',ts:'javascript',tsx:'javascript',py:'python',cpp:'text/x-c++src',c:'text/x-csrc',java:'text/x-java',rs:'rust',go:'text/x-go',sh:'shell',html:'htmlmixed',css:'css',json:'javascript',md:'text/plain',txt:'text/plain' };

// VS Code-style file icons using text/symbols — no emojis
const FILE_ICONS = { js:'JS',jsx:'JSX',ts:'TS',tsx:'TSX',py:'PY',cpp:'C++',c:'C',java:'JV',rs:'RS',go:'GO',sh:'SH',html:'HTM',css:'CSS',json:'JSON',md:'MD',txt:'TXT' };
const ext = n => n.split('.').pop().toLowerCase();
const modeOf = n => MODE_MAP[ext(n)] || 'text/plain';
const fileIconOf = n => FILE_ICONS[ext(n)] || 'F';

const renderAIText = text => {
  const parts = [], re = /```(\w*)\n?([\s\S]*?)```/g;
  let last=0,match,key=0;
  while((match=re.exec(text))!==null){
    if(match.index>last)parts.push(<span key={key++} style={{whiteSpace:'pre-wrap'}}>{text.slice(last,match.index)}</span>);
    parts.push(<pre key={key++} style={{background:'#0d0e12',borderRadius:6,padding:'10px 12px',fontFamily:'var(--font-mono)',fontSize:12,overflowX:'auto',margin:'6px 0',border:'1px solid rgba(255,255,255,0.08)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>
      {match[1]&&<div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:4}}>{match[1]}</div>}
      {match[2].trim()}
    </pre>);
    last=match.index+match[0].length;
  }
  if(last<text.length)parts.push(<span key={key++} style={{whiteSpace:'pre-wrap'}}>{text.slice(last)}</span>);
  return parts;
};

// ── Tree helpers ──
let _fid = 300;
const mkFile = (name, code='', parentId=null) => ({ id:`cf${_fid++}`, name, type:'file', code, parentId });
const mkFolder = (name, parentId=null) => ({ id:`cd${_fid++}`, name, type:'folder', children:[], parentId, collapsed:false });

const STARTERS = {
  'index.js': 'console.log("Hello from SyncCode!");\n',
  'main.py': 'print("Hello from SyncCode!")\n',
  'README.md': '# My Project\n\nBuilt with SyncCode Team Collab.\n',
};

// Persist project tree per room
const saveTree = (roomId, tree) => {
  try { localStorage.setItem(`synccode_tree_${roomId}`, JSON.stringify(tree)); } catch {}
};
const loadTree = (roomId) => {
  try {
    const saved = localStorage.getItem(`synccode_tree_${roomId}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
};

const flatFiles = nodes => {
  let result = [];
  nodes.forEach(n => {
    if (n.type === 'file') result.push(n);
    else if (n.type === 'folder' && n.children) result = [...result, ...flatFiles(n.children)];
  });
  return result;
};

const findNode = (nodes, id) => {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.type === 'folder') { const f = findNode(n.children, id); if (f) return f; }
  }
  return null;
};

const CollabPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const username = location.state?.username || 'User';

  const initTree = () => {
    const saved = loadTree(roomId);
    if (saved) return saved;
    return [
      mkFile('index.js', STARTERS['index.js']),
      mkFile('README.md', STARTERS['README.md']),
    ];
  };

  const [tree, setTree] = useState(initTree);
  const [activeFileId, setActiveFileId] = useState(null);
  const [clients, setClients] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [newItemState, setNewItemState] = useState(null); // {parentId, kind, insertAfter}
  const [newItemName, setNewItemName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [aiMessages, setAiMessages] = useState([{ role:'assistant', text:'Hi! Ask me anything about the project. Attach images for context.', ts:Date.now() }]);
  const [aiHistory, setAiHistory] = useState([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [imgPreview, setImgPreview] = useState(null);
  const [aiWidth, setAiWidth] = useState(300);

  const socketRef = useRef(null);
  const codeRef = useRef('');
  const aiEndRef = useRef(null);
  const newItemInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const imgRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  const allFiles = flatFiles(tree);
  const curFileId = activeFileId || allFiles[0]?.id;
  const activeFile = allFiles.find(f => f.id === curFileId) || allFiles[0];

  // Save tree on every change
  useEffect(() => { saveTree(roomId, tree); }, [tree, roomId]);
  useEffect(() => { if (activeFile) codeRef.current = activeFile.code; }, [curFileId]);
  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [aiMessages]);
  useEffect(() => { if (newItemState) newItemInputRef.current?.focus(); }, [newItemState]);
  useEffect(() => { if (renamingId) renameInputRef.current?.focus(); }, [renamingId]);

  // Close context menu on click elsewhere
  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // Socket
  useEffect(() => {
    const socket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000');
    socketRef.current = socket;
    socket.emit(ACTIONS.JOIN, { roomId, username });

    socket.on(ACTIONS.JOINED, ({ clients: c, username: u, socketId }) => {
      setClients(c);
      if (u !== username) toast.success(`${u} joined`);
      socket.emit(ACTIONS.SYNC_CODE, { code: codeRef.current, socketId });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({ code: c }) => {
      if (c !== null) {
        codeRef.current = c;
        setTree(prev => updateFileCode(prev, curFileId, c));
      }
    });

    socket.on(ACTIONS.DISCONNECTED, ({ username: u, socketId }) => {
      toast(`${u} left`);
      setClients(prev => prev.filter(c => c.socketId !== socketId));
    });

    return () => socket.disconnect();
  }, [roomId, username]);

  const updateFileCode = (nodes, id, code) => nodes.map(n => {
    if (n.id === id && n.type === 'file') return { ...n, code };
    if (n.type === 'folder') return { ...n, children: updateFileCode(n.children, id, code) };
    return n;
  });

  const handleCodeChange = val => {
    codeRef.current = val;
    setTree(prev => updateFileCode(prev, curFileId, val));
    socketRef.current?.emit(ACTIONS.CODE_CHANGE, { roomId, code: val });
  };

  const switchFile = id => {
    const f = allFiles.find(f => f.id === id);
    if (f) codeRef.current = f.code;
    setActiveFileId(id);
    setContextMenu(null);
  };

  const toggleFolder = id => {
    const toggle = nodes => nodes.map(n => {
      if (n.id === id) return { ...n, collapsed: !n.collapsed };
      if (n.type === 'folder') return { ...n, children: toggle(n.children) };
      return n;
    });
    setTree(toggle);
  };

  // Insert a new node: if parentId is a folder, insert inside it; else insert at root
  const insertNode = (nodes, parentId, newNode) => {
    if (parentId === null) return [...nodes, newNode];
    return nodes.map(n => {
      if (n.id === parentId && n.type === 'folder') {
        return { ...n, collapsed: false, children: [...n.children, newNode] };
      }
      if (n.type === 'folder') return { ...n, children: insertNode(n.children, parentId, newNode) };
      return n;
    });
  };

  const removeNode = (nodes, id) => nodes.filter(n => {
    if (n.id === id) return false;
    if (n.type === 'folder') n.children = removeNode(n.children, id);
    return true;
  });

  const renameNode = (nodes, id, newName) => nodes.map(n => {
    if (n.id === id) return { ...n, name: newName };
    if (n.type === 'folder') return { ...n, children: renameNode(n.children, id, newName) };
    return n;
  });

  const commitNewItem = e => {
    if (e.key === 'Enter' && newItemName.trim()) {
      const name = newItemName.trim();
      if (allFiles.find(f => f.name === name)) { toast.error('Name already exists'); return; }
      const newNode = newItemState.kind === 'folder'
        ? mkFolder(name, newItemState.parentId)
        : mkFile(name, '', newItemState.parentId);
      setTree(prev => insertNode(prev, newItemState.parentId, newNode));
      if (newItemState.kind === 'file') setActiveFileId(newNode.id);
      setNewItemState(null); setNewItemName('');
    }
    if (e.key === 'Escape') { setNewItemState(null); setNewItemName(''); }
  };

  const commitRename = (e, id) => {
    if (e.key === 'Enter' && renameVal.trim()) {
      setTree(prev => renameNode(prev, id, renameVal.trim()));
      setRenamingId(null);
    }
    if (e.key === 'Escape') setRenamingId(null);
  };

  const deleteNode = id => {
    setContextMenu(null);
    const files = flatFiles(tree);
    const isActive = id === curFileId;
    setTree(prev => removeNode([...prev], id));
    if (isActive) {
      const remaining = files.filter(f => f.id !== id);
      setActiveFileId(remaining[0]?.id || null);
    }
  };

  const showCtx = (e, nodeId, nodeType) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId, nodeType });
  };

  // Resize AI
  const onResizeAI = useCallback(e => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = aiWidth;
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  }, [aiWidth]);

  useEffect(() => {
    const onMove = e => { if (!isDragging.current) return; setAiWidth(Math.min(520, Math.max(200, dragStartW.current + dragStartX.current - e.clientX))); };
    const onUp = () => { isDragging.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const copyRoomId = async () => {
    try { await navigator.clipboard.writeText(roomId); toast.success('Room ID copied'); }
    catch { toast.error('Could not copy'); }
  };

  const downloadProject = () => {
    allFiles.forEach(f => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([f.code], { type: 'text/plain' }));
      a.download = f.name; a.click();
    });
    toast.success(`${allFiles.length} file${allFiles.length > 1 ? 's' : ''} downloaded`);
  };

  const handleImgSelect = e => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 4*1024*1024) { toast.error('Max 4MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setImgPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const sendAI = async () => {
    if (!aiInput.trim() && !imgPreview) return;
    const msg = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role:'user', text: msg || '(image attached)', imgPreview, ts: Date.now() }]);
    setImgPreview(null);
    const userContent = { role:'user', content:`File: ${activeFile?.name}\n\`\`\`\n${codeRef.current}\n\`\`\`\n\n${msg}` };
    const newHistory = [...aiHistory, userContent];
    setAiLoading(true);
    try {
      const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const { data } = await axios.post(`${base}/api/v1/ai/suggest`, { messages: newHistory });
      if (data.success) {
        setAiHistory([...newHistory, { role:'assistant', content: data.suggestion }]);
        setAiMessages(prev => [...prev, { role:'assistant', text: data.suggestion, ts: Date.now() }]);
      }
    } catch {
      setAiMessages(prev => [...prev, { role:'assistant', text: 'Could not reach AI.', ts: Date.now() }]);
    } finally { setAiLoading(false); }
  };

  // ── Tree renderer ──
  const renderTree = (nodes, depth=0) => nodes.map(node => (
    <React.Fragment key={node.id}>
      {node.type === 'folder' ? (
        <>
          <div
            className="tree-item folder"
            style={{ paddingLeft: 8 + depth*14 }}
            onClick={() => toggleFolder(node.id)}
            onContextMenu={e => showCtx(e, node.id, 'folder')}>
            <span className="tree-folder-arrow">{node.collapsed ? '▶' : '▼'}</span>
            <span className="tree-folder-name">{node.name}</span>
          </div>
          {!node.collapsed && (
            <>
              {newItemState && newItemState.parentId === node.id && (
                <div style={{ paddingLeft: 8 + (depth+1)*14 }}>
                  <input ref={newItemInputRef} className="new-file-input"
                    placeholder={newItemState.kind === 'folder' ? 'folder-name' : 'filename.js'}
                    value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={commitNewItem} />
                </div>
              )}
              {renderTree(node.children, depth+1)}
            </>
          )}
        </>
      ) : (
        <div
          className={`tree-item${node.id === curFileId ? ' active' : ''}`}
          style={{ paddingLeft: 8 + depth*14 }}
          onClick={() => switchFile(node.id)}
          onContextMenu={e => showCtx(e, node.id, 'file')}>
          {renamingId === node.id ? (
            <input ref={renameInputRef} className="new-file-input" style={{flex:1,margin:'0 4px'}}
              value={renameVal} onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => commitRename(e, node.id)} onClick={e => e.stopPropagation()} />
          ) : (
            <>
              <span className="tree-file-badge">{fileIconOf(node.name)}</span>
              <span className="tree-file-name">{node.name}</span>
            </>
          )}
        </div>
      )}
    </React.Fragment>
  ));

  if (!location.state) { navigate('/'); return null; }

  return (
    <div className="collab-shell-v2">
      {/* Topbar */}
      <div className="topbar-v2">
        <div className="topbar-left">
          <button className="icon-btn" onClick={() => navigate('/home')}>Home</button>
          <div className="topbar-sep" />
          <span className="topbar-brand">Sync<span>Code</span></span>
          <span className="mode-badge collab">Team Collab</span>
          <span className="room-pill">{roomId.slice(0,12)}…</span>
          <button className="icon-btn" onClick={copyRoomId}>Copy ID</button>
        </div>
        <div className="topbar-right">
          <button className="download-btn" onClick={downloadProject}>Download all</button>
        </div>
      </div>

      {/* Body */}
      <div className="collab-body-v2">
        {/* File tree */}
        <div className="file-sidebar">
          <div className="file-sidebar-header">
            <span className="file-sidebar-title">EXPLORER</span>
            <div style={{ display:'flex', gap:2 }}>
              <button className="tree-btn" onClick={() => setNewItemState({ parentId:null, kind:'file' })} title="New file">+F</button>
              <button className="tree-btn" onClick={() => setNewItemState({ parentId:null, kind:'folder' })} title="New folder">+D</button>
            </div>
          </div>
          <div className="file-sidebar-body">
            {newItemState && newItemState.parentId === null && (
              <input ref={newItemInputRef} className="new-file-input"
                placeholder={newItemState.kind === 'folder' ? 'folder-name' : 'filename.js'}
                value={newItemName} onChange={e => setNewItemName(e.target.value)} onKeyDown={commitNewItem} />
            )}
            {renderTree(tree)}
          </div>
          {/* Online users */}
          <div className="users-panel">
            <div className="users-title">ONLINE — {Math.max(clients.length, 1)}</div>
            <div>
              <span className="user-pill"><span className="user-dot" />{username}</span>
              {clients.filter(c => c.username !== username).map(c => (
                <span key={c.socketId} className="user-pill"><span className="user-dot" />{c.username}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="code-editor-wrap" style={{ flex:1, minWidth:0 }}>
          {activeFile ? (
            <CodeMirror value={activeFile.code}
              options={{ mode: modeOf(activeFile.name), theme:'synccode', lineNumbers:true, autoCloseBrackets:true, matchBrackets:true, lineWrapping:false, indentUnit:2, tabSize:2, styleActiveLine:true, extraKeys:{'Tab':'indentMore','Shift-Tab':'indentLess'} }}
              onBeforeChange={(_e,_d,val) => handleCodeChange(val)} />
          ) : (
            <div className="empty-editor"><span className="empty-icon">No files</span><p>Create a file to start editing</p></div>
          )}
        </div>

        {/* Resize AI */}
        <div className="resize-handle" onMouseDown={onResizeAI} />

        {/* AI panel */}
        <div className="ai-panel-v2" style={{ width: aiWidth }}>
          <div className="ai-panel-header">
            <span className="ai-title"><span className="ai-dot" />AI assistant</span>
            <button className="icon-btn" style={{ fontSize:11, padding:'2px 6px' }}
              onClick={() => { setAiMessages([{ role:'assistant', text:'Chat cleared.', ts:Date.now() }]); setAiHistory([]); }}>Clear</button>
          </div>
          <div className="ai-messages">
            {aiMessages.map((m,i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                {m.imgPreview && <img src={m.imgPreview} alt="attached" className="img-preview" />}
                <div>{renderAIText(m.text)}</div>
                <div className="ai-msg-time">{new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            ))}
            {aiLoading && <div className="ai-msg assistant"><div className="output-spinner"><span className="spinner"/>Thinking…</div></div>}
            <div ref={aiEndRef} />
          </div>
          {imgPreview && (
            <div style={{ padding:'6px 10px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
              <img src={imgPreview} alt="preview" className="img-preview" />
              <button onClick={() => setImgPreview(null)} style={{ fontSize:10, background:'none', border:'none', color:'#ef4444', cursor:'pointer', marginTop:2 }}>Remove</button>
            </div>
          )}
          <div className="ai-input-area">
            <div className="ai-image-upload">
              <button className="img-upload-btn" onClick={() => imgRef.current?.click()}>Attach image</button>
              <input ref={imgRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImgSelect} />
            </div>
            <textarea className="ai-textarea" rows={3}
              placeholder="Ask about the project… (Enter to send)"
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendAI();} }} />
            <button className="ai-send-btn" onClick={sendAI} disabled={(!aiInput.trim()&&!imgPreview)||aiLoading}>Send</button>
          </div>
        </div>

        {/* Right-click context menu */}
        {contextMenu && (
          <div className="context-menu" style={{ top:contextMenu.y, left:contextMenu.x }} onClick={e => e.stopPropagation()}>
            <div className="ctx-item" onClick={() => { setNewItemState({ parentId: contextMenu.nodeId, kind:'file' }); setContextMenu(null); }}>New file inside</div>
            {contextMenu.nodeType === 'folder' && (
              <div className="ctx-item" onClick={() => { setNewItemState({ parentId: contextMenu.nodeId, kind:'folder' }); setContextMenu(null); }}>New folder inside</div>
            )}
            <div className="ctx-item" onClick={() => {
              const node = findNode(tree, contextMenu.nodeId);
              if (node) { setRenamingId(contextMenu.nodeId); setRenameVal(node.name); }
              setContextMenu(null);
            }}>Rename</div>
            <div className="ctx-item danger" onClick={() => deleteNode(contextMenu.nodeId)}>Delete</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollabPage;