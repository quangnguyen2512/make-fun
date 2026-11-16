'use client';

import { useEffect } from 'react';

export function GameViewport({ src }: { src: string }) {
  useEffect(() => {
    document.body.dataset.state = 'title';
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'solar-warden-state' && typeof event.data.state === 'string') {
        document.body.dataset.state = event.data.state;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#070b18]">
      <iframe
        src={src}
        title="Solar Warden — Bastion of the Drift"
        className="w-full h-full border-0 block"
        allow="autoplay"
      />
    </main>
  );
}
