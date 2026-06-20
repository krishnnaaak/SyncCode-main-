import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/Home';
import EditorPage from './pages/EditorPage';
import InterviewPage from './pages/InterviewPage';
import CollabPage from './pages/CollabPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/editor/:roomId" element={<ProtectedRoute><EditorPage /></ProtectedRoute>} />
        <Route path="/interview/:roomId" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
        <Route path="/collab/:roomId" element={<ProtectedRoute><CollabPage /></ProtectedRoute>} />
      </Routes>

      <Toaster
        position="top-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: { background: '#1e2130', color: '#f0f0f0', fontSize: '13px', fontWeight: '500', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' },
          success: { duration: 3000, iconTheme: { primary: '#3ecf6e', secondary: '#1e2130' } },
          error: { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#1e2130' } },
        }}
      />
    </BrowserRouter>
  );
}

export default App;