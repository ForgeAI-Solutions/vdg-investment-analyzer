import { useMemo } from 'react';
import { PropertyAnalysis, PropertyType } from '@shared/schema';
import { formatCurrency, formatPercent, calculateValuation } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Percent, 
  Building2,
  Trash2,
  Home,
  Calculator,
  Wallet,
  PiggyBank,
  Target
} from 'lucide-react';

interface DashboardProps {
  portfolio: PropertyAnalysis[];
  marketCapRate: number;
  onMarketCapRateChange: (rate: number) => void;
  onRemoveProperty: (id: string) => void;
}

const CHART_COLORS = [
  'hsl(217, 91%, 60%)',
  'hsl(198, 93%, 60%)',
  'hsl(142, 76%, 36%)',
  'hsl(280, 67%, 55%)',
  'hsl(25, 95%, 53%)',
];

export function Dashboard({ 
  portfolio, 
  marketCapRate, 
  onMarketCapRateChange,
  onRemoveProperty 
}: DashboardProps) {
  const totals = useMemo(() => {
    const totalValue = portfolio.reduce((sum, p) => sum + p.shared.purchasePrice, 0);
    const totalCashInvested = portfolio.reduce((sum, p) => sum + p.metrics.initialCashInvested, 0);
    const totalAnnualCashFlow = portfolio.reduce((sum, p) => sum + p.metrics.annualNetCashFlow, 0);
    const totalMonthlyCashFlow = portfolio.reduce((sum, p) => sum + p.metrics.netMonthlyCashFlow, 0);
    const totalAnnualNOI = portfolio.reduce((sum, p) => sum + (p.metrics.netMonthlyIncome * 12), 0);
    
    const avgCoC = portfolio.length > 0 
      ? portfolio.reduce((sum, p) => sum + p.metrics.cashOnCashReturn, 0) / portfolio.length 
      : 0;
    const avgCapRate = portfolio.length > 0 
      ? portfolio.reduce((sum, p) => sum + p.metrics.capRate, 0) / portfolio.length 
      : 0;
    
    const ltrCount = portfolio.filter(p => p.type === PropertyType.LTR).length;
    const strCount = portfolio.filter(p => p.type === PropertyType.STR).length;
    
    const portfolioValuation = calculateValuation(totalAnnualNOI, marketCapRate);
    const equityGain = portfolioValuation - totalValue;
    
    return {
      totalValue,
      totalCashInvested,
      totalAnnualCashFlow,
      totalMonthlyCashFlow,
      totalAnnualNOI,
      avgCoC,
      avgCapRate,
      ltrCount,
      strCount,
      portfolioValuation,
      equityGain,
    };
  }, [portfolio, marketCapRate]);

  const cashFlowChartData = useMemo(() => 
    portfolio.map(p => ({
      name: p.shared.name.length > 12 ? p.shared.name.substring(0, 12) + '...' : p.shared.name,
      cashFlow: p.metrics.netMonthlyCashFlow,
      type: p.type,
    })), [portfolio]);

  const cocChartData = useMemo(() => 
    portfolio.map(p => ({
      name: p.shared.name.length > 12 ? p.shared.name.substring(0, 12) + '...' : p.shared.name,
      coc: p.metrics.cashOnCashReturn,
      capRate: p.metrics.capRate,
    })), [portfolio]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-card-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <DollarSign className="w-4 h-4" />
              Portfolio Value
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {formatCurrency(totals.totalValue)}
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                <span className="inline-flex items-center gap-0.5">
                  <Home className="w-2.5 h-2.5 shrink-0" />
                  <span>{totals.ltrCount} LTR</span>
                </span>
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                <span className="inline-flex items-center gap-0.5">
                  <Building2 className="w-2.5 h-2.5 shrink-0" />
                  <span>{totals.strCount} STR</span>
                </span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wallet className="w-4 h-4" />
              Monthly Cash Flow
            </div>
            <div className={`text-2xl font-bold tabular-nums ${totals.totalMonthlyCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {formatCurrency(totals.totalMonthlyCashFlow)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(totals.totalAnnualCashFlow)}/year
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-4 h-4" />
              Avg CoC Return
            </div>
            <div className={`text-2xl font-bold tabular-nums ${totals.avgCoC >= 8 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
              {formatPercent(totals.avgCoC)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: 8%+
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Percent className="w-4 h-4" />
              Avg Cap Rate
            </div>
            <div className="text-2xl font-bold tabular-nums">
              {formatPercent(totals.avgCapRate)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Market: {marketCapRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              Monthly Cash Flow by Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Cash Flow']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Bar dataKey="cashFlow" radius={[4, 4, 0, 0]}>
                    {cashFlowChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.cashFlow >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Returns Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cocChartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatPercent(value), 
                      name === 'coc' ? 'CoC Return' : 'Cap Rate'
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 20 }} />
                  <Line type="monotone" dataKey="coc" name="CoC Return" stroke="rgb(165, 28, 48)" strokeWidth={2} dot={{ fill: 'rgb(165, 28, 48)', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="capRate" name="Cap Rate" stroke="rgb(200, 160, 80)" strokeWidth={2} dot={{ fill: 'rgb(200, 160, 80)', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            Portfolio Valuation Calculator
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Market Cap Rate: {marketCapRate}%</Label>
                <Slider
                  value={[marketCapRate]}
                  onValueChange={(v) => onMarketCapRateChange(v[0])}
                  min={3}
                  max={12}
                  step={0.25}
                  className="mt-3"
                  data-testid="slider-cap-rate"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>3%</span>
                  <span>12%</span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Adjust the market cap rate to see how it affects portfolio valuation.</p>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Target className="w-4 h-4" />
                Annual NOI
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {formatCurrency(totals.totalAnnualNOI)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Net Operating Income before debt service
              </p>
            </div>

            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <div className="flex items-center gap-2 text-primary text-sm mb-2">
                <PiggyBank className="w-4 h-4" />
                Portfolio Valuation
              </div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {formatCurrency(totals.portfolioValuation)}
              </div>
              <p className={`text-sm mt-1 ${totals.equityGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                {totals.equityGain >= 0 ? '+' : ''}{formatCurrency(totals.equityGain)} equity vs cost
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Property Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Property</th>
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Price</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">CapEx</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Monthly CF</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">CoC</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground">Cap Rate</th>
                  <th className="text-right py-2 px-2 font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((p, idx) => (
                  <tr 
                    key={p.shared.id} 
                    className={`border-b border-border last:border-0 ${idx % 2 === 0 ? 'bg-muted/30' : ''}`}
                    data-testid={`row-property-${p.shared.id}`}
                  >
                    <td className="py-2.5 px-2 font-medium">{p.shared.name}</td>
                    <td className="py-2.5 px-2">
                      <Badge variant={p.type === PropertyType.LTR ? 'default' : 'secondary'} className="text-xs">
                        {p.type}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(p.shared.purchasePrice)}</td>
                    <td className={`py-2.5 px-2 text-right tabular-nums ${p.metrics.totalManualCapEx > 0 ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-muted-foreground'}`}>
                      {p.metrics.totalManualCapEx > 0 ? formatCurrency(p.metrics.totalManualCapEx) : '—'}
                    </td>
                    <td className={`py-2.5 px-2 text-right tabular-nums font-medium ${p.metrics.netMonthlyCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                      {formatCurrency(p.metrics.netMonthlyCashFlow)}
                    </td>
                    <td className={`py-2.5 px-2 text-right tabular-nums ${p.metrics.cashOnCashReturn >= 8 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                      {formatPercent(p.metrics.cashOnCashReturn)}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums">{formatPercent(p.metrics.capRate)}</td>
                    <td className="py-2.5 px-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveProperty(p.shared.id)}
                        className="w-7 h-7"
                        data-testid={`button-table-remove-${p.shared.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
