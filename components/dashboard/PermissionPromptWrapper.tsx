// components/dashboard/PermissionPromptWrapper.tsx
// Client wrapper yang mengecek state notifikasi browser sebelum render PermissionPrompt
'use client';

import { useEffect, useState } from 'react';
import PermissionPrompt from './PermissionPrompt';

export default function PermissionPromptWrapper() {
  const [needsPrompt, setNeedsPrompt] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      Notification.permission === 'default'
    ) {
      setNeedsPrompt(true);
    }
  }, []);

  if (!needsPrompt) return null;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
  return (
    <PermissionPrompt
      vapidPublicKey={vapidKey}
      onSubscribed={() => setNeedsPrompt(false)}
    />
  );
}
