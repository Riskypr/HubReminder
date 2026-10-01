// app/manifest.ts
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HubReminder',
    short_name: 'HubReminder',
    description: 'Reminder absensi harian MagangHub Kemnaker',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F8FA',
    theme_color: '#2F6FED',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
