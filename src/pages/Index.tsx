
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Calendar, FileText, Users, Camera, DollarSign, TrendingUp, Clock, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS = ['#7950F2', '#FAB005', '#40C057', '#FF6B6B', '#15AABF'];

const barData = [
  { name: 'Jan', valor: 4000 },
  { name: 'Fev', valor: 3000 },
  { name: 'Mar', valor: 2000 },
  { name: 'Abr', valor: 2780 },
  { name: 'Mai', valor: 1890 },
  { name: 'Jun', valor: 2390 },
];

const pieData = [
  { name: 'Gestante', value: 35 },
  { name: 'Família', value: 25 },
  { name: 'Aniversário', value: 15 },
  { name: 'Casamento', value: 10 },
  { name: 'Newborn', value: 15 },
];

// Próximos eventos
const proximosEventos = [
  { 
    id: 1, 
    cliente: "Maria Oliveira", 
    tipo: "Gestante", 
    data: "12/05/2025", 
    hora: "09:30" 
  },
  { 
    id: 2, 
    cliente: "José Santos", 
    tipo: "Família", 
    data: "15/05/2025", 
    hora: "14:00" 
  },
  { 
    id: 3, 
    cliente: "Pedro Henrique", 
    tipo: "Corporativo", 
    data: "22/05/2025", 
    hora: "16:30" 
  },
];

export default function Index() {
  const [periodoSelecionado] = useState("mes");
  
  const cardStatsList = [
    {
      title: "Receita Total",
      value: "R$ 12.750",
      change: "+5,2%",
      positive: true,
      icon: <DollarSign className="h-5 w-5" />,
      color: "bg-green-500",
    },
    {
      title: "Sessões Realizadas",
      value: "24",
      change: "+12,5%",
      positive: true,
      icon: <Camera className="h-5 w-5" />,
      color: "bg-violet-500",
    },
    {
      title: "Novos Clientes",
      value: "18",
      change: "+8,3%",
      positive: true,
      icon: <Users className="h-5 w-5" />,
      color: "bg-blue-500",
    },
    {
      title: "Taxa de Conversão",
      value: "67%",
      change: "-2,1%",
      positive: false,
      icon: <TrendingUp className="h-5 w-5" />,
      color: "bg-amber-500",
    },
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vindo ao Lunari 2.0 - Seu sistema de gestão para fotógrafos.
        </p>
      </div>
      
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardStatsList.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`${stat.color} p-2 rounded-md text-white`}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className={`text-xs ${stat.positive ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
                {stat.change}
                <span className="text-muted-foreground ml-1">vs. mês passado</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Receita Mensal</CardTitle>
              <div className="flex">
                <Button variant="ghost" size="sm" className={periodoSelecionado === "semana" ? "text-violet-600 underline" : ""}>
                  Semana
                </Button>
                <Button variant="ghost" size="sm" className={periodoSelecionado === "mes" ? "text-violet-600 underline" : ""}>
                  Mês
                </Button>
                <Button variant="ghost" size="sm" className={periodoSelecionado === "ano" ? "text-violet-600 underline" : ""}>
                  Ano
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip formatter={(value) => [`R$ ${value}`, 'Receita']} />
                <Bar dataKey="valor" fill="#7950F2" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      
      {/* Próximos Eventos e Tarefas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-violet-600" />
              <CardTitle className="text-base">Próximos Agendamentos</CardTitle>
            </div>
            <Link to="/agenda">
              <Button variant="ghost" size="sm" className="text-violet-600">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {proximosEventos.map((evento) => (
                <div key={evento.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{evento.cliente}</p>
                      <div className="flex items-center mt-1">
                        <div className={`h-2 w-2 rounded-full mr-2 ${
                          evento.tipo === "Gestante" ? "bg-green-500" : 
                          evento.tipo === "Família" ? "bg-orange-500" : "bg-blue-500"
                        }`}></div>
                        <p className="text-sm text-muted-foreground">{evento.tipo}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        {evento.data}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {evento.hora}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-violet-600" />
              <CardTitle className="text-base">Orçamentos Pendentes</CardTitle>
            </div>
            <Link to="/orcamentos">
              <Button variant="ghost" size="sm" className="text-violet-600">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-40 border border-dashed rounded-md">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum orçamento pendente no momento
              </p>
              <Link to="/orcamentos/novo">
                <Button className="mt-4 bg-violet-600 hover:bg-violet-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Criar novo orçamento
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
