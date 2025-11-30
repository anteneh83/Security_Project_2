'use client';
import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res: any = await auth.login(email, password);

      // -------------------- Admin / Superadmin (NO MFA) --------------------
      if (['admin', 'superadmin'].includes(res.role)) {
        router.push('/dashboard/admin');
        return;
      }

      // -------------------- MFA REQUIRED --------------------
      if (res.mfaRequired) {
        localStorage.setItem('tempToken', res.token);

        if (res.alreadyEnabled) {
          // router.push(`/auth/mfa/verify?role=${res.role}`);
           if (res.role === 'author') {
            router.push('/dashboard/author');
           } else if (res.role === 'editor') {
              router.push('/dashboard/editor');
           } else if (res.role === 'reviewer') {
              router.push('/dashboard/reviewer');
           } else {
              router.push('/dashboard/hr');
           }
        } else {
          router.push(`/auth/mfa-prompt?role=${res.role}`);
        }
        return;
      } else {
        router.push(`/auth/mfa-prompt?role=${res.role}`);
      }

    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Login</h2>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            Login
          </button>
        </form>

        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>
    </div>
  );
}
