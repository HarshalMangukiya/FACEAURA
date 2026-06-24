import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch the logged-in user profile
  const fetchProfile = async () => {
    try {
      const response = await api.get('/api/users/profile/');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const tokensStr = localStorage.getItem('faceaura_tokens');
    if (tokensStr) {
      // Fetch user profile if we have tokens stored
      fetchProfile();
    } else {
      setLoading(false);
    }

    // Set up global listener for forced logout from API client
    const handleLogout = () => {
      setUser(null);
    };
    window.addEventListener('auth_logout', handleLogout);
    return () => {
      window.removeEventListener('auth_logout', handleLogout);
    };
  }, []);

  const login = async (username, password) => {
    // We call standard axios since we don't have authorization header yet
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const response = await axios.post(`${API_BASE_URL}/api/token/`, {
      username,
      password,
    });
    
    // Save tokens in localStorage
    localStorage.setItem('faceaura_tokens', JSON.stringify({
      access: response.data.access,
      refresh: response.data.refresh
    }));
    
    // Fetch profile
    setLoading(true);
    await fetchProfile();
    return response.data;
  };

  const register = async (username, email, password) => {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const response = await axios.post(`${API_BASE_URL}/api/users/register/`, {
      username,
      email,
      password,
    });
    return response.data;
  };

  const logout = () => {
    // Optional: Call /api/users/logout/ on the server
    api.post('/api/users/logout/').catch(() => {});
    
    localStorage.removeItem('faceaura_tokens');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
