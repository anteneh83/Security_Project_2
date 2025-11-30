'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function MfaSendPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
const handleSendOtp = async () => {
  if (!email) return setError('Please enter your email');

  try {
    setError('');
    setSuccess('');
    const token = localStorage.getItem('token'); // optional, if user logged in
    const res = await axios.post(
      'http://localhost:4000/api/auth/mfa/setup',
      { email },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    // store tempToken in localStorage for verification page
    localStorage.setItem('tempToken', res.data.tempToken);
    setSuccess('OTP sent! Check your email.');

    setTimeout(() => router.push('/auth/mfa/verify'), 1500);
  } catch (err: any) {
    setError(err.response?.data?.message || 'Failed to send OTP');
  }
};


  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold mb-4 text-center">Enable MFA</h2>
        <p className="text-sm text-gray-600 mb-3 text-center">
          Enter your email to receive an OTP.
        </p>
        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border w-full p-2 rounded-md mb-3"
        />
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        {success && <div className="text-green-600 text-sm mb-2">{success}</div>}
        <button
          onClick={handleSendOtp}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
        >
          Send OTP
        </button>
      </div>
    </div>
  );
}
