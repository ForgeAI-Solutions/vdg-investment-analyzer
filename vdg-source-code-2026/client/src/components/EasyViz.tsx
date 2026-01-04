import { useState, useCallback, useRef, useEffect, type ChangeEvent } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  X,
  Download,
  BarChart3,
  PieChartIcon,
  TrendingUp,
  Grid3X3,
  TableIcon,
  GripVertical,
  FileSpreadsheet,
  FileText,
  Presentation,
  Trash2,
  Filter,
  Loader2,
  ScatterChart as ScatterIcon,
  AreaChart as AreaIcon,
  Circle,
  Layers,
  Palette,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Type,
  AlertTriangle,
  Save,
  FolderOpen,
  Plus
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip as ShadcnTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';

type ChartType = 'vertical-bar' | 'horizontal-bar' | 'pie' | 'line' | 'heatmap' | 'table' | 'scatter' | 'area' | 'donut' | 'stacked-bar';
type DataType = 'string' | 'number' | 'date' | 'currency' | 'percentage';

interface ColumnInfo {
  name: string;
  type: DataType;
  values: (string | number | Date)[];
}

interface DataPanel {
  id: string;
  fileName: string;
  columns: ColumnInfo[];
  data: Record<string, any>[];
  chartType: ChartType;
  selectedColumns: string[];
  filters: Record<string, string[]>;
  customColor: string | null;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  cellColors: Record<string, string>;
}

interface SavedDashboard {
  id: string;
  name: string;
  savedAt: string;
  panels: DataPanel[];
  layout: LayoutItem[];
}

const EASYVIZ_STORAGE_KEY = 'vdg_easyviz_dashboards';
const MAX_SAVED_DASHBOARDS = 10;

const CELL_COLOR_PRESETS = [
  { name: 'None', value: '' },
  { name: 'Green', value: '#dcfce7' },
  { name: 'Red', value: '#fee2e2' },
  { name: 'Yellow', value: '#fef9c3' },
  { name: 'Blue', value: '#dbeafe' },
  { name: 'Purple', value: '#f3e8ff' },
  { name: 'Orange', value: '#ffedd5' },
];

// Format camelCase to Title_Case_With_Underscores for legend labels
const formatLegendLabel = (value: string): string => {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/^./, str => str.toUpperCase())
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('_');
};

const COLOR_PRESETS = [
  { name: 'Default', value: null },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Amber', value: '#f59e0b' },
];

interface EasyVizProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#f87171',
  '#a78bfa',
];

const PIE_COLORS = ['#a52a2a', '#1e40af', '#047857', '#b45309', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

const WARNING_ORANGE = '#f97316';
const WARNING_ORANGE_BG = '#fff7ed';
const WARNING_ORANGE_BORDER = '#fed7aa';

const MANUAL_EXPENSE_KEYWORDS = [
  'manual', 'capex', 'cap ex', 'human context', 'override', 
  'adjustment', 'estimated cost', 'immediate', 'year 1',
  'roof', 'hvac', 'plumbing', 'foundation', 'repair'
];

function isManualExpenseColumn(columnName: string): boolean {
  const lower = columnName.toLowerCase();
  return MANUAL_EXPENSE_KEYWORDS.some(keyword => lower.includes(keyword));
}

function inferDataType(values: string[]): DataType {
  const nonEmpty = values.filter(v => v && v.trim() !== '');
  if (nonEmpty.length === 0) return 'string';

  const currencyPattern = /^\$[\d,]+(\.\d{2})?$/;
  const percentPattern = /^[\d.]+%$/;
  const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$|^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/;
  // Strict number pattern: only digits, optional commas, optional decimal, optional negative
  const strictNumberPattern = /^-?[\d,]+(\.\d+)?$/;
  
  let currencyCount = 0;
  let percentCount = 0;
  let dateCount = 0;
  let numberCount = 0;

  for (const val of nonEmpty.slice(0, 20)) {
    const trimmed = val.trim();
    if (currencyPattern.test(trimmed)) currencyCount++;
    else if (percentPattern.test(trimmed)) percentCount++;
    else if (datePattern.test(trimmed)) dateCount++;
    // Only count as number if the ENTIRE string is numeric (not just starts with digits)
    else if (strictNumberPattern.test(trimmed)) numberCount++;
  }

  const threshold = nonEmpty.slice(0, 20).length * 0.6;
  if (currencyCount >= threshold) return 'currency';
  if (percentCount >= threshold) return 'percentage';
  if (dateCount >= threshold) return 'date';
  if (numberCount >= threshold) return 'number';
  return 'string';
}

function parseValue(value: string, type: DataType): string | number | Date {
  if (!value || value.trim() === '') return type === 'number' || type === 'currency' || type === 'percentage' ? 0 : '';
  
  switch (type) {
    case 'currency':
      return parseFloat(value.replace(/[$,]/g, '')) || 0;
    case 'percentage':
      return parseFloat(value.replace('%', '')) || 0;
    case 'number':
      return parseFloat(value.replace(/,/g, '')) || 0;
    case 'date':
      return new Date(value);
    default:
      return value;
  }
}

function suggestChartType(columns: ColumnInfo[]): ChartType {
  const hasDate = columns.some(c => c.type === 'date');
  const numericCols = columns.filter(c => ['number', 'currency', 'percentage'].includes(c.type));
  const categoricalCols = columns.filter(c => c.type === 'string');
  
  if (hasDate && numericCols.length > 0) {
    return 'line';
  }
  if (categoricalCols.length === 1 && numericCols.length === 1) {
    const uniqueCategories = new Set(categoricalCols[0].values).size;
    if (uniqueCategories <= 8) return 'pie';
    return 'vertical-bar';
  }
  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    return 'vertical-bar';
  }
  return 'table';
}

