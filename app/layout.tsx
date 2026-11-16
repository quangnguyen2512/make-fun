import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Solar Warden — Bastion of the Drift',
  description: 'An original tactical orbital action shooter with Aegis Parry reflection, Solar Nova resonance, 4 distinct enemy archetypes, and a multi-phase boss.',
  openGraph: {
    title: 'Solar Warden — Bastion of the Drift',
    description: 'An original tactical orbital action shooter with Aegis Parry reflection, Solar Nova resonance, 4 distinct enemy archetypes, and a multi-phase boss.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solar Warden — Bastion of the Drift',
    description: 'An original tactical orbital action shooter with Aegis Parry reflection, Solar Nova resonance, 4 distinct enemy archetypes, and a multi-phase boss.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
