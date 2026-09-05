import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useSupabaseLeads } from '@/hooks/useSupabaseLeads';
import { useClientesRealtime } from '@/hooks/useClientesRealtime';
import { useMaterialShares } from '@/hooks/useMaterialShares';
import { getPublicShareBaseUrl } from '@/utils/domainUtils';
import { formatWhatsAppNumber } from '../types';

interface SendProposalModalProps {
  materialId: string | null;
  onClose: () => void;
}

export function SendProposalModal({ materialId, onClose }: SendProposalModalProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>('none');
  const [customMessage, setCustomMessage] = useState('');
  const [generatedShare, setGeneratedShare] = useState<any>(null);

  const { leads } = useSupabaseLeads();
  const { clientes } = useClientesRealtime();
  const { createShare } = useMaterialShares(materialId || undefined);

  const handleClose = () => {
    setSelectedLeadId('none');
    setCustomMessage('');
    setGeneratedShare(null);
    onClose();
  };

  const handleCreateShare = () => {
    let lead_id: string | undefined;
    let cliente_id: string | undefined;

    if (selectedLeadId !== 'none') {
      if (selectedLeadId.startsWith('lead_')) {
        lead_id = selectedLeadId.replace('lead_', '');
      } else if (selectedLeadId.startsWith('cliente_')) {
        cliente_id = selectedLeadId.replace('cliente_', '');
      } else {
        lead_id = selectedLeadId;
      }
    }

    createShare.mutate(
      {
        lead_id,
        cliente_id,
        custom_message: customMessage,
      },
      {
        onSuccess: (data) => {
          setGeneratedShare(data);
        },
      }
    );
  };

  return (
    <Dialog
      open={!!materialId}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enviar Orçamento</DialogTitle>
          <DialogDescription>
            Crie um link rastreável para enviar esta proposta. A versão atual será travada para garantir a integridade do que foi enviado.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {!generatedShare ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Vincular a um Cliente ou Lead (Opcional)</label>
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={popoverOpen}
                      className="w-full justify-between font-normal h-11"
                    >
                      {selectedLeadId !== 'none' && selectedLeadId !== ''
                        ? selectedLeadId.startsWith('lead_')
                          ? leads.find((lead) => `lead_${lead.id}` === selectedLeadId)?.nome
                          : clientes.find((cliente) => `cliente_${cliente.id}` === selectedLeadId)?.nome
                        : 'Não vincular a ninguém'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[450px] p-0" align="start">
                    <Command
                      filter={(value, search) => {
                        const normalize = (str: string) =>
                          str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                        if (normalize(value).includes(normalize(search))) return 1;
                        return 0;
                      }}
                    >
                      <CommandInput placeholder="Buscar por nome ou número..." className="h-10" />
                      <CommandList>
                        <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Nao vincular a ninguem"
                            onSelect={() => {
                              setSelectedLeadId('none');
                              setPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedLeadId === 'none' ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            Não vincular a ninguém
                          </CommandItem>
                        </CommandGroup>

                        {leads && leads.length > 0 && (
                          <CommandGroup heading="Leads (CRM)">
                            {leads.map((lead) => (
                              <CommandItem
                                key={`lead_${lead.id}`}
                                value={`${lead.nome} ${lead.whatsapp || ''}`}
                                onSelect={() => {
                                  setSelectedLeadId(`lead_${lead.id}`);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedLeadId === `lead_${lead.id}` ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {lead.nome} {lead.whatsapp && `(${lead.whatsapp})`}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}

                        {clientes && clientes.length > 0 && (
                          <CommandGroup heading="Clientes da Base">
                            {clientes.map((cliente) => (
                              <CommandItem
                                key={`cliente_${cliente.id}`}
                                value={`${cliente.nome} ${cliente.whatsapp || ''}`}
                                onSelect={() => {
                                  setSelectedLeadId(`cliente_${cliente.id}`);
                                  setPopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    selectedLeadId === `cliente_${cliente.id}` ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                {cliente.nome} {cliente.whatsapp && `(${cliente.whatsapp})`}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Vinculando a um lead, o Kanban será avançado automaticamente quando ele interagir com a proposta.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Mensagem Personalizada (Opcional)</label>
                <Textarea
                  placeholder="Deixe uma mensagem que será exibida no início da proposta..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex flex-col items-center justify-center text-center gap-2">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center mb-1">
                  <Sparkles className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-green-800">Orçamento pronto para envio!</h3>
                <p className="text-sm text-green-700 mb-4">
                  Copie o link abaixo e envie para o seu cliente.
                </p>

                <div className="flex flex-col w-full gap-2 mt-4">
                  <div className="flex w-full items-center gap-2">
                    <Input
                      readOnly
                      value={`${getPublicShareBaseUrl()}/p/${generatedShare.token}`}
                      className="bg-white border-green-200 text-sm h-11"
                    />
                    <Button
                      variant="secondary"
                      className="shrink-0 bg-white hover:bg-green-100 text-green-700 border-green-200 h-11 px-4"
                      onClick={() => {
                        navigator.clipboard.writeText(`${getPublicShareBaseUrl()}/p/${generatedShare.token}`);
                        toast.success('Link copiado!');
                      }}
                    >
                      Copiar
                    </Button>
                  </div>

                  {(() => {
                    let phone = '';
                    if (selectedLeadId && selectedLeadId !== 'none') {
                      if (selectedLeadId.startsWith('lead_')) {
                        const lead = leads.find((l) => `lead_${l.id}` === selectedLeadId);
                        if (lead?.whatsapp) phone = lead.whatsapp;
                      } else {
                        const cli = clientes.find((c) => `cliente_${c.id}` === selectedLeadId);
                        if (cli?.whatsapp) phone = cli.whatsapp;
                      }
                    }

                    if (!phone) return null;

                    const formattedPhone = formatWhatsAppNumber(phone);
                    const linkText = encodeURIComponent(
                      (customMessage ? customMessage + '\n\n' : '') +
                        'Acesse sua proposta aqui: ' +
                        `${getPublicShareBaseUrl()}/p/${generatedShare.token}`
                    );
                    const wpUrl = `https://wa.me/${formattedPhone}?text=${linkText}`;

                    return (
                      <a href={wpUrl} target="_blank" rel="noreferrer" className="w-full">
                        <Button className="w-full bg-[#25D366] hover:bg-[#20b858] text-white h-11 font-medium gap-2">
                          Enviar no WhatsApp
                        </Button>
                      </a>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          {!generatedShare ? (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={handleCreateShare}
                disabled={createShare.isPending}
                className="gap-2"
              >
                {createShare.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Gerar Link Rastreável
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Concluir
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