function formatValue(value: any, type: DataType): string {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'date':
      return value instanceof Date ? value.toLocaleDateString() : String(value);
    default:
      return String(value);
  }
}

// Parse address into components: street, city, state, zip
function parseAddress(address: string): { street: string; city: string; state: string; zip: string; isAddress: boolean } {
  if (!address || typeof address !== 'string') {
    return { street: String(address || ''), city: '', state: '', zip: '', isAddress: false };
  }
  
  // Common address pattern: "123 Main St, City, ST 12345" or "123 Main St City ST 12345"
  // Look for patterns with state abbreviations and zip codes
  const stateZipPattern = /,?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i;
  const stateZipMatch = address.match(stateZipPattern);
  
  if (stateZipMatch) {
    const beforeStateZip = address.slice(0, stateZipMatch.index).trim();
    const state = stateZipMatch[1].toUpperCase();
    const zip = stateZipMatch[2];
    
    // Now try to find the city (usually after the last comma before state)
    const lastCommaIdx = beforeStateZip.lastIndexOf(',');
    if (lastCommaIdx > 0) {
      const street = beforeStateZip.slice(0, lastCommaIdx).trim();
      const city = beforeStateZip.slice(lastCommaIdx + 1).trim();
      return { street, city, state, zip, isAddress: true };
    }
    
    // No comma found, try to find city by looking for the street number pattern
    // Assume street is everything before the city
    return { street: beforeStateZip, city: '', state, zip, isAddress: true };
  }
  
  // Check if it looks like just a street address with a number
  const streetNumberPattern = /^\d+\s+/;
  if (streetNumberPattern.test(address)) {
    // Try splitting by comma
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      return { 
        street: parts[0], 
        city: parts[1] || '', 
        state: parts[2]?.replace(/\d+/g, '').trim() || '', 
        zip: parts[2]?.match(/\d+/)?.[0] || '',
        isAddress: true 
      };
    }
    return { street: address, city: '', state: '', zip: '', isAddress: true };
  }
  
  return { street: address, city: '', state: '', zip: '', isAddress: false };
}

// Format address for X-axis labels (street only)
function formatStreetAddress(value: string): string {
  const parsed = parseAddress(value);
  return parsed.street || value;
}

