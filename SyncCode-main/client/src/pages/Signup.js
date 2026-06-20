import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const strengthRules = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One uppercase letter', test: p => /[A-Z]/.test(p) },
  { label: 'One number', test: p => /[0-9]/.test(p) },
  { label: 'One special character (!@#$...)', test: p => /[^A-Za-z0-9]/.test(p) },
];

const getStrength = (p) => {
  if (!p) return { score: 0, label: '', color: '' };
  const passed = strengthRules.filter(r => r.test(p)).length;
  if (passed <= 1) return { score: 1, label: 'Weak', color: '#ef4444' };
  if (passed === 2) return { score: 2, label: 'Fair', color: '#f59e0b' };
  if (passed === 3) return { score: 3, label: 'Good', color: '#3b82f6' };
  return { score: 4, label: 'Strong', color: '#3ecf6e' };
};

const Signup = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const strength = getStrength(form.password);

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (form.password.length < 8) e.password = 'At least 8 characters required';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Add at least one uppercase letter';
    else if (!/[0-9]/.test(form.password)) e.password = 'Add at least one number';
    else if (!/[^A-Za-z0-9]/.test(form.password)) e.password = 'Add at least one special character';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }));
  };

  const handleSignup = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
      const res = await axios.post(`${backendUrl}/api/v1/auth/signup`,
        { name: form.name.trim(), email: form.email.toLowerCase().trim(), password: form.password },
        { withCredentials: true });
      if (res.data.success) {
        toast.success('Account created! Please sign in.');
        setTimeout(() => navigate('/login'), 1000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || '';
      if (msg.toLowerCase().includes('exist')) {
        setErrors(e => ({ ...e, email: 'Email already registered.' }));
        toast.error('Email already registered.');
      } else {
        toast.error(msg || 'Signup failed. Try again.');
      }
    } finally { setIsLoading(false); }
  };

  return (
    <div className="authForm">
      <h2>Create Account</h2>
      <div style={{ maxWidth: 380, width: '100%' }}>

        {/* Name */}
        <div style={{ marginBottom: '1rem' }}>
          <input type="text" placeholder="Enter your name" value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignup()}
            disabled={isLoading}
            style={{ width: '100%', borderColor: errors.name ? '#ef4444' : undefined }} />
          {errors.name && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.name}</p>}
        </div>

        {/* Email */}
        <div style={{ marginBottom: '1rem' }}>
          <input type="email" placeholder="Enter your email" value={form.email}
            onChange={e => set('email', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignup()}
            disabled={isLoading}
            style={{ width: '100%', borderColor: errors.email ? '#ef4444' : undefined }} />
          {errors.email && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.email}</p>}
        </div>

        {/* Password */}
        <div style={{ marginBottom: '0.5rem', position: 'relative' }}>
          <input type={showPassword ? 'text' : 'password'} placeholder="Create a password"
            value={form.password} onChange={e => set('password', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignup()}
            disabled={isLoading}
            style={{ width: '100%', paddingRight: 40, borderColor: errors.password ? '#ef4444' : undefined }} />
          <button type="button"
            onMouseDown={() => setShowPassword(true)} onMouseUp={() => setShowPassword(false)}
            onMouseLeave={() => setShowPassword(false)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16, padding: 0 }}>
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>

        {/* Strength bar */}
        {form.password.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)', transition: 'background 0.2s' }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '0.75rem', color: strength.color, fontWeight: 500 }}>{strength.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                {strengthRules.map((r, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', color: r.test(form.password) ? '#3ecf6e' : 'rgba(255,255,255,0.35)' }}>
                    {r.test(form.password) ? '✓' : '○'} {r.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        {errors.password && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '0.5rem' }}>{errors.password}</p>}

        {/* Confirm password */}
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <input type={showConfirm ? 'text' : 'password'} placeholder="Confirm your password"
            value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSignup()}
            disabled={isLoading}
            style={{ width: '100%', paddingRight: 40, borderColor: errors.confirmPassword ? '#ef4444' : undefined }} />
          <button type="button"
            onMouseDown={() => setShowConfirm(true)} onMouseUp={() => setShowConfirm(false)}
            onMouseLeave={() => setShowConfirm(false)}
            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 16, padding: 0 }}>
            {showConfirm ? '🙈' : '👁'}
          </button>
          {errors.confirmPassword && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{errors.confirmPassword}</p>}
        </div>

        <button onClick={handleSignup} disabled={isLoading} style={{ width: '100%' }}>
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </button>
        <p className="createInfo">Already have an account? <Link to="/login" className="createNewBtn">Login here</Link></p>
      </div>
    </div>
  );
};

export default Signup;