import type {
  CampaignRecord,
  DashboardFilters,
  IndustryProfile,
  Tenant,
  UserPersona,
} from '../../types/platform';
import type { DashboardAnalyticsSnapshot } from '../analytics/kpiEngine';
import { formatIdrCompact } from '../analytics/kpiEngine';

export interface AiInsightRequest {
  question: string;
  tenant: Tenant;
  industry: IndustryProfile;
  persona: UserPersona;
  filters: DashboardFilters;
  analytics: DashboardAnalyticsSnapshot;
  campaigns: CampaignRecord[];
}

export interface AiInsightResponse {
  answer: string;
  model: string;
  groundedTenant: string;
  requiresHumanApproval: boolean;
  generatedAt: string;
}

export interface AiServiceClient {
  checkHealth(): Promise<{ geminiConfigured: boolean }>;
  askBusinessQuestion(request: AiInsightRequest): Promise<AiInsightResponse>;
}

export const serveonAiService: AiServiceClient = {
  async checkHealth(): Promise<{ geminiConfigured: boolean }> {
    const res = await fetch('/api/health');
    if (!res.ok) {
      throw new Error(`Health check failed (${res.status})`);
    }
    const data = (await res.json()) as { geminiConfigured?: boolean };
    return { geminiConfigured: Boolean(data.geminiConfigured) };
  },

  async askBusinessQuestion(request: AiInsightRequest): Promise<AiInsightResponse> {
    const { question, tenant, industry, persona, filters, analytics, campaigns } = request;
    const regionLabel =
      filters.regionId === 'ALL'
        ? `All Permitted Regions (${tenant.primaryProvinceName})`
        : tenant.province.regencies.find((r) => r.id === filters.regionId)?.name ?? filters.regionId;

    const payload = {
      question,
      tenantContext: {
        tenantName: tenant.name,
        industryName: industry.name,
        regionScope: regionLabel,
        roleLabel: `${persona.title} (${persona.scopeLevel} scope)`,
        dateRange: filters.dateRange,
        summaryMetrics: analytics.kpis.map((k) => ({
          label: k.label,
          value: k.formattedValue,
          change: k.deltaLabel,
        })),
        topRegions: analytics.regionalPerformance.slice(0, 8).map((r) => ({
          name: r.regionName,
          customers: r.customers,
          opportunityScore: r.opportunityScore,
          revenueFormatted: formatIdrCompact(r.revenue),
        })),
        segments: analytics.segments.map((s) => ({
          name: s.segment,
          count: s.count,
          sharePct: s.sharePct,
        })),
        topRiskFactors: [
          'Days since last transaction/service visit',
          'Reduced branch engagement frequency',
          'Regional competitive intensity',
        ],
        activeCampaigns: campaigns
          .filter((c) => c.tenant_id === tenant.id)
          .slice(0, 6)
          .map((c) => ({
            name: c.name,
            status: c.status,
            channel: c.channel,
            targetCount: c.targetAudienceCount,
          })),
      },
    };

    const res = await fetch('/api/ai/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as Partial<AiInsightResponse> & {
      error?: string;
    };

    if (!res.ok) {
      throw new Error(data.error || `AI service request failed (${res.status})`);
    }

    return {
      answer: data.answer ?? '',
      model: data.model ?? 'gemini-4-hydrogen',
      groundedTenant: data.groundedTenant ?? tenant.name,
      requiresHumanApproval: Boolean(data.requiresHumanApproval ?? true),
      generatedAt: data.generatedAt ?? new Date().toISOString(),
    };
  },
};
