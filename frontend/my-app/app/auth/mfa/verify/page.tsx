'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function MfaVerifyPage() {
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleVerify = async () => {
  const tempToken = localStorage.getItem('tempToken');
  if (!otp) return setError('Please enter OTP');
  if (!tempToken) return setError('Missing temp token. Go back and request OTP.');

  try {
    setError('');
    const res = await axios.post('http://localhost:4000/api/auth/mfa/verify', { tempToken, otp });

    if (res.data.token) {
      localStorage.setItem('token', res.data.token); // main JWT
      localStorage.setItem('role', res.data.role || 'author');
      localStorage.removeItem('tempToken'); // cleanup
      setSuccess('✅ MFA verified! Redirecting...');

      setTimeout(() => router.push('/dashboard'), 1500);
    }
  } catch (err: any) {
    setError(err.response?.data?.message || 'Invalid OTP');
  }
};


  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold mb-4 text-center">Verify OTP</h2>
        <p className="text-sm text-gray-600 mb-3 text-center">
          Enter the OTP sent to your email.
        </p>
        <input
          type="text"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="border w-full p-2 rounded-md mb-3"
        />
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        {success && <div className="text-green-600 text-sm mb-2">{success}</div>}
        <button
          onClick={handleVerify}
          className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
        >
          Verify & Enable MFA
        </button>
      </div>
    </div>
  );
}