// Custom tooltip formatter for charts that formats names and values
function CustomTooltipFormatter({ 
  active, 
  payload, 
  label, 
  columns,
  categoryKey
}: { 
  active?: boolean; 
  payload?: any[]; 
  label?: string;
  columns: ColumnInfo[];
  categoryKey?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  
  // Parse the label as an address if it looks like one
  const parsedAddress = parseAddress(String(label || ''));
  
  return (
    <div className="bg-background border border-border rounded-md p-2 shadow-md max-w-[300px]">
      {parsedAddress.isAddress ? (
        <div className="mb-2">
          <p className="font-medium text-sm">{parsedAddress.street}</p>
          {(parsedAddress.city || parsedAddress.state) && (
            <p className="text-xs text-muted-foreground">
              {[parsedAddress.city, parsedAddress.state].filter(Boolean).join(', ')}
            </p>
          )}
          {parsedAddress.zip && (
            <p className="text-xs text-muted-foreground">{parsedAddress.zip}</p>
          )}
        </div>
      ) : (
        <p className="font-medium text-sm mb-1">{label}</p>
      )}
      {payload.map((entry: any, index: number) => {
        const col = columns.find(c => c.name === entry.dataKey);
        const formattedName = formatLegendLabel(entry.dataKey || entry.name || '');
        const formattedValue = col ? formatValue(entry.value, col.type) : entry.value;
        return (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {formattedName}: {formattedValue}
          </p>
        );
      })}
    </div>
  );
}

export function EasyViz({ open, onOpenChange }: EasyVizProps) {
  const [panels, setPanels] = useState<DataPanel[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboard[]>([]);
  const [dashboardName, setDashboardName] = useState('');
  const [currentLoadedDashboardId, setCurrentLoadedDashboardId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  
  useEffect(() => {
    const stored = localStorage.getItem(EASYVIZ_STORAGE_KEY);
    if (stored) {
      try {
        setSavedDashboards(JSON.parse(stored));
      } catch {
        console.error('Failed to parse saved dashboards');
      }
    }
  }, []);
  
  const saveDashboard = useCallback((saveAsNew: boolean = false) => {
    if (!dashboardName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the dashboard.",
        variant: "destructive",
      });
      return;
    }
    
    if (panels.length === 0) {
      toast({
        title: "No panels",
        description: "Add at least one CSV panel before saving.",
        variant: "destructive",
      });
      return;
    }
    
    const isUpdating = currentLoadedDashboardId && !saveAsNew;
    
    if (!isUpdating && savedDashboards.length >= MAX_SAVED_DASHBOARDS) {
      toast({
        title: "Limit reached",
        description: `You can save up to ${MAX_SAVED_DASHBOARDS} dashboards. Delete one to save a new one.`,
        variant: "destructive",
      });
      return;
    }
    
    if (isUpdating) {
      const updated = savedDashboards.map(d => 
        d.id === currentLoadedDashboardId 
          ? {
              ...d,
              name: dashboardName.trim(),
              savedAt: new Date().toISOString(),
              panels: structuredClone(panels),
              layout: structuredClone(layout),
            }
          : d
      );
      setSavedDashboards(updated);
      localStorage.setItem(EASYVIZ_STORAGE_KEY, JSON.stringify(updated));
      
      toast({
        title: "Dashboard updated",
        description: `"${dashboardName.trim()}" has been updated.`,
      });
    } else {
      const newDashboard: SavedDashboard = {
        id: crypto.randomUUID(),
        name: dashboardName.trim(),
        savedAt: new Date().toISOString(),
        panels: structuredClone(panels),
        layout: structuredClone(layout),
      };
      
      const updated = [...savedDashboards, newDashboard];
      setSavedDashboards(updated);
      localStorage.setItem(EASYVIZ_STORAGE_KEY, JSON.stringify(updated));
      setCurrentLoadedDashboardId(newDashboard.id);
      
      toast({
        title: "Dashboard saved",
        description: `"${newDashboard.name}" has been saved.`,
      });
    }
    
    setSaveDialogOpen(false);
  }, [dashboardName, panels, layout, savedDashboards, currentLoadedDashboardId, toast]);
  
  const loadDashboard = useCallback((dashboard: SavedDashboard) => {
    const rehydratedPanels = dashboard.panels.map(panel => ({
      ...panel,
      columns: panel.columns.map(col => ({
        ...col,
        values: col.type === 'date' 
          ? col.values.map(v => typeof v === 'string' ? new Date(v) : v)
          : col.values
      })),
      data: panel.data.map(row => {
        const newRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          const col = panel.columns.find(c => c.name === key);
          if (col?.type === 'date' && typeof value === 'string') {
            newRow[key] = new Date(value);
          } else {
            newRow[key] = value;
          }
        }
        return newRow;
      })
    }));
    
    setPanels(rehydratedPanels);
    setLayout(dashboard.layout);
    setCurrentLoadedDashboardId(dashboard.id);
    setDashboardName(dashboard.name);
    setLoadDialogOpen(false);
    
    toast({
      title: "Dashboard loaded",
      description: `"${dashboard.name}" has been loaded.`,
    });
  }, [toast]);
  
  const deleteDashboard = useCallback((id: string) => {
    const updated = savedDashboards.filter(d => d.id !== id);
    setSavedDashboards(updated);
    localStorage.setItem(EASYVIZ_STORAGE_KEY, JSON.stringify(updated));
    
    if (currentLoadedDashboardId === id) {
      setCurrentLoadedDashboardId(null);
      setDashboardName('');
    }
    
    toast({
      title: "Dashboard deleted",
      description: "The saved dashboard has been removed.",
    });
  }, [savedDashboards, currentLoadedDashboardId, toast]);
  
  const clearCurrentDashboard = useCallback(() => {
    setPanels([]);
    setLayout([]);
    setCurrentLoadedDashboardId(null);
    setDashboardName('');
  }, []);

  const handleFileUpload = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 6 - panels.length;
    if (remainingSlots <= 0) {
      toast({
        title: "Maximum panels reached",
        description: "You can have up to 6 visualization panels.",
        variant: "destructive"
      });
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          toast({
            title: "Invalid CSV",
            description: `${file.name} must have headers and at least one data row.`,
            variant: "destructive"
          });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rawData: string[][] = lines.slice(1).map(line => {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim());
          return values;
        });

        const columns: ColumnInfo[] = headers.map((header, idx) => {
          const columnValues = rawData.map(row => row[idx] || '');
          const type = inferDataType(columnValues);
          return {
            name: header,
            type,
            values: columnValues.map(v => parseValue(v, type))
          };
        });

        const data = rawData.map(row => {
          const record: Record<string, any> = {};
          headers.forEach((header, idx) => {
            const col = columns[idx];
            record[header] = parseValue(row[idx] || '', col.type);
          });
          return record;
        });

        const suggestedChart = suggestChartType(columns);
        const numericCols = columns.filter(c => ['number', 'currency', 'percentage'].includes(c.type));
        const categoricalCols = columns.filter(c => c.type === 'string');
        
        let selectedColumns: string[] = [];
        if (categoricalCols.length > 0) selectedColumns.push(categoricalCols[0].name);
        if (numericCols.length > 0) selectedColumns.push(numericCols[0].name);
        if (selectedColumns.length === 0) selectedColumns = headers.slice(0, 2);

        const newPanel: DataPanel = {
          id: crypto.randomUUID(),
          fileName: file.name,
          columns,
          data,
          chartType: suggestedChart,
          selectedColumns,
          filters: {},
          customColor: null,
          sortColumn: null,
          sortDirection: 'asc',
          cellColors: {}
        };

        setPanels(prev => {
          const newPanels = [...prev, newPanel];
          const panelIndex = newPanels.length - 1;
          const col = panelIndex % 2;
          const row = Math.floor(panelIndex / 2);
          setLayout(prevLayout => [
            ...prevLayout,
            { i: newPanel.id, x: col * 6, y: row * 4, w: 6, h: 4, minW: 3, minH: 3 }
          ]);
          return newPanels;
        });

        toast({
          title: "CSV imported",
          description: `${file.name} loaded with ${data.length} rows.`
        });
      };
      reader.readAsText(file);
    });

    e.target.value = '';
  }, [panels.length, toast]);

  const removePanel = useCallback((id: string) => {
    setPanels(prev => prev.filter(p => p.id !== id));
    setLayout(prev => prev.filter(l => l.i !== id));
  }, []);

  const updatePanelChart = useCallback((id: string, chartType: ChartType) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, chartType } : p));
  }, []);

  const updatePanelFilter = useCallback((id: string, column: string, values: string[]) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== id) return p;
      const newFilters = { ...p.filters };
      if (values.length === 0) {
        delete newFilters[column];
      } else {
        newFilters[column] = values;
      }
      return { ...p, filters: newFilters };
    }));
  }, []);

  const updatePanelColor = useCallback((id: string, color: string | null) => {
    setPanels(prev => prev.map(p => p.id === id ? { ...p, customColor: color } : p));
  }, []);

  const updatePanelSort = useCallback((id: string, column: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== id) return p;
      if (p.sortColumn === column) {
        return { ...p, sortDirection: p.sortDirection === 'asc' ? 'desc' : 'asc' };
      }
      return { ...p, sortColumn: column, sortDirection: 'asc' };
    }));
  }, []);

  const updateColumnType = useCallback((panelId: string, columnName: string, newType: DataType) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const updatedColumns = p.columns.map(col => 
        col.name === columnName ? { ...col, type: newType } : col
      );
      return { ...p, columns: updatedColumns };
    }));
  }, []);

  const updateCellColor = useCallback((panelId: string, cellKey: string, color: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const newCellColors = { ...p.cellColors };
      if (color === '') {
        delete newCellColors[cellKey];
      } else {
        newCellColors[cellKey] = color;
      }
      return { ...p, cellColors: newCellColors };
    }));
  }, []);

  const updateColumnColor = useCallback((panelId: string, columnName: string, color: string) => {
    setPanels(prev => prev.map(p => {
      if (p.id !== panelId) return p;
      const newCellColors = { ...p.cellColors };
      p.data.forEach((_, rowIdx) => {
        const cellKey = `${rowIdx}-${columnName}`;
        if (color === '') {
          delete newCellColors[cellKey];
        } else {
          newCellColors[cellKey] = color;
        }
      });
      return { ...p, cellColors: newCellColors };
    }));
  }, []);

  const getFilteredData = useCallback((panel: DataPanel) => {
    return panel.data.filter(row => {
      for (const [column, allowedValues] of Object.entries(panel.filters)) {
        if (!allowedValues.includes(String(row[column]))) {
          return false;
        }
      }
      return true;
    });
  }, []);

  const renderChart = useCallback((panel: DataPanel) => {
    const filteredData = getFilteredData(panel);
    const categoricalCol = panel.columns.find(c => c.type === 'string');
    const numericCol = panel.columns.find(c => ['number', 'currency', 'percentage'].includes(c.type));
    
    const categoryKey = categoricalCol?.name || panel.columns[0]?.name || '';
    const valueKey = numericCol?.name || panel.columns[1]?.name || '';
    const chartColor = panel.customColor || CHART_COLORS[0];
    
    // Create axis tick formatter based on column type
    const getAxisFormatter = (colName: string) => {
      const col = panel.columns.find(c => c.name === colName);
      if (!col) return (value: number) => String(value);
      
      return (value: number) => {
        switch (col.type) {
          case 'currency':
            return new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD',
              notation: 'compact',
              maximumFractionDigits: 1
            }).format(value);
          case 'percentage':
            return `${value.toFixed(0)}%`;
          case 'number':
            return value >= 1000 
              ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
              : value.toLocaleString();
          default:
            return String(value);
        }
      };
    };
    
    const valueAxisFormatter = getAxisFormatter(valueKey);

    if (filteredData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data to display
        </div>
      );
    }

    switch (panel.chartType) {
      case 'vertical-bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={categoryKey} 
                tick={{ fontSize: 10 }} 
                angle={-45} 
                textAnchor="end"
                height={80}
                interval={0}
                tickFormatter={formatStreetAddress}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={valueAxisFormatter} />
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} formatter={formatLegendLabel} />
              <Bar dataKey={valueKey} fill={chartColor} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontal-bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} layout="vertical" margin={{ top: 20, right: 30, left: 120, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={valueAxisFormatter} />
              <YAxis 
                dataKey={categoryKey} 
                type="category" 
                tick={{ fontSize: 10 }} 
                width={110}
                tickFormatter={formatStreetAddress}
              />
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} formatter={formatLegendLabel} />
              <Bar dataKey={valueKey} fill={chartColor} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={categoryKey} 
                tick={{ fontSize: 10 }} 
                angle={-45} 
                textAnchor="end"
                height={80}
                tickFormatter={formatStreetAddress}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={valueAxisFormatter} />
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} formatter={formatLegendLabel} />
              <Line 
                type="monotone" 
                dataKey={valueKey} 
                stroke={chartColor} 
                strokeWidth={2}
                dot={{ fill: chartColor, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        const pieData = filteredData.slice(0, 10).map((item, idx) => ({
          name: String(item[categoryKey]),
          value: Number(item[valueKey]) || 0,
          fill: PIE_COLORS[idx % PIE_COLORS.length]
        }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius="70%"
                label={({ name, percent }) => `${formatStreetAddress(name)}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'heatmap':
        const heatmapData = filteredData.slice(0, 20);
        const numCols = panel.columns.filter(c => ['number', 'currency', 'percentage'].includes(c.type));
        const maxValues: Record<string, number> = {};
        numCols.forEach(col => {
          maxValues[col.name] = Math.max(...heatmapData.map(d => Math.abs(Number(d[col.name]) || 0)), 1);
        });
        
        return (
          <div className="w-full h-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background">{categoryKey}</TableHead>
                  {numCols.map(col => (
                    <TableHead key={col.name} className="text-center">{col.name}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {heatmapData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="sticky left-0 bg-background font-medium">
                      {String(row[categoryKey])}
                    </TableCell>
                    {numCols.map((col, colIdx) => {
                      const val = Number(row[col.name]) || 0;
                      const intensity = Math.abs(val) / maxValues[col.name];
                      const bgColor = val >= 0 
                        ? `rgba(34, 197, 94, ${intensity * 0.7})` 
                        : `rgba(239, 68, 68, ${intensity * 0.7})`;
                      return (
                        <TableCell 
                          key={col.name} 
                          className="text-center"
                          style={{ backgroundColor: bgColor }}
                        >
                          {formatValue(val, col.type)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );

      case 'scatter':
        const numericCols = panel.columns.filter(c => ['number', 'currency', 'percentage'].includes(c.type));
        const xCol = numericCols[0]?.name || categoryKey;
        const yCol = numericCols[1]?.name || valueKey;
        return (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey={xCol} type="number" tick={{ fontSize: 10 }} name={xCol} tickFormatter={getAxisFormatter(xCol)} />
              <YAxis dataKey={yCol} type="number" tick={{ fontSize: 10 }} name={yCol} tickFormatter={getAxisFormatter(yCol)} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} formatter={formatLegendLabel} />
              <Scatter name={`${xCol} vs ${yCol}`} data={filteredData} fill={chartColor} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={categoryKey} 
                tick={{ fontSize: 10 }} 
                angle={-45} 
                textAnchor="end"
                height={80}
                tickFormatter={formatStreetAddress}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={valueAxisFormatter} />
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} formatter={formatLegendLabel} />
              <Area 
                type="monotone" 
                dataKey={valueKey} 
                stroke={chartColor}
                fill={chartColor}
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'donut':
        const donutData = filteredData.slice(0, 10).map((item, idx) => ({
          name: String(item[categoryKey]),
          value: Number(item[valueKey]) || 0,
          fill: PIE_COLORS[idx % PIE_COLORS.length]
        }));
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="70%"
                label={({ name, percent }) => `${formatStreetAddress(name)}: ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'stacked-bar':
        const stackNumericCols = panel.columns.filter(c => ['number', 'currency', 'percentage'].includes(c.type)).slice(0, 4);
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey={categoryKey} 
                tick={{ fontSize: 10 }} 
                angle={-45} 
                textAnchor="end"
                height={80}
                interval={0}
                tickFormatter={formatStreetAddress}
              />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={valueAxisFormatter} />
              <Tooltip content={<CustomTooltipFormatter columns={panel.columns} categoryKey={categoryKey} />} />
              <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px' }} formatter={formatLegendLabel} />
              {stackNumericCols.map((col, idx) => (
                <Bar 
                  key={col.name} 
                  dataKey={col.name} 
                  stackId="stack" 
                  fill={CHART_COLORS[idx % CHART_COLORS.length]} 
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'table':
      default:
        const indexedData = filteredData.map((row, originalIdx) => ({ ...row, _originalIndex: originalIdx } as Record<string, any> & { _originalIndex: number }));
        const sortedData = [...indexedData];
        if (panel.sortColumn) {
          const col = panel.columns.find(c => c.name === panel.sortColumn);
          sortedData.sort((a, b) => {
            const aVal = a[panel.sortColumn!];
            const bVal = b[panel.sortColumn!];
            let result = 0;
            if (col?.type === 'string') {
              result = String(aVal).localeCompare(String(bVal));
            } else if (col?.type === 'date') {
              result = new Date(aVal).getTime() - new Date(bVal).getTime();
            } else {
              result = (Number(aVal) || 0) - (Number(bVal) || 0);
            }
            return panel.sortDirection === 'desc' ? -result : result;
          });
        }
        return (
          <ScrollArea className="h-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {panel.columns.map(col => {
                    const isManualExpense = isManualExpenseColumn(col.name);
                    return (
                    <TableHead 
                      key={col.name}
                      className="select-none"
                      style={isManualExpense ? { backgroundColor: WARNING_ORANGE_BG } : undefined}
                      data-testid={`table-header-${col.name}`}
                    >
                      <div className="flex items-center gap-1">
                        {isManualExpense && (
                          <span className="text-orange-500" title="Human Context / CapEx">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          </span>
                        )}
                        <ShadcnTooltip>
                          <TooltipTrigger asChild>
                            <span 
                              className={`cursor-pointer hover-elevate flex-1 flex items-center gap-1 truncate max-w-[200px] ${isManualExpense ? 'text-orange-700 font-medium' : ''}`}
                              onClick={() => updatePanelSort(panel.id, col.name)}
                            >
                              <span className="truncate">{col.name}</span>
                              {panel.sortColumn === col.name ? (
                                panel.sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 flex-shrink-0" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 flex-shrink-0" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40 flex-shrink-0" />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[400px] whitespace-normal">
                            <p className="break-words text-sm">
                              {isManualExpense && <span className="text-orange-500 font-medium">[Human Context] </span>}
                              {col.name}
                            </p>
                          </TooltipContent>
                        </ShadcnTooltip>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 p-0"
                              data-testid={`button-column-color-${col.name}`}
                            >
                              <Palette className="w-3 h-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-40 p-2" align="start">
                            <div className="text-xs font-medium mb-2">Color entire column</div>
                            <div className="grid grid-cols-4 gap-1">
                              {CELL_COLOR_PRESETS.map(preset => (
                                <Button
                                  key={preset.name}
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => updateColumnColor(panel.id, col.name, preset.value)}
                                  title={preset.name}
                                  data-testid={`column-color-${col.name}-${preset.name.toLowerCase()}`}
                                >
                                  {preset.value ? (
                                    <div 
                                      className="w-4 h-4 rounded" 
                                      style={{ backgroundColor: preset.value }}
                                    />
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                </Button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                  );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.slice(0, 50).map((row) => {
                  const originalIdx = row._originalIndex;
                  return (
                    <TableRow key={originalIdx}>
                      {panel.columns.map(col => {
                        const cellKey = `${originalIdx}-${col.name}`;
                        const cellColor = panel.cellColors[cellKey];
                        return (
                          <TableCell 
                            key={col.name}
                            style={cellColor ? { backgroundColor: cellColor } : undefined}
                          >
                            <Popover>
                              <PopoverTrigger asChild>
                                <span 
                                  className="cursor-pointer hover:underline block w-full"
                                  data-testid={`cell-${originalIdx}-${col.name}`}
                                >
                                  {formatValue(row[col.name], col.type)}
                                </span>
                              </PopoverTrigger>
                              <PopoverContent className="w-40 p-2" align="start">
                                <div className="text-xs font-medium mb-2">Cell color</div>
                                <div className="grid grid-cols-4 gap-1">
                                  {CELL_COLOR_PRESETS.map(preset => (
                                    <Button
                                      key={preset.name}
                                      variant="outline"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => updateCellColor(panel.id, cellKey, preset.value)}
                                      title={preset.name}
                                      data-testid={`cell-color-${originalIdx}-${col.name}-${preset.name.toLowerCase()}`}
                                    >
                                      {preset.value ? (
                                        <div 
                                          className="w-4 h-4 rounded" 
                                          style={{ backgroundColor: preset.value }}
                                        />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                    </Button>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        );
    }
  }, [getFilteredData, updatePanelSort, updateCellColor, updateColumnColor]);

  const exportToPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF('landscape');
      const pageWidth = 297;
      
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('EasyViz Dashboard Report', 15, 20);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, 28);

      let yOffset = 40;

      for (const panel of panels) {
        if (yOffset > 160) {
          doc.addPage();
          yOffset = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(panel.fileName, 15, yOffset);
        yOffset += 8;

        const filteredData = getFilteredData(panel);
        const tableData = filteredData.slice(0, 20).map(row => 
          panel.columns.map(col => formatValue(row[col.name], col.type))
        );

        autoTable(doc, {
          head: [panel.columns.map(c => c.name)],
          body: tableData,
          startY: yOffset,
          theme: 'striped',
          headStyles: { fillColor: [165, 42, 42], fontSize: 8 },
          bodyStyles: { fontSize: 7 },
          margin: { left: 15, right: 15 },
        });

        yOffset = (doc as any).lastAutoTable?.finalY + 15 || yOffset + 50;
      }

      doc.save('easyviz-dashboard.pdf');
      toast({ title: "PDF exported", description: "Dashboard saved as PDF." });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export to PDF.", variant: "destructive" });
    }
    setIsExporting(false);
  }, [panels, getFilteredData, toast]);

  const exportToExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();

      panels.forEach((panel, idx) => {
        const filteredData = getFilteredData(panel);
        const ws = XLSX.utils.json_to_sheet(filteredData);
        const sheetName = panel.fileName.replace(/\.csv$/i, '').slice(0, 31) || `Sheet${idx + 1}`;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, 'easyviz-dashboard.xlsx');
      toast({ title: "Excel exported", description: "Dashboard saved as Excel." });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export to Excel.", variant: "destructive" });
    }
  }, [panels, getFilteredData, toast]);

  const exportToPowerPoint = useCallback(async () => {
    setIsExporting(true);
    try {
      const pptx = new PptxGenJS();
      pptx.author = 'Veterans Development Group';
      pptx.title = 'EasyViz Dashboard';

      const titleSlide = pptx.addSlide();
      titleSlide.addText('EasyViz Dashboard Report', {
        x: 0.5, y: 2, w: 9, h: 1,
        fontSize: 36, bold: true, color: 'A52A2A',
        align: 'center'
      });
      titleSlide.addText(`Generated: ${new Date().toLocaleDateString()}`, {
        x: 0.5, y: 3.2, w: 9, h: 0.5,
        fontSize: 14, color: '64748B',
        align: 'center'
      });
      titleSlide.addText('Veterans Development Group', {
        x: 0.5, y: 4, w: 9, h: 0.5,
        fontSize: 16, color: '1E293B',
        align: 'center'
      });

      for (const panel of panels) {
        const slide = pptx.addSlide();
        slide.addText(panel.fileName, {
          x: 0.5, y: 0.3, w: 9, h: 0.5,
          fontSize: 24, bold: true, color: '1E293B'
        });

        const filteredData = getFilteredData(panel);
        const tableRows = [
          panel.columns.map(c => ({ text: c.name })),
          ...filteredData.slice(0, 15).map(row => 
            panel.columns.map(col => ({ text: formatValue(row[col.name], col.type) }))
          )
        ];

        slide.addTable(tableRows as any, {
          x: 0.5, y: 1, w: 9, h: 4,
          fontSize: 9,
          color: '1E293B',
          border: { pt: 0.5, color: 'CCCCCC' },
          fill: { color: 'FFFFFF' },
          align: 'center',
          valign: 'middle'
        });
      }

      await pptx.writeFile({ fileName: 'easyviz-dashboard.pptx' });
      toast({ title: "PowerPoint exported", description: "Dashboard saved as PPTX." });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export to PowerPoint.", variant: "destructive" });
    }
    setIsExporting(false);
  }, [panels, getFilteredData, toast]);

  const chartTypeOptions = [
    { value: 'vertical-bar', label: 'Vertical Bar', icon: BarChart3 },
    { value: 'horizontal-bar', label: 'Horizontal Bar', icon: BarChart3 },
    { value: 'stacked-bar', label: 'Stacked Bar', icon: Layers },
    { value: 'pie', label: 'Pie Chart', icon: PieChartIcon },
    { value: 'donut', label: 'Donut Chart', icon: Circle },
    { value: 'line', label: 'Line Graph', icon: TrendingUp },
    { value: 'area', label: 'Area Chart', icon: AreaIcon },
    { value: 'scatter', label: 'Scatter Plot', icon: ScatterIcon },
    { value: 'heatmap', label: 'Heat Map', icon: Grid3X3 },
    { value: 'table', label: 'Data Table', icon: TableIcon },
  ];

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="w-6 h-6 text-primary" />
            EasyViz - Dynamic Dashboard
          </DialogTitle>
          <DialogDescription>
            Import CSV files to create professional visualizations. Upload up to 6 files and customize your dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-csv-upload"
            />
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={panels.length >= 6}
              data-testid="button-upload-csv"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload CSV ({panels.length}/6)
            </Button>

            <div className="flex-1" />

            {panels.length > 0 && (
              <>
                <Badge variant="secondary" className="gap-1">
                  <Grid3X3 className="w-3 h-3" />
                  {panels.length} Panel{panels.length !== 1 ? 's' : ''}
                </Badge>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" disabled={isExporting} data-testid="button-export-dashboard">
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Export Dashboard
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="space-y-1">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start" 
                        onClick={exportToPDF}
                        data-testid="button-export-pdf"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        PDF
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start" 
                        onClick={exportToExcel}
                        data-testid="button-export-excel"
                      >
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Excel (XLSX)
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start" 
                        onClick={exportToPowerPoint}
                        data-testid="button-export-pptx"
                      >
                        <Presentation className="w-4 h-4 mr-2" />
                        PowerPoint (PPTX)
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button 
                  variant="outline" 
                  onClick={() => setSaveDialogOpen(true)}
                  data-testid="button-save-dashboard"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {currentLoadedDashboardId ? 'Save' : 'Save Dashboard'}
                </Button>
              </>
            )}

            <Button 
              variant="outline" 
              onClick={() => setLoadDialogOpen(true)}
              disabled={savedDashboards.length === 0}
              data-testid="button-load-dashboard"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              My Dashboards ({savedDashboards.length}/{MAX_SAVED_DASHBOARDS})
            </Button>
          </div>

          <div ref={containerRef} className="flex-1 overflow-auto p-4">
            {panels.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-muted/50 rounded-full p-6 mb-4">
                  <Upload className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No data yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Upload CSV files to create visualizations. Each file becomes a panel you can customize with different chart types.
                </p>
                <Button onClick={() => fileInputRef.current?.click()} data-testid="button-upload-csv-empty">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First CSV
                </Button>
              </div>
            ) : (
              <GridLayout
                {...{
                  className: "layout",
                  layout: layout,
                  cols: 12,
                  rowHeight: 80,
                  width: Math.max(containerRef.current?.clientWidth || 1200, 800),
                  onLayoutChange: (newLayout: LayoutItem[]) => setLayout(newLayout),
                  draggableHandle: ".drag-handle",
                  compactType: "vertical",
                  preventCollision: false
                } as any}
              >
                {panels.map(panel => (
                  <div key={panel.id} className="bg-card border rounded-lg shadow-sm overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 shrink-0">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-move drag-handle" />
                      <span className="font-medium text-sm truncate flex-1">{panel.fileName}</span>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2" data-testid={`button-filter-${panel.id}`}>
                            <Filter className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3" align="end">
                          <Label className="text-sm font-medium">Filter Data</Label>
                          <div className="mt-2 space-y-3 max-h-[200px] overflow-y-auto">
                            {panel.columns.filter(c => c.type === 'string').slice(0, 3).map(col => {
                              const uniqueValues = Array.from(new Set(col.values.map(String))).slice(0, 10);
                              return (
                                <div key={col.name} className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">{col.name}</Label>
                                  <div className="space-y-1">
                                    {uniqueValues.map(val => (
                                      <div 
                                        key={val} 
                                        className="flex items-center gap-2 cursor-pointer hover-elevate rounded px-2 py-1"
                                        onClick={() => {
                                          const current = panel.filters[col.name] || [];
                                          const newValues = current.includes(val)
                                            ? current.filter(v => v !== val)
                                            : [...current, val];
                                          updatePanelFilter(panel.id, col.name, newValues);
                                        }}
                                      >
                                        <Checkbox 
                                          checked={(panel.filters[col.name] || []).includes(val)}
                                        />
                                        <span className="text-sm truncate">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2" data-testid={`button-color-${panel.id}`}>
                            <Palette className="w-3 h-3" />
                            {panel.customColor && (
                              <div 
                                className="w-2 h-2 rounded-full ml-1" 
                                style={{ backgroundColor: panel.customColor }}
                              />
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3" align="end">
                          <Label className="text-sm font-medium">Chart Color</Label>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {COLOR_PRESETS.map(preset => (
                              <Button
                                key={preset.name}
                                variant={panel.customColor === preset.value ? "default" : "outline"}
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => updatePanelColor(panel.id, preset.value)}
                                data-testid={`color-${preset.name.toLowerCase()}`}
                              >
                                {preset.value ? (
                                  <div 
                                    className="w-3 h-3 rounded-full mr-1" 
                                    style={{ backgroundColor: preset.value }}
                                  />
                                ) : null}
                                {preset.name}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2" data-testid={`button-format-${panel.id}`}>
                            <Type className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="end">
                          <Label className="text-sm font-medium">Column Format</Label>
                          <div className="mt-2 space-y-2">
                            {panel.columns.filter(col => ['number', 'currency', 'percentage'].includes(col.type) || col.type === 'string').map(col => (
                              <div key={col.name} className="flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground truncate max-w-[100px]">{col.name}</span>
                                <Select 
                                  value={col.type} 
                                  onValueChange={(v) => updateColumnType(panel.id, col.name, v as DataType)}
                                >
                                  <SelectTrigger className="w-[90px] h-7 text-xs" data-testid={`select-format-${panel.id}-${col.name}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">Text</SelectItem>
                                    <SelectItem value="number">Number</SelectItem>
                                    <SelectItem value="currency">Money</SelectItem>
                                    <SelectItem value="percentage">Percent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Select 
                        value={panel.chartType} 
                        onValueChange={(v) => updatePanelChart(panel.id, v as ChartType)}
                      >
                        <SelectTrigger className="w-[130px] h-7 text-xs" data-testid={`select-chart-${panel.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {chartTypeOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <div className="flex items-center gap-2">
                                <opt.icon className="w-3 h-3" />
                                {opt.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 text-muted-foreground" 
                        onClick={() => removePanel(panel.id)}
                        data-testid={`button-remove-${panel.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex-1 p-2 min-h-0">
                      {renderChart(panel)}
                    </div>
                  </div>
                ))}
              </GridLayout>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {currentLoadedDashboardId ? 'Save Dashboard' : 'Save New Dashboard'}
          </DialogTitle>
          <DialogDescription>
            {currentLoadedDashboardId 
              ? 'Update the current dashboard or save as new.'
              : `Save your dashboard configuration. You can save up to ${MAX_SAVED_DASHBOARDS} dashboards.`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">Dashboard Name</Label>
            <Input
              id="dashboard-name"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              placeholder="Enter dashboard name..."
              data-testid="input-dashboard-name"
            />
          </div>
          {currentLoadedDashboardId && (
            <p className="text-sm text-muted-foreground">
              Currently editing: {savedDashboards.find(d => d.id === currentLoadedDashboardId)?.name}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          {currentLoadedDashboardId && (
            <Button 
              variant="outline" 
              onClick={() => saveDashboard(true)}
              data-testid="button-save-as-new-dashboard"
            >
              <Plus className="w-4 h-4 mr-2" />
              Save as New
            </Button>
          )}
          <Button 
            onClick={() => saveDashboard(false)}
            data-testid="button-confirm-save-dashboard"
          >
            <Save className="w-4 h-4 mr-2" />
            {currentLoadedDashboardId ? 'Update' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>My Dashboards</DialogTitle>
          <DialogDescription>
            Load a saved dashboard or delete ones you no longer need.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2 pr-4">
            {savedDashboards.map((dashboard) => (
              <div 
                key={dashboard.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  currentLoadedDashboardId === dashboard.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
                data-testid={`dashboard-item-${dashboard.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{dashboard.name}</span>
                    {currentLoadedDashboardId === dashboard.id && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboard.panels.length} panel{dashboard.panels.length !== 1 ? 's' : ''} | 
                    Saved {new Date(dashboard.savedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDashboard(dashboard)}
                    disabled={currentLoadedDashboardId === dashboard.id}
                    data-testid={`button-load-dashboard-${dashboard.id}`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 mr-1" />
                    Load
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteDashboard(dashboard.id)}
                    data-testid={`button-delete-dashboard-${dashboard.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {savedDashboards.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No saved dashboards yet.</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setLoadDialogOpen(false)} data-testid="button-close-load-dialog">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
