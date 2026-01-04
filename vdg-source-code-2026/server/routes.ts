import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import fs from "fs";

// Using Replit's AI Integrations service for Gemini access (no personal API key needed)
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRateLimited = error?.status === 429 || 
        error?.message?.includes('429') || 
        error?.message?.includes('quota') ||
        error?.message?.includes('rate limit');
      
      if (!isRateLimited || attempt === maxRetries) {
        throw error;
      }
      
      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`Rate limited, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Download endpoint for source code zip
  app.get('/api/download/source-code', (req, res) => {
    const zipPath = path.join(process.cwd(), 'vdg-source-code.zip');
    if (fs.existsSync(zipPath)) {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="vdg-source-code.zip"');
      res.download(zipPath, 'vdg-source-code.zip');
    } else {
      res.status(404).json({ error: 'Source code archive not found' });
    }
  });

  app.post('/api/market-value', async (req, res) => {
    try {
      const { propertyName, propertyType } = req.body;
      
      if (!propertyName || typeof propertyName !== 'string' || !propertyName.trim()) {
        return res.status(400).json({ error: 'Property name/address is required' });
      }

      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      const prompt = `You are a real estate valuation assistant. Based on the property address or name provided, estimate the market value of the property.

Property: ${propertyName}
Property Type: ${propertyType || 'Residential'}

Provide a reasonable market value estimate based on:
- The property location (city, state, neighborhood)
- Typical property values for this type of property in that area
- General real estate pricing patterns for similar properties

You MUST provide an estimate. Even if you're uncertain, make your best educated guess based on typical property values for the location and type. Do not refuse to provide an estimate.

IMPORTANT: You must respond with ONLY a JSON object in this exact format:
{
  "estimatedValue": <number - your best estimate, never null>,
  "confidence": "<low|medium|high>",
  "reasoning": "<brief explanation of how you arrived at this estimate>"
}

If you cannot determine a reasonable estimate (e.g., the address is too vague or not a valid property), respond with:
{
  "estimatedValue": null,
  "confidence": "none",
  "reasoning": "<explanation of why you couldn't estimate>"
}

Do not include any text outside the JSON object.`;

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        });
      });

      const responseText = response.text || "";
      
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      try {
        const result = JSON.parse(jsonStr);
        res.json({ 
          marketValue: result.estimatedValue,
          confidence: result.confidence,
          reasoning: result.reasoning
        });
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, 'Response:', responseText);
        res.status(500).json({ 
          error: 'Failed to parse market value estimate',
          rawResponse: responseText
        });
      }
    } catch (error) {
      console.error('Market Value Estimation Error:', error);
      res.status(500).json({ 
        error: 'Failed to estimate market value',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/mortgage-rate', async (req, res) => {
    try {
      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const prompt = `You are a mortgage rate assistant. Estimate Bank of America's current 30-year fixed conventional mortgage rate.

Current market data as of December 2025:
- Bank of America's 30-year fixed rate is currently around 6.125% to 6.25%
- The national average 30-year fixed rate is approximately 6.27% to 6.34%
- Rates have been declining in late 2025

Based on this current data, provide Bank of America's 30-year fixed rate. Use a value between 6.0% and 6.5%.

IMPORTANT: You must respond with ONLY a JSON object in this exact format:
{
  "rate": <number between 6.0 and 6.5, e.g. 6.125>,
  "source": "Bank of America 30-Year Fixed",
  "asOf": "${today}"
}

Do not include any text outside the JSON object.`;

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        });
      });

      const responseText = response.text || "";
      
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      try {
        const result = JSON.parse(jsonStr);
        res.json({ 
          rate: result.rate,
          source: result.source,
          asOf: result.asOf
        });
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, 'Response:', responseText);
        res.status(500).json({ 
          error: 'Failed to parse mortgage rate',
          rawResponse: responseText
        });
      }
    } catch (error) {
      console.error('Mortgage Rate Error:', error);
      res.status(500).json({ 
        error: 'Failed to get mortgage rate',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/str-estimate', async (req, res) => {
    try {
      const { propertyName } = req.body;
      
      if (!propertyName || typeof propertyName !== 'string' || !propertyName.trim()) {
        return res.status(400).json({ error: 'Property name/address is required' });
      }

      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      const prompt = `You are a short-term rental (Airbnb/VRBO) market analyst. Based on the property address provided, estimate the STR rental rates and typical expenses for a CONDO at this location.

