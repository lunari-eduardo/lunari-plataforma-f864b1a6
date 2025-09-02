/**
 * Component for managing global pricing table
 * Handles creation, editing and validation of global pricing ranges
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { PricingCalculationService } from '@/services/PricingCalculationService';
import { PricingValidationService } from '@/services/PricingValidationService';
import { formatarMoeda } from '@/utils/currencyUtils';
import type { TabelaPrecos, FaixaPreco } from '@/types/pricing';

interface GlobalPricingTableProps {
  table: TabelaPrecos | null;
  onTableChange: (table: TabelaPrecos | null) => void;
}

export function GlobalPricingTable({ table, onTableChange }: GlobalPricingTableProps) {
  const [editando, setEditando] = useState(false);

  const criarNovaTabelaGlobal = () => {
    const novaTabela = PricingCalculationService.criarTabelaExemplo();
    onTableChange(novaTabela);
    setEditando(true);
    toast.success('Nova tabela criada! Configure as faixas de preços abaixo.');
  };

  const adicionarFaixa = () => {
    if (!table) return;
    
    const ultimaFaixa = table.faixas[table.faixas.length - 1];
    const novoMin = ultimaFaixa ? (ultimaFaixa.max || ultimaFaixa.min) + 1 : 1;
    
    const novaFaixa: FaixaPreco = {
      min: novoMin,
      max: null,
      valor: 20
    };
    
    onTableChange({
      ...table,
      faixas: [...table.faixas, novaFaixa]
    });
  };

  const removerFaixa = (index: number) => {
    if (!table) return;
    
    const novasFaixas = table.faixas.filter((_, i) => i !== index);
    const faixasRecalculadas = PricingCalculationService.recalcularFaixas(novasFaixas);
    
    onTableChange({
      ...table,
      faixas: faixasRecalculadas
    });
  };

  const atualizarFaixa = (index: number, campo: keyof FaixaPreco, valor: any) => {
    if (!table) return;

    // Prevent editing "min" field except for first range
    if (campo === 'min' && index !== 0) {
      return;
    }

    const novasFaixas = table.faixas.map((faixa, i) => 
      i === index ? { ...faixa, [campo]: valor } : faixa
    );

    // If changed "max" field, recalculate subsequent ranges
    if (campo === 'max') {
      const faixasRecalculadas = PricingCalculationService.recalcularFaixas(novasFaixas);
      onTableChange({
        ...table,
        faixas: faixasRecalculadas
      });
    } else {
      onTableChange({
        ...table,
        faixas: novasFaixas
      });
    }
  };

  const atualizarNomeTabela = (nome: string) => {
    if (!table) return;
    onTableChange({ ...table, nome });
  };

  const validarTabela = () => {
    if (!table) return;
    
    const validation = PricingValidationService.validarTabelaPrecos(table);
    if (!validation.valid) {
      toast.error(`Erro de validação: ${validation.errors[0]}`);
    } else {
      toast.success('Tabela válida!');
      if (validation.warnings && validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          toast.warning(warning);
        });
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Tabela de Preços Global
        </CardTitle>
        <CardDescription>
          Configure as faixas de quantidade e seus respectivos valores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!table ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              Nenhuma tabela de preços configurada
            </p>
            <Button onClick={criarNovaTabelaGlobal}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Tabela de Preços
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <Label>Nome da Tabela</Label>
                <Input
                  value={table.nome}
                  onChange={(e) => atualizarNomeTabela(e.target.value)}
                  className="mt-1"
                  placeholder="Nome da tabela de preços"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={validarTabela}
                >
                  Validar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setEditando(!editando)}
                >
                  {editando ? 'Parar Edição' : 'Editar Tabela'}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quantidade (De)</TableHead>
                    <TableHead>Até</TableHead>
                    <TableHead>Valor por Foto</TableHead>
                    {editando && <TableHead className="w-20">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {table.faixas.map((faixa, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {editando ? (
                          <Input
                            type="number"
                            value={faixa.min}
                            onChange={(e) => atualizarFaixa(index, 'min', parseInt(e.target.value) || 0)}
                            className="w-20"
                            min="1"
                            disabled={index !== 0}
                            readOnly={index !== 0}
                          />
                        ) : (
                          faixa.min
                        )}
                      </TableCell>
                      <TableCell>
                        {editando ? (
                          <Input
                            type="number"
                            value={faixa.max || ''}
                            onChange={(e) => atualizarFaixa(index, 'max', e.target.value ? parseInt(e.target.value) : null)}
                            placeholder="∞"
                            className="w-20"
                          />
                        ) : (
                          faixa.max || '∞'
                        )}
                      </TableCell>
                      <TableCell>
                        {editando ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={faixa.valor}
                            onChange={(e) => atualizarFaixa(index, 'valor', parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        ) : (
                          formatarMoeda(faixa.valor)
                        )}
                      </TableCell>
                      {editando && (
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => removerFaixa(index)}
                            className="h-8 w-8"
                            disabled={table.faixas.length <= 1}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {editando && (
              <Button onClick={adicionarFaixa} variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Faixa
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}