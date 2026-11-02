import ModulePage from '../../../../src/dashboard-next/ModulePage';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ModulePage guildId={guildId} moduleId="polls" />;
}