Property Address: ${propertyName}

Provide estimates based on:
- The property location (city, state, neighborhood)
- Typical Airbnb/VRBO rates for condos in that area
- Seasonal patterns and tourism demand
- Standard condo operating costs

You MUST provide estimates. Make your best educated guess based on typical STR rates for the location.

IMPORTANT: You must respond with ONLY a JSON object in this exact format:
{
  "dailyRate": <number - typical nightly rate in dollars, never null>,
  "occupancyRate": <number - average annual occupancy percentage 0-100, typically 50-75 for STR>,
  "coHostFeePercent": <number - typical co-host/property manager fee, usually 20-25>,
  "cleaningFeePerStay": <number - cleaning fee per guest stay, typically 100-200>,
  "avgStaysPerMonth": <number - average number of bookings per month, typically 3-6>,
  "monthlyUtilities": <number - typical monthly utilities for a condo, usually 150-300>,
  "annualPropertyTax": <number - estimated annual property tax based on typical condo values>,
  "annualInsurance": <number - estimated annual insurance for STR property>,
  "confidence": "<low|medium|high>",
  "reasoning": "<brief explanation of how you arrived at these estimates>"
}

Do not include any text outside the JSON object.`;

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        });
      });

      const responseText = response.text || "";
      
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      try {
        const result = JSON.parse(jsonStr);
        res.json({ 
          dailyRate: result.dailyRate,
          occupancyRate: result.occupancyRate,
          coHostFeePercent: result.coHostFeePercent,
          cleaningFeePerStay: result.cleaningFeePerStay,
          avgStaysPerMonth: result.avgStaysPerMonth,
          monthlyUtilities: result.monthlyUtilities,
          annualPropertyTax: result.annualPropertyTax,
          annualInsurance: result.annualInsurance,
          confidence: result.confidence,
          reasoning: result.reasoning
        });
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, 'Response:', responseText);
        res.status(500).json({ 
          error: 'Failed to parse STR estimates',
          rawResponse: responseText
        });
      }
    } catch (error) {
      console.error('STR Estimate Error:', error);
      res.status(500).json({ 
        error: 'Failed to get STR estimates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const { portfolio, humanContext } = req.body;
      
      if (!portfolio || !Array.isArray(portfolio) || portfolio.length === 0) {
        return res.status(400).json({ error: 'Portfolio data is required' });
      }

      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      const portfolioSummary = portfolio.map((p: any) => {
        let summary = `
        Property: ${p.name}
        Type: ${p.type}
        Market Value: $${p.marketValue?.toLocaleString() || p.purchasePrice?.toLocaleString()}
        Purchase Price: $${p.purchasePrice?.toLocaleString()}
        Downpayment: $${p.downpayment?.toLocaleString()}
        Original Loan: $${p.loanAmount?.toLocaleString()}
        Loan Remaining: $${p.loanRemaining?.toLocaleString() || p.loanAmount?.toLocaleString()}
        Interest Rate: ${p.interestRate}%
        Monthly Mortgage: $${p.monthlyMortgage?.toLocaleString()}
        Gross Monthly Income: $${p.grossMonthlyIncome?.toLocaleString()}
        Monthly Expenses: $${p.monthlyExpenses?.toLocaleString()}
        Net Monthly Cash Flow: $${p.netMonthlyCashFlow?.toLocaleString()}
        Annual Cash Flow: $${p.annualCashFlow?.toLocaleString()}
        Cash on Cash Return: ${p.cashOnCashReturn?.toFixed(2)}%
        Cap Rate: ${p.capRate?.toFixed(2)}%
        Initial Cash Invested: $${p.cashInvested?.toLocaleString()}
        ${p.veteranGoal ? `Veteran Occupancy Goal: ${p.veteranGoal}%` : ''}
        ${p.currentVeteranOccupancy !== undefined ? `Current Veteran Occupancy: ${p.currentVeteranOccupancy}%` : ''}`;
        
        if (p.manualCapEx) {
          summary += `
        ** MANUAL CAPITAL EXPENSES (User-Identified) **
        Total Manual CapEx: $${p.manualCapEx.total?.toLocaleString()}
        - Immediate CapEx (added to initial investment): $${p.manualCapEx.immediate?.toLocaleString()}
        - Year 1 CapEx (deducted from first year cash flow): $${p.manualCapEx.year1?.toLocaleString()}
        Items: ${p.manualCapEx.items?.map((item: any) => `${item.name}: $${item.cost?.toLocaleString()} (${item.timing})`).join(', ') || 'None'}
        Note: The metrics above already account for these manual expenses. Consider these as property issues identified during walkthrough that require capital investment.`;
        }
        
        return summary;
      }).join('\n---\n');

      const totalValue = portfolio.reduce((sum: number, p: any) => sum + (p.purchasePrice || 0), 0);
      const totalCashFlow = portfolio.reduce((sum: number, p: any) => sum + (p.annualCashFlow || 0), 0);
      const avgCoC = portfolio.length > 0 
        ? portfolio.reduce((sum: number, p: any) => sum + (p.cashOnCashReturn || 0), 0) / portfolio.length 
        : 0;

      const prompt = `You are a real estate investment advisor for the Veterans Development Group, 
