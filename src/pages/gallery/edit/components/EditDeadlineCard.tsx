import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DeleteGalleryDialog } from '@/components/DeleteGalleryDialog';
import { cn } from '@/lib/utils';

export interface EditDeadlineCardProps {
  prazoSelecao: Date | undefined;
  setPrazoSelecao: (d: Date | undefined) => void;
  handleExtendDeadline: (days: number) => void;
  galleryName: string;
  handleDelete: () => Promise<void>;
}

export function EditDeadlineCard({
  prazoSelecao,
  setPrazoSelecao,
  handleExtendDeadline,
  galleryName,
  handleDelete,
}: EditDeadlineCardProps) {
  return (
    <>
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Prazo de Seleção
          </CardTitle>
          <CardDescription>
            Defina até quando o cliente pode fazer a seleção
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="space-y-2">
              <Label>Data limite</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[240px] justify-start text-left font-normal',
                      !prazoSelecao && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {prazoSelecao
                      ? format(prazoSelecao, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Selecionar data'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={prazoSelecao}
                    onSelect={setPrazoSelecao}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleExtendDeadline(7)}>
                +7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExtendDeadline(14)}>
                +14 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExtendDeadline(30)}>
                +30 dias
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Gallery - Text link only */}
      <DeleteGalleryDialog
        galleryName={galleryName}
        onDelete={handleDelete}
        trigger={
          <button className="text-sm text-destructive hover:underline">
            Excluir galeria
          </button>
        }
      />
    </>
  );
}
