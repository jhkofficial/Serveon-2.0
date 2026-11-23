import React from 'react';
import { ShieldAlert, ArrowLeft, Blocks } from 'lucide-react';
import { PlatformProvider, usePlatform } from './core/state/PlatformContext';
import { LoginView } from './modules/auth/LoginView';
import { AppShell } from './layouts/AppShell';
import { ExecutiveDashboard } from './modules/dashboard/ExecutiveDashboard';
import { CustomerIntelligence } from './modules/customer-intelligence/CustomerIntelligence';
import { LocationIntelligence } from './modules/location-intelligence/LocationIntelligence';
import { PredictiveIntelligence } from './modules/predictive-intelligence/PredictiveIntelligence';
import { ExplainableAiWorkspace } from './modules/predictive-intelligence/ExplainableAiWorkspace';
import { NextBestActionWorkspace } from './modules/decision-intelligence/NextBestActionWorkspace';
import { DecisionIntelligence } from './modules/decision-intelligence/DecisionIntelligence';
import { CampaignStudio } from './modules/crm-campaign/CampaignStudio';
import { ApprovalInbox } from './modules/crm-campaign/ApprovalInbox';
import { CampaignOperations } from './modules/crm-campaign/CampaignOperations';
import { PerformanceIntelligence } from './modules/performance-intelligence/PerformanceIntelligence';
import { LearningGovernanceWorkspace } from './modules/governance/LearningGovernanceWorkspace';
import { AdminConsole } from './modules/administration/AdminConsole';
import { PlatformOverview } from './modules/enterprise-admin/PlatformOverview';
import { TenantManagementWorkspace } from './modules/enterprise-admin/TenantManagementWorkspace';
import { OrganizationManagementWorkspace } from './modules/enterprise-admin/OrganizationManagementWorkspace';
import { IndustryProfileStudio } from './modules/enterprise-admin/IndustryProfileStudio';
import { ModuleMarketplaceWorkspace } from './modules/enterprise-admin/ModuleMarketplaceWorkspace';
import { UserRoleManagementWorkspace } from './modules/enterprise-admin/UserRoleManagementWorkspace';
import { DataIntegrationHubWorkspace } from './modules/enterprise-admin/DataIntegrationHubWorkspace';
import { EnterpriseAiGovernanceWorkspace } from './modules/enterprise-admin/EnterpriseAiGovernanceWorkspace';
import { SecurityAuditWorkspace } from './modules/enterprise-admin/SecurityAuditWorkspace';
import { PlatformMonitoringWorkspace } from './modules/enterprise-admin/PlatformMonitoringWorkspace';
import { EnterpriseReadinessWorkspace } from './modules/enterprise-admin/EnterpriseReadinessWorkspace';

function WorkspaceRouter() {
  const { isAuthenticated, activeRoute, routeAccess, persona, navigateToRoute } = usePlatform();

  if (!isAuthenticated) {
    return <LoginView />;
  }

  let content: React.ReactNode;

  if (!routeAccess.allowed) {
    const canManageModules = persona.permissions.includes('admin.manage_modules');
    content = (
      <div className="mx-auto max-w-xl py-12">
        <div className="rounded-xl border border-rose-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">
                {routeAccess.blockedByRole ? 'RBAC Authorization Guardrail' : 'Disabled Module Guardrail'}
              </div>
              <h1 className="mt-1 font-display text-lg font-bold text-[#102B4D]">
                Workspace Access Blocked
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{routeAccess.reason}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigateToRoute('executive')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Return to Executive Dashboard</span>
            </button>
            {routeAccess.blockedModuleId && canManageModules && (
              <button
                type="button"
                onClick={() => navigateToRoute('ent_marketplace')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Blocks className="h-3.5 w-3.5 text-[#1769AA]" />
                <span>Open Module Marketplace</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    switch (activeRoute) {
      case 'executive':
        content = <ExecutiveDashboard />;
        break;
      case 'customers':
        content = <CustomerIntelligence />;
        break;
      case 'location':
        content = <LocationIntelligence />;
        break;
      case 'ai_predictions':
        content = <PredictiveIntelligence />;
        break;
      case 'explainable_ai':
        content = <ExplainableAiWorkspace />;
        break;
      case 'next_best_action':
        content = <NextBestActionWorkspace />;
        break;
      case 'decision_hub':
        content = <DecisionIntelligence />;
        break;
      case 'campaign_studio':
        content = <CampaignStudio />;
        break;
      case 'approval_inbox':
        content = <ApprovalInbox />;
        break;
      case 'campaign_ops':
        content = <CampaignOperations />;
        break;
      case 'performance':
        content = <PerformanceIntelligence />;
        break;
      case 'learning_governance':
        content = <LearningGovernanceWorkspace />;
        break;
      case 'admin_config':
        content = <AdminConsole />;
        break;
      case 'ent_overview':
        content = <PlatformOverview />;
        break;
      case 'ent_tenants':
        content = <TenantManagementWorkspace />;
        break;
      case 'ent_org':
        content = <OrganizationManagementWorkspace />;
        break;
      case 'ent_industries':
        content = <IndustryProfileStudio />;
        break;
      case 'ent_marketplace':
        content = <ModuleMarketplaceWorkspace />;
        break;
      case 'ent_users':
        content = <UserRoleManagementWorkspace />;
        break;
      case 'ent_integrations':
        content = <DataIntegrationHubWorkspace />;
        break;
      case 'ent_ai_governance':
        content = <EnterpriseAiGovernanceWorkspace />;
        break;
      case 'ent_security_audit':
        content = <SecurityAuditWorkspace />;
        break;
      case 'ent_monitoring':
        content = <PlatformMonitoringWorkspace />;
        break;
      case 'ent_readiness':
        content = <EnterpriseReadinessWorkspace />;
        break;
      default:
        content = <ExecutiveDashboard />;
    }
  }

  return <AppShell>{content}</AppShell>;
}

export default function App() {
  return (
    <PlatformProvider>
      <WorkspaceRouter />
    </PlatformProvider>
  );
}
