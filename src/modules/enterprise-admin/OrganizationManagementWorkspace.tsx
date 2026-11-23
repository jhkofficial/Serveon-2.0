import React, { useState } from 'react';
import { GitBranch, Building2, MapPin, Plus, Layers } from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';

export function OrganizationManagementWorkspace() {
  const { activeTenant, activeIndustry, addBusinessUnit, addBranch } = usePlatform();

  const [buName, setBuName] = useState('');
  const [buCode, setBuCode] = useState('');

  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchBuId, setBranchBuId] = useState(activeTenant.businessUnits[0]?.id ?? '');
  const [branchRegionId, setBranchRegionId] = useState(
    activeTenant.province.regencies[0]?.id ?? ''
  );
  const [branchCity, setBranchCity] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleAddBu = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addBusinessUnit(buName, buCode);
    setFeedback(res.message);
    if (res.ok) {
      setBuName('');
      setBuCode('');
    }
  };

  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    const res = addBranch({
      name: branchName,
      code: branchCode,
      businessUnitId: branchBuId || activeTenant.businessUnits[0]?.id || '',
      regionId: branchRegionId || activeTenant.province.regencies[0]?.id || '',
      city: branchCity,
    });
    setFeedback(res.message);
    if (res.ok) {
      setBranchName('');
      setBranchCode('');
      setBranchCity('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
          Enterprise Administration · Tenant-Scoped Organizational Hierarchy
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
          Organization Management — {activeTenant.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure the structural hierarchy from SERVEON Platform through Tenant, Business Units,
          Regions, and {activeIndustry.terminology.branchSingular} operational units.
        </p>
      </div>

      {feedback && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-medium text-sky-900">
          {feedback}
        </div>
      )}

      {/* Visual Hierarchy Tree */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-[#1769AA]" />
            <h2 className="font-display text-base font-semibold text-[#102B4D]">
              Active Enterprise Hierarchy Tree
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500">
            1 Platform · 1 Tenant · {activeTenant.businessUnits.length} Business Units ·{' '}
            {activeTenant.province.regencies.length} Regions · {activeTenant.branches.length}{' '}
            Operational Units
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {/* Root Platform & Tenant Nodes */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-[#102B4D] px-3 py-1.5 font-semibold text-white">
              SERVEON Core Platform
            </span>
            <span className="text-slate-400">→</span>
            <span className="rounded-md bg-[#1769AA] px-3 py-1.5 font-semibold text-white">
              Tenant: {activeTenant.name} ({activeTenant.code})
            </span>
            <span className="text-slate-400">→</span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
              Province: {activeTenant.primaryProvinceName}
            </span>
          </div>

          {/* Business Units & Mapped Branches */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {activeTenant.businessUnits.map((bu) => {
              const buBranches = activeTenant.branches.filter(
                (b) => b.business_unit_id === bu.id
              );
              return (
                <div key={bu.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#16A6BD]" />
                      <span className="font-display text-sm font-bold text-[#102B4D]">
                        {bu.name}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-slate-500">
                      {bu.code} · {buBranches.length} Units
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {buBranches.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
                        No operational branches assigned yet.
                      </div>
                    ) : (
                      buBranches.map((br) => {
                        const reg = activeTenant.province.regencies.find(
                          (r) => r.id === br.region_id
                        );
                        return (
                          <div
                            key={br.id}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5 text-[#1769AA]" />
                              <div>
                                <div className="font-semibold text-slate-900">{br.name}</div>
                                <div className="text-[11px] text-slate-500">
                                  Region: {reg?.name ?? br.type}
                                </div>
                              </div>
                            </div>
                            <div className="text-right font-mono text-[11px] text-slate-500">
                              <div>{br.code}</div>
                              <div className="text-[10px]">
                                {br.lat.toFixed(2)}, {br.lng.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Business Unit & Add Branch Forms */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleAddBu}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#1769AA]" />
            <h3 className="font-display text-sm font-bold text-[#102B4D]">
              Add Business Unit ({activeTenant.shortName})
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Business Unit Name</label>
              <input
                type="text"
                value={buName}
                onChange={(e) => setBuName(e.target.value)}
                placeholder="e.g. Digital Direct Commerce"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Unit Code</label>
              <input
                type="text"
                value={buCode}
                onChange={(e) => setBuCode(e.target.value.toUpperCase())}
                placeholder="e.g. DDC"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs uppercase"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
          >
            Create Business Unit
          </button>
        </form>

        <form
          onSubmit={handleAddBranch}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#16A6BD]" />
            <h3 className="font-display text-sm font-bold text-[#102B4D]">
              Add {activeIndustry.terminology.branchSingular} / Operational Unit
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Unit Name</label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder={`e.g. ${activeTenant.shortName} East Hub`}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Unit Code</label>
              <input
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                placeholder="e.g. HUB-09"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Business Unit</label>
              <select
                value={branchBuId || activeTenant.businessUnits[0]?.id || ''}
                onChange={(e) => setBranchBuId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
              >
                {activeTenant.businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>
                    {bu.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Territory / Regency
              </label>
              <select
                value={branchRegionId || activeTenant.province.regencies[0]?.id || ''}
                onChange={(e) => setBranchRegionId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs"
              >
                {activeTenant.province.regencies.map((reg) => (
                  <option key={reg.id} value={reg.id}>
                    {reg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[#1769AA] px-4 py-2 text-xs font-semibold text-white hover:bg-[#102B4D]"
          >
            Add Operational Unit
          </button>
        </form>
      </div>
    </div>
  );
}