a company focused on building wealth through real estate while supporting veteran housing initiatives.

Analyze this real estate investment portfolio and provide actionable recommendations:

PORTFOLIO SUMMARY:
- Total Properties: ${portfolio.length}
- Total Portfolio Value: $${totalValue.toLocaleString()}
- Total Annual Cash Flow: $${totalCashFlow.toLocaleString()}
- Average Cash-on-Cash Return: ${avgCoC.toFixed(2)}%

INDIVIDUAL PROPERTIES:
${portfolioSummary}

Please provide:
1. **Portfolio Strength Assessment** - Overall health of the portfolio
2. **Top Performers** - Which properties are performing best and why
3. **Areas for Improvement** - Properties that may need attention or optimization
4. **Risk Analysis** - Potential risks in this portfolio mix
5. **Strategic Recommendations** - 2-3 actionable next steps to improve returns
6. **Veteran Impact** - If applicable, comment on veteran housing goals
${humanContext ? `
ADDITIONAL CONTEXT FROM THE INVESTOR:
The following qualitative insights were provided by the investor. Please incorporate this context professionally into your analysis:

"${humanContext}"

Address these insights specifically in your recommendations where relevant.` : ''}

Keep your analysis concise, professional, and focused on actionable insights. 
Use bullet points for clarity. Avoid generic advice - be specific to these numbers.`;

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        });
      });

      const analysis = response.text || "Unable to generate analysis at this time.";
      
      res.json({ analysis });
    } catch (error) {
      console.error('AI Analysis Error:', error);
      res.status(500).json({ 
        error: 'Failed to generate analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/extract-property', async (req, res) => {
    try {
      let { text, image, propertyType } = req.body;
      
      if ((!text || typeof text !== 'string' || !text.trim()) && !image) {
        return res.status(400).json({ error: 'Property text or image is required' });
      }

      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      // Check if the text is a URL and fetch the page content
      const urlMatch = text?.trim().match(/^(https?:\/\/[^\s]+)$/i);
      if (urlMatch) {
        const url = urlMatch[1];
        console.log('Detected URL, fetching content:', url);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            }
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const html = await response.text();
            // Extract text content, focusing on key data
            // Remove script and style tags, then get text
            const cleanHtml = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Limit to first 15000 characters to avoid token limits
            text = `URL: ${url}\n\nPage Content:\n${cleanHtml.slice(0, 15000)}`;
            console.log('Fetched page content, length:', text.length);
          } else {
            console.log('Failed to fetch URL, status:', response.status);
            text = `URL: ${url}\n\nNote: Could not fetch page content. Please paste the listing details or upload a screenshot instead.`;
          }
        } catch (fetchError) {
          console.log('Error fetching URL:', fetchError);
          return res.status(400).json({ 
            error: 'Cannot access Zillow directly. Please copy and paste the listing text from the Zillow page, or upload a screenshot instead.',
            suggestion: 'copy_paste'
          });
        }
      }
      
      // If URL fetch failed with 403/blocked, ask user to paste content
      if (text?.includes('Could not fetch page content')) {
        return res.status(400).json({ 
          error: 'Cannot access Zillow directly. Please copy and paste the listing text from the Zillow page, or upload a screenshot instead.',
          suggestion: 'copy_paste'
        });
      }

      const isLTR = propertyType === 'LTR';
      
      const extractionPrompt = `You are a real estate data extraction assistant. Extract property data from the provided ${image ? 'screenshot' : 'text'} (which may be from Zillow, Redfin, or other real estate sites).

