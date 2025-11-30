'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import useAuth from '@/hooks/useAuth';

export default function MfaPromptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromQuery = searchParams.get('role'); 
  const { role: roleFromStorage } = useAuth();
  const role = roleFromQuery || roleFromStorage || 'author';

  const handleEnableMfa = () => {
    router.push('/auth/mfa'); // go to MFA setup page
  };

  const handleRemindMeLater = () => {
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-6 rounded shadow text-center max-w-md">
        <h2 className="text-2xl font-bold mb-4">Secure Your Account</h2>
        <p className="mb-6">Enabling Multi-Factor Authentication (MFA) adds an extra layer of security.</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleEnableMfa}
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
          >
            Enable MFA
          </button>
          <button
            onClick={handleRemindMeLater}
            className="w-full bg-gray-300 text-gray-800 p-2 rounded hover:bg-gray-400"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
}
