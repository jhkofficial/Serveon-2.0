import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '512kb' }));

interface TenantInsightPayload {
  question?: unknown;
  tenantContext?: {
    tenantName?: string;
    industryName?: string;
    regionScope?: string;
    roleLabel?: string;
    dateRange?: string;
    summaryMetrics?: Array<{ label: string; value: string; change?: string }>;
    topRegions?: Array<{ name: string; customers: number; opportunityScore: number; revenueFormatted: string }>;
    segments?: Array<{ name: string; count: number; sharePct: number }>;
    topRiskFactors?: string[];
    activeCampaigns?: Array<{ name: string; status: string; channel: string; targetCount: number }>;
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'serveon-platform',
    geminiConfigured: Boolean(getGeminiClient()),
  });
});

app.post('/api/ai/insights', async (req, res) => {
  const body = (req.body ?? {}) as TenantInsightPayload;
  const rawQuestion = typeof body.question === 'string' ? body.question.trim() : '';

  if (!rawQuestion) {
    res.status(400).json({ error: 'Please provide a business question to analyze.' });
    return;
  }

  if (rawQuestion.length > 1000) {
    res.status(400).json({ error: 'Question must be 1,000 characters or fewer.' });
    return;
  }

  const ctx = body.tenantContext;
  if (!ctx || typeof ctx !== 'object' || typeof ctx.tenantName !== 'string') {
    res.status(400).json({ error: 'Valid tenant dashboard context is required.' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(503).json({
      error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable live AI insights.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
    return;
  }

  const systemInstruction = [
    'You are the SERVEON Enterprise AI Business Insights Assistant.',
    'You answer executive and operational questions strictly grounded in the provided structured tenant dashboard context.',
    'Rules:',
    '1. Only cite figures, regions, segments, and campaigns that appear in the provided tenant context. Never invent or extrapolate undocumented figures.',
    '2. If the requested metric or breakdown is not present in the context, state explicitly what information is unavailable.',
    '3. Remind the user that the underlying figures are synthetic Demo Data and that any recommended business action (such as launching a campaign or reassigning territory) requires explicit human review and approval.',
    '4. Respond concisely in structured plain prose with short bullet points (maximum 180 words). Do not use raw HTML.',
  ].join('\n');

  const safeContext = {
    tenantName: String(ctx.tenantName).slice(0, 120),
    industryName: String(ctx.industryName ?? '').slice(0, 80),
    regionScope: String(ctx.regionScope ?? 'All Permitted Regions').slice(0, 120),
    roleLabel: String(ctx.roleLabel ?? '').slice(0, 80),
    dateRange: String(ctx.dateRange ?? '').slice(0, 40),
    summaryMetrics: Array.isArray(ctx.summaryMetrics) ? ctx.summaryMetrics.slice(0, 12) : [],
    topRegions: Array.isArray(ctx.topRegions) ? ctx.topRegions.slice(0, 10) : [],
    segments: Array.isArray(ctx.segments) ? ctx.segments.slice(0, 8) : [],
    topRiskFactors: Array.isArray(ctx.topRiskFactors) ? ctx.topRiskFactors.slice(0, 6) : [],
    activeCampaigns: Array.isArray(ctx.activeCampaigns) ? ctx.activeCampaigns.slice(0, 8) : [],
  };

  const userPrompt = [
    'AUTHORIZED TENANT CONTEXT (Demo Data):',
    JSON.stringify(safeContext, null, 2),
    '',
    `USER QUESTION: ${rawQuestion}`,
  ].join('\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: userPrompt,
      config: {
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const answer = response.text?.trim();
    if (!answer) {
      res.status(502).json({ error: 'The AI service returned an empty response. Please try again.' });
      return;
    }

    res.json({
      answer,
      model: 'gemini-4-hydrogen',
      groundedTenant: safeContext.tenantName,
      requiresHumanApproval: true,
      generatedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected Gemini API error';
    const status =
      message.includes('403') || message.includes('PERMISSION_DENIED')
        ? 403
        : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : 502;
    res.status(status).json({
      error: `Unable to generate AI insight: ${message}`,
    });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SERVEON server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
