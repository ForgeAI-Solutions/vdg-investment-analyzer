import { Property, PropertyType, FinancialMetrics, ExpenseTiming } from "@shared/schema";

export function calculateMetrics(property: Property): FinancialMetrics {
  const { shared } = property;
  
  const monthlyRate = shared.interestRate / 100 / 12;
  const numPayments = shared.loanTermYears * 12;
  
  let monthlyMortgagePayment = 0;
  const activeLoanBalance = shared.loanRemaining > 0 ? shared.loanRemaining : shared.loanAmount;
  if (activeLoanBalance > 0 && monthlyRate > 0) {
    monthlyMortgagePayment = activeLoanBalance * 
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  }

  let grossMonthlyIncome = 0;
  let totalMonthlyExpenses = 0;

  if (property.type === PropertyType.LTR && property.ltr) {
    const ltr = property.ltr;
    grossMonthlyIncome = ltr.grossRentPerMonth * ltr.numberOfUnits;
    
    const pmFee = grossMonthlyIncome * (ltr.pmFeePercent / 100);
    const monthlyTax = ltr.annualPropertyTax / 12;
    const monthlyInsurance = ltr.annualInsurance / 12;
    
    totalMonthlyExpenses = pmFee + monthlyTax + monthlyInsurance + ltr.monthlyRepairReserve;
  } else if (property.type === PropertyType.STR && property.str) {
    const str = property.str;
    const bookedNights = str.daysInMonth * (str.occupancyRate / 100);
    grossMonthlyIncome = bookedNights * str.dailyRate;
    
    const coHostFee = grossMonthlyIncome * (str.coHostFeePercent / 100);
    const cleaningCosts = str.cleaningFeePerStay * str.avgStaysPerMonth;
    const monthlyTax = str.annualPropertyTax / 12;
    const monthlyInsurance = str.annualInsurance / 12;
    
    totalMonthlyExpenses = coHostFee + cleaningCosts + monthlyTax + monthlyInsurance + str.monthlyUtilities;
  }

  const netMonthlyIncome = grossMonthlyIncome - totalMonthlyExpenses;
  const netMonthlyCashFlow = netMonthlyIncome - monthlyMortgagePayment;
  
  const downPayment = shared.downpayment > 0 ? shared.downpayment : (shared.purchasePrice - shared.loanAmount);
  const initialCashInvested = downPayment + shared.closingCosts;
  
  const annualNetCashFlow = netMonthlyCashFlow * 12;
  const cashOnCashReturn = initialCashInvested > 0 
    ? (annualNetCashFlow / initialCashInvested) * 100 
    : 0;
  
  const annualNOI = netMonthlyIncome * 12;
  const capRate = shared.purchasePrice > 0 
    ? (annualNOI / shared.purchasePrice) * 100 
    : 0;

  // Calculate manual CapEx expenses
  const manualExpenses = property.manualExpenses || [];
  const immediateCapEx = manualExpenses
    .filter(e => e.timing === ExpenseTiming.IMMEDIATE)
    .reduce((sum, e) => sum + e.estimatedCost, 0);
  const year1CapEx = manualExpenses
    .filter(e => e.timing === ExpenseTiming.YEAR_1)
    .reduce((sum, e) => sum + e.estimatedCost, 0);
  const totalManualCapEx = immediateCapEx + year1CapEx;

  // Adjusted metrics accounting for manual CapEx
  // Immediate CapEx adds to initial investment, Year 1 deducts from first year cash flow
  const adjustedInitialCashInvested = initialCashInvested + immediateCapEx;
  const adjustedAnnualNetCashFlow = annualNetCashFlow - year1CapEx;
  
  const adjustedCashOnCashReturn = adjustedInitialCashInvested > 0 
    ? (adjustedAnnualNetCashFlow / adjustedInitialCashInvested) * 100 
    : 0;
  
  // Cap rate based on purchase price + immediate CapEx as total investment
  const totalPropertyCost = shared.purchasePrice + immediateCapEx;
  const adjustedCapRate = totalPropertyCost > 0 
    ? (annualNOI / totalPropertyCost) * 100 
    : 0;

  // When manual CapEx exists, use adjusted values as the primary metrics
  // This ensures all downstream consumers see the correct values
  const hasManualCapEx = totalManualCapEx > 0;
  const finalInitialCashInvested = hasManualCapEx ? adjustedInitialCashInvested : initialCashInvested;
  const finalCashOnCashReturn = hasManualCapEx ? adjustedCashOnCashReturn : cashOnCashReturn;
  const finalCapRate = hasManualCapEx ? adjustedCapRate : capRate;
  const finalAnnualNetCashFlow = hasManualCapEx ? adjustedAnnualNetCashFlow : annualNetCashFlow;
  // Spread Year 1 CapEx across 12 months for monthly cash flow
  const adjustedNetMonthlyCashFlow = netMonthlyCashFlow - (year1CapEx / 12);
  const finalNetMonthlyCashFlow = hasManualCapEx ? adjustedNetMonthlyCashFlow : netMonthlyCashFlow;

  return {
    monthlyMortgagePayment: Math.round(monthlyMortgagePayment * 100) / 100,
    grossMonthlyIncome: Math.round(grossMonthlyIncome * 100) / 100,
    totalMonthlyExpenses: Math.round(totalMonthlyExpenses * 100) / 100,
    netMonthlyIncome: Math.round(netMonthlyIncome * 100) / 100,
    netMonthlyCashFlow: Math.round(finalNetMonthlyCashFlow * 100) / 100,
    initialCashInvested: Math.round(finalInitialCashInvested * 100) / 100,
    cashOnCashReturn: Math.round(finalCashOnCashReturn * 100) / 100,
    capRate: Math.round(finalCapRate * 100) / 100,
    annualGrossIncome: Math.round(grossMonthlyIncome * 12 * 100) / 100,
    annualNetCashFlow: Math.round(finalAnnualNetCashFlow * 100) / 100,
    totalManualCapEx: Math.round(totalManualCapEx * 100) / 100,
    immediateCapEx: Math.round(immediateCapEx * 100) / 100,
    year1CapEx: Math.round(year1CapEx * 100) / 100,
    adjustedInitialCashInvested: Math.round(adjustedInitialCashInvested * 100) / 100,
    adjustedCashOnCashReturn: Math.round(adjustedCashOnCashReturn * 100) / 100,
    adjustedCapRate: Math.round(adjustedCapRate * 100) / 100,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function calculateValuation(annualNOI: number, marketCapRate: number): number {
  if (marketCapRate <= 0) return 0;
  return annualNOI / (marketCapRate / 100);
}
