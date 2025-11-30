'use client';
import React, { createContext, useState, useEffect } from 'react';
import api, { setAuthToken } from './api';


type User = { _id?: string; name?: string; email?: string; role?: string; department?: string } | null;


const AuthContext = createContext({
user: null as User,
token: null as string | null,
login: async (email: string, password: string) => {},
logout: () => {},
register: async (payload: any) => {}
});


export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
const [token, setToken] = useState<string | null>(() => typeof window !== 'undefined' ? localStorage.getItem('token') : null);
const [user, setUser] = useState<User>(null);


useEffect(() => {
setAuthToken(token);
if (token) {
// lazy fetch user info (optionally backend could provide /me)
// We'll decode token lightly or call a safe endpoint - here we'll just trust token and let pages fetch as needed
localStorage.setItem('token', token);
} else {
localStorage.removeItem('token');
}
}, [token]);


const login = async (email: string, password: string) => {
const { data } = await api.post('/auth/login', { email, password });
if (data.mfaRequired) return { mfaRequired: true, tempToken: data.tempToken };
setToken(data.token);
setAuthToken(data.token);
// fetch user basic info if you have /me endpoint; else decode token clientside or fetch paper lists
return { token: data.token };
};


const logout = () => {
setToken(null);
setUser(null);
setAuthToken(null);
};


const register = async (payload: any) => {
const { data } = await api.post('/auth/register', payload);
return data;
};


return (
<AuthContext.Provider value={{ user, token, login, logout, register }}>
{children}
</AuthContext.Provider>
);
};


export default AuthContext;