${text ? `TEXT TO ANALYZE:\n${text}\n` : ''}
Extract and return ONLY a JSON object with these fields. Use null for any field you cannot determine:

{
  "name": "property address or name",
  "purchasePrice": number (the CURRENT LISTING/SALE PRICE - the main asking price shown prominently),
  "marketValue": number (use the Zestimate if available, otherwise use the listing price),
  "estimatedRent": number (monthly rent estimate if available, otherwise estimate based on property size/location),
  "annualPropertyTax": number (annual property tax if listed),
  "annualInsurance": number (estimate based on property value if not listed, typically 0.5% of value),
  "numberOfUnits": number (default 1 for single family),
  "squareFeet": number (if available),
  "bedrooms": number,
  "bathrooms": number,
  "yearBuilt": number,
  "propertyType": "single_family" | "multi_family" | "condo" | "townhouse" | "other",
  "zillowUrl": "url if present",
  "notes": "any relevant details like HOA fees, special features, etc"
}

CRITICAL INSTRUCTIONS FOR purchasePrice:
- The purchasePrice MUST be the CURRENT ASKING/LISTING PRICE - this is the main sale price shown on the listing
- On Zillow: This is the large price at the top (e.g., "$375,000"), NOT the Zestimate or price history values
- IGNORE: Zestimate, price history, previous sale prices, tax assessed values - these are NOT the listing price
- The listing price is what a buyer would pay TODAY to purchase the property
- Convert to plain number: "$375,000" becomes 375000, "$1,250,000" becomes 1250000
- If you see "$375K" that means 375000

OTHER IMPORTANT NOTES:
- Return ONLY valid JSON, no explanation or markdown
- For marketValue, use Zestimate if shown separately from listing price
- Estimate annualInsurance as 0.5% of purchase price if not specified
- For numberOfUnits, default to 1 unless it's clearly a multi-family property
- Look carefully at ALL visible information including price, address, taxes, property details`;

      // Build content parts for the request
      const parts: any[] = [];
      
      // Add image if provided
      if (image) {
        // Extract base64 data and mime type from data URL
        const matches = image.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mimeType = matches[1];
          const base64Data = matches[2];
          parts.push({
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          });
        }
      }
      
      // Add text prompt
      parts.push({ text: extractionPrompt });

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts }],
        });
      });

      const responseText = response.text || "";
      
      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      try {
        const extracted = JSON.parse(jsonStr);
        res.json({ extracted });
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError, 'Response:', responseText);
        res.status(500).json({ 
          error: 'Failed to parse extracted data',
          rawResponse: responseText
        });
      }
    } catch (error) {
      console.error('Property Extraction Error:', error);
      res.status(500).json({ 
        error: 'Failed to extract property data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/cfo-analyze', async (req, res) => {
    try {
      const { portfolio, marketCapRate, portfolioMetrics, humanContext } = req.body;
      
      if (!portfolio || !Array.isArray(portfolio) || portfolio.length === 0) {
        return res.status(400).json({ error: 'Portfolio data is required' });
      }

      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      const propertyDetails = portfolio.map((p: any) => {
        let details = `
Property: ${p.name} (${p.type})
- Market Value: $${p.marketValue?.toLocaleString() || p.purchasePrice?.toLocaleString()}
- Purchase Price: $${p.purchasePrice?.toLocaleString()}
- Downpayment: $${p.downpayment?.toLocaleString()}
- Original Loan: $${p.loanAmount?.toLocaleString()}
- Loan Remaining: $${p.loanRemaining?.toLocaleString() || p.loanAmount?.toLocaleString()} at ${p.interestRate}% for ${p.loanTermYears} years
- Monthly Mortgage: $${p.monthlyMortgage?.toLocaleString()}
- Gross Monthly Income: $${p.grossMonthlyIncome?.toLocaleString()}
- Net Monthly Income (before mortgage): $${p.netMonthlyIncome?.toLocaleString()}
- Monthly Operating Expenses: $${p.monthlyExpenses?.toLocaleString()}
- Net Monthly Cash Flow: $${p.netMonthlyCashFlow?.toLocaleString()}
- Annual NOI: $${p.annualNOI?.toLocaleString()}
- Annual Net Cash Flow: $${p.annualCashFlow?.toLocaleString()}
- Cap Rate: ${p.capRate?.toFixed(2)}%
- Cash-on-Cash Return: ${p.cashOnCashReturn?.toFixed(2)}%
- Initial Investment: $${p.cashInvested?.toLocaleString()}
${p.veteranGoal ? `- Veteran Occupancy Goal: ${p.veteranGoal}%` : ''}
${p.currentVeteranOccupancy !== undefined ? `- Current Veteran Occupancy: ${p.currentVeteranOccupancy}%` : ''}`;

        if (p.manualCapEx) {
          details += `
