import LeadsKanban from '@/components/leads/LeadsKanban';

export default function Leads() {
  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-lunar-bg">
      <LeadsKanban />
    </div>
  );
}