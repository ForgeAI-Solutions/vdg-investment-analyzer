import { PropertyAnalysis, PropertyType } from '@shared/schema';
import { formatCurrency, formatPercent } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  Percent, 
  Building2, 
  Home, 
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  PiggyBank,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PropertyCardProps {
  property: PropertyAnalysis;
  onRemove: (id: string) => void;
  onEdit?: (property: PropertyAnalysis) => void;
}

export function PropertyCard({ property, onRemove, onEdit }: PropertyCardProps) {
  const { shared, metrics, type } = property;
  const isPositiveCashFlow = metrics.netMonthlyCashFlow >= 0;
  const isGoodCoC = metrics.cashOnCashReturn >= 8;

  return (
    <Card className="border-card-border relative group" data-testid={`card-property-${shared.id}`}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge 
              variant={type === PropertyType.LTR ? 'default' : 'secondary'}
              className="shrink-0"
            >
              {type === PropertyType.LTR ? (
                <><Home className="w-3 h-3 mr-1" /> LTR</>
              ) : (
                <><Building2 className="w-3 h-3 mr-1" /> STR</>
              )}
            </Badge>
            {property.ltr?.targetVeteranOccupancyPercent && property.ltr.targetVeteranOccupancyPercent > 0 && (
              <Badge variant="outline" className="text-xs shrink-0">
                {property.ltr.targetVeteranOccupancyPercent}% Vet Goal
              </Badge>
            )}
          </div>
          <CardTitle className="text-base font-semibold truncate" title={shared.name}>
            {shared.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            {shared.marketValue > 0 ? formatCurrency(shared.marketValue) : formatCurrency(shared.purchasePrice)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(property)}
              data-testid={`button-edit-${shared.id}`}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(shared.id)}
            data-testid={`button-remove-${shared.id}`}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-md p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Wallet className="w-3.5 h-3.5" />
              Monthly Cash Flow
            </div>
            <div className={`text-lg font-bold flex items-center gap-1 ${isPositiveCashFlow ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {isPositiveCashFlow ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              {formatCurrency(Math.abs(metrics.netMonthlyCashFlow))}
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              CoC Return
            </div>
            <div className={`text-lg font-bold ${isGoodCoC ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
              {formatPercent(metrics.cashOnCashReturn)}
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Percent className="w-3.5 h-3.5" />
              Cap Rate
            </div>
            <div className="text-lg font-bold">
              {formatPercent(metrics.capRate)}
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <PiggyBank className="w-3.5 h-3.5" />
              Annual CF
            </div>
            <div className={`text-lg font-bold ${metrics.annualNetCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
              {formatCurrency(metrics.annualNetCashFlow)}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Monthly Mortgage</span>
            <span className="font-medium text-foreground">{formatCurrency(metrics.monthlyMortgagePayment)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Gross Income</span>
            <span className="font-medium text-foreground">{formatCurrency(metrics.grossMonthlyIncome)}/mo</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Monthly Expenses</span>
            <span className="font-medium text-foreground">{formatCurrency(metrics.totalMonthlyExpenses)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Cash Invested</span>
            <span className="font-medium text-foreground">{formatCurrency(metrics.initialCashInvested)}</span>
          </div>
          {metrics.totalManualCapEx > 0 && (
            <div className="flex justify-between items-center text-orange-600 dark:text-orange-400">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 cursor-help">
                    <AlertTriangle className="w-3 h-3" />
                    Manual CapEx
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>User-entered capital expenses included in calculations</p>
                </TooltipContent>
              </Tooltip>
              <span className="font-medium">{formatCurrency(metrics.totalManualCapEx)}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