** MANUAL CAPITAL EXPENSES (User-Identified Physical Issues) **
- Total Manual CapEx: $${p.manualCapEx.total?.toLocaleString()}
- Immediate CapEx (added to initial investment): $${p.manualCapEx.immediate?.toLocaleString()}
- Year 1 CapEx (deducted from first year cash flow): $${p.manualCapEx.year1?.toLocaleString()}
- Items: ${p.manualCapEx.items?.map((item: any) => `${item.name}: $${item.cost?.toLocaleString()} (${item.timing})`).join(', ') || 'None'}
Note: These are physical property issues (roofs, HVAC, plumbing, etc.) identified during walkthrough. Metrics above already include these adjustments.`;
        }
        
        return details;
      }).join('\n\n');

      const basePrompt = `You are an AI CFO Consultant for the Veterans Development Group, a real estate investment company focused on building wealth while supporting veteran housing initiatives.

PORTFOLIO OVERVIEW:
- Total Properties: ${portfolio.length}
- Total Portfolio Value (Purchase): $${portfolioMetrics.totalValue?.toLocaleString()}
- Estimated Market Value: $${portfolioMetrics.estimatedValue?.toLocaleString()} (at ${marketCapRate}% market cap rate)
- Unrealized Gain/Loss: $${portfolioMetrics.unrealizedGain?.toLocaleString()}
- Total Debt: $${portfolioMetrics.totalLoanAmount?.toLocaleString()}
- Total Equity: $${portfolioMetrics.totalEquity?.toLocaleString()}
- Monthly Gross Income: $${portfolioMetrics.grossMonthlyIncome?.toLocaleString()}
- Monthly Net Income: $${portfolioMetrics.netMonthlyIncome?.toLocaleString()}
- Monthly Cash Flow: $${portfolioMetrics.netMonthlyCashFlow?.toLocaleString()}
- Monthly Expenses: $${portfolioMetrics.totalMonthlyExpenses?.toLocaleString()}
- Monthly Debt Service: $${portfolioMetrics.totalMortgage?.toLocaleString()}
- Annual NOI: $${portfolioMetrics.annualNOI?.toLocaleString()}
- Annual Cash Flow: $${portfolioMetrics.annualCashFlow?.toLocaleString()}
- Average Cap Rate: ${portfolioMetrics.avgCapRate?.toFixed(2)}%
- Average Cash-on-Cash Return: ${portfolioMetrics.avgCoC?.toFixed(2)}%
- Total Cash Invested: $${portfolioMetrics.totalCashInvested?.toLocaleString()}

INDIVIDUAL PROPERTY DETAILS:
${propertyDetails}
${humanContext ? `
ADDITIONAL CONTEXT FROM LEADERSHIP:
The following qualitative insights were provided by leadership. Please incorporate this context professionally into your CFO analysis:

"${humanContext}"

Address these insights specifically in your analysis and recommendations where relevant.` : ''}`;

      const prompts = {
        summary: `${basePrompt}

As the AI CFO, provide an EXECUTIVE SUMMARY of this portfolio's financial health. Include:
- Overall portfolio grade (A-F) with brief justification
- Key financial strengths (2-3 bullet points)
- Critical concerns (2-3 bullet points)
- One-sentence outlook

Keep it concise and executive-focused. Use specific numbers from the data.`,

        capRateAnalysis: `${basePrompt}

As the AI CFO, provide a detailed CAP RATE ANALYSIS. Include:
- How each property's cap rate compares to the ${marketCapRate}% market benchmark
- Which properties are above/below market and what that means
- Cap rate compression/expansion risks
- Recommendations for improving cap rates
- Industry comparison context

Be specific with numbers and provide actionable insights.`,

        incomeProjections: `${basePrompt}

