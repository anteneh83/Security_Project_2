'use client';

import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import ReCAPTCHA from 'react-google-recaptcha';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const auth = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');

    if (!name || !email || !department || !password || !captchaToken) {
      setError('All fields and CAPTCHA are required.');
      return;
    }

    try {
      const res = await auth.register({
        name,
        email,
        password,
        department,
        captcha: captchaToken
      });

      setMsg(res.message || 'Registered successfully! Check your email for verification.');

      // Redirect to login after success
      setTimeout(() => router.push('/auth/login'), 2000);

    } catch (err) {
      console.log(err);
      const errorMessage =
        err?.response?.data?.message ||
        err.message ||
        'Registration failed';

      if (errorMessage.includes('Email already used')) {
        setError('This email is already registered. Please login or use another email.');
      } else if (errorMessage.includes('Email and password required')) {
        setError('Email and password are required.');
      } else if (errorMessage.includes('Captcha')) {
        setError('Please complete the CAPTCHA challenge.');
      } else {
        setError(errorMessage);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-6 rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Register</h2>

        <form onSubmit={handleSubmit} className="space-y-3">

          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />

          <input
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />

          <input
            placeholder="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />

          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
            required
          />

          {/* -------------------- CAPTCHA -------------------- */}
          <ReCAPTCHA
            sitekey="6Lce1BwsAAAAAG4TGGi8bWkFihSTaF9FZX2ehbrT"
            onChange={(token) => setCaptchaToken(token)}
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            Register
          </button>
        </form>

        {msg && <p className="text-green-600 mt-2">{msg}</p>}
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </div>
    </div>
  );
}
