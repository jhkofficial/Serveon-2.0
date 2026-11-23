import React, { useState } from 'react';
import { Users, Shield, Plus, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import { USER_PERSONAS } from '../../core/permissions/rbac';
import type { UserRoleId } from '../../types/platform';

export function UserRoleManagementWorkspace() {
  const {
    activeTenant,
    persona,
    tenantUsers,
    sessions,
    addEnterpriseUser,
    toggleEnterpriseUserStatus,
    revokeSession,
  } = usePlatform();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<UserRoleId>('business_analyst');
  const [buScope, setBuScope] = useState('All Business Units');
  const [regionScope, setRegionScope] = useState(`All ${activeTenant.primaryProvinceName}`);
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const isPlatformAdmin = persona.permissions.includes('admin.manage_tenants');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addEnterpriseUser({
      name,
      email,
      roleId,
      businessUnitScope: buScope,
      regionScope,
      mfaEnabled,
    });
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      setName('');
      setEmail('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Enterprise Administration · Identity, Roles &amp; Scope ({activeTenant.shortName})
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
          User &amp; Role Management
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage tenant user accounts, inspect the 8-role RBAC permission matrix, and review active
          demonstration sessions.
        </p>
      </div>

      {/* Honest Demo Auth Disclosure */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div>
          <span className="font-semibold">Demo Simulation Mode:</span> User records and role
          switching are stored in local browser state for multi-persona demonstration. Production
          deployment requires enterprise SSO (OIDC/SAML), MFA enforcement at the identity provider,
          and backend JWT validation on every API request.
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
            feedback.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Tenant User Directory + Provision Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1769AA]" />
              <h2 className="font-display text-base font-semibold text-[#102B4D]">
                Tenant Users ({tenantUsers.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">Scoped to {activeTenant.name}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Data Scope</th>
                  <th className="px-4 py-3">MFA / Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenantUsers.map((usr) => {
                  const roleMeta = USER_PERSONAS.find((p) => p.id === usr.roleId);
                  return (
                    <tr key={usr.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{usr.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{usr.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {roleMeta?.title ?? usr.roleId}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        <div>{usr.businessUnitScope}</div>
                        <div className="text-slate-500">{usr.regionScope}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                              usr.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700'
                                : usr.status === 'Suspended'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-sky-50 text-sky-700'
                            }`}
                          >
                            {usr.status}
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {usr.mfaEnabled ? 'MFA On' : 'MFA Off'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const res = toggleEnterpriseUserStatus(usr.id);
                            setFeedback({ ok: res.ok, text: res.message });
                          }}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {usr.status === 'Suspended' ? 'Reactivate' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Tenant User Form */}
        <form
          onSubmit={handleAddUser}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3.5 lg:col-span-4"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#1769AA]" />
            <h2 className="font-display text-sm font-bold text-[#102B4D]">
              Provision Tenant User
            </h2>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arif Nugroho"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Work Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="arif.nugroho@tenant.demo"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Assigned RBAC Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value as UserRoleId)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              {USER_PERSONAS.filter(
                (p) => isPlatformAdmin || p.id !== 'platform_super_admin'
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.scopeLevel})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Business Unit Scope</label>
            <select
              value={buScope}
              onChange={(e) => setBuScope(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value="All Business Units">All Business Units</option>
              {activeTenant.businessUnits.map((bu) => (
                <option key={bu.id} value={bu.name}>
                  {bu.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Regional Scope</label>
            <select
              value={regionScope}
              onChange={(e) => setRegionScope(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            >
              <option value={`All ${activeTenant.primaryProvinceName}`}>
                All {activeTenant.primaryProvinceName}
              </option>
              {activeTenant.province.regencies.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={mfaEnabled}
              onChange={(e) => setMfaEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#1769AA]"
            />
            <span>Require MFA on first sign-in</span>
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
          >
            Add User Account
          </button>
        </form>
      </div>

      {/* 8-Role RBAC Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Shield className="h-4 w-4 text-[#16A6BD]" />
          <h2 className="font-display text-base font-semibold text-[#102B4D]">
            Enterprise RBAC Role &amp; Permission Matrix (8 Roles)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-3 py-2.5">Scope</th>
                <th className="px-3 py-2.5 text-center">Tenants (Platform)</th>
                <th className="px-3 py-2.5 text-center">Modules &amp; Industry</th>
                <th className="px-3 py-2.5 text-center">Campaign Approve</th>
                <th className="px-3 py-2.5 text-center">AI &amp; Predictive</th>
                <th className="px-3 py-2.5 text-center">Customer 360</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {USER_PERSONAS.map((role) => (
                <tr key={role.id} className={role.id === persona.id ? 'bg-sky-50/60' : ''}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">{role.title}</div>
                    <div className="text-[11px] text-slate-500">{role.department}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] uppercase text-slate-600">
                    {role.scopeLevel}
                  </td>
                  {[
                    role.permissions.includes('admin.manage_tenants'),
                    role.permissions.includes('admin.manage_modules'),
                    role.permissions.includes('campaigns.approve'),
                    role.permissions.includes('predictive.view'),
                    role.permissions.includes('customers.view_detail'),
                  ].map((allowed, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      {allowed ? (
                        <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="mx-auto h-4 w-4 text-slate-300" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Management */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[#102B4D]">
            Session Management (Simulated Sessions)
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-900">
                  {sess.userName} · <span className="text-[#1769AA]">{sess.roleTitle}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {sess.authContext} · Started {sess.startedAt} · {sess.scopeSummary}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    sess.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {sess.status}
                </span>
                {sess.status === 'Active' && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = revokeSession(sess.id);
                      setFeedback({ ok: res.ok, text: res.message });
                    }}
                    className="rounded border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    Revoke Session
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
