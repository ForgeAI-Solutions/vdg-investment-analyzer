import { useState, useCallback, useEffect, type ChangeEvent } from 'react';
import { Property, PropertyAnalysis, SavedPortfolio } from '@shared/schema';
import { calculateMetrics } from '@/lib/calculations';
import { exportPDF, exportDashboardPDF, exportExcel, exportSQL } from '@/lib/exports';
import { InputForm } from '@/components/InputForm';
import { Dashboard } from '@/components/Dashboard';
import { PropertyCard } from '@/components/PropertyCard';
import { RecommendationPanel } from '@/components/RecommendationPanel';
import { CFOConsultant } from '@/components/CFOConsultant';
import { EasyViz } from '@/components/EasyViz';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  LayoutDashboard, 
  ListFilter, 
  FileText, 
  Sheet, 
  FileCode,
  FileBarChart,
  Building2,
  Save,
  FolderOpen,
  Trash2,
  ChevronDown,
  FileOutput,
  Briefcase,
  MessageSquareText,
  Play,
  Sparkles,
  Loader2,
  Download,
  Upload,
  Check,
  Database,
  BarChart3,
  FilePlus
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import vdgLogo from '@assets/VDG_logo-1.png';

const MAX_SAVED_PORTFOLIOS = 5;
const STORAGE_KEY = 'vdg_saved_portfolios';

