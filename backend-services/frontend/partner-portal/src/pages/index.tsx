import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">🎫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">TicketToken Partner Portal</h1>
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
