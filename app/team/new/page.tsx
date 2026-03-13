'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import TeamSetupWizard from '../../components/team/TeamSetupWizard';

export default function NewTeamPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getCurrentUser().then(user => {
      if (!user) {
        router.replace('/login');
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <img src="/logo-full.png" alt="Team Manager" className="h-16 mb-4 mx-auto" />
          <div className="text-gray-400">Laden...</div>
        </div>
      </div>
    );
  }

  return <TeamSetupWizard />;
}
