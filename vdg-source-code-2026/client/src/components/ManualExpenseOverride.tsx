import { useState, useCallback } from 'react';
import { ManualExpense, ExpenseTiming } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, HelpCircle, Wrench } from 'lucide-react';
import { formatCurrency } from '@/lib/calculations';

interface ManualExpenseOverrideProps {
  expenses: ManualExpense[];
  onExpensesChange: (expenses: ManualExpense[]) => void;
}

export function ManualExpenseOverride({ expenses, onExpensesChange }: ManualExpenseOverrideProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expenseName, setExpenseName] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [timing, setTiming] = useState<ExpenseTiming>(ExpenseTiming.IMMEDIATE);

  const handleAddExpense = useCallback(() => {
    if (!expenseName.trim() || !estimatedCost) return;

    const cost = parseFloat(estimatedCost.replace(/[,$]/g, ''));
    if (isNaN(cost) || cost <= 0) return;

    const newExpense: ManualExpense = {
      id: crypto.randomUUID(),
      name: expenseName.trim(),
      estimatedCost: cost,
      timing,
    };

    onExpensesChange([...expenses, newExpense]);
    setExpenseName('');
    setEstimatedCost('');
    setTiming(ExpenseTiming.IMMEDIATE);
    setDialogOpen(false);
  }, [expenseName, estimatedCost, timing, expenses, onExpensesChange]);

  const handleRemoveExpense = useCallback((id: string) => {
    onExpensesChange(expenses.filter(e => e.id !== id));
  }, [expenses, onExpensesChange]);

  const totalImmediate = expenses
    .filter(e => e.timing === ExpenseTiming.IMMEDIATE)
    .reduce((sum, e) => sum + e.estimatedCost, 0);
  
  const totalYear1 = expenses
    .filter(e => e.timing === ExpenseTiming.YEAR_1)
    .reduce((sum, e) => sum + e.estimatedCost, 0);

  const totalAll = totalImmediate + totalYear1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Manual CapEx Overrides</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p>Use this to account for physical property issues (like roofs or plumbing) identified during walkthroughs that the AI cannot see from listing data.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              data-testid="button-add-manual-capex"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Human Context / CapEx
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Add Manual CapEx Expense
              </DialogTitle>
              <DialogDescription>
                Enter property issues identified during walkthroughs that are not captured in listing data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="expense-name">Expense Name</Label>
                <Input
                  id="expense-name"
                  placeholder="e.g., Roof Repair, HVAC Replacement, Foundation Work"
                  value={expenseName}
                  onChange={(e) => setExpenseName(e.target.value)}
                  data-testid="input-expense-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated-cost">Estimated Cost</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="estimated-cost"
                    type="text"
                    placeholder="3,000"
                    className="pl-7"
                    value={estimatedCost}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9.,]/g, '');
                      setEstimatedCost(value);
                    }}
                    data-testid="input-estimated-cost"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Timing</Label>
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">
                      {timing === ExpenseTiming.IMMEDIATE ? 'Immediate (Pre-Closing)' : 'Year 1 Amortization'}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {timing === ExpenseTiming.IMMEDIATE 
                        ? 'Added to initial investment cost' 
                        : 'Deducted from first year cash flow'}
                    </p>
                  </div>
                  <Switch
                    checked={timing === ExpenseTiming.YEAR_1}
                    onCheckedChange={(checked) => 
                      setTiming(checked ? ExpenseTiming.YEAR_1 : ExpenseTiming.IMMEDIATE)
                    }
                    data-testid="switch-expense-timing"
                  />
                </div>
              </div>

              <Button 
                onClick={handleAddExpense} 
                className="w-full"
                disabled={!expenseName.trim() || !estimatedCost}
                data-testid="button-confirm-add-expense"
              >
                Add Expense
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {expenses.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span>Human Context Entries</span>
              <Badge variant="outline" className="ml-auto text-orange-600 border-orange-500/50">
                {formatCurrency(totalAll)} Total
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4 space-y-2">
            {expenses.map((expense) => (
              <div 
                key={expense.id} 
                className="flex items-center justify-between gap-2 py-2 border-b border-orange-500/20 last:border-0"
                data-testid={`expense-item-${expense.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{expense.name}</span>
                    <Badge 
                      variant="outline" 
                      className={expense.timing === ExpenseTiming.IMMEDIATE 
                        ? 'text-orange-600 border-orange-500/50 text-xs' 
                        : 'text-amber-600 border-amber-500/50 text-xs'}
                    >
                      {expense.timing === ExpenseTiming.IMMEDIATE ? 'Immediate' : 'Year 1'}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(expense.estimatedCost)}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemoveExpense(expense.id)}
                  className="text-destructive shrink-0"
                  data-testid={`button-remove-expense-${expense.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {(totalImmediate > 0 || totalYear1 > 0) && (
              <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                {totalImmediate > 0 && (
                  <div className="flex justify-between">
                    <span>Immediate (Pre-Closing):</span>
                    <span className="font-medium text-orange-600">{formatCurrency(totalImmediate)}</span>
                  </div>
                )}
                {totalYear1 > 0 && (
                  <div className="flex justify-between">
                    <span>Year 1 Amortization:</span>
                    <span className="font-medium text-amber-600">{formatCurrency(totalYear1)}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