As the AI CFO, provide INCOME PROJECTIONS AND ANALYSIS. Include:
- Gross vs Net income analysis - expense ratios
- Monthly and annual income breakdown
- 5-year income projection with 3% annual rent growth assumption
- Vacancy risk assessment for each property type
- Income diversification analysis (LTR vs STR mix)
- Recommendations for income optimization

Use specific numbers and realistic projections.`,

        valuationInsights: `${basePrompt}

As the AI CFO, provide VALUATION INSIGHTS AND FUTURE VALUE PROJECTIONS. Include:
- Current estimated value vs purchase price analysis
- Equity position assessment
- 5-year appreciation projection (assume 3% annual appreciation)
- Value-add opportunities for each property
- Refinance potential based on equity positions
- Exit strategy considerations

Be specific with calculations and projections.`,

        expenseOptimization: `${basePrompt}

As the AI CFO, provide EXPENSE OPTIMIZATION ANALYSIS. Include:
- Current expense ratios for each property
- Industry benchmark comparisons
- Specific cost reduction opportunities
- Debt service optimization (refinance opportunities?)
- Operating efficiency recommendations
- Potential annual savings with specific dollar amounts

Be specific and actionable with recommendations.`,

        strategicRecommendations: `${basePrompt}

As the AI CFO, provide STRATEGIC RECOMMENDATIONS. Include:
- Top 3 immediate action items with expected ROI
- Portfolio rebalancing suggestions
- Acquisition/disposition recommendations
- Financing optimization strategies
- Risk mitigation priorities
- 12-month strategic roadmap
- Veteran housing initiative impact and opportunities

Be specific, actionable, and prioritize by impact.`
      };

      const generateSection = async (prompt: string): Promise<string> => {
        const response = await retryWithBackoff(async () => {
          return await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          });
        });
        return response.text || "Analysis not available.";
      };

      const [summary, capRateAnalysis, incomeProjections, valuationInsights, expenseOptimization, strategicRecommendations] = await Promise.all([
        generateSection(prompts.summary),
        generateSection(prompts.capRateAnalysis),
        generateSection(prompts.incomeProjections),
        generateSection(prompts.valuationInsights),
        generateSection(prompts.expenseOptimization),
        generateSection(prompts.strategicRecommendations),
      ]);

      res.json({
        analysis: {
          summary,
          capRateAnalysis,
          incomeProjections,
          valuationInsights,
          expenseOptimization,
          strategicRecommendations,
        }
      });
    } catch (error) {
      console.error('CFO Analysis Error:', error);
      res.status(500).json({ 
        error: 'Failed to generate CFO analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/easyq', async (req, res) => {
    try {
      const { query, portfolios } = req.body;
      
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      if (!portfolios || !Array.isArray(portfolios) || portfolios.length === 0) {
        return res.status(400).json({ error: 'Portfolio data is required' });
      }

      if (!process.env.AI_INTEGRATIONS_GEMINI_API_KEY) {
        return res.status(500).json({ error: 'AI service not configured' });
      }

      const isMultiPortfolio = portfolios.length > 1;
      
      const schemaDescription = `
Available data fields for each property:
- portfolioId: Portfolio identifier (text) - identifies which portfolio this property belongs to
- portfolioName: Portfolio name (text) - human-readable name of the source portfolio
- name: Property name/address (text)
- type: Property type - 'LTR' or 'STR' (text)
- purchasePrice: Original purchase price (number, dollars)
- marketValue: Current market value (number, dollars)
- loanAmount: Original loan amount (number, dollars)
- loanRemaining: Current loan balance (number, dollars)
- interestRate: Loan interest rate (number, percentage e.g. 6.5 means 6.5%)
- loanTermYears: Loan term in years (number)
- grossMonthlyIncome: Gross monthly rental income (number, dollars)
- monthlyExpenses: Monthly operating expenses (number, dollars)
- monthlyMortgage: Monthly mortgage payment (number, dollars)
- netMonthlyCashFlow: Net monthly cash flow after all expenses (number, dollars)
- annualCashFlow: Annual net cash flow (number, dollars)
- capRate: Capitalization rate (number, percentage e.g. 8.5 means 8.5%)
- cashOnCashReturn: Cash-on-cash return (number, percentage)
- annualNOI: Annual net operating income (number, dollars)
- cashInvested: Total cash invested (number, dollars)
- currentVeteranOccupancy: Current veteran tenant occupancy percentage (number, 0-100)
- veteranGoal: Target veteran occupancy goal (number, usually 50)
- pmFeePercent: Property management fee percentage (number, e.g. 10 means 10%)
- monthlyPmFee: Monthly property management fee in dollars
- annualPropertyTax: Annual property tax (number, dollars)
- annualInsurance: Annual insurance cost (number, dollars)
- monthlyRepairReserve: Monthly repair/maintenance reserve (number, dollars)
- numberOfUnits: Number of rental units in the property
- buildingType: Type of building (SFH, Duplex, Triplex, etc.)

