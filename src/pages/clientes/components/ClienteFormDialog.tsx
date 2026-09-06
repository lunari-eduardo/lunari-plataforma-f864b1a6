import React from 'react';
import { toTitleCase } from '@/hooks/useTitleCase';
import { Cliente } from '@/types/cliente';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  SelectModal as Select,
  SelectModalContent as SelectContent,
  SelectModalItem as SelectItem,
  SelectModalTrigger as SelectTrigger,
  SelectModalValue as SelectValue,
} from '@/components/ui/select-in-modal';
import { cn } from '@/lib/utils';
import {
  dialogSize,
  DIALOG_SHELL,
  DIALOG_BODY,
  DIALOG_FOOTER,
  DIALOG_TITLE_CLS,
  FIELD_GROUP,
  FIELD_LABEL,
} from '@/lib/dialogTokens';
import { ORIGENS_PADRAO } from '@/utils/defaultOrigens';
import { ClienteSuggestionsCard } from '@/components/clientes/ClienteSuggestionsCard';
import { ClienteFormData } from '../types';

interface ClienteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClient: Cliente | null;
  formData: ClienteFormData;
  setFormData: React.Dispatch<React.SetStateAction<ClienteFormData>>;
  onSave: () => Promise<void>;
  duplicateCheck: any;
  showSuggestions: boolean;
  onEditSuggestion: (cliente: Cliente) => void;
  onDismissSuggestions: () => void;
  forceCreate: boolean;
  setForceCreate: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectOpenChange: (open: boolean, selectType: string) => void;
}

export const ClienteFormDialog: React.FC<ClienteFormDialogProps> = ({
  open,
  onOpenChange,
  editingClient,
  formData,
  setFormData,
  onSave,
  duplicateCheck,
  showSuggestions,
  onEditSuggestion,
  onDismissSuggestions,
  forceCreate,
  setForceCreate,
  setShowSuggestions,
  onSelectOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(dialogSize('md'), DIALOG_SHELL)}>
        <DialogHeader>
          <DialogTitle className={DIALOG_TITLE_CLS}>
            {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
          </DialogTitle>
        </DialogHeader>

        <div className={cn(DIALOG_BODY, 'space-y-4 pr-1')}>
          <div className={FIELD_GROUP}>
            <Label htmlFor="nome" className={FIELD_LABEL}>
              Nome *
            </Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  nome: toTitleCase(e.target.value),
                }));
                setForceCreate(false);
                setShowSuggestions(true);
              }}
              placeholder="Nome completo"
              className={duplicateCheck.isDuplicata ? 'border-destructive' : ''}
            />

            {!editingClient && showSuggestions && duplicateCheck.clientesSimilares.length > 0 && (
              <ClienteSuggestionsCard
                clientes={duplicateCheck.clientesSimilares}
                onEditClient={onEditSuggestion}
                onDismiss={onDismissSuggestions}
              />
            )}
          </div>

          <div className={FIELD_GROUP}>
            <Label htmlFor="email" className={FIELD_LABEL}>
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  email: e.target.value,
                }))
              }
              placeholder="email@exemplo.com"
            />
          </div>

          <div className={FIELD_GROUP}>
            <Label htmlFor="telefone" className={FIELD_LABEL}>
              Telefone
            </Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  telefone: e.target.value,
                }))
              }
              placeholder="(Opcional) +55 (DDD) 00000-0000"
            />
          </div>

          <div className={FIELD_GROUP}>
            <Label htmlFor="origem" className={FIELD_LABEL}>
              Origem
            </Label>
            <Select
              value={formData.origem}
              onValueChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  origem: value,
                }))
              }
              onOpenChange={(isOpen) => onSelectOpenChange(isOpen, 'origem')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a origem" />
              </SelectTrigger>
              <SelectContent>
                {ORIGENS_PADRAO.map((origem) => (
                  <SelectItem key={origem.id} value={origem.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{
                          backgroundColor: origem.cor,
                        }}
                      />
                      {origem.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!editingClient && !forceCreate && duplicateCheck.isDuplicata && (
            <p className="text-center text-xs text-destructive">
              Cliente com este nome já existe. Clique em "Adicionar" para ver opções.
            </p>
          )}
        </div>

        <div className={cn(DIALOG_FOOTER, 'flex justify-end gap-2')}>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={onSave}
            disabled={!editingClient && !forceCreate && duplicateCheck.isDuplicata}
          >
            {editingClient ? 'Atualizar' : 'Adicionar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
