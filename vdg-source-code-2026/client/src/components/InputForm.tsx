import { useState, useCallback, useRef, useEffect } from 'react';
import { Property, PropertyType, BuildingType, BUILDING_TYPE_UNITS, BUILDING_TYPE_LABELS, DEFAULT_LTR_PROPERTY, DEFAULT_STR_PROPERTY, ManualExpense } from '@shared/schema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Home, Plus, Undo2, DollarSign, Percent, Calendar, Wand2, Loader2, ImagePlus, X, RotateCcw, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ManualExpenseOverride } from './ManualExpenseOverride';

interface InputFormProps {
  onAddProperty: (property: Property) => void;
  onUndo: () => Property | null;
}

export function InputForm({ onAddProperty, onUndo }: InputFormProps) {
  const [propertyType, setPropertyType] = useState<PropertyType>(PropertyType.LTR);
  const [formData, setFormData] = useState<Property>(() => structuredClone(DEFAULT_LTR_PROPERTY));
  const [canUndo, setCanUndo] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importImage, setImportImage] = useState<string | null>(null);
  const [importImageName, setImportImageName] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEstimatingValue, setIsEstimatingValue] = useState(false);
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isFetchingSTREstimate, setIsFetchingSTREstimate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImportImage(base64);
      setImportImageName(file.name);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const clearImage = useCallback(() => {
    setImportImage(null);
    setImportImageName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleTypeChange = useCallback((type: string) => {
    const newType = type as PropertyType;
    setPropertyType(newType);
    const defaults = newType === PropertyType.LTR ? DEFAULT_LTR_PROPERTY : DEFAULT_STR_PROPERTY;
    setFormData(structuredClone(defaults));
  }, []);

  const updateShared = useCallback((field: string, value: number | string) => {
    setFormData(prev => ({
      ...prev,
      shared: { ...prev.shared, [field]: value }
    }));
  }, []);

  const handleEstimateMarketValue = useCallback(async () => {
    if (!formData.shared.name.trim()) {
      toast({
        title: "Property name required",
        description: "Please enter a property name or address first.",
        variant: "destructive",
      });
      return;
    }

    setIsEstimatingValue(true);
    try {
      const response = await fetch('/api/market-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          propertyName: formData.shared.name,
          propertyType: propertyType
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to estimate market value');
      }

      if (result.marketValue && result.marketValue > 0) {
        updateShared('marketValue', result.marketValue);
        toast({
          title: "Market value estimated",
          description: `Estimated at $${result.marketValue.toLocaleString()} (${result.confidence} confidence). ${result.reasoning}`,
        });
      } else {
        toast({
          title: "Could not estimate value",
          description: result.reasoning || "Unable to determine market value for this property.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Estimation failed",
        description: error instanceof Error ? error.message : 'Failed to estimate market value',
        variant: "destructive",
      });
    } finally {
      setIsEstimatingValue(false);
    }
  }, [formData.shared.name, propertyType, updateShared, toast]);

  const handleFetchMortgageRate = useCallback(async () => {
    setIsFetchingRate(true);
    try {
      const response = await fetch('/api/mortgage-rate');
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch mortgage rate');
      }

      if (result.rate && result.rate > 0) {
        updateShared('interestRate', result.rate);
        toast({
          title: "Interest rate updated",
          description: `Current 30-year fixed rate: ${result.rate}% (${result.source})`,
        });
      } else {
        toast({
          title: "Could not fetch rate",
          description: "Unable to determine current mortgage rate.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Rate fetch failed",
        description: error instanceof Error ? error.message : 'Failed to fetch mortgage rate',
        variant: "destructive",
      });
    } finally {
      setIsFetchingRate(false);
    }
  }, [updateShared, toast]);

  const handleFetchSTREstimate = useCallback(async () => {
    if (!formData.shared.name.trim()) {
      toast({
        title: "Property address required",
        description: "Please enter a property name or address first.",
        variant: "destructive",
      });
      return;
    }

    setIsFetchingSTREstimate(true);
    try {
      const response = await fetch('/api/str-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          propertyName: formData.shared.name
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to get STR estimates');
      }

      setFormData(prev => ({
        ...prev,
        str: prev.str ? {
          ...prev.str,
          dailyRate: result.dailyRate || prev.str.dailyRate,
          occupancyRate: result.occupancyRate || prev.str.occupancyRate,
          coHostFeePercent: result.coHostFeePercent || prev.str.coHostFeePercent,
          cleaningFeePerStay: result.cleaningFeePerStay || prev.str.cleaningFeePerStay,
          avgStaysPerMonth: result.avgStaysPerMonth || prev.str.avgStaysPerMonth,
          monthlyUtilities: result.monthlyUtilities || prev.str.monthlyUtilities,
          annualPropertyTax: result.annualPropertyTax || prev.str.annualPropertyTax,
          annualInsurance: result.annualInsurance || prev.str.annualInsurance,
        } : undefined,
      }));

      toast({
        title: "STR estimates populated",
        description: `${result.confidence} confidence: ${result.reasoning}`,
      });
    } catch (error) {
      toast({
        title: "STR estimate failed",
        description: error instanceof Error ? error.message : 'Failed to get STR estimates',
        variant: "destructive",
      });
    } finally {
      setIsFetchingSTREstimate(false);
    }
  }, [formData.shared.name, toast]);

  const updateLTR = useCallback((field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      ltr: prev.ltr ? { ...prev.ltr, [field]: value } : undefined
    }));
  }, []);

  const updateSTR = useCallback((field: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      str: prev.str ? { ...prev.str, [field]: value } : undefined
    }));
  }, []);

  // Auto-calculate dependent fields when purchase price changes
  useEffect(() => {
    const purchasePrice = formData.shared.purchasePrice;
    if (purchasePrice > 0) {
      setFormData(prev => {
        const newDownpayment = Math.round(purchasePrice * 0.20);
        const newLoanAmount = purchasePrice - newDownpayment;
        const newClosingCosts = Math.round(purchasePrice * 0.03);
        // Annual insurance: approximately 0.35% of purchase price
        const newAnnualInsurance = Math.round(purchasePrice * 0.0035);
        
        const updates: Partial<Property> = {
          shared: {
            ...prev.shared,
            downpayment: newDownpayment,
            loanAmount: newLoanAmount,
            loanRemaining: newLoanAmount,
            closingCosts: newClosingCosts,
          }
        };
        
        // Update LTR insurance if it's an LTR property
        if (prev.type === PropertyType.LTR && prev.ltr) {
          updates.ltr = {
            ...prev.ltr,
            annualInsurance: newAnnualInsurance,
          };
        }
        
        // Update STR insurance if it's an STR property
        if (prev.type === PropertyType.STR && prev.str) {
          updates.str = {
            ...prev.str,
            annualInsurance: newAnnualInsurance,
          };
        }
        
        return { ...prev, ...updates };
      });
    }
  }, [formData.shared.purchasePrice]);

  // Auto-calculate Annual Tax as 1% of Loan Amount
  useEffect(() => {
    const loanAmount = formData.shared.loanAmount;
    if (loanAmount > 0) {
      const annualTax = Math.round(loanAmount * 0.01);
      setFormData(prev => {
        const updates: Partial<Property> = {};
        
        if (prev.type === PropertyType.LTR && prev.ltr) {
          updates.ltr = {
            ...prev.ltr,
            annualPropertyTax: annualTax,
          };
        }
        
        if (prev.type === PropertyType.STR && prev.str) {
          updates.str = {
            ...prev.str,
            annualPropertyTax: annualTax,
          };
        }
        
        return { ...prev, ...updates };
      });
    }
  }, [formData.shared.loanAmount, formData.type]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const property: Property = {
      ...formData,
      shared: {
        ...formData.shared,
        id: crypto.randomUUID(),
      }
    };
    onAddProperty(property);
    setCanUndo(true);
    const defaults = propertyType === PropertyType.LTR ? DEFAULT_LTR_PROPERTY : DEFAULT_STR_PROPERTY;
    setFormData(structuredClone(defaults));
  }, [formData, propertyType, onAddProperty]);

  const handleUndo = useCallback(() => {
    const restored = onUndo();
    if (restored) {
      setFormData(restored);
      setPropertyType(restored.type);
    }
    setCanUndo(false);
  }, [onUndo]);

  const handleReset = useCallback(() => {
    const defaults = propertyType === PropertyType.LTR ? DEFAULT_LTR_PROPERTY : DEFAULT_STR_PROPERTY;
    setFormData(structuredClone(defaults));
    toast({
      title: "Form reset",
      description: "All fields have been reset to 0.",
    });
  }, [propertyType, toast]);

  const handleQuickImport = useCallback(async () => {
    if (!importImage) {
      toast({
        title: "No screenshot provided",
        description: "Please upload a screenshot of the property listing.",
        variant: "destructive",
      });
      return;
    }

    setIsExtracting(true);
    try {
      const response = await fetch('/api/extract-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: importImage,
          propertyType 
        }),
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('Server returned invalid response. Please try again.');
      }
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to extract property data');
      }
      
      const { extracted, rawResponse } = result;
      
      if (!extracted) {
        throw new Error(rawResponse ? `AI could not parse the listing. Raw: ${rawResponse.slice(0, 100)}...` : 'Failed to extract property data');
      }
      
      // Use listing price as purchase price - user enters loan details manually
      const listingPrice = extracted.purchasePrice || extracted.listingPrice || 0;
      const marketValue = extracted.marketValue || listingPrice;
      const estimatedRent = extracted.estimatedRent || 0;
      const annualTax = extracted.annualPropertyTax || 0;
      const annualInsurance = extracted.annualInsurance || (listingPrice > 0 ? Math.round(listingPrice * 0.005) : 0);
      const units = extracted.numberOfUnits || 1;
      
      // Map units to building type
      const getBuildingType = (unitCount: number): BuildingType => {
        if (unitCount <= 1) return BuildingType.SFH;
        if (unitCount === 2) return BuildingType.DUPLEX;
        if (unitCount === 3) return BuildingType.TRIPLEX;
        if (unitCount === 4) return BuildingType.QUADPLEX;
        if (unitCount <= 6) return BuildingType.SIXPLEX;
        if (unitCount <= 8) return BuildingType.OCTOPLEX;
        if (unitCount <= 10) return BuildingType.DECAPLEX;
        return BuildingType.DODECAPLEX;
      };
      
      const buildingType = getBuildingType(units);
      const actualUnits = BUILDING_TYPE_UNITS[buildingType];
      
      if (propertyType === PropertyType.LTR) {
        setFormData(prev => ({
          ...prev,
          shared: {
            ...prev.shared,
            name: extracted.name || prev.shared.name,
            marketValue: marketValue,
            purchasePrice: listingPrice,
            downpayment: 0,
            loanAmount: 0,
            loanRemaining: 0,
          },
          ltr: prev.ltr ? {
            ...prev.ltr,
            grossRentPerMonth: estimatedRent,
            annualPropertyTax: annualTax || prev.ltr.annualPropertyTax,
            annualInsurance: annualInsurance || prev.ltr.annualInsurance,
            buildingType: buildingType,
            numberOfUnits: actualUnits,
          } : undefined,
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          shared: {
            ...prev.shared,
            name: extracted.name || prev.shared.name,
            marketValue: marketValue,
            purchasePrice: listingPrice,
            downpayment: 0,
            loanAmount: 0,
            loanRemaining: 0,
          },
          str: prev.str ? {
            ...prev.str,
            annualPropertyTax: annualTax || prev.str.annualPropertyTax,
            annualInsurance: annualInsurance || prev.str.annualInsurance,
            dailyRate: estimatedRent > 0 ? Math.round(estimatedRent / 20) : prev.str.dailyRate,
          } : undefined,
        }));
      }

      toast({
        title: "Property data imported",
        description: `Imported "${extracted.name || 'property'}" - review and adjust the values as needed.`,
      });
      
      setImportDialogOpen(false);
      clearImage();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : 'Failed to extract property data',
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  }, [importImage, propertyType, toast, clearImage]);

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="w-5 h-5 text-primary" />
            Property Analysis
          </CardTitle>
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-quick-import">
                <Wand2 className="w-4 h-4 mr-1" />
                Quick Import
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Quick Import from Screenshot</DialogTitle>
                <DialogDescription>
                  Upload a screenshot from a Zillow, Redfin, or other property listing. AI will extract the key details automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label className="text-sm font-medium mb-2 block">Upload Screenshot</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    data-testid="input-image-upload"
                  />
                  {importImage ? (
                    <div className="relative border rounded-md p-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <img 
                          src={importImage} 
                          alt="Uploaded listing" 
                          className="w-16 h-16 object-cover rounded-md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{importImageName}</p>
                          <p className="text-xs text-muted-foreground">Image uploaded</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={clearImage}
                          className="shrink-0"
                          data-testid="button-clear-image"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-32 flex-col gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-upload-image"
                    >
                      <ImagePlus className="w-8 h-8" />
                      <span>Click to upload a screenshot</span>
                    </Button>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false);
                    clearImage();
                  }}
                  disabled={isExtracting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickImport}
                  disabled={isExtracting || !importImage}
                  data-testid="button-extract"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Extract Data
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Tabs value={propertyType} onValueChange={handleTypeChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value={PropertyType.LTR} className="flex items-center gap-2" data-testid="tab-ltr">
                <Home className="w-4 h-4" />
                Long-Term Rental
              </TabsTrigger>
              <TabsTrigger value={PropertyType.STR} className="flex items-center gap-2" data-testid="tab-str">
                <Building2 className="w-4 h-4" />
                Short-Term Rental
              </TabsTrigger>
            </TabsList>

            <div className="mt-5 space-y-4">
              <div>
                <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">Property Name</Label>
                <Input
                  id="name"
                  value={formData.shared.name}
                  onChange={(e) => updateShared('name', e.target.value)}
                  placeholder="Enter property name"
                  className="mt-1.5"
                  data-testid="input-name"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Market Value
                </Label>
                <div className="flex gap-1.5 mt-1.5">
                  <Input
                    type="number"
                    value={formData.shared.marketValue ?? 0}
                    onChange={(e) => updateShared('marketValue', Number(e.target.value))}
                    placeholder="Current property value"
                    className="flex-1"
                    data-testid="input-market-value"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleEstimateMarketValue}
                        disabled={isEstimatingValue || !formData.shared.name.trim()}
                        data-testid="button-estimate-market-value"
                      >
                        {isEstimatingValue ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>AI estimate market value</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Purchase Price
                </Label>
                <Input
                  type="number"
                  value={formData.shared.purchasePrice ?? 0}
                  onChange={(e) => updateShared('purchasePrice', Number(e.target.value))}
                  placeholder="Original purchase price"
                  className="mt-1.5"
                  data-testid="input-purchase-price"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Downpayment
                  </Label>
                  <Input
                    type="number"
                    value={formData.shared.downpayment ?? 0}
                    onChange={(e) => updateShared('downpayment', Number(e.target.value))}
                    placeholder="Amount put down"
                    className="mt-1.5"
                    data-testid="input-downpayment"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Loan Amount
                  </Label>
                  <Input
                    type="number"
                    value={formData.shared.loanAmount ?? 0}
                    onChange={(e) => updateShared('loanAmount', Number(e.target.value))}
                    placeholder="Original loan"
                    className="mt-1.5"
                    data-testid="input-loan-amount"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Loan Remaining
                  </Label>
                  <Input
                    type="number"
                    value={formData.shared.loanRemaining ?? 0}
                    onChange={(e) => updateShared('loanRemaining', Number(e.target.value))}
                    placeholder="Current balance"
                    className="mt-1.5"
                    data-testid="input-loan-remaining"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    Interest Rate
                  </Label>
                  <div className="flex gap-1.5 mt-1.5">
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.shared.interestRate}
                      onChange={(e) => updateShared('interestRate', Number(e.target.value))}
                      className="flex-1"
                      data-testid="input-interest-rate"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleFetchMortgageRate}
                          disabled={isFetchingRate}
                          data-testid="button-fetch-mortgage-rate"
                        >
                          {isFetchingRate ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Get Bank of America 30-year fixed rate</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Loan Term (Years)
                </Label>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Closing Costs
                </Label>
                <Input
                  type="number"
                  value={formData.shared.loanTermYears}
                  onChange={(e) => updateShared('loanTermYears', Number(e.target.value))}
                  data-testid="input-loan-term"
                />
                <Input
                  type="number"
                  value={formData.shared.closingCosts}
                  onChange={(e) => updateShared('closingCosts', Number(e.target.value))}
                  data-testid="input-closing-costs"
                />
              </div>

              <TabsContent value={PropertyType.LTR} className="mt-0 space-y-4">
                <div className="pt-3 border-t border-border">
                  <h4 className="text-sm font-medium text-foreground mb-3">LTR Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        Rent/Unit/Month
                      </Label>
                      <Input
                        type="number"
                        value={formData.ltr?.grossRentPerMonth || 0}
                        onChange={(e) => updateLTR('grossRentPerMonth', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-rent-per-unit"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        Property Type
                      </Label>
                      <Select
                        value={formData.ltr?.buildingType || BuildingType.SFH}
                        onValueChange={(value: BuildingType) => {
                          const units = BUILDING_TYPE_UNITS[value];
                          setFormData(prev => ({
                            ...prev,
                            ltr: prev.ltr ? {
                              ...prev.ltr,
                              buildingType: value,
                              numberOfUnits: units,
                            } : prev.ltr
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1.5" data-testid="select-building-type">
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(BuildingType).map((type) => (
                            <SelectItem key={type} value={type}>
                              {BUILDING_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">PM Fee (%)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={formData.ltr?.pmFeePercent || 0}
                        onChange={(e) => updateLTR('pmFeePercent', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-pm-fee"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Monthly Repairs</Label>
                      <Input
                        type="number"
                        value={formData.ltr?.monthlyRepairReserve || 0}
                        onChange={(e) => updateLTR('monthlyRepairReserve', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-repairs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Annual Tax</Label>
                      <Input
                        type="number"
                        value={formData.ltr?.annualPropertyTax || 0}
                        onChange={(e) => updateLTR('annualPropertyTax', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-ltr-tax"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Annual Insurance</Label>
                      <Input
                        type="number"
                        value={formData.ltr?.annualInsurance || 0}
                        onChange={(e) => updateLTR('annualInsurance', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-ltr-insurance"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Vet. Occupancy Goal (%)</Label>
                      <Input
                        type="number"
                        value={50}
                        disabled
                        className="mt-1.5 bg-muted text-muted-foreground cursor-not-allowed"
                        data-testid="input-veteran-occupancy-goal"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Current Vet. Occupancy (%)</Label>
                      <Input
                        type="number"
                        value={formData.ltr?.currentVeteranOccupancyPercent || 0}
                        onChange={(e) => updateLTR('currentVeteranOccupancyPercent', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-current-veteran-occupancy"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value={PropertyType.STR} className="mt-0 space-y-4">
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="text-sm font-medium text-foreground">STR Details</h4>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleFetchSTREstimate}
                          disabled={isFetchingSTREstimate || !formData.shared.name.trim()}
                          data-testid="button-str-estimate"
                        >
                          {isFetchingSTREstimate ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-1" />
                              AI Estimate
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>AI estimate STR rates and condo expenses based on address</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                    <Label className="text-sm font-medium text-muted-foreground">Daily Rate</Label>
                    <Label className="text-sm font-medium text-muted-foreground">Days/Month</Label>
                    <Label className="text-sm font-medium text-muted-foreground">Occupancy (%)</Label>
                    <Input
                      type="number"
                      value={formData.str?.dailyRate || 0}
                      onChange={(e) => updateSTR('dailyRate', Number(e.target.value))}
                      data-testid="input-daily-rate"
                    />
                    <Input
                      type="number"
                      value={formData.str?.daysInMonth || 30}
                      onChange={(e) => updateSTR('daysInMonth', Number(e.target.value))}
                      data-testid="input-days-in-month"
                    />
                    <Input
                      type="number"
                      value={formData.str?.occupancyRate || 0}
                      onChange={(e) => updateSTR('occupancyRate', Number(e.target.value))}
                      data-testid="input-occupancy"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Co-Host Fee (%)</Label>
                      <Input
                        type="number"
                        value={formData.str?.coHostFeePercent || 0}
                        onChange={(e) => updateSTR('coHostFeePercent', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-cohost-fee"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Avg Stays/Month</Label>
                      <Input
                        type="number"
                        value={formData.str?.avgStaysPerMonth || 0}
                        onChange={(e) => updateSTR('avgStaysPerMonth', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-stays"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Cleaning Fee/Stay</Label>
                      <Input
                        type="number"
                        value={formData.str?.cleaningFeePerStay || 0}
                        onChange={(e) => updateSTR('cleaningFeePerStay', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-cleaning-fee"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Monthly Utilities</Label>
                      <Input
                        type="number"
                        value={formData.str?.monthlyUtilities || 0}
                        onChange={(e) => updateSTR('monthlyUtilities', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-utilities"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Annual Tax</Label>
                      <Input
                        type="number"
                        value={formData.str?.annualPropertyTax || 0}
                        onChange={(e) => updateSTR('annualPropertyTax', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-str-tax"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Annual Insurance</Label>
                      <Input
                        type="number"
                        value={formData.str?.annualInsurance || 0}
                        onChange={(e) => updateSTR('annualInsurance', Number(e.target.value))}
                        className="mt-1.5"
                        data-testid="input-str-insurance"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="pt-3 border-t border-border">
            <ManualExpenseOverride
              expenses={formData.manualExpenses || []}
              onExpensesChange={(expenses: ManualExpense[]) => {
                setFormData(prev => ({ ...prev, manualExpenses: expenses }));
              }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" data-testid="button-add-property">
              <Plus className="w-4 h-4 mr-2" />
              Add Property
            </Button>
            <Button type="button" variant="outline" onClick={handleReset} data-testid="button-reset">
              <RotateCcw className="w-4 h-4" />
            </Button>
            {canUndo && (
              <Button type="button" variant="outline" onClick={handleUndo} data-testid="button-undo">
                <Undo2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
