import Link from 'next/link';
import { KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-base text-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 rounded-full bg-mint/10 flex items-center justify-center mb-6">
        <KeyRound className="w-8 h-8 text-mint" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Forgot Password</h1>
      <p className="text-white/50 text-center mb-8">
        Password reset flow coming soon.
      </p>
      <Link
        href="/login"
        className="text-mint hover:underline text-sm"
      >
        Back to Login
      </Link>
    </div>
  );
}
