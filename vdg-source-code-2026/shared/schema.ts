import { z } from "zod";

export enum PropertyType {
  LTR = 'LTR',
  STR = 'STR',
}

export enum BuildingType {
  SFH = 'SFH',           // Single Family Home - 1 unit
  DUPLEX = 'DUPLEX',     // 2 units
  TRIPLEX = 'TRIPLEX',   // 3 units
  QUADPLEX = 'QUADPLEX', // 4 units
  SIXPLEX = 'SIXPLEX',   // 6 units
  OCTOPLEX = 'OCTOPLEX', // 8 units
  DECAPLEX = 'DECAPLEX', // 10 units
  DODECAPLEX = 'DODECAPLEX', // 12 units
}

export const BUILDING_TYPE_UNITS: Record<BuildingType, number> = {
  [BuildingType.SFH]: 1,
  [BuildingType.DUPLEX]: 2,
  [BuildingType.TRIPLEX]: 3,
  [BuildingType.QUADPLEX]: 4,
  [BuildingType.SIXPLEX]: 6,
  [BuildingType.OCTOPLEX]: 8,
  [BuildingType.DECAPLEX]: 10,
  [BuildingType.DODECAPLEX]: 12,
};

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  [BuildingType.SFH]: 'Single Family Home',
  [BuildingType.DUPLEX]: 'Duplex (2 units)',
  [BuildingType.TRIPLEX]: 'Triplex (3 units)',
  [BuildingType.QUADPLEX]: 'Quadplex (4 units)',
  [BuildingType.SIXPLEX]: 'Sixplex (6 units)',
  [BuildingType.OCTOPLEX]: 'Octoplex (8 units)',
  [BuildingType.DECAPLEX]: 'Decaplex (10 units)',
  [BuildingType.DODECAPLEX]: 'Dodecaplex (12 units)',
};

export interface SharedDetails {
  id: string;
  name: string;
  marketValue: number;
  purchasePrice: number;
  downpayment: number;
  loanAmount: number;
  loanRemaining: number;
  interestRate: number;
  loanTermYears: number;
  closingCosts: number;
}

export interface LTRDetails {
  grossRentPerMonth: number;
  buildingType: BuildingType;
  numberOfUnits: number;
  pmFeePercent: number;
  annualPropertyTax: number;
  annualInsurance: number;
  monthlyRepairReserve: number;
  targetVeteranOccupancyPercent: number;
  currentVeteranOccupancyPercent?: number;
}

export interface STRDetails {
  dailyRate: number;
  daysInMonth: number;
  occupancyRate: number;
  coHostFeePercent: number;
  cleaningFeePerStay: number;
  avgStaysPerMonth: number;
  monthlyUtilities: number;
  annualPropertyTax: number;
  annualInsurance: number;
}

export enum ExpenseTiming {
  IMMEDIATE = 'IMMEDIATE',    // Pre-Closing / Immediate
  YEAR_1 = 'YEAR_1',          // Year 1 Amortization
}

export interface ManualExpense {
  id: string;
  name: string;
  estimatedCost: number;
  timing: ExpenseTiming;
}

export interface Property {
  type: PropertyType;
  shared: SharedDetails;
  ltr?: LTRDetails;
  str?: STRDetails;
  manualExpenses?: ManualExpense[];
}

export interface FinancialMetrics {
  monthlyMortgagePayment: number;
  grossMonthlyIncome: number;
  totalMonthlyExpenses: number;
  netMonthlyIncome: number;
  netMonthlyCashFlow: number;
  initialCashInvested: number;
  cashOnCashReturn: number;
  capRate: number;
  annualGrossIncome: number;
  annualNetCashFlow: number;
  totalManualCapEx: number;
  immediateCapEx: number;
  year1CapEx: number;
  adjustedInitialCashInvested: number;
  adjustedCashOnCashReturn: number;
  adjustedCapRate: number;
}

export interface PropertyAnalysis extends Property {
  metrics: FinancialMetrics;
}

export const DEFAULT_LTR_PROPERTY: Property = {
  type: PropertyType.LTR,
  shared: {
    id: '',
    name: '',
    marketValue: 0,
    purchasePrice: 0,
    downpayment: 0,
    loanAmount: 0,
    loanRemaining: 0,
    interestRate: 0,
    loanTermYears: 30,
    closingCosts: 0,
  },
  ltr: {
    grossRentPerMonth: 0,
    buildingType: BuildingType.SFH,
    numberOfUnits: 1,
    pmFeePercent: 9,
    annualPropertyTax: 0,
    annualInsurance: 0,
    monthlyRepairReserve: 50,
    targetVeteranOccupancyPercent: 50,
    currentVeteranOccupancyPercent: 0,
  },
  manualExpenses: [],
};

export const DEFAULT_STR_PROPERTY: Property = {
  type: PropertyType.STR,
  shared: {
    id: '',
    name: '',
    marketValue: 0,
    purchasePrice: 0,
    downpayment: 0,
    loanAmount: 0,
    loanRemaining: 0,
    interestRate: 0,
    loanTermYears: 30,
    closingCosts: 0,
  },
  str: {
    dailyRate: 0,
    daysInMonth: 30,
    occupancyRate: 0,
    coHostFeePercent: 0,
    cleaningFeePerStay: 0,
    avgStaysPerMonth: 0,
    monthlyUtilities: 0,
    annualPropertyTax: 0,
    annualInsurance: 0,
  },
  manualExpenses: [],
};

export interface SavedPortfolio {
  id: string;
  name: string;
  savedAt: string;
  properties: PropertyAnalysis[];
  marketCapRate: number;
}

export const insertPropertySchema = z.object({
  type: z.nativeEnum(PropertyType),
  name: z.string().min(1),
  marketValue: z.number().min(0),
  purchasePrice: z.number().positive(),
  downpayment: z.number().min(0),
  loanAmount: z.number().min(0),
  loanRemaining: z.number().min(0),
  interestRate: z.number().min(0).max(100),
  loanTermYears: z.number().int().positive(),
  closingCosts: z.number().min(0),
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;

export const users = null;
export type User = { id: string; username: string; password: string };
export type InsertUser = { username: string; password: string };
export const insertUserSchema = z.object({ username: z.string(), password: z.string() });
