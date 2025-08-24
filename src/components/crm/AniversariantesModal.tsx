import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Cliente } from '@/types/orcamentos';
import { formatToDayMonth, formatDateForDisplay } from '@/utils/dateUtils';
import { MessageCircle, Phone, Cake, X } from "lucide-react";
import { abrirWhatsApp } from '@/utils/whatsappUtils';

interface AniversariantesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientes: Cliente[];
}

interface Aniversariante {
  nome: string;
  dataNascimento: string;
  tipo: 'cliente' | 'conjuge' | 'filho';
  clientePai?: string;
  telefone?: string;
  clienteId?: string;
  idade?: number;
}

function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const nascimento = new Date(ano, mes - 1, dia);
  
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mesAtual = hoje.getMonth() + 1;
  const diaAtual = hoje.getDate();
  
  if (mesAtual < mes || (mesAtual === mes && diaAtual < dia)) {
    idade--;
  }
  
  return idade;
}

function isAniversarioNoMes(dataNascimento: string, mes: number): boolean {
  if (!dataNascimento) return false;
  const [ano, mesNasc] = dataNascimento.split('-').map(Number);
  return mesNasc === mes;
}

export function AniversariantesModal({ open, onOpenChange, clientes }: AniversariantesModalProps) {
  const mesAtual = new Date().getMonth() + 1;
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const aniversariantes = useMemo(() => {
    const result = {
      clientes: [] as Aniversariante[],
      conjuges: [] as Aniversariante[],
      filhos: [] as Aniversariante[]
    };

    clientes.forEach(cliente => {
      // Cliente
      if (cliente.dataNascimento && isAniversarioNoMes(cliente.dataNascimento, mesAtual)) {
        result.clientes.push({
          nome: cliente.nome,
          dataNascimento: cliente.dataNascimento,
          tipo: 'cliente',
          telefone: cliente.telefone,
          clienteId: cliente.id,
          idade: calcularIdade(cliente.dataNascimento)
        });
      }

      // Cônjuge
      if (cliente.conjuge?.dataNascimento && isAniversarioNoMes(cliente.conjuge.dataNascimento, mesAtual)) {
        result.conjuges.push({
          nome: cliente.conjuge.nome || 'Cônjuge',
          dataNascimento: cliente.conjuge.dataNascimento,
          tipo: 'conjuge',
          clientePai: cliente.nome,
          telefone: cliente.telefone,
          clienteId: cliente.id,
          idade: calcularIdade(cliente.conjuge.dataNascimento)
        });
      }

      // Filhos
      cliente.filhos?.forEach(filho => {
        if (filho.dataNascimento && isAniversarioNoMes(filho.dataNascimento, mesAtual)) {
          result.filhos.push({
            nome: filho.nome || 'Filho(a)',
            dataNascimento: filho.dataNascimento,
            tipo: 'filho',
            clientePai: cliente.nome,
            telefone: cliente.telefone,
            clienteId: cliente.id,
            idade: calcularIdade(filho.dataNascimento)
          });
        }
      });
    });

    // Ordenar por data de aniversário
    const ordenarPorData = (a: Aniversariante, b: Aniversariante) => {
      const diaA = parseInt(a.dataNascimento.split('-')[2]);
      const diaB = parseInt(b.dataNascimento.split('-')[2]);
      return diaA - diaB;
    };

    result.clientes.sort(ordenarPorData);
    result.conjuges.sort(ordenarPorData);
    result.filhos.sort(ordenarPorData);

    return result;
  }, [clientes, mesAtual]);

  const totalAniversariantes = aniversariantes.clientes.length + aniversariantes.conjuges.length + aniversariantes.filhos.length;

  const handleWhatsApp = (aniversariante: Aniversariante) => {
    if (!aniversariante.telefone) return;
    
    const telefone = aniversariante.telefone.replace(/\D/g, '');
    let mensagem = '';
    
    if (aniversariante.tipo === 'cliente') {
      mensagem = `🎉 Parabéns, ${aniversariante.nome}! 🎂\n\nEspero que seu dia especial seja repleto de alegria e momentos incríveis!\n\nDesejamos muito sucesso e felicidade sempre! 🎈✨`;
    } else {
      const tipoTexto = aniversariante.tipo === 'conjuge' ? 'cônjuge' : 'filho(a)';
      mensagem = `🎉 Olá ${aniversariante.clientePai}!\n\nGostaria de parabenizar seu(sua) ${tipoTexto} ${aniversariante.nome} pelo aniversário! 🎂\n\nDesejamos muito sucesso e felicidade! 🎈✨`;
    }
    
    const mensagemCodificada = encodeURIComponent(mensagem);
    const link = `https://wa.me/55${telefone}?text=${mensagemCodificada}`;
    window.open(link, '_blank');
  };

  const AniversarianteCard = ({ aniversariante }: { aniversariante: Aniversariante }) => (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Cake className="h-4 w-4 text-amber-500" />
              <h4 className="font-medium text-primary">{aniversariante.nome}</h4>
              {aniversariante.idade && (
                <Badge variant="secondary">{aniversariante.idade} anos</Badge>
              )}
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">
              {formatToDayMonth(aniversariante.dataNascimento)} ({formatDateForDisplay(aniversariante.dataNascimento)})
            </p>
            
            {aniversariante.clientePai && (
              <p className="text-xs text-muted-foreground">
                Família de {aniversariante.clientePai}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleWhatsApp(aniversariante)}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
              disabled={!aniversariante.telefone}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => aniversariante.telefone && window.open(`tel:${aniversariante.telefone}`, '_self')}
              className="h-8 w-8 p-0"
              disabled={!aniversariante.telefone}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Cake className="h-5 w-5 text-amber-500" />
              Aniversariantes de {nomesMeses[mesAtual - 1]}
              {totalAniversariantes > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {totalAniversariantes}
                </Badge>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {totalAniversariantes === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Cake className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum aniversariante este mês</h3>
            <p className="text-sm text-muted-foreground">
              Não há aniversários cadastrados para {nomesMeses[mesAtual - 1].toLowerCase()}.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="clientes" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clientes" className="flex items-center gap-2">
                Clientes
                {aniversariantes.clientes.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {aniversariantes.clientes.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="conjuges" className="flex items-center gap-2">
                Cônjuges
                {aniversariantes.conjuges.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {aniversariantes.conjuges.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="filhos" className="flex items-center gap-2">
                Filhos
                {aniversariantes.filhos.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {aniversariantes.filhos.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 max-h-[400px] overflow-y-auto scrollbar-elegant">
              <TabsContent value="clientes" className="mt-0">
                {aniversariantes.clientes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum cliente aniversariante este mês
                  </p>
                ) : (
                  aniversariantes.clientes.map((aniversariante, index) => (
                    <AniversarianteCard key={index} aniversariante={aniversariante} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="conjuges" className="mt-0">
                {aniversariantes.conjuges.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum cônjuge aniversariante este mês
                  </p>
                ) : (
                  aniversariantes.conjuges.map((aniversariante, index) => (
                    <AniversarianteCard key={index} aniversariante={aniversariante} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="filhos" className="mt-0">
                {aniversariantes.filhos.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum filho aniversariante este mês
                  </p>
                ) : (
                  aniversariantes.filhos.map((aniversariante, index) => (
                    <AniversarianteCard key={index} aniversariante={aniversariante} />
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}