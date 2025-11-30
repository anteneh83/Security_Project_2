'use client';
import Link from 'next/link';
import useAuth from '@/hooks/useAuth';


export default function Navbar() {
const { token, logout } = useAuth();
return (
<nav className="bg-white shadow">
<div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
<Link href="/" className="font-bold">RPSRP</Link>
<div className="space-x-2">
{!token ? (
<>
<Link href="/auth/login" className="px-3 py-1">Login</Link>
<Link href="/auth/register" className="px-3 py-1">Register</Link>
</>
) : (
<>
<Link href="/dashboard" className="px-3 py-1">Dashboard</Link>
<button onClick={() => logout()} className="px-3 py-1">Logout</button>
</>
)}
</div>
</div>
</nav>
);
}