import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { PropertyAnalysis, PropertyType } from '@shared/schema';
import { formatCurrency, formatPercent } from './calculations';

export function exportPDF(properties: PropertyAnalysis[], aiAnalysis: string | null): void {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text('Veterans Development Group', 20, 20);
  doc.setFontSize(14);
  doc.text('Investment Portfolio Analysis', 20, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 40);
  
  if (properties.length > 0) {
    const tableData = properties.map(p => [
      p.shared.name,
      p.type,
      formatCurrency(p.shared.purchasePrice),
      formatCurrency(p.metrics.netMonthlyCashFlow),
      formatPercent(p.metrics.cashOnCashReturn),
      formatPercent(p.metrics.capRate),
    ]);
    
    autoTable(doc, {
      head: [['Property', 'Type', 'Price', 'Monthly CF', 'CoC Return', 'Cap Rate']],
      body: tableData,
      startY: 50,
      theme: 'striped',
      headStyles: { fillColor: [30, 41, 59] },
    });
  }
  
  if (aiAnalysis) {
    const finalY = (doc as any).lastAutoTable?.finalY || 80;
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('AI Analysis', 20, finalY + 15);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const splitText = doc.splitTextToSize(aiAnalysis, 170);
    doc.text(splitText, 20, finalY + 25);
  }
  
  doc.save('vdg-portfolio-analysis.pdf');
}

