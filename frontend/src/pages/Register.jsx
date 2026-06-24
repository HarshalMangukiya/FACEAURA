import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Key, User, Mail, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    setFieldErrors({});
    setSuccessMsg('');

    if (!username.trim() || !email.trim() || !password) {
      setGeneralError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password);
      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      console.error(err);
      if (err.response?.data && typeof err.response.data === 'object') {
        const data = err.response.data;
        if (data.detail) {
          setGeneralError(data.detail);
        } else {
          setFieldErrors(data);
        }
      } else {
        setGeneralError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Glow effect backdrops */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Form Container */}
        <div className="relative glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl accent-glow-violet">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 bg-gradient-to-tr from-violet-500 to-indigo-500 rounded-2xl shadow-lg shadow-violet-500/20 mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Create Account</h2>
            <p className="mt-2 text-slate-400 text-sm">Join FaceAura and start your skincare & style journey</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {generalError && (
              <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm animate-shake">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{generalError}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300 text-sm">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{successMsg}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`form-input-dark w-full pl-11 pr-4 py-3 rounded-2xl text-base ${
                    fieldErrors.username ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
                  }`}
                  placeholder="Choose a username"
                  autoComplete="username"
                  required
                />
              </div>
              {fieldErrors.username && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium pl-1">{fieldErrors.username[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`form-input-dark w-full pl-11 pr-4 py-3 rounded-2xl text-base ${
                    fieldErrors.email ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
                  }`}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs text-rose-400 font-medium pl-1">{fieldErrors.email[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`form-input-dark w-full pl-11 pr-4 py-3 rounded-2xl text-base ${
                    fieldErrors.password ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : ''
                  }`}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              {fieldErrors.password && (
                <div className="mt-1.5 space-y-0.5 text-xs text-rose-400 font-medium pl-1">
                  {fieldErrors.password.map((err, idx) => (
                    <p key={idx}>{err}</p>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !!successMsg}
              className="relative w-full mt-2 py-3.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-[0.98] text-white font-semibold rounded-2xl shadow-xl shadow-violet-600/15 hover:shadow-violet-600/25 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-8 text-center border-t border-slate-800/80 pt-6">
            <p className="text-slate-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Register;
