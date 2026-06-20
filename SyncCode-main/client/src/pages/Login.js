import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
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
          <input type="email" placeholder="Enter your email" value={email}
            onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(er => ({ ...er, email: '' })); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={isLoading}
            style={{ width: '100%', borderColor: errors.email ? '#ef4444' : undefined }} />
          {errors.email && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.email}</p>}
        </div>

        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password"
            value={password}
            onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(er => ({ ...er, password: '' })); }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            disabled={isLoading}
            style={{ width: '100%', paddingRight: 40, borderColor: errors.password ? '#ef4444' : undefined }} />
          <button type="button"
            onMouseDown={() => setShowPassword(true)} onMouseUp={() => setShowPassword(false)}
            onMouseLeave={() => setShowPassword(false)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16, padding: 0 }}>
            {showPassword ? '🙈' : '👁'}
          </button>
          {errors.password && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.password}</p>}
        </div>

        <button onClick={handleLogin} disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Signing in...' : 'Login'}
        </button>
        <p className="createInfo">Don't have an account? <Link to="/signup" className="createNewBtn">Sign up here</Link></p>
      </div>
    </div>
  );
};

export default Login;