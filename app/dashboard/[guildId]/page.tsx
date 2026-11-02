import ModulePage from '../../../src/dashboard-next/ModulePage';
export const dynamic = 'force-dynamic';
export default async function GuildDashboardPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  return <ModulePage guildId={guildId} moduleId="general" />;
}