INVESTOR OWNERSHIP CONTEXT:
- All properties in this portfolio are owned equally by 4 investors
- Each investor has 25% ownership stake
- When calculating per-investor amounts, divide the total by 4 (or multiply by 0.25)
- Example: If monthly PM fee is $500, each investor's share is $125 ($500 * 0.25)
- Example: If annual cash flow is $12,000, each investor receives $3,000 per year
`;

      const allProperties = portfolios.flatMap((p: any) => 
        p.properties.map((prop: any) => ({
          ...prop,
          portfolioId: p.portfolioId,
          portfolioName: p.portfolioName
        }))
      );

      const multiPortfolioContext = isMultiPortfolio ? `
MULTI-PORTFOLIO QUERY CONTEXT:
This query spans ${portfolios.length} portfolios: ${portfolios.map((p: any) => `"${p.portfolioName}"`).join(', ')}
- When comparing across portfolios, use portfolioName to identify the source
- Use SQL UNION or JOIN semantics when showing combined data from multiple portfolios
- Include portfolioName column when it helps clarify which portfolio a property belongs to
- For aggregate queries (totals, averages), you may need to group by portfolioName
` : '';

      const prompt = `You are EasyQ, a natural-language query system for a real estate portfolio analysis app.

${schemaDescription}
${multiPortfolioContext}

User's question: "${query}"

Your task:
1. Understand the user's intent from their natural language question
2. Generate a representative SELECT SQL query (for DISPLAY PURPOSES ONLY - this will NOT be executed)
3. Analyze the portfolio data and filter/compute results that match the user's question
4. Return the appropriate columns and matching data rows

CRITICAL RULES:
- The SQL is for DISPLAY ONLY. You must manually filter the data yourself.
- Only show SELECT statements in the SQL field - never UPDATE, DELETE, INSERT, DROP, etc.
- Carefully analyze the portfolio data and return only the rows that match the query conditions
- For percentage comparisons (cap rate, CoC return), values are stored as numbers (8.5 = 8.5%)
- For veteran occupancy tracking, check if currentVeteranOccupancy < veteranGoal
${isMultiPortfolio ? '- Include portfolioName in results when helpful to show which portfolio each property belongs to' : ''}

Current portfolio data (${allProperties.length} properties${isMultiPortfolio ? ` across ${portfolios.length} portfolios` : ''}):
${JSON.stringify(allProperties, null, 2)}

Respond with ONLY a valid JSON object in this exact format:
{
  "sql": "SELECT name, capRate FROM properties WHERE capRate > 8",
  "columns": ["name", "capRate"],
  "results": [{ "name": "123 Main St", "capRate": 9.5 }],
  "error": null
}

If the query cannot be answered, respond with:
{
  "sql": "",
  "columns": [],
  "results": [],
  "error": "Explanation of why the query cannot be answered"
}

Generate the response now:`;

      const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
      });

      const responseText = response.text || '';
      
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.error) {
        return res.status(400).json({ error: parsed.error });
      }

      let displaySQL = (parsed.sql || '').trim();
      const upperSQL = displaySQL.toUpperCase();
      if (upperSQL.includes('DROP') || upperSQL.includes('DELETE') || 
          upperSQL.includes('UPDATE') || upperSQL.includes('INSERT') ||
          upperSQL.includes('ALTER') || upperSQL.includes('TRUNCATE')) {
        displaySQL = '-- Query filtered for display --';
      }

      res.json({
        sql: displaySQL,
        columns: parsed.columns || [],
        results: parsed.results || []
      });
    } catch (error) {
      console.error('EasyQ Error:', error);
      res.status(500).json({ 
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}
