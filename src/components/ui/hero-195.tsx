import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BorderBeam } from "@/components/ui/border-beam";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Workflow, Users, Camera, BarChart3 } from "lucide-react";

export function Hero195() {
  return (
    <section className="container mx-auto px-4 py-16 md:py-24">
      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Left Content */}
        <div className="space-y-8">
          <div className="space-y-6">
            <Badge variant="outline" className="text-xs">
              Sistema de Gestão para Fotógrafos
            </Badge>
            
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold leading-tight">
                👉 Mais fotos, menos planilhas.
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed">
                Se você ainda esquece clientes, horários ou não sabe pra onde foi o dinheiro do mês… o Lunari resolve. 
                Aqui a bagunça não entra.
              </p>
            </div>

            <div className="space-y-4">
              <Button size="lg" className="px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                TESTE GRÁTIS POR 30 DIAS
              </Button>
              <p className="text-sm text-muted-foreground">
                (sem cartão, sem pegadinha)
              </p>
            </div>
          </div>
        </div>

        {/* Right Content - Interactive Cards */}
        <div className="space-y-6">
          <Tabs defaultValue="agenda" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
              <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              <TabsTrigger value="workflow">Workflow</TabsTrigger>
              <TabsTrigger value="clientes">Clientes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="agenda" className="mt-6">
              <Card className="relative overflow-hidden">
                <BorderBeam />
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Agenda Inteligente</CardTitle>
                      <CardDescription>Agora você sabe onde enfiou a terça-feira.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Ensaio - Maria Silva</span>
                      <Badge variant="secondary">14:00</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Casamento - João & Ana</span>
                      <Badge variant="secondary">16:30</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="financeiro" className="mt-6">
              <Card className="relative overflow-hidden">
                <BorderBeam colorFrom="#22c55e" colorTo="#16a34a" />
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <CardTitle>Controle Financeiro</CardTitle>
                      <CardDescription>Descubra por que seu dinheiro some mais rápido que cartão SD.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Receita do mês</span>
                      <span className="font-semibold text-green-600">R$ 12.450</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Despesas</span>
                      <span className="font-semibold text-red-600">R$ 3.200</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="workflow" className="mt-6">
              <Card className="relative overflow-hidden">
                <BorderBeam colorFrom="#8b5cf6" colorTo="#7c3aed" />
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <Workflow className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle>Workflow</CardTitle>
                      <CardDescription>Do clique à entrega, sem dramas de WhatsApp.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Fotos editadas</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm">Aguardando aprovação</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Pronto para entrega</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="clientes" className="mt-6">
              <Card className="relative overflow-hidden">
                <BorderBeam colorFrom="#f59e0b" colorTo="#d97706" />
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle>CRM Inteligente</CardTitle>
                      <CardDescription>Seus clientes organizados, sem planilha perdida.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Clientes ativos</span>
                      <Badge>127</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Leads em prospecção</span>
                      <Badge variant="secondary">23</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </section>
  );
}