export function exportDashboardPDF(properties: PropertyAnalysis[], marketCapRate: number, cfoAnalysisText?: string): void {
  const doc = new jsPDF('landscape');
  const pageWidth = 297;
  const pageHeight = 210;
  
  // Crimson and Cream color palette
  const crimson = { r: 165, g: 28, b: 48 };
  const crimsonDark = { r: 120, g: 20, b: 35 };
  const cream = { r: 253, g: 251, b: 245 };
  const creamDark = { r: 245, g: 240, b: 230 };
  const textDark = { r: 60, g: 20, b: 30 };
  const textMuted = { r: 120, g: 80, b: 90 };
  
  // Investor configuration
  const investors = [
    { name: 'Investor A', stake: 0.25 },
    { name: 'Investor B', stake: 0.25 },
    { name: 'Investor C', stake: 0.25 },
    { name: 'Investor D', stake: 0.25 },
  ];
  
  // Calculate portfolio metrics
  const totalPurchasePrice = properties.reduce((sum, p) => sum + p.shared.purchasePrice, 0);
  const totalLoanAmount = properties.reduce((sum, p) => sum + p.shared.loanAmount, 0);
  const totalEquity = totalPurchasePrice - totalLoanAmount;
  const totalCashInvested = properties.reduce((sum, p) => sum + p.metrics.initialCashInvested, 0);
  const grossMonthlyIncome = properties.reduce((sum, p) => sum + p.metrics.grossMonthlyIncome, 0);
  const netMonthlyIncome = properties.reduce((sum, p) => sum + p.metrics.netMonthlyIncome, 0);
  const monthlyMortgage = properties.reduce((sum, p) => sum + p.metrics.monthlyMortgagePayment, 0);
  const monthlyExpenses = properties.reduce((sum, p) => sum + p.metrics.totalMonthlyExpenses, 0);
  const netMonthlyCashFlow = properties.reduce((sum, p) => sum + p.metrics.netMonthlyCashFlow, 0);
  const annualCashFlow = properties.reduce((sum, p) => sum + p.metrics.annualNetCashFlow, 0);
  const annualNOI = netMonthlyIncome * 12;
  const avgCoC = properties.length > 0 
    ? properties.reduce((sum, p) => sum + p.metrics.cashOnCashReturn, 0) / properties.length 
    : 0;
  const avgCapRate = properties.length > 0 
    ? properties.reduce((sum, p) => sum + p.metrics.capRate, 0) / properties.length 
    : 0;
  const estimatedValue = marketCapRate > 0 ? annualNOI / (marketCapRate / 100) : 0;
  const unrealizedGain = estimatedValue - totalPurchasePrice;
  const ltrCount = properties.filter(p => p.type === PropertyType.LTR).length;
  const strCount = properties.filter(p => p.type === PropertyType.STR).length;
  
  // ========== PAGE 1: EXECUTIVE SUMMARY ==========
  
  // Header bar
  doc.setFillColor(crimson.r, crimson.g, crimson.b);
  doc.rect(0, 0, pageWidth, 28, 'F');
  
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('VETERANS DEVELOPMENT GROUP', 15, 14);
  doc.setFontSize(11);
  doc.text('Investment Portfolio Analysis Dashboard', 15, 22);
  
  doc.setFontSize(9);
  doc.text(`Report Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - 15, 14, { align: 'right' });
  doc.text(`Market Cap Rate Assumption: ${marketCapRate.toFixed(1)}%`, pageWidth - 15, 22, { align: 'right' });
  
  // Executive Summary Section
  doc.setFontSize(14);
  doc.setTextColor(crimson.r, crimson.g, crimson.b);
  doc.text('EXECUTIVE SUMMARY', 15, 38);
  
  doc.setDrawColor(crimson.r, crimson.g, crimson.b);
  doc.setLineWidth(0.5);
  doc.line(15, 40, 100, 40);
  
  // Key Performance Indicators - Row 1
  const kpiY = 48;
  const kpiWidth = 52;
  const kpiHeight = 24;
  const kpiGap = 4;
  
  const kpis = [
    { label: 'Portfolio Value', value: formatCurrency(totalPurchasePrice), sub: `${properties.length} Properties` },
    { label: 'Estimated Market Value', value: formatCurrency(estimatedValue), sub: `@ ${marketCapRate}% Cap` },
    { label: 'Unrealized Gain/Loss', value: formatCurrency(unrealizedGain), sub: unrealizedGain >= 0 ? 'Above Purchase' : 'Below Purchase' },
    { label: 'Total Equity', value: formatCurrency(totalEquity), sub: `${((totalEquity / totalPurchasePrice) * 100).toFixed(1)}% LTV` },
    { label: 'Cash Invested', value: formatCurrency(totalCashInvested), sub: 'Total Capital Deployed' },
  ];
  
  kpis.forEach((kpi, i) => {
    const x = 15 + (i * (kpiWidth + kpiGap));
    doc.setFillColor(creamDark.r, creamDark.g, creamDark.b);
    doc.roundedRect(x, kpiY, kpiWidth, kpiHeight, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(kpi.label.toUpperCase(), x + 3, kpiY + 6);
    doc.setFontSize(12);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(kpi.value, x + 3, kpiY + 15);
    doc.setFontSize(6);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(kpi.sub, x + 3, kpiY + 21);
  });
  
  // Key Performance Indicators - Row 2 (Cash Flow)
  const kpi2Y = kpiY + kpiHeight + 6;
  
  const cashFlowKpis = [
    { label: 'Gross Monthly Income', value: formatCurrency(grossMonthlyIncome), sub: formatCurrency(grossMonthlyIncome * 12) + '/yr' },
    { label: 'Monthly Expenses', value: formatCurrency(monthlyExpenses), sub: 'Operating Costs' },
    { label: 'Monthly Mortgage', value: formatCurrency(monthlyMortgage), sub: 'Debt Service' },
    { label: 'Net Monthly Cash Flow', value: formatCurrency(netMonthlyCashFlow), sub: formatCurrency(annualCashFlow) + '/yr' },
    { label: 'Annual NOI', value: formatCurrency(annualNOI), sub: 'Before Debt Service' },
  ];
  
  cashFlowKpis.forEach((kpi, i) => {
    const x = 15 + (i * (kpiWidth + kpiGap));
    doc.setFillColor(creamDark.r, creamDark.g, creamDark.b);
    doc.roundedRect(x, kpi2Y, kpiWidth, kpiHeight, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(kpi.label.toUpperCase(), x + 3, kpi2Y + 6);
    doc.setFontSize(12);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    doc.text(kpi.value, x + 3, kpi2Y + 15);
    doc.setFontSize(6);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text(kpi.sub, x + 3, kpi2Y + 21);
  });
  
  // Returns Section
  const returnsY = kpi2Y + kpiHeight + 12;
  doc.setFontSize(14);
  doc.setTextColor(crimson.r, crimson.g, crimson.b);
  doc.text('RETURN METRICS', 15, returnsY);
  doc.line(15, returnsY + 2, 80, returnsY + 2);
  
  const returnMetrics = [
    { label: 'Average Cap Rate', value: formatPercent(avgCapRate), desc: 'NOI / Purchase Price' },
    { label: 'Average Cash-on-Cash', value: formatPercent(avgCoC), desc: 'Annual CF / Cash Invested' },
    { label: 'Portfolio DSCR', value: (netMonthlyIncome / monthlyMortgage).toFixed(2) + 'x', desc: 'Debt Service Coverage' },
    { label: 'Expense Ratio', value: formatPercent((monthlyExpenses / grossMonthlyIncome) * 100), desc: 'Expenses / Gross Income' },
  ];
  
  const returnBoxY = returnsY + 8;
  returnMetrics.forEach((metric, i) => {
    const x = 15 + (i * 50);
    doc.setFillColor(crimson.r, crimson.g, crimson.b);
    doc.roundedRect(x, returnBoxY, 46, 22, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(metric.label.toUpperCase(), x + 3, returnBoxY + 6);
    doc.setFontSize(14);
    doc.text(metric.value, x + 3, returnBoxY + 15);
    doc.setFontSize(5);
    doc.text(metric.desc, x + 3, returnBoxY + 19);
  });
  
  // Portfolio Composition (right side) with PIE CHART - CENTERED heading
  const compX = 215;
  const compWidth = pageWidth - 15 - compX;
  const compCenterX = compX + (compWidth / 2);
  doc.setFontSize(14);
  doc.setTextColor(crimson.r, crimson.g, crimson.b);
  doc.text('PORTFOLIO COMPOSITION', compCenterX, returnsY, { align: 'center' });
  doc.line(compX, returnsY + 2, pageWidth - 15, returnsY + 2);
  
  // Draw pie chart for LTR vs STR
  const pieX = compX + 20;
  const pieY = returnBoxY + 11;
  const pieRadius = 10;
  const total = ltrCount + strCount;
  
  // Helper function to draw a pie slice using polygon approximation
  const drawPieSlice = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number, r: number, g: number, b: number) => {
    const segments = 32; // More segments for smoother curve
    const points: {x: number, y: number}[] = [];
    
    // Start from center
    points.push({ x: centerX, y: centerY });
    
    // Add points along the arc
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      points.push({ x, y });
    }
    
    // Draw as a series of triangles from center
    doc.setFillColor(r, g, b);
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        points[0].x, points[0].y,
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y,
        'F'
      );
    }
  };
  
  if (total > 0) {
    const ltrRatio = ltrCount / total;
    const strRatio = strCount / total;
    
    if (ltrCount > 0 && strCount > 0) {
      // Draw LTR slice (crimson) - starts at top (-PI/2)
      const ltrStartAngle = -Math.PI / 2;
      const ltrEndAngle = ltrStartAngle + (ltrRatio * 2 * Math.PI);
      drawPieSlice(pieX, pieY, pieRadius, ltrStartAngle, ltrEndAngle, crimson.r, crimson.g, crimson.b);
      
      // Draw STR slice (amber/gold)
      const strStartAngle = ltrEndAngle;
      const strEndAngle = strStartAngle + (strRatio * 2 * Math.PI);
      drawPieSlice(pieX, pieY, pieRadius, strStartAngle, strEndAngle, 245, 158, 11);
    } else if (ltrCount > 0) {
      doc.setFillColor(crimson.r, crimson.g, crimson.b);
      doc.circle(pieX, pieY, pieRadius, 'F');
    } else {
      doc.setFillColor(245, 158, 11);
      doc.circle(pieX, pieY, pieRadius, 'F');
    }
  }
  
  // Legend next to pie
  const legendX = pieX + 18;
  doc.setFillColor(crimson.r, crimson.g, crimson.b);
  doc.rect(legendX, returnBoxY + 4, 4, 4, 'F');
  doc.setFontSize(8);
  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.text(`LTR: ${ltrCount}`, legendX + 6, returnBoxY + 7);
  
  doc.setFillColor(200, 160, 80);
  doc.rect(legendX, returnBoxY + 12, 4, 4, 'F');
  doc.text(`STR: ${strCount}`, legendX + 6, returnBoxY + 15);
  
  doc.setFontSize(7);
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text(`Total: ${total} properties`, legendX, returnBoxY + 21);
  
  // ========== INVESTOR BREAKDOWN SECTION ==========
  const investorY = returnBoxY + 32;
  doc.setFontSize(14);
  doc.setTextColor(crimson.r, crimson.g, crimson.b);
  doc.text('INVESTOR DISTRIBUTION (25% Equal Stakes)', 15, investorY);
  doc.line(15, investorY + 2, 150, investorY + 2);
  
  const investorTableY = investorY + 6;
  
  autoTable(doc, {
    head: [['Investor', 'Ownership', 'Equity Share', 'Cash Invested', 'Monthly CF', 'Annual CF', 'Est. Value Share']],
    body: investors.map(inv => [
      inv.name,
      formatPercent(inv.stake * 100),
      formatCurrency(totalEquity * inv.stake),
      formatCurrency(totalCashInvested * inv.stake),
      formatCurrency(netMonthlyCashFlow * inv.stake),
      formatCurrency(annualCashFlow * inv.stake),
      formatCurrency(estimatedValue * inv.stake),
    ]),
    foot: [['TOTAL', '100%', formatCurrency(totalEquity), formatCurrency(totalCashInvested), formatCurrency(netMonthlyCashFlow), formatCurrency(annualCashFlow), formatCurrency(estimatedValue)]],
    startY: investorTableY,
    theme: 'grid',
    headStyles: { fillColor: [crimson.r, crimson.g, crimson.b], fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 8, halign: 'center' },
    footStyles: { fillColor: [crimsonDark.r, crimsonDark.g, crimsonDark.b], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [creamDark.r, creamDark.g, creamDark.b] },
    columnStyles: {
      0: { halign: 'left' },
    },
    margin: { left: 15 },
    tableWidth: pageWidth - 30,
  });
  
  // ========== PAGE 2: PROPERTY DETAILS ==========
  doc.addPage('landscape');
  
  // Header bar
  doc.setFillColor(crimson.r, crimson.g, crimson.b);
  doc.rect(0, 0, pageWidth, 22, 'F');
  
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PROPERTY ANALYSIS DETAIL', 15, 14);
  doc.setFontSize(9);
  doc.text('Veterans Development Group', pageWidth - 15, 14, { align: 'right' });
  
  // Property Details Table
  doc.setFontSize(12);
  doc.setTextColor(crimson.r, crimson.g, crimson.b);
  doc.text('INDIVIDUAL PROPERTY PERFORMANCE', 15, 32);
  doc.line(15, 34, 140, 34);
  
  if (properties.length > 0) {
    const propertyData = properties.map((p, i) => [
      (i + 1).toString(),
      p.shared.name,
      p.type,
      formatCurrency(p.shared.purchasePrice),
      formatCurrency(p.shared.loanAmount),
      formatPercent(p.shared.interestRate),
      formatCurrency(p.metrics.grossMonthlyIncome),
      formatCurrency(p.metrics.totalMonthlyExpenses),
      formatCurrency(p.metrics.monthlyMortgagePayment),
      formatCurrency(p.metrics.netMonthlyCashFlow),
      formatPercent(p.metrics.cashOnCashReturn),
      formatPercent(p.metrics.capRate),
    ]);
    
    autoTable(doc, {
      head: [['#', 'Property Name', 'Type', 'Purchase Price', 'Loan Amount', 'Rate', 'Gross/Mo', 'Expenses/Mo', 'Mortgage/Mo', 'Net CF/Mo', 'CoC', 'Cap']],
      body: propertyData,
      startY: 38,
      theme: 'grid',
      headStyles: { fillColor: [crimson.r, crimson.g, crimson.b], fontSize: 7, halign: 'center' },
      bodyStyles: { fontSize: 7, halign: 'center' },
      alternateRowStyles: { fillColor: [creamDark.r, creamDark.g, creamDark.b] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { halign: 'left', cellWidth: 35 },
        2: { cellWidth: 12 },
      },
      margin: { left: 15, right: 15 },
    });
  }
  
  // Per-Investor Per-Property Breakdown
  const propTableFinalY = (doc as any).lastAutoTable?.finalY || 100;
  
  doc.setFontSize(12);
  doc.setTextColor(crimson.r, crimson.g, crimson.b);
  doc.text('PER-INVESTOR MONTHLY CASH FLOW BY PROPERTY (25% Each)', 15, propTableFinalY + 12);
  doc.line(15, propTableFinalY + 14, 180, propTableFinalY + 14);
  
  if (properties.length > 0) {
    const perInvestorData = properties.map((p, i) => [
      (i + 1).toString(),
      p.shared.name,
      formatCurrency(p.metrics.netMonthlyCashFlow),
      formatCurrency(p.metrics.netMonthlyCashFlow * 0.25),
      formatCurrency(p.metrics.netMonthlyCashFlow * 0.25),
      formatCurrency(p.metrics.netMonthlyCashFlow * 0.25),
      formatCurrency(p.metrics.netMonthlyCashFlow * 0.25),
    ]);
    
    const totalRow = [
      '',
      'PORTFOLIO TOTAL',
      formatCurrency(netMonthlyCashFlow),
      formatCurrency(netMonthlyCashFlow * 0.25),
      formatCurrency(netMonthlyCashFlow * 0.25),
      formatCurrency(netMonthlyCashFlow * 0.25),
      formatCurrency(netMonthlyCashFlow * 0.25),
    ];
    
    autoTable(doc, {
      head: [['#', 'Property', 'Total Monthly CF', 'Investor A (25%)', 'Investor B (25%)', 'Investor C (25%)', 'Investor D (25%)']],
      body: perInvestorData,
      foot: [totalRow],
      startY: propTableFinalY + 18,
      theme: 'grid',
      headStyles: { fillColor: [crimson.r, crimson.g, crimson.b], fontSize: 8, halign: 'center' },
      bodyStyles: { fontSize: 8, halign: 'center' },
      footStyles: { fillColor: [crimsonDark.r, crimsonDark.g, crimsonDark.b], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [creamDark.r, creamDark.g, creamDark.b] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { halign: 'left', cellWidth: 45 },
      },
      margin: { left: 15, right: 15 },
    });
  }
  
  // ========== PAGE 3: VISUAL CHARTS ==========
  doc.addPage('landscape');
  
  // Professional color palette
  const navy = { r: 31, g: 41, b: 55 };
  const slate = { r: 71, g: 85, b: 105 };
  const emerald = { r: 16, g: 185, b: 129 };
  const amber = { r: 245, g: 158, b: 11 };
  const chartBg = { r: 249, g: 250, b: 251 };
  const gridColor = { r: 229, g: 231, b: 235 };
  
  // Header bar
  doc.setFillColor(crimson.r, crimson.g, crimson.b);
  doc.rect(0, 0, pageWidth, 22, 'F');
  
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PORTFOLIO PERFORMANCE ANALYTICS', 15, 14);
  doc.setFontSize(9);
  doc.text('Veterans Development Group', pageWidth - 15, 14, { align: 'right' });
  
  // ========== CHART 1: Monthly Cash Flow by Property (Top Left) ==========
  const chart1X = 15;
  const chart1Y = 32;
  const chartWidth = 130;
  const chartHeight = 65;
  
  // Chart title with professional styling
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy.r, navy.g, navy.b);
  doc.text('Monthly Net Cash Flow by Property', chart1X, chart1Y - 3);
  
  if (properties.length > 0) {
    const cashFlows = properties.map(p => p.metrics.netMonthlyCashFlow);
    const maxCF = Math.max(...cashFlows.map(cf => Math.abs(cf)), 1);
    
    // Draw chart container with subtle shadow effect
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(chart1X, chart1Y, chartWidth, chartHeight, 3, 3, 'F');
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(chart1X, chart1Y, chartWidth, chartHeight, 3, 3, 'S');
    
    const plotArea = { x: chart1X + 25, y: chart1Y + 8, w: chartWidth - 35, h: chartHeight - 20 };
    const zeroLineY = plotArea.y + plotArea.h / 2;
    
    // Draw horizontal grid lines
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const y = plotArea.y + (plotArea.h * i / 4);
      doc.line(plotArea.x, y, plotArea.x + plotArea.w, y);
    }
    
    // Zero line (thicker)
    doc.setDrawColor(slate.r, slate.g, slate.b);
    doc.setLineWidth(0.4);
    doc.line(plotArea.x, zeroLineY, plotArea.x + plotArea.w, zeroLineY);
    
    // Draw bars with rounded tops
    const barWidth = Math.min(18, (plotArea.w / properties.length) * 0.7);
    const barGap = (plotArea.w - (barWidth * properties.length)) / (properties.length + 1);
    
    properties.forEach((p, i) => {
      const cf = p.metrics.netMonthlyCashFlow;
      const barHeight = Math.max(2, (Math.abs(cf) / maxCF) * (plotArea.h / 2 - 5));
      const barX = plotArea.x + barGap + i * (barWidth + barGap);
      
      if (cf >= 0) {
        doc.setFillColor(emerald.r, emerald.g, emerald.b);
        doc.roundedRect(barX, zeroLineY - barHeight, barWidth, barHeight, 1, 1, 'F');
      } else {
        doc.setFillColor(crimson.r, crimson.g, crimson.b);
        doc.roundedRect(barX, zeroLineY, barWidth, barHeight, 1, 1, 'F');
      }
      
      // Property label
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slate.r, slate.g, slate.b);
      const shortName = p.shared.name.substring(0, 6);
      doc.text(shortName, barX + barWidth / 2, plotArea.y + plotArea.h + 6, { align: 'center' });
    });
    
    // Y-axis labels
    doc.setFontSize(6);
    doc.setTextColor(slate.r, slate.g, slate.b);
    doc.text(formatCurrency(maxCF), chart1X + 23, plotArea.y + 3, { align: 'right' });
    doc.text('$0', chart1X + 23, zeroLineY + 2, { align: 'right' });
    doc.text(formatCurrency(-maxCF), chart1X + 23, plotArea.y + plotArea.h - 1, { align: 'right' });
  }
  
  // Legend
  doc.setFillColor(emerald.r, emerald.g, emerald.b);
  doc.roundedRect(chart1X, chart1Y + chartHeight + 4, 8, 4, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate.r, slate.g, slate.b);
  doc.text('Positive', chart1X + 10, chart1Y + chartHeight + 7);
  
  doc.setFillColor(crimson.r, crimson.g, crimson.b);
  doc.roundedRect(chart1X + 35, chart1Y + chartHeight + 4, 8, 4, 1, 1, 'F');
  doc.text('Negative', chart1X + 45, chart1Y + chartHeight + 7);
  
  // ========== CHART 2: Cumulative Cash Flow Trend (Top Right) ==========
  const chart2X = 155;
  const chart2Y = chart1Y;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy.r, navy.g, navy.b);
  doc.text('Cumulative Portfolio Cash Flow', chart2X, chart2Y - 3);
  
  if (properties.length > 0) {
    let cumulative = 0;
    const cumulativeData = properties.map(p => {
      cumulative += p.metrics.netMonthlyCashFlow;
      return cumulative;
    });
    
    const maxCumulative = Math.max(...cumulativeData.map(c => Math.abs(c)), 1);
    const minCumulative = Math.min(...cumulativeData, 0);
    const range = Math.max(maxCumulative, Math.abs(minCumulative)) || 1;
    
    // Chart container
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(chart2X, chart2Y, chartWidth, chartHeight, 3, 3, 'F');
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(chart2X, chart2Y, chartWidth, chartHeight, 3, 3, 'S');
    
    const plotArea = { x: chart2X + 25, y: chart2Y + 8, w: chartWidth - 35, h: chartHeight - 20 };
    const centerY = plotArea.y + plotArea.h / 2;
    
    // Horizontal grid lines
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const y = plotArea.y + (plotArea.h * i / 4);
      doc.line(plotArea.x, y, plotArea.x + plotArea.w, y);
    }
    
    // Zero line
    if (minCumulative < 0) {
      doc.setDrawColor(slate.r, slate.g, slate.b);
      doc.setLineWidth(0.4);
      doc.line(plotArea.x, centerY, plotArea.x + plotArea.w, centerY);
    }
    
    // Calculate points
    const points: { x: number; y: number; value: number }[] = [];
    cumulativeData.forEach((value, i) => {
      const x = plotArea.x + 10 + (i / Math.max(cumulativeData.length - 1, 1)) * (plotArea.w - 20);
      const y = centerY - (value / range) * (plotArea.h / 2 - 5);
      points.push({ x, y, value });
    });
    
    // Draw the line
    doc.setDrawColor(crimson.r, crimson.g, crimson.b);
    doc.setLineWidth(1.5);
    for (let i = 1; i < points.length; i++) {
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }
    
    // Draw data points with white center
    points.forEach((point) => {
      doc.setFillColor(crimson.r, crimson.g, crimson.b);
      doc.circle(point.x, point.y, 3, 'F');
      doc.setFillColor(255, 255, 255);
      doc.circle(point.x, point.y, 1.5, 'F');
    });
    
    // Y-axis labels
    doc.setFontSize(6);
    doc.setTextColor(slate.r, slate.g, slate.b);
    doc.text(formatCurrency(range), chart2X + 23, plotArea.y + 3, { align: 'right' });
    if (minCumulative < 0) {
      doc.text('$0', chart2X + 23, centerY + 2, { align: 'right' });
    }
    doc.text(formatCurrency(-range), chart2X + 23, plotArea.y + plotArea.h - 1, { align: 'right' });
    
    // X-axis property markers
    doc.setFontSize(6);
    points.forEach((_, i) => {
      const x = plotArea.x + 10 + (i / Math.max(points.length - 1, 1)) * (plotArea.w - 20);
      doc.text(`P${i + 1}`, x, plotArea.y + plotArea.h + 6, { align: 'center' });
    });
  }
  
  // Legend
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(slate.r, slate.g, slate.b);
  doc.text('Cumulative total as properties are added to portfolio', chart2X, chart2Y + chartHeight + 7);
  
  // ========== CHART 3: Income vs Expenses Comparison (Bottom Left) ==========
  const chart3X = 15;
  const chart3Y = 115;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy.r, navy.g, navy.b);
  doc.text('Income vs Operating Expenses', chart3X, chart3Y - 3);
  
  if (properties.length > 0) {
    // Chart container
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(chart3X, chart3Y, chartWidth, chartHeight, 3, 3, 'F');
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(chart3X, chart3Y, chartWidth, chartHeight, 3, 3, 'S');
    
    const maxValue = Math.max(
      ...properties.map(p => p.metrics.grossMonthlyIncome),
      ...properties.map(p => p.metrics.totalMonthlyExpenses),
      1
    );
    
    const plotArea = { x: chart3X + 40, y: chart3Y + 8, w: chartWidth - 50, h: chartHeight - 16 };
    const rowHeight = Math.min(14, (plotArea.h - 4) / properties.length);
    
    // Vertical grid lines
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const x = plotArea.x + (plotArea.w * i / 4);
      doc.line(x, plotArea.y, x, plotArea.y + plotArea.h);
    }
    
    properties.forEach((p, i) => {
      const rowY = plotArea.y + 2 + i * rowHeight;
      const incomeWidth = Math.max(2, (p.metrics.grossMonthlyIncome / maxValue) * plotArea.w);
      const expenseWidth = Math.max(2, (p.metrics.totalMonthlyExpenses / maxValue) * plotArea.w);
      
      // Income bar (emerald/green)
      doc.setFillColor(emerald.r, emerald.g, emerald.b);
      doc.roundedRect(plotArea.x, rowY, incomeWidth, rowHeight * 0.38, 1, 1, 'F');
      
      // Expense bar (amber/orange)
      doc.setFillColor(amber.r, amber.g, amber.b);
      doc.roundedRect(plotArea.x, rowY + rowHeight * 0.45, expenseWidth, rowHeight * 0.38, 1, 1, 'F');
      
      // Property label
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(navy.r, navy.g, navy.b);
      doc.text(p.shared.name.substring(0, 12), chart3X + 38, rowY + rowHeight * 0.55, { align: 'right' });
    });
    
    // X-axis value labels
    doc.setFontSize(5);
    doc.setTextColor(slate.r, slate.g, slate.b);
    for (let i = 0; i <= 4; i++) {
      const x = plotArea.x + (plotArea.w * i / 4);
      const val = (maxValue * i / 4);
      doc.text(formatCurrency(val), x, plotArea.y + plotArea.h + 5, { align: 'center' });
    }
  }
  
  // Legend with better styling
  doc.setFillColor(emerald.r, emerald.g, emerald.b);
  doc.roundedRect(chart3X, chart3Y + chartHeight + 4, 8, 4, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate.r, slate.g, slate.b);
  doc.text('Gross Income', chart3X + 10, chart3Y + chartHeight + 7);
  
  doc.setFillColor(amber.r, amber.g, amber.b);
  doc.roundedRect(chart3X + 48, chart3Y + chartHeight + 4, 8, 4, 1, 1, 'F');
  doc.text('Total Expenses', chart3X + 58, chart3Y + chartHeight + 7);
  
  // ========== CHART 4: Cap Rate & CoC Return (Bottom Right) ==========
  const chart4X = 155;
  const chart4Y = chart3Y;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(navy.r, navy.g, navy.b);
  doc.text('Return Metrics by Property', chart4X, chart4Y - 3);
  
  if (properties.length > 0) {
    // Chart container
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(chart4X, chart4Y, chartWidth, chartHeight, 3, 3, 'F');
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(chart4X, chart4Y, chartWidth, chartHeight, 3, 3, 'S');
    
    const maxRate = Math.max(
      ...properties.map(p => Math.max(p.metrics.capRate, p.metrics.cashOnCashReturn)),
      10
    );
    
    const plotArea = { x: chart4X + 20, y: chart4Y + 8, w: chartWidth - 30, h: chartHeight - 22 };
    const chartBaseY = plotArea.y + plotArea.h;
    
    // Horizontal grid lines with percentage labels
    doc.setDrawColor(gridColor.r, gridColor.g, gridColor.b);
    doc.setLineWidth(0.2);
    for (let i = 0; i <= 4; i++) {
      const y = plotArea.y + (plotArea.h * (4 - i) / 4);
      doc.line(plotArea.x, y, plotArea.x + plotArea.w, y);
      
      doc.setFontSize(5);
      doc.setTextColor(slate.r, slate.g, slate.b);
      const pct = (maxRate * i / 4).toFixed(0);
      doc.text(`${pct}%`, chart4X + 18, y + 1.5, { align: 'right' });
    }
    
    const groupWidth = plotArea.w / properties.length;
    const barWidth = Math.min(12, groupWidth * 0.35);
    const barGap = 2;
    
    properties.forEach((p, i) => {
      const groupX = plotArea.x + (groupWidth * i) + (groupWidth - barWidth * 2 - barGap) / 2;
      
      // Cap Rate bar (crimson)
      const capHeight = Math.max(2, (p.metrics.capRate / maxRate) * plotArea.h);
      doc.setFillColor(crimson.r, crimson.g, crimson.b);
      doc.roundedRect(groupX, chartBaseY - capHeight, barWidth, capHeight, 1, 1, 'F');
      
      // CoC Return bar (navy blue)
      const cocHeight = Math.max(2, (p.metrics.cashOnCashReturn / maxRate) * plotArea.h);
      doc.setFillColor(navy.r, navy.g, navy.b);
      doc.roundedRect(groupX + barWidth + barGap, chartBaseY - cocHeight, barWidth, cocHeight, 1, 1, 'F');
      
      // Property label
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(slate.r, slate.g, slate.b);
      doc.text(`P${i + 1}`, groupX + barWidth + barGap / 2, chartBaseY + 6, { align: 'center' });
    });
  }
  
  // Legend
  doc.setFillColor(crimson.r, crimson.g, crimson.b);
  doc.roundedRect(chart4X, chart4Y + chartHeight + 4, 8, 4, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(slate.r, slate.g, slate.b);
  doc.text('Cap Rate', chart4X + 10, chart4Y + chartHeight + 7);
  
  doc.setFillColor(navy.r, navy.g, navy.b);
  doc.roundedRect(chart4X + 42, chart4Y + chartHeight + 4, 8, 4, 1, 1, 'F');
  doc.text('Cash-on-Cash Return', chart4X + 52, chart4Y + chartHeight + 7);
  
  // Determine total pages (3 base + 1 if CFO analysis provided)
  const totalPages = cfoAnalysisText ? 4 : 3;
  
  // ========== PAGE 4: CFO STRATEGIC INSIGHTS (if provided) ==========
  if (cfoAnalysisText) {
    doc.addPage('landscape');
    
    // Header bar
    doc.setFillColor(crimson.r, crimson.g, crimson.b);
    doc.rect(0, 0, pageWidth, 22, 'F');
    
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('CFO STRATEGIC INSIGHTS', 15, 14);
    doc.setFontSize(9);
    doc.text('Veterans Development Group', pageWidth - 15, 14, { align: 'right' });
    
    // Introduction
    doc.setFontSize(10);
    doc.setTextColor(crimson.r, crimson.g, crimson.b);
    doc.text('AI-POWERED FINANCIAL ANALYSIS & RECOMMENDATIONS', 15, 32);
    doc.line(15, 34, 180, 34);
    
    // Parse and display CFO analysis
    doc.setFontSize(8);
    doc.setTextColor(textDark.r, textDark.g, textDark.b);
    
    // Clean up the text (remove markdown formatting)
    let cleanText = cfoAnalysisText
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/---/g, '')
      .trim();
    
    // Split into lines that fit the page width
    const maxWidth = pageWidth - 30;
    const lines = doc.splitTextToSize(cleanText, maxWidth);
    
    // Calculate how many lines fit on the page
    const lineHeight = 4;
    const startY = 42;
    const maxLinesPerPage = Math.floor((pageHeight - startY - 15) / lineHeight);
    
    // Display lines, adding pages as needed
    let currentY = startY;
    let currentPage = 4;
    
    for (let i = 0; i < lines.length; i++) {
      if (currentY > pageHeight - 15) {
        // Add new page
        doc.addPage('landscape');
        currentPage++;
        
        // Header bar for continuation
        doc.setFillColor(crimson.r, crimson.g, crimson.b);
        doc.rect(0, 0, pageWidth, 22, 'F');
        
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('CFO STRATEGIC INSIGHTS (Continued)', 15, 14);
        doc.setFontSize(9);
        doc.text('Veterans Development Group', pageWidth - 15, 14, { align: 'right' });
        
        currentY = 32;
        doc.setFontSize(8);
        doc.setTextColor(textDark.r, textDark.g, textDark.b);
      }
      
      doc.text(lines[i], 15, currentY);
      currentY += lineHeight;
    }
  }
  
  // Footer position
  const footerY = pageHeight - 8;
  
  // Add footers to all pages
  const finalPageCount = doc.getNumberOfPages();
  for (let i = 1; i <= finalPageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('CONFIDENTIAL - Veterans Development Group Investment Analysis', 15, footerY);
    doc.text(`Page ${i} of ${finalPageCount}`, pageWidth - 15, footerY, { align: 'right' });
  }
  
  doc.save('vdg-analyst-dashboard.pdf');
}

export function exportExcel(properties: PropertyAnalysis[]): void {
  const data = properties.map(p => ({
    'Property Name': p.shared.name,
    'Type': p.type,
    'Purchase Price': p.shared.purchasePrice,
    'Loan Amount': p.shared.loanAmount,
    'Interest Rate (%)': p.shared.interestRate,
    'Loan Term (Years)': p.shared.loanTermYears,
    'Closing Costs': p.shared.closingCosts,
    'Monthly Mortgage': p.metrics.monthlyMortgagePayment,
    'Gross Monthly Income': p.metrics.grossMonthlyIncome,
    'Monthly Expenses': p.metrics.totalMonthlyExpenses,
    'Net Monthly Cash Flow': p.metrics.netMonthlyCashFlow,
    'Annual Cash Flow': p.metrics.annualNetCashFlow,
    'Cash on Cash Return (%)': p.metrics.cashOnCashReturn,
    'Cap Rate (%)': p.metrics.capRate,
    'Initial Cash Invested': p.metrics.initialCashInvested,
    ...(p.type === PropertyType.LTR && p.ltr ? {
      'Units': p.ltr.numberOfUnits,
      'Rent/Unit': p.ltr.grossRentPerMonth,
      'PM Fee (%)': p.ltr.pmFeePercent,
      'Veteran Occupancy Goal (%)': p.ltr.targetVeteranOccupancyPercent || 0,
    } : {}),
    ...(p.type === PropertyType.STR && p.str ? {
      'Daily Rate': p.str.dailyRate,
      'Occupancy (%)': p.str.occupancyRate,
      'Co-Host Fee (%)': p.str.coHostFeePercent,
    } : {}),
  }));
  
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
  XLSX.writeFile(wb, 'vdg-portfolio-data.xlsx');
}

export function exportSQL(properties: PropertyAnalysis[]): void {
  let sql = `-- Veterans Development Group Portfolio Export\n`;
  sql += `-- Generated: ${new Date().toISOString()}\n\n`;
  
  sql += `CREATE TABLE IF NOT EXISTS properties (\n`;
  sql += `  id VARCHAR(36) PRIMARY KEY,\n`;
  sql += `  name VARCHAR(255) NOT NULL,\n`;
  sql += `  type VARCHAR(10) NOT NULL,\n`;
  sql += `  purchase_price DECIMAL(12,2),\n`;
  sql += `  loan_amount DECIMAL(12,2),\n`;
  sql += `  interest_rate DECIMAL(5,2),\n`;
  sql += `  loan_term_years INT,\n`;
  sql += `  closing_costs DECIMAL(12,2),\n`;
  sql += `  monthly_cash_flow DECIMAL(10,2),\n`;
  sql += `  annual_cash_flow DECIMAL(12,2),\n`;
  sql += `  coc_return DECIMAL(5,2),\n`;
  sql += `  cap_rate DECIMAL(5,2),\n`;
  sql += `  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n`;
  sql += `);\n\n`;
  
  properties.forEach(p => {
    sql += `INSERT INTO properties (id, name, type, purchase_price, loan_amount, interest_rate, loan_term_years, closing_costs, monthly_cash_flow, annual_cash_flow, coc_return, cap_rate) VALUES (\n`;
    sql += `  '${p.shared.id}',\n`;
    sql += `  '${p.shared.name.replace(/'/g, "''")}',\n`;
    sql += `  '${p.type}',\n`;
    sql += `  ${p.shared.purchasePrice},\n`;
    sql += `  ${p.shared.loanAmount},\n`;
    sql += `  ${p.shared.interestRate},\n`;
    sql += `  ${p.shared.loanTermYears},\n`;
    sql += `  ${p.shared.closingCosts},\n`;
    sql += `  ${p.metrics.netMonthlyCashFlow},\n`;
    sql += `  ${p.metrics.annualNetCashFlow},\n`;
    sql += `  ${p.metrics.cashOnCashReturn},\n`;
    sql += `  ${p.metrics.capRate}\n`;
    sql += `);\n\n`;
  });
  
  const blob = new Blob([sql], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vdg-portfolio.sql';
  a.click();
  URL.revokeObjectURL(url);
}
