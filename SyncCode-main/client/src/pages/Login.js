import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const EyeIcon = ({ open }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {open ? (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </>
    ) : (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </>
    )}
  </svg>
);

const PasswordInput = ({ value, onChange, onKeyDown, disabled, error, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder || 'Enter your password'}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        disabled={disabled}
        style={{
          width: '100%',
          paddingRight: 44,
          borderColor: error ? '#ef4444' : undefined,
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        className="eye-btn"
        onClick={() => setShow(v => !v)}
        style={{
          position: 'absolute',
          right: 14,
          zIndex: 1,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: show ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
          lineHeight: 1,
        }}
        tabIndex={-1}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    setErrors({});
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const res = await axios.post(`${backendUrl}/api/v1/auth/login`,
        { email: email.toLowerCase().trim(), password },
        { withCredentials: true });
      if (res.data.success) {
        const name = res.data.user?.name || email.split('@')[0];
        localStorage.setItem('synccode_user', JSON.stringify({ name, email: email.toLowerCase().trim() }));
        toast.success('Welcome back!');
        navigate('/home');
      }
    } catch (err) {
      const status = err.response?.status;
      let msg = 'Login failed. Please try again.';
      if (status === 401 || status === 403 || status === 400) msg = err.response?.data?.message || 'Invalid email or password';
      else if (status === 404) msg = 'Account not found. Please sign up first.';
      else if (err.message === 'Network Error') msg = 'Cannot connect to server.';
      toast.error(msg);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="authForm">
      <h2>Login</h2>
      <div style={{ maxWidth: 380, width: '100%' }}>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(er => ({ ...er, email: '' })); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={isLoading}
            style={{ width: '100%', borderColor: errors.email ? '#ef4444' : undefined }}
          />
          {errors.email && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.email}</p>}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <PasswordInput
            value={password}
            onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(er => ({ ...er, password: '' })); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={isLoading}
            error={errors.password}
          />
          {errors.password && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.password}</p>}
        </div>

        <button onClick={handleLogin} disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Signing in...' : 'Login'}
        </button>

        <p className="createInfo">
          Don't have an account? <Link to="/signup" className="createNewBtn">Sign up here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;