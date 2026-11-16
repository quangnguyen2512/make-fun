import { SolarWarden3D } from '@/components/SolarWarden3D';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const autostart = params.autostart === '1' || params.autostart === 'true';
  const shot = typeof params.shot === 'string' ? params.shot : null;
  const seedRaw = typeof params.seed === 'string' ? Number(params.seed) : 42;
  const seed = Number.isFinite(seedRaw) ? seedRaw : 42;

  return <SolarWarden3D autostart={autostart} shot={shot} seed={seed} />;
}
