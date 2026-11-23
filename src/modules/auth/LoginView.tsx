import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  ChevronDown,
  Info,
  Layers,
  Lock,
  Shield,
  User,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { USER_PERSONAS } from '../../core/permissions/rbac';
import type { UserRoleId } from '../../types/platform';

export function LoginView() {
  const { enterDemo, tenants } = usePlatform();
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    tenants.find((t) => t.id === 'tenant-astra-motor')?.id ?? tenants[0].id
  );
  const [selectedRole, setSelectedRole] = useState<UserRoleId>('executive_management');
  const [authTab, setAuthTab] = useState<'demo' | 'production'>('demo');

  const handleEnterDemo = (e: React.FormEvent) => {
    e.preventDefault();
    enterDemo(selectedRole, selectedTenantId);
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#F5FAFF] via-[#F2F8FF] to-[#E3F1FE] px-4 py-10 sm:px-6">
      {/* Subtle layered sky-blue ambient wave backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[42vh] min-h-[260px] select-none overflow-hidden"
      >
        <svg
          viewBox="0 0 1440 360"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="serveon-wave-back" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CBE4FC" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#DCEEFF" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#BFE0FD" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="serveon-wave-mid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#BBDDFB" stopOpacity="0.55" />
              <stop offset="55%" stopColor="#CFE7FD" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#AED5FA" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="serveon-wave-front" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B4D9FB" stopOpacity="0.65" />
              <stop offset="50%" stopColor="#CCE5FC" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#A6D0F9" stopOpacity="0.72" />
            </linearGradient>
          </defs>
          <path
            d="M0,120 C220,165 440,260 760,235 C1060,212 1260,125 1440,85 L1440,360 L0,360 Z"
            fill="url(#serveon-wave-back)"
          />
          <path
            d="M0,185 C290,150 560,290 920,255 C1180,230 1330,175 1440,145 L1440,360 L0,360 Z"
            fill="url(#serveon-wave-mid)"
          />
          <path
            d="M0,265 C340,210 660,335 1040,285 C1240,258 1365,220 1440,198 L1440,360 L0,360 Z"
            fill="url(#serveon-wave-front)"
          />
        </svg>
      </div>

      {/* Centered Modern Enterprise Login Card */}
      <main className="relative z-10 w-full max-w-[500px] rounded-[24px] border border-white/90 bg-white px-7 py-9 shadow-[0_24px_60px_-14px_rgba(16,43,77,0.12),0_4px_18px_-4px_rgba(16,43,77,0.05)] sm:px-11 sm:py-11">
        {/* Centered Brand Lockup */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-[13px] bg-gradient-to-br from-[#06B6D4] via-[#08A2BD] to-[#0891B2] text-white shadow-[0_6px_16px_-4px_rgba(8,145,178,0.45)]">
              <Layers className="h-6 w-6 stroke-[2.2]" />
            </div>
            <h1 className="font-display text-[34px] font-extrabold leading-none tracking-[-0.02em] text-[#0D2754]">
              SERVEON
            </h1>
          </div>

          <p className="mt-4 text-[15px] font-medium text-[#2A3F5F]">
            Enterprise AI Customer &amp; Location Intelligence
          </p>
          <p className="mt-2 text-[13.5px] text-[#4E617C]">
            One Platform. Multiple Industries. Configurable Intelligence.
          </p>
        </div>

        {/* Segmented Auth Mode Tabs */}
        <div
          role="tablist"
          aria-label="Authentication mode"
          className="mt-8 grid grid-cols-2 gap-1 rounded-[12px] bg-[#EEF3F9] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={authTab === 'demo'}
            onClick={() => setAuthTab('demo')}
            className={`rounded-[9px] px-4 py-2.5 text-[14.5px] transition-all whitespace-nowrap ${
              authTab === 'demo'
                ? 'bg-gradient-to-r from-[#0A6ECF] to-[#0552B5] font-semibold text-white shadow-[0_4px_12px_-2px_rgba(5,82,181,0.35)]'
                : 'font-medium text-[#2E4260] hover:text-[#0D2754]'
            }`}
          >
            Explore Demo
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authTab === 'production'}
            onClick={() => setAuthTab('production')}
            className={`rounded-[9px] px-4 py-2.5 text-[14.5px] transition-all whitespace-nowrap ${
              authTab === 'production'
                ? 'bg-gradient-to-r from-[#0A6ECF] to-[#0552B5] font-semibold text-white shadow-[0_4px_12px_-2px_rgba(5,82,181,0.35)]'
                : 'font-medium text-[#2E4260] hover:text-[#0D2754]'
            }`}
          >
            Production SSO
          </button>
        </div>

        {authTab === 'demo' ? (
          <form onSubmit={handleEnterDemo} className="mt-6 space-y-5">
            {/* Select Tenant (Demo) */}
            <div>
              <label
                htmlFor="login-tenant-select"
                className="flex items-center gap-2 text-[13.5px] font-semibold text-[#182B49]"
              >
                <Building2 className="h-4 w-4 text-[#475D7A]" />
                <span>
                  Select Tenant <span className="font-normal text-[#5A6F8A]">(Demo)</span>
                </span>
              </label>
              <div className="relative mt-2">
                <select
                  id="login-tenant-select"
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  className="w-full appearance-none rounded-[10px] border border-[#CBD5E1] bg-white px-4 py-3 pr-10 text-[15px] font-medium text-[#0F2342] transition-colors hover:border-[#94A3B8] focus:border-[#0A6ECF] focus:outline-none focus:ring-2 focus:ring-[#0A6ECF]/15"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#334155]"
                />
              </div>
            </div>

            {/* Select User Role (Demo) */}
            <div>
              <label
                htmlFor="login-role-select"
                className="flex items-center gap-2 text-[13.5px] font-semibold text-[#182B49]"
              >
                <User className="h-4 w-4 text-[#475D7A]" />
                <span>
                  Select User Role <span className="font-normal text-[#5A6F8A]">(Demo)</span>
                </span>
              </label>
              <div className="relative mt-2">
                <select
                  id="login-role-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRoleId)}
                  className="w-full appearance-none rounded-[10px] border border-[#CBD5E1] bg-white px-4 py-3 pr-10 text-[15px] font-medium text-[#0F2342] transition-colors hover:border-[#94A3B8] focus:border-[#0A6ECF] focus:outline-none focus:ring-2 focus:ring-[#0A6ECF]/15"
                >
                  {USER_PERSONAS.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#334155]"
                />
              </div>
            </div>

            {/* Primary Gradient CTA */}
            <div className="pt-2">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2.5 rounded-[12px] bg-gradient-to-r from-[#1EA9C9] via-[#1379B8] to-[#0B5AA8] px-5 py-3.5 text-[15.5px] font-semibold text-white shadow-[0_10px_22px_-6px_rgba(11,90,168,0.45)] transition-all hover:brightness-[1.04] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A6ECF] focus-visible:ring-offset-2"
              >
                <span>Enter Demo</span>
                <ArrowRight className="h-4 w-4 stroke-[2.3]" />
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-[12px] border border-[#DCE6F2] bg-[#F6FAFF] p-4">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#0D2754]" />
                <div>
                  <h2 className="text-[13.5px] font-semibold text-[#0D2754]">
                    Production Authentication — Enterprise SSO
                  </h2>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#4E617C]">
                    Production access is separated from demo mode and validates tenant membership
                    server-side against authenticated identity provider claims.
                  </p>
                </div>
              </div>
            </div>

            <ul className="space-y-2 rounded-[12px] border border-[#E6EDF5] bg-white p-4 text-[12.5px] text-[#3B506B]">
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E9472]" />
                <span>OIDC / Firebase Authentication identity provider binding</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E9472]" />
                <span>Server-enforced tenant isolation and RBAC permission claims</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0E9472]" />
                <span>Demo tenant selector is disabled in production sessions</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={() => setAuthTab('demo')}
              className="w-full rounded-[10px] border border-[#CBD5E1] bg-white px-4 py-2.5 text-[14px] font-medium text-[#1E3352] transition-colors hover:bg-[#F5F9FF]"
            >
              Return to Explore Demo
            </button>
          </div>
        )}

        {/* Footer Hairline Divider & Demo Environment Notice */}
        <div className="mt-7 border-t border-[#E6EDF5] pt-5">
          <div className="flex items-center justify-center gap-2 text-center text-[12.5px] text-[#4E617C]">
            <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-[#3B506B]" />
            <span>
              <strong className="font-semibold text-[#1F3452]">Demo Environment:</strong> Synthetic
              data for demonstration only.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
