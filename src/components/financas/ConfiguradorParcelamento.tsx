
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfiguracaoParcelamento } from "@/types/financas";
import { Calculator } from "lucide-react";

interface ConfiguradorParcelamentoProps {
  valor: number;
  configuracao: ConfiguracaoParcelamento;
  onConfiguracao: (config: ConfiguracaoParcelamento) => void;
}

export default function ConfiguradorParcelamento({ 
  valor, 
  configuracao, 
  onConfiguracao 
}: ConfiguradorParcelamentoProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleTipoChange = (tipo: 'unico' | 'parcelado') => {
    onConfiguracao({
      ...configuracao,
      tipo,
      quantidadeParcelas: tipo === 'unico' ? 1 : configuracao.quantidadeParcelas
    });
  };

  const valorParcela = configuracao.tipo === 'parcelado' && configuracao.quantidadeParcelas > 1
    ? valor / configuracao.quantidadeParcelas
    : valor;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          <Calculator className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <Label>Tipo de Lançamento</Label>
            <Select value={configuracao.tipo} onValueChange={handleTipoChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unico">Único</SelectItem>
                <SelectItem value="parcelado">Parcelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data de Início</Label>
            <Input
              type="date"
              value={configuracao.dataInicio}
              onChange={(e) => onConfiguracao({
                ...configuracao,
                dataInicio: e.target.value
              })}
            />
          </div>

          {configuracao.tipo === 'parcelado' && (
            <div>
              <Label>Quantidade de Parcelas</Label>
              <Input
                type="number"
                min="2"
                max="24"
                value={configuracao.quantidadeParcelas}
                onChange={(e) => onConfiguracao({
                  ...configuracao,
                  quantidadeParcelas: parseInt(e.target.value) || 2
                })}
              />
            </div>
          )}

          {configuracao.tipo === 'parcelado' && valor > 0 && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                {configuracao.quantidadeParcelas}x de <strong>R$ {valorParcela.toFixed(2)}</strong>
              </p>
            </div>
          )}

          <Button 
            onClick={() => setIsOpen(false)} 
            className="w-full"
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
