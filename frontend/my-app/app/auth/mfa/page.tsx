'use client';
import { useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function MfaPage() {
  const router = useRouter();
  const { role: roleFromStorage } = useAuth();
  const role = roleFromStorage || 'author';

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [secret, setSecret] = useState('');
  const [setupDone, setSetupDone] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [tempToken, setTempToken] = useState('');

  const handleSendOtp = async () => {
    if (!email) return setError('Please enter your email');

    try {
      setError('');
      const token = localStorage.getItem('token'); // optional, can remove if not needed
      const res = await axios.post(
        'http://localhost:4000/api/auth/mfa/setup',
        { email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSecret(res.data.secret);
      setTempToken(res.data.tempToken); // store tempToken for verification
      setOtpSent(true); // show OTP input and verify button
      console.log('MFA Secret:', res.data.secret, 'Temp Token:', res.data.tempToken);
      console.log(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };


const handleVerify = async () => {
  if (!otp) return setError('Please enter OTP');

  try {
    const res = await axios.post(
      'http://localhost:4000/api/auth/mfa/verify',
      { tempToken, otp } // use tempToken here
    );

    if (res.data.success) {
      setSetupDone(true);

      // store real token in localStorage if needed
      localStorage.setItem('token', res.data.token);

      // redirect
      setTimeout(() => {
        switch (role) {
          case 'admin':
          case 'superadmin':
            router.push('/dashboard/admin');
            break;
          case 'editor':
            router.push('/dashboard/editor');
            break;
          case 'reviewer':
            router.push('/dashboard/reviewer');
            break;
          case 'author':
            router.push('/dashboard/author');
            break;
          case 'hr':
            router.push('/dashboard/hr');
            break;
          default:
            router.push('/dashboard');
        }
      }, 2000);
    }
  } catch (err: any) {
    setError(err.response?.data?.message || 'Invalid OTP');
  }
};

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg p-6 rounded-lg w-96">
        <h2 className="text-xl font-semibold mb-4 text-center">Setup MFA</h2>

        {setupDone ? (
          <p className="text-green-600 text-center">✅ MFA setup complete! Redirecting...</p>
        ) : (
          <>
            {!otpSent ? (
              <>
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
                <button
                  onClick={handleSendOtp}
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                >
                  Send OTP
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3 text-center">
                  OTP sent! Enter the code from your email.
                </p>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="border w-full p-2 rounded-md mb-3"
                />
                {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
                <button
                  onClick={handleVerify}
                  className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700"
                >
                  Verify & Enable MFA
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
