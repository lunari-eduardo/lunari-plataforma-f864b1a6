import React from "react";
import { User, UserPlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toTitleCase } from "@/hooks/useTitleCase";
import { PanelSection } from "../PanelSection";
import ClientSearchCombobox from "../../ClientSearchCombobox";
import type { PanelFormState } from "../types";

interface ClientSectionProps {
  form: PanelFormState;
  setForm: React.Dispatch<React.SetStateAction<PanelFormState>>;
  clientDisplayName: string;
  cliente?: { telefone?: string; email?: string };
  newClientMode: boolean;
  setNewClientMode: (v: boolean) => void;
  newClient: { nome: string; telefone: string };
  setNewClient: React.Dispatch<React.SetStateAction<{ nome: string; telefone: string }>>;
  clientes: Array<{ id: string; nome: string; telefone?: string; email?: string }>;
  setShowClientEdit: (v: boolean) => void;
}

export const ClientSection: React.FC<ClientSectionProps> = ({
  form,
  setForm,
  clientDisplayName,
  cliente,
  newClientMode,
  setNewClientMode,
  newClient,
  setNewClient,
  clientes,
  setShowClientEdit,
}) => {
  return (
    <PanelSection icon={User} title="Cliente">
      {form.clienteId ? (
        <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-accent-gold/15 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-accent-gold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">
                  {clientDisplayName}
                </span>
                <span className="shrink-0 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  CRM
                </span>
              </div>
              {cliente?.telefone && (
                <span className="text-xs text-muted-foreground block truncate">
                  {cliente.telefone}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  clienteId: "",
                  clientName: "",
                }))
              }
              title="Trocar cliente"
            >
              Trocar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs rounded-md"
              onClick={() => setShowClientEdit(true)}
            >
              Editar
            </Button>
          </div>
        </div>
      ) : newClientMode ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-accent-gold" />
              Cadastrar novo cliente
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setNewClientMode(false);
                setNewClient({ nome: "", telefone: "" });
              }}
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Buscar no CRM
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              value={newClient.nome}
              onChange={(e) =>
                setNewClient((p) => ({
                  ...p,
                  nome: toTitleCase(e.target.value),
                }))
              }
              placeholder="Nome do cliente *"
              className="h-10 rounded-lg text-base sm:text-sm"
              autoFocus
            />
            <Input
              value={newClient.telefone}
              onChange={(e) =>
                setNewClient((p) => ({
                  ...p,
                  telefone: e.target.value,
                }))
              }
              placeholder="WhatsApp / Telefone"
              className="h-10 rounded-lg text-base sm:text-sm"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <ClientSearchCombobox
              value={form.clienteId}
              onSelect={(id) => {
                const c = clientes.find((x) => x.id === id);
                setForm((prev) => ({
                  ...prev,
                  clienteId: id,
                  clientName: c?.nome || prev.clientName,
                }));
              }}
              placeholder="Buscar cliente no CRM..."
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNewClientMode(true)}
            className="h-10 px-3 rounded-lg shrink-0 gap-1.5 border-border/80 hover:border-accent-gold/60 hover:bg-accent-gold/10 text-xs font-medium text-foreground transition-all shadow-xs"
            title="Cadastrar novo cliente"
          >
            <Plus className="h-4 w-4 text-accent-gold" />
            <span>Novo</span>
          </Button>
        </div>
      )}
    </PanelSection>
  );
};
