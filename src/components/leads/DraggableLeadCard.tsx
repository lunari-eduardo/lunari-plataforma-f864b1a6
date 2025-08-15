import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import LeadCard from '@/components/leads/LeadCard';
import type { Lead } from '@/types/leads';

export default function DraggableLeadCard(props: {
  lead: Lead;
  onDelete: () => void;
  onConvertToOrcamento: () => void;
  onRequestMove?: (status: string) => void;
  statusOptions: { value: string; label: string }[];
  activeId?: string | null;
}) {
  const { lead, activeId, ...rest } = props;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id, data: { lead } });

  const style = isDragging ? { opacity: 0, pointerEvents: 'none' } : (transform ? { transform: CSS.Transform.toString(transform) } : undefined);

  return (
    <LeadCard
      lead={lead}
      onDelete={rest.onDelete}
      onConvertToOrcamento={rest.onConvertToOrcamento}
      onRequestMove={rest.onRequestMove}
      statusOptions={rest.statusOptions}
      dndRef={setNodeRef as any}
      dndListeners={listeners}
      dndAttributes={attributes}
      dndStyle={style}
      isDragging={!!isDragging}
    />
  );
}