import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { maskCep, unmaskDigits, isValidCep, UF_LIST } from "@/lib/validateCpfCnpj";
import { lookupCep } from "@/lib/viaCep";

interface AddressValue {
  cep?: string;
  endereco?: string;
  endereco_numero?: string;
  endereco_complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
}

interface Props {
  value: AddressValue;
  onSave: (patch: Partial<AddressValue>) => Promise<void> | void;
}

/**
 * AddressFieldsBlock — bloco compacto para endereço completo dentro do CRM.
 * CEP com botão ViaCEP (só preenche campos vazios, nunca sobrescreve).
 * Cada campo salva individualmente ao sair (blur).
 */
export function AddressFieldsBlock({ value, onSave }: Props) {
  const [cep, setCep] = useState(value.cep ? maskCep(value.cep) : "");
  const [endereco, setEndereco] = useState(value.endereco || "");
  const [numero, setNumero] = useState(value.endereco_numero || "");
  const [complemento, setComplemento] = useState(value.endereco_complemento || "");
  const [bairro, setBairro] = useState(value.bairro || "");
  const [cidade, setCidade] = useState(value.cidade || "");
  const [uf, setUf] = useState(value.uf || "");
  const [looking, setLooking] = useState(false);

  const persist = async (patch: Partial<AddressValue>) => {
    try {
      await onSave(patch);
    } catch {
      toast.error("Erro ao salvar endereço");
    }
  };

  const handleCepBlur = async () => {
    const digits = unmaskDigits(cep);
    if (!digits) {
      if (value.cep) await persist({ cep: "" });
      return;
    }
    if (isValidCep(digits) && digits !== value.cep) {
      await persist({ cep: digits });
    }
  };

  const handleLookupCep = async () => {
    if (!isValidCep(cep)) {
      toast.error("Informe um CEP válido");
      return;
    }
    setLooking(true);
    try {
      const result = await lookupCep(cep);
      if (!result) {
        toast.error("CEP não encontrado");
        return;
      }
      const patch: Partial<AddressValue> = { cep: result.cep };
      if (!endereco && result.logradouro) {
        setEndereco(result.logradouro);
        patch.endereco = result.logradouro;
      }
      if (!bairro && result.bairro) {
        setBairro(result.bairro);
        patch.bairro = result.bairro;
      }
      if (!cidade && result.localidade) {
        setCidade(result.localidade);
        patch.cidade = result.localidade;
      }
      if (!uf && result.uf) {
        setUf(result.uf);
        patch.uf = result.uf;
      }
      await persist(patch);
    } finally {
      setLooking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">CEP</Label>
          <Input
            value={cep}
            onChange={(e) => setCep(maskCep(e.target.value))}
            onBlur={handleCepBlur}
            placeholder="00000-000"
            inputMode="numeric"
            className="h-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={handleLookupCep}
          disabled={!isValidCep(cep) || looking}
        >
          {looking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Buscar CEP
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Logradouro</Label>
          <Input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            onBlur={() => endereco !== (value.endereco || "") && persist({ endereco })}
            placeholder="Rua, avenida..."
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Número</Label>
          <Input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onBlur={() => numero !== (value.endereco_numero || "") && persist({ endereco_numero: numero })}
            placeholder="123"
            className="h-9"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Complemento</Label>
        <Input
          value={complemento}
          onChange={(e) => setComplemento(e.target.value)}
          onBlur={() =>
            complemento !== (value.endereco_complemento || "") && persist({ endereco_complemento: complemento })
          }
          placeholder="Apto, sala..."
          className="h-9"
        />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Bairro</Label>
        <Input
          value={bairro}
          onChange={(e) => setBairro(e.target.value)}
          onBlur={() => bairro !== (value.bairro || "") && persist({ bairro })}
          placeholder="Centro"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px] gap-2">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Cidade</Label>
          <Input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            onBlur={() => cidade !== (value.cidade || "") && persist({ cidade })}
            placeholder="São Paulo"
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">UF</Label>
          <Select
            value={uf}
            onValueChange={(v) => {
              setUf(v);
              persist({ uf: v });
            }}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="UF" />
            </SelectTrigger>
            <SelectContent>
              {UF_LIST.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