export default function Home() {
  const [properties, setProperties] = useState<PropertyAnalysis[]>([]);
  const [viewMode, setViewMode] = useState<'whole' | 'individual'>('whole');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [marketCapRate, setMarketCapRate] = useState(6.0);
  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [analystReportDialogOpen, setAnalystReportDialogOpen] = useState(false);
  const [cfoAnalysisText, setCfoAnalysisText] = useState('');
  const [portfolioName, setPortfolioName] = useState('');
  const [currentLoadedPortfolioId, setCurrentLoadedPortfolioId] = useState<string | null>(null);
  const [easyQDialogOpen, setEasyQDialogOpen] = useState(false);
  const [easyQQuery, setEasyQQuery] = useState('');
  const [easyQGeneratedSQL, setEasyQGeneratedSQL] = useState('');
  const [easyQResults, setEasyQResults] = useState<Record<string, any>[] | null>(null);
  const [easyQColumns, setEasyQColumns] = useState<string[]>([]);
  const [easyQLoading, setEasyQLoading] = useState(false);
  const [easyQError, setEasyQError] = useState('');
  const [easyQImportedSQL, setEasyQImportedSQL] = useState('');
  const [easyQSelectedPortfolios, setEasyQSelectedPortfolios] = useState<string[]>(['current']);
  const [easyVizDialogOpen, setEasyVizDialogOpen] = useState(false);
  const { toast } = useToast();

  const handleSaveSQL = useCallback(() => {
    if (!easyQGeneratedSQL) return;
    const blob = new Blob([easyQGeneratedSQL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easyq_query_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "SQL saved", description: "Query saved to text file." });
  }, [easyQGeneratedSQL, toast]);

  const handleSaveResultsCSV = useCallback(() => {
    if (!easyQResults || easyQResults.length === 0 || easyQColumns.length === 0) return;
    const csvRows = [easyQColumns.join(',')];
    easyQResults.forEach(row => {
      const values = easyQColumns.map(col => {
        const val = row[col];
        if (val === null || val === undefined) return '';
        const strVal = String(val);
        return strVal.includes(',') || strVal.includes('"') ? `"${strVal.replace(/"/g, '""')}"` : strVal;
      });
      csvRows.push(values.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `easyq_results_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Results saved", description: "Results saved to CSV file." });
  }, [easyQResults, easyQColumns, toast]);

  const handleImportSQL = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setEasyQImportedSQL(content.trim());
      toast({ title: "SQL imported", description: "Reference query loaded. Use it to guide your new question." });
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [toast]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedPortfolios(JSON.parse(stored));
      } catch {
        console.error('Failed to parse saved portfolios');
      }
    }
  }, []);

  const savePortfolio = useCallback((saveAsNew: boolean = false) => {
    if (!portfolioName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the portfolio.",
        variant: "destructive",
      });
      return;
    }

    if (properties.length === 0) {
      toast({
        title: "No properties",
        description: "Add at least one property before saving.",
        variant: "destructive",
      });
      return;
    }

    const isUpdating = currentLoadedPortfolioId && !saveAsNew;
    
    if (!isUpdating && savedPortfolios.length >= MAX_SAVED_PORTFOLIOS) {
      toast({
        title: "Limit reached",
        description: `You can save up to ${MAX_SAVED_PORTFOLIOS} portfolios. Delete one to save a new one.`,
        variant: "destructive",
      });
      return;
    }

    if (isUpdating) {
      const updated = savedPortfolios.map(p => 
        p.id === currentLoadedPortfolioId 
          ? {
              ...p,
              name: portfolioName.trim(),
              savedAt: new Date().toISOString(),
              properties: structuredClone(properties),
              marketCapRate,
            }
          : p
      );
      setSavedPortfolios(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      
      toast({
        title: "Portfolio updated",
        description: `"${portfolioName.trim()}" has been updated.`,
      });
    } else {
      const newPortfolio: SavedPortfolio = {
        id: crypto.randomUUID(),
        name: portfolioName.trim(),
        savedAt: new Date().toISOString(),
        properties: structuredClone(properties),
        marketCapRate,
      };

      const updated = [...savedPortfolios, newPortfolio];
      setSavedPortfolios(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setCurrentLoadedPortfolioId(newPortfolio.id);
      
      toast({
        title: "Portfolio saved",
        description: `"${newPortfolio.name}" has been saved.`,
      });
    }
    
    setSaveDialogOpen(false);
  }, [portfolioName, properties, marketCapRate, savedPortfolios, currentLoadedPortfolioId, toast]);

  const loadPortfolio = useCallback((portfolio: SavedPortfolio) => {
    setProperties(portfolio.properties);
    setMarketCapRate(portfolio.marketCapRate);
    setAiAnalysis(null);
    setLoadDialogOpen(false);
    setCurrentLoadedPortfolioId(portfolio.id);
    setPortfolioName(portfolio.name);
    
    toast({
      title: "Portfolio loaded",
      description: `"${portfolio.name}" has been loaded.`,
    });
  }, [toast]);

  const deletePortfolio = useCallback((id: string) => {
    const updated = savedPortfolios.filter(p => p.id !== id);
    setSavedPortfolios(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    toast({
      title: "Portfolio deleted",
      description: "The saved portfolio has been removed.",
    });
  }, [savedPortfolios, toast]);

  const handleAddProperty = useCallback((property: Property) => {
    const analysis: PropertyAnalysis = { 
      ...property, 
      metrics: calculateMetrics(property) 
    };
    setProperties((prev) => [...prev, analysis]);
    if (aiAnalysis) setAiAnalysis(null);
  }, [aiAnalysis]);

  const handleUndoLastProperty = useCallback((): Property | null => {
    if (properties.length === 0) return null;
    const lastProperty = properties[properties.length - 1];
    setProperties((prev) => prev.slice(0, prev.length - 1));
    if (aiAnalysis) setAiAnalysis(null);
    return lastProperty;
  }, [properties, aiAnalysis]);

  const handleRemoveProperty = useCallback((id: string) => {
    setProperties((prev) => prev.filter((p) => p.shared.id !== id));
    if (aiAnalysis) setAiAnalysis(null);
  }, [aiAnalysis]);

  const handleEasyQQuery = useCallback(async () => {
    if (!easyQQuery.trim()) return;
    if (easyQSelectedPortfolios.length === 0) {
      toast({
        title: "No portfolios selected",
        description: "Please select at least one portfolio to query.",
        variant: "destructive"
      });
      return;
    }
    
    const portfolios: Array<{
      portfolioId: string;
      portfolioName: string;
      sourceType: 'current' | 'saved';
      properties: Array<Record<string, any>>;
    }> = [];
    
    if (easyQSelectedPortfolios.includes('current') && properties.length > 0) {
      portfolios.push({
        portfolioId: 'current',
        portfolioName: 'Current Portfolio',
        sourceType: 'current',
        properties: properties.map(p => ({
          name: p.shared.name,
          type: p.type,
          purchasePrice: p.shared.purchasePrice,
          marketValue: p.shared.marketValue,
          loanAmount: p.shared.loanAmount,
          loanRemaining: p.shared.loanRemaining,
          interestRate: p.shared.interestRate,
          loanTermYears: p.shared.loanTermYears,
          grossMonthlyIncome: p.metrics.grossMonthlyIncome,
          monthlyExpenses: p.metrics.totalMonthlyExpenses,
          monthlyMortgage: p.metrics.monthlyMortgagePayment,
          netMonthlyCashFlow: p.metrics.netMonthlyCashFlow,
          annualCashFlow: p.metrics.annualNetCashFlow,
          capRate: p.metrics.capRate,
          cashOnCashReturn: p.metrics.cashOnCashReturn,
          annualNOI: p.metrics.annualGrossIncome - p.metrics.totalMonthlyExpenses * 12,
          cashInvested: p.metrics.initialCashInvested,
          currentVeteranOccupancy: p.ltr?.currentVeteranOccupancyPercent,
          veteranGoal: p.ltr?.targetVeteranOccupancyPercent,
          pmFeePercent: p.ltr?.pmFeePercent,
          monthlyPmFee: p.ltr ? (p.metrics.grossMonthlyIncome * (p.ltr.pmFeePercent || 0) / 100) : undefined,
          annualPropertyTax: p.ltr?.annualPropertyTax,
          annualInsurance: p.ltr?.annualInsurance,
          monthlyRepairReserve: p.ltr?.monthlyRepairReserve,
          numberOfUnits: p.ltr?.numberOfUnits,
          buildingType: p.ltr?.buildingType
        }))
      });
    }
    
    for (const portfolioId of easyQSelectedPortfolios) {
      if (portfolioId === 'current') continue;
      const savedPortfolio = savedPortfolios.find(p => p.id === portfolioId);
      if (savedPortfolio && savedPortfolio.properties.length > 0) {
        portfolios.push({
          portfolioId: savedPortfolio.id,
          portfolioName: savedPortfolio.name,
          sourceType: 'saved',
          properties: savedPortfolio.properties.map(p => ({
            name: p.shared.name,
            type: p.type,
            purchasePrice: p.shared.purchasePrice,
            marketValue: p.shared.marketValue,
            loanAmount: p.shared.loanAmount,
            loanRemaining: p.shared.loanRemaining,
            interestRate: p.shared.interestRate,
            loanTermYears: p.shared.loanTermYears,
            grossMonthlyIncome: p.metrics.grossMonthlyIncome,
            monthlyExpenses: p.metrics.totalMonthlyExpenses,
            monthlyMortgage: p.metrics.monthlyMortgagePayment,
            netMonthlyCashFlow: p.metrics.netMonthlyCashFlow,
            annualCashFlow: p.metrics.annualNetCashFlow,
            capRate: p.metrics.capRate,
            cashOnCashReturn: p.metrics.cashOnCashReturn,
            annualNOI: p.metrics.annualGrossIncome - p.metrics.totalMonthlyExpenses * 12,
            cashInvested: p.metrics.initialCashInvested,
            currentVeteranOccupancy: p.ltr?.currentVeteranOccupancyPercent,
            veteranGoal: p.ltr?.targetVeteranOccupancyPercent,
            pmFeePercent: p.ltr?.pmFeePercent,
            monthlyPmFee: p.ltr ? (p.metrics.grossMonthlyIncome * (p.ltr.pmFeePercent || 0) / 100) : undefined,
            annualPropertyTax: p.ltr?.annualPropertyTax,
            annualInsurance: p.ltr?.annualInsurance,
            monthlyRepairReserve: p.ltr?.monthlyRepairReserve,
            numberOfUnits: p.ltr?.numberOfUnits,
            buildingType: p.ltr?.buildingType
          }))
        });
      }
    }
    
    if (portfolios.length === 0 || portfolios.every(p => p.properties.length === 0)) {
      toast({
        title: "No properties to query",
        description: "Selected portfolios have no properties. Add properties first.",
        variant: "destructive"
      });
      return;
    }
    
    setEasyQLoading(true);
    setEasyQError('');
    setEasyQGeneratedSQL('');
    setEasyQResults(null);
    setEasyQColumns([]);
    
    try {
      const response = await fetch('/api/easyq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: easyQQuery,
          portfolios
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process query');
      }
      
      setEasyQGeneratedSQL(data.sql || '');
      setEasyQResults(data.results || []);
      setEasyQColumns(data.columns || []);
    } catch (error) {
      setEasyQError(error instanceof Error ? error.message : 'Failed to process query');
      toast({
        title: "Query failed",
        description: error instanceof Error ? error.message : 'Failed to process query',
        variant: "destructive"
      });
    } finally {
      setEasyQLoading(false);
    }
  }, [easyQQuery, easyQSelectedPortfolios, properties, savedPortfolios, toast]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-sidebar text-sidebar-foreground shadow-sm sticky top-0 z-50 border-b border-sidebar-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-24 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center">
            <img 
              src={vdgLogo} 
              alt="Veterans Development Group" 
              className="h-20 w-auto object-contain"
              data-testid="img-vdg-logo"
            />
          </div>
          
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto pb-2 sm:pb-0 justify-center sm:justify-end">
            <div className="h-8 w-px bg-sidebar-border mx-1 hidden sm:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="shrink-0"
                  data-testid="button-reports-menu"
                >
                  <FileOutput className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Reports</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setAnalystReportDialogOpen(true)}
                  disabled={properties.length === 0}
                  data-testid="menu-item-analyst-report"
                >
                  <FileBarChart className="w-4 h-4 mr-2" />
                  Analyst Report
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportExcel(properties)}
                  disabled={properties.length === 0}
                  data-testid="menu-item-excel"
                >
                  <Sheet className="w-4 h-4 mr-2" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportPDF(properties, aiAnalysis)}
                  disabled={properties.length === 0}
                  data-testid="menu-item-pdf"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportSQL(properties)}
                  disabled={properties.length === 0}
                  data-testid="menu-item-sql"
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  SQL
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setEasyQDialogOpen(true)}
                  data-testid="menu-item-easyq"
                >
                  <MessageSquareText className="w-4 h-4 mr-2" />
                  EasyQ Query
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setEasyVizDialogOpen(true)}
                  data-testid="menu-item-easyviz"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  EasyViz Dashboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={analystReportDialogOpen} onOpenChange={setAnalystReportDialogOpen}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Generate Analyst Report</DialogTitle>
                  <DialogDescription>
                    Generate a professional PDF report with charts and financial metrics. Optionally paste AI CFO analysis to include insights in the report.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="cfo-analysis" className="text-base font-semibold">AI CFO Consultant Analysis (Optional)</Label>
                    <Textarea
                      id="cfo-analysis"
                      value={cfoAnalysisText}
                      onChange={(e) => setCfoAnalysisText(e.target.value)}
                      placeholder="Paste the AI CFO Consultant analysis here to include strategic insights in your report..."
                      className="mt-2 min-h-[200px] text-base"
                      data-testid="textarea-cfo-analysis"
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      Copy the analysis from the AI CFO Consultant section and paste here to integrate professional insights into the report.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAnalystReportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      exportDashboardPDF(properties, marketCapRate, cfoAnalysisText || undefined);
                      setAnalystReportDialogOpen(false);
                      toast({
                        title: "Report generated",
                        description: "Your analyst report has been downloaded.",
                      });
                    }}
                    data-testid="button-generate-report"
                  >
                    <FileBarChart className="w-4 h-4 mr-2" />
                    Generate Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={easyQDialogOpen} onOpenChange={(open) => {
              setEasyQDialogOpen(open);
              if (!open) {
                setEasyQQuery('');
                setEasyQGeneratedSQL('');
                setEasyQResults(null);
                setEasyQColumns([]);
                setEasyQError('');
                setEasyQImportedSQL('');
                setEasyQSelectedPortfolios(['current']);
              }
            }}>
              <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    EasyQ - Natural Language Query
                  </DialogTitle>
                  <DialogDescription>
                    Ask questions about your portfolio in plain English. EasyQ will generate SQL and show you the results.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                  <div>
                    <Label className="text-sm font-medium">Query Portfolios</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between mt-1.5" data-testid="button-select-portfolios">
                          <span className="flex items-center gap-2">
                            <Database className="w-4 h-4" />
                            {easyQSelectedPortfolios.length === 1 && easyQSelectedPortfolios[0] === 'current'
                              ? 'Current Portfolio'
                              : easyQSelectedPortfolios.length === 1
                                ? savedPortfolios.find(p => p.id === easyQSelectedPortfolios[0])?.name || 'Selected Portfolio'
                                : `${easyQSelectedPortfolios.length} portfolios selected`}
                          </span>
                          <ChevronDown className="w-4 h-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-2" align="start">
                        <div className="space-y-1">
                          <div
                            className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                            onClick={() => {
                              setEasyQSelectedPortfolios(prev =>
                                prev.includes('current')
                                  ? prev.filter(id => id !== 'current')
                                  : [...prev, 'current']
                              );
                            }}
                            data-testid="checkbox-current-portfolio"
                          >
                            <Checkbox checked={easyQSelectedPortfolios.includes('current')} />
                            <span className="text-sm font-medium">Current Portfolio</span>
                            {properties.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                {properties.length} {properties.length === 1 ? 'property' : 'properties'}
                              </span>
                            )}
                          </div>
                          {savedPortfolios.length > 0 && (
                            <>
                              <div className="h-px bg-border my-2" />
                              <p className="text-xs text-muted-foreground px-2 py-1">Saved Portfolios</p>
                              {savedPortfolios.map(portfolio => (
                                <div
                                  key={portfolio.id}
                                  className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                                  onClick={() => {
                                    setEasyQSelectedPortfolios(prev =>
                                      prev.includes(portfolio.id)
                                        ? prev.filter(id => id !== portfolio.id)
                                        : [...prev, portfolio.id]
                                    );
                                  }}
                                  data-testid={`checkbox-portfolio-${portfolio.id}`}
                                >
                                  <Checkbox checked={easyQSelectedPortfolios.includes(portfolio.id)} />
                                  <span className="text-sm">{portfolio.name}</span>
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {portfolio.properties.length} {portfolio.properties.length === 1 ? 'property' : 'properties'}
                                  </span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">
                      Select one or more portfolios to query. Multi-portfolio queries will combine data from all selected portfolios.
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <Label htmlFor="easyq-query" className="text-sm font-medium">Your Question</Label>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".txt,.sql"
                          onChange={handleImportSQL}
                          className="hidden"
                          data-testid="input-import-sql"
                        />
                        <Button variant="outline" size="sm" asChild>
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            Import SQL
                          </span>
                        </Button>
                      </label>
                    </div>
                    <Textarea
                      id="easyq-query"
                      value={easyQQuery}
                      onChange={(e) => setEasyQQuery(e.target.value)}
                      placeholder="e.g., Show all properties with cash flow above $1500..."
                      className="min-h-[80px]"
                      data-testid="textarea-easyq-query"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Examples: "List properties with cap rate over 8%" | "Show properties not meeting veteran occupancy goal" | "Compare loan terms for all properties"
                    </p>
                  </div>
                  
                  {easyQImportedSQL && (
                    <div className="p-3 bg-muted/50 border border-border rounded-md">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Label className="text-sm font-medium">Reference SQL (Imported)</Label>
                        <Button variant="ghost" size="sm" onClick={() => setEasyQImportedSQL('')}>
                          Clear
                        </Button>
                      </div>
                      <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">{easyQImportedSQL}</pre>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleEasyQQuery}
                      disabled={easyQLoading || !easyQQuery.trim()}
                      data-testid="button-generate-query"
                    >
                      {easyQLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Run Query
                    </Button>
                  </div>
                  
                  {easyQError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
                      {easyQError}
                    </div>
                  )}
                  
                  {easyQGeneratedSQL && (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm font-medium">Generated SQL</Label>
                        <Button variant="outline" size="sm" onClick={handleSaveSQL} data-testid="button-save-sql">
                          <Download className="w-4 h-4 mr-2" />
                          Save SQL
                        </Button>
                      </div>
                      <div className="mt-1.5 max-h-[150px] overflow-auto border border-border rounded-md">
                        <pre className="p-3 bg-muted text-sm font-mono whitespace-pre min-w-max">
                          {easyQGeneratedSQL}
                        </pre>
                      </div>
                    </div>
                  )}
                  
                  {easyQResults && easyQResults.length > 0 && (
                    <div className="flex-1 min-h-0">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-sm font-medium">Results ({easyQResults.length} rows)</Label>
                        <Button variant="outline" size="sm" onClick={handleSaveResultsCSV} data-testid="button-save-csv">
                          <Download className="w-4 h-4 mr-2" />
                          Save CSV
                        </Button>
                      </div>
                      <div className="mt-1.5 border border-border rounded-md overflow-auto max-h-[300px]">
                        <Table className="w-full min-w-max">
                          <TableHeader>
                            <TableRow>
                              {easyQColumns.map((col) => (
                                <TableHead key={col} className="font-semibold whitespace-nowrap bg-muted sticky top-0">
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {easyQResults.map((row, idx) => (
                              <TableRow key={idx}>
                                {easyQColumns.map((col) => (
                                  <TableCell key={col} className="whitespace-nowrap">
                                    {typeof row[col] === 'number' 
                                      ? (col.toLowerCase().includes('rate') || col.toLowerCase().includes('percent') || col.toLowerCase().includes('coc') || col.toLowerCase().includes('cap'))
                                        ? `${row[col].toFixed(2)}%`
                                        : col.toLowerCase().includes('price') || col.toLowerCase().includes('value') || col.toLowerCase().includes('flow') || col.toLowerCase().includes('income') || col.toLowerCase().includes('expense') || col.toLowerCase().includes('mortgage') || col.toLowerCase().includes('loan') || col.toLowerCase().includes('noi') || col.toLowerCase().includes('invested')
                                          ? `$${row[col].toLocaleString()}`
                                          : row[col].toLocaleString()
                                      : row[col]?.toString() || '-'}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  
                  {easyQResults && easyQResults.length === 0 && easyQGeneratedSQL && (
                    <div className="p-4 text-center text-muted-foreground border border-border rounded-md">
                      No results found for this query.
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  data-testid="button-portfolios-menu"
                >
                  <Briefcase className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">My Portfolios</span>
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setProperties([]);
                    setCurrentLoadedPortfolioId(null);
                    setPortfolioName('');
                    setAiAnalysis(null);
                    toast({ title: "New portfolio", description: "Started a new empty portfolio." });
                  }}
                  data-testid="menu-item-new"
                >
                  <FilePlus className="w-4 h-4 mr-2" />
                  New Portfolio
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSaveDialogOpen(true)}
                  disabled={properties.length === 0}
                  data-testid="menu-item-save"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Portfolio
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLoadDialogOpen(true)}
                  data-testid="menu-item-load"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Load Portfolio
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{currentLoadedPortfolioId ? 'Update Portfolio' : 'Save Portfolio'}</DialogTitle>
                  <DialogDescription>
                    {currentLoadedPortfolioId 
                      ? `Update "${portfolioName}" with your changes, or save as a new portfolio.`
                      : `Save your current portfolio for later. You can save up to ${MAX_SAVED_PORTFOLIOS} portfolios (${savedPortfolios.length}/${MAX_SAVED_PORTFOLIOS} used).`
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="portfolio-name">Portfolio Name</Label>
                  <Input
                    id="portfolio-name"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="Enter a name for this portfolio"
                    className="mt-2"
                    data-testid="input-portfolio-name"
                  />
                </div>
                <DialogFooter className="flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  {currentLoadedPortfolioId && savedPortfolios.length < MAX_SAVED_PORTFOLIOS && (
                    <Button 
                      variant="outline" 
                      onClick={() => savePortfolio(true)} 
                      data-testid="button-save-as-new"
                    >
                      Save as New
                    </Button>
                  )}
                  <Button 
                    onClick={() => savePortfolio(false)} 
                    disabled={!currentLoadedPortfolioId && savedPortfolios.length >= MAX_SAVED_PORTFOLIOS} 
                    data-testid="button-confirm-save"
                  >
                    {currentLoadedPortfolioId ? 'Update Portfolio' : 'Save Portfolio'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Load Portfolio</DialogTitle>
                  <DialogDescription>
                    Load a previously saved portfolio. This will replace your current properties.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2 max-h-64 overflow-y-auto">
                  {savedPortfolios.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No saved portfolios yet.</p>
                  ) : (
                    savedPortfolios.map((portfolio) => (
                      <div 
                        key={portfolio.id} 
                        className="flex items-center justify-between p-3 border border-border rounded-md hover-elevate"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{portfolio.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {portfolio.properties.length} properties | Saved {new Date(portfolio.savedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => loadPortfolio(portfolio)}
                            data-testid={`button-load-${portfolio.id}`}
                          >
                            Load
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deletePortfolio(portfolio.id)}
                            data-testid={`button-delete-${portfolio.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setLoadDialogOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <InputForm 
              onAddProperty={handleAddProperty} 
              onUndo={handleUndoLastProperty}
            />
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              <h2 className="text-2xl font-bold text-foreground ml-12">Portfolio Results</h2>
              
              <div className="bg-card border border-card-border rounded-lg p-1 flex">
                <button 
                  onClick={() => setViewMode('whole')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'whole' 
                      ? 'bg-muted text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="button-view-analyst"
                >
                  <LayoutDashboard className="w-4 h-4" /> Analyst View
                </button>
                <button 
                  onClick={() => setViewMode('individual')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'individual' 
                      ? 'bg-muted text-foreground' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid="button-view-individual"
                >
                  <ListFilter className="w-4 h-4" /> Individual
                </button>
              </div>
            </div>

            {properties.length === 0 ? (
              <div className="bg-card border-2 border-dashed border-card-border rounded-xl h-64 flex flex-col items-center justify-center text-muted-foreground">
                <Building2 className="w-12 h-12 mb-3 opacity-20" />
                <p className="font-medium">No properties analyzed yet.</p>
                <p className="text-sm mt-1">Use the form on the left to add an LTR or STR investment.</p>
              </div>
            ) : (
              <>
                {viewMode === 'whole' && (
                  <Dashboard 
                    portfolio={properties} 
                    marketCapRate={marketCapRate}
                    onMarketCapRateChange={setMarketCapRate}
                    onRemoveProperty={handleRemoveProperty}
                  />
                )}
                
                {viewMode === 'individual' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {properties.map(p => (
                      <PropertyCard 
                        key={p.shared.id} 
                        property={p} 
                        onRemove={handleRemoveProperty} 
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <CFOConsultant 
          portfolio={properties} 
          marketCapRate={marketCapRate}
        />

        <RecommendationPanel 
          portfolio={properties} 
          analysis={aiAnalysis} 
          onAnalysisChange={setAiAnalysis} 
        />
      </main>

      <EasyViz open={easyVizDialogOpen} onOpenChange={setEasyVizDialogOpen} />
    </div>
  );
}
