import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/financialUtils';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useDashboardFinanceiro } from '@/hooks/useDashboardFinanceiro';

// Paleta de cores beige/marrom elegantes
const COLORS = ['hsl(var(--finance-primary))', 'hsl(var(--finance-secondary))'];
const EXPENSE_COLORS = ['hsl(var(--finance-primary))', 'hsl(var(--chart-secondary))', 'hsl(var(--chart-tertiary))', 'hsl(var(--chart-quaternary))', 'hsl(var(--chart-quinary))', 'hsl(var(--chart-senary))'];
export default function DashboardFinanceiro() {
  const {
    anoSelecionado,
    setAnoSelecionado,
    mesSelecionado,
    setMesSelecionado,
    anosDisponiveis,
    categoriaSelecionada,
    setCategoriaSelecionada,
    categoriasDisponiveis,
    kpisData,
    metasData,
    dadosMensais,
    composicaoDespesas,
    evolucaoCategoria,
    getNomeMes
  } = useDashboardFinanceiro();

  // Cálculos para gráficos de metas
  const lucratividade = metasData.receitaAtual > 0 ? metasData.lucroAtual / metasData.receitaAtual * 100 : 0;
  const percentMetaReceita = metasData.metaReceita > 0 ? metasData.receitaAtual / metasData.metaReceita * 100 : 0;
  const percentMetaLucro = metasData.metaLucro > 0 ? metasData.lucroAtual / metasData.metaLucro * 100 : 0;

  // Opções para o seletor de mês
  const opcoesmes = [{
    value: 'ano-completo',
    label: 'Ano Completo'
  }, {
    value: '1',
    label: 'Janeiro'
  }, {
    value: '2',
    label: 'Fevereiro'
  }, {
    value: '3',
    label: 'Março'
  }, {
    value: '4',
    label: 'Abril'
  }, {
    value: '5',
    label: 'Maio'
  }, {
    value: '6',
    label: 'Junho'
  }, {
    value: '7',
    label: 'Julho'
  }, {
    value: '8',
    label: 'Agosto'
  }, {
    value: '9',
    label: 'Setembro'
  }, {
    value: '10',
    label: 'Outubro'
  }, {
    value: '11',
    label: 'Novembro'
  }, {
    value: '12',
    label: 'Dezembro'
  }];
  return <div className="min-h-screen" style={{
    background: 'linear-gradient(135deg, #e6dccd 0%, #f5f1ec 100%)'
  }}>
      <div className="p-6 space-y-6 bg-lunar-bg px-[18px] py-[13px]">
        {/* Barra de Filtros de Período - Design elegante */}
        <Card className="border-0 shadow-lg" style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px'
      }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold" style={{
            color: '#8B6F3E'
          }}>Filtros de Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Ano
                </label>
                <Select value={anoSelecionado} onValueChange={setAnoSelecionado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {anosDisponiveis.map(ano => <SelectItem key={ano} value={ano.toString()}>
                        {ano}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Período
                </label>
                <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    {opcoesmes.map(opcao => <SelectItem key={opcao.value} value={opcao.value}>
                        {opcao.label}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {mesSelecionado && mesSelecionado !== 'ano-completo' && <div className="flex items-end">
                  <div className="px-3 py-2 bg-primary/10 rounded-lg text-sm font-medium">
                    Período: {getNomeMes(mesSelecionado)} {anoSelecionado}
                  </div>
                </div>}
            </div>
          </CardContent>
        </Card>

        {/* KPIs Cards - Design elegante */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide" style={{
              color: '#8B6F3E'
            }}>RECEITA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{
              color: '#2D7A4F'
            }}>
                {formatCurrency(kpisData.totalReceita)}
              </div>
              <div className="text-xs mt-1" style={{
              color: '#8B6F3E'
            }}>↗ 12% em comparação ao mês anterior</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide" style={{
              color: '#8B6F3E'
            }}>PREVISTO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{
              color: '#1E5F99'
            }}>
                {formatCurrency(kpisData.valorPrevisto)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide" style={{
              color: '#8B6F3E'
            }}>A RECEBER</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{
              color: '#cfb38a'
            }}>
                {formatCurrency(kpisData.aReceber)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide" style={{
              color: '#8B6F3E'
            }}>DESPESAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{
              color: '#D85A47'
            }}>
                -{formatCurrency(kpisData.totalDespesas)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide" style={{
              color: '#8B6F3E'
            }}>LUCRO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{
              color: '#2D7A4F'
            }}>
                {formatCurrency(kpisData.totalLucro)}
              </div>
              <div className="text-xs mt-1" style={{
              color: '#8B6F3E'
            }}>↗ 18% em comparação ao mês anterior</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide" style={{
              color: '#8B6F3E'
            }}>SALDO</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold" style={{
              color: '#cfb38a'
            }}>
                {formatCurrency(kpisData.saldoTotal)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico Principal - Receita vs Lucro */}
        <Card className="border-0 shadow-lg" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px'
      }}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2" style={{
            color: '#8B6F3E'
          }}>
              <div className="w-3 h-3 rounded-full" style={{
              backgroundColor: '#1E5F99'
            }}></div>
              RECEITA
              <div className="w-3 h-3 rounded-full ml-4" style={{
              backgroundColor: '#2D7A4F'
            }}></div>
              LUCRO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dadosMensais} margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20
            }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dccd" opacity={0.6} />
                <XAxis dataKey="mes" tick={{
                fontSize: 12,
                fill: '#8B6F3E',
                fontWeight: 500
              }} tickLine={{
                stroke: '#e6dccd'
              }} axisLine={{
                stroke: '#e6dccd'
              }} />
                <YAxis tick={{
                fontSize: 12,
                fill: '#8B6F3E',
                fontWeight: 500
              }} tickLine={{
                stroke: '#e6dccd'
              }} axisLine={{
                stroke: '#e6dccd'
              }} tickFormatter={value => `R$ ${Number(value).toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}`} />
                <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'lucro' ? 'Lucro' : 'Receita']} labelStyle={{
                color: '#8B6F3E',
                fontSize: '12px',
                fontWeight: 500
              }} contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e6dccd',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }} />
                <Legend wrapperStyle={{
                fontSize: '12px',
                color: '#8B6F3E',
                fontWeight: 500
              }} />
                <Bar dataKey="receita" fill="#1E5F99" name="Receita" radius={[6, 6, 0, 0]} opacity={0.9} />
                <Bar dataKey="lucro" fill="#cfb38a" name="Lucro" radius={[6, 6, 0, 0]} opacity={0.9} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fluxo de Caixa - Gráfico de Área */}
        <Card className="border-0 shadow-lg" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px'
      }}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold" style={{
            color: '#8B6F3E'
          }}>FLUXO DE CAIXA</CardTitle>
            <p className="text-sm" style={{
            color: '#8B6F3E'
          }}>Análise mensal do ano selecionado</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dadosMensais} margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20
            }}>
                <defs>
                  <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#cfb38a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#cfb38a" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dccd" opacity={0.4} />
                <XAxis dataKey="mes" tick={{
                fontSize: 11,
                fill: '#8B6F3E',
                fontWeight: 500
              }} tickLine={{
                stroke: '#e6dccd'
              }} axisLine={{
                stroke: '#e6dccd'
              }} />
                <YAxis tick={{
                fontSize: 11,
                fill: '#8B6F3E',
                fontWeight: 500
              }} tickLine={{
                stroke: '#e6dccd'
              }} axisLine={{
                stroke: '#e6dccd'
              }} tickFormatter={value => `${Number(value).toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              })}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{
                color: '#8B6F3E',
                fontSize: '12px',
                fontWeight: 500
              }} contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e6dccd',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }} />
                <Area type="monotone" dataKey="receita" stroke="#cfb38a" fillOpacity={1} fill="url(#colorArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Despesas por Categoria */}
        <Card className="border-0 shadow-lg" style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px'
      }}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-center" style={{
            color: '#8B6F3E'
          }}>DESPESAS POR CATEGORIA</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie data={composicaoDespesas} cx="50%" cy="50%" innerRadius={80} outerRadius={150} dataKey="valor" strokeWidth={3} stroke="#ffffff">
                  {composicaoDespesas.map((entry, index) => <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} opacity={0.85} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string, props: any) => [formatCurrency(value), `${props.payload.grupo} (${props.payload.percentual.toFixed(1)}%)`]} labelStyle={{
                color: '#8B6F3E',
                fontSize: '12px',
                fontWeight: 500
              }} contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e6dccd',
                borderRadius: '12px',
                fontSize: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
              }} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{
                fontSize: '12px',
                fontWeight: 500
              }} formatter={(value, entry) => <span style={{
                color: entry.color
              }}>
                      {value} ({composicaoDespesas.find(item => item.grupo === value)?.percentual.toFixed(1)}%)
                    </span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI Section - Inspirado na imagem */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="text-center">
              <CardTitle className="text-sm font-medium" style={{
              color: '#8B6F3E'
            }}>ROI</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-sm" style={{
              color: '#8B6F3E'
            }}>VALOR INVESTIDO</div>
              <div className="text-2xl font-bold" style={{
              color: '#8B6F3E'
            }}>
                {formatCurrency(kpisData.totalDespesas * 0.3)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="text-center">
              <CardTitle className="text-sm font-medium" style={{
              color: '#8B6F3E'
            }}>RETORNO SOBRE INVESTIMENTO</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold" style={{
              color: '#cfb38a'
            }}>
                {kpisData.totalDespesas > 0 ? (kpisData.totalReceita / (kpisData.totalDespesas * 0.3) * 100).toFixed(2) : '0'}%
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg" style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px'
        }}>
            <CardHeader className="text-center">
              <CardTitle className="text-sm font-medium" style={{
              color: '#8B6F3E'
            }}>META ANUAL</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-2xl font-bold" style={{
              color: '#2D7A4F'
            }}>
                {formatCurrency(metasData.metaReceita * 12)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
}