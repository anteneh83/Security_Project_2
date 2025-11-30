'use client';
import { useState } from 'react';
import axios from 'axios';

export default function useAuth() {
  const [token, setToken] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('token') : null
  );

  const [role, setRole] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('role') : null
  );

  // -------------------- REGISTER --------------------
  const register = async ({ name, email, password, department }) => {
    const res = await axios.post('http://localhost:4000/api/auth/register', {
      name,
      email,
      password,
      department,
    });
    return res.data;
  };

  // -------------------- LOGIN --------------------
  const login = async (email, password) => {
    try {
      const res = await axios.post('http://localhost:4000/api/auth/login', {
        email,
        password
      });

      const data = res.data;

      // If admin or superadmin → token is final
      if (!data.mfaRequired) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role || 'author');
        setToken(data.token);
        setRole(data.role || 'author');
      }

      return {
        token: data.token || data.tempToken,   // MFA flow uses tempToken
        role: data.role,
        mfaRequired: data.mfaRequired,
        alreadyEnabled: data.alreadyEnabled || false,
        success: true,
      };
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Login failed');
    }
  };

  // -------------------- VERIFY MFA --------------------
  const verifyMfa = async (tempToken, otp) => {
    const res = await axios.post('http://localhost:4000/api/auth/mfa/verify', {
      tempToken,
      otp
    });

    const data = res.data;

    // Save final JWT
    localStorage.setItem('token', data.token);
    localStorage.setItem('role', data.role || 'author');
    localStorage.removeItem('tempToken');

    setToken(data.token);
    setRole(data.role || 'author');

    return { token: data.token, role: data.role, success: true };
  };

  // -------------------- LOGOUT --------------------
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('tempToken');
    setToken(null);
    setRole(null);
  };

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  return { register, login, verifyMfa, logout, token, role, getAuthHeaders };
}
