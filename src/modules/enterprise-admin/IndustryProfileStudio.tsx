import React, { useMemo, useState } from 'react';
import {
  Layers,
  Copy,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Trash2,
  Plus,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { usePlatform } from '../../core/state/PlatformContext';
import type { ManagedIndustryProfile, CanonicalEntityName } from '../../types/mvp4';
import { validateIndustryProfileSchema } from '../../core/enterprise/mvp4Engine';

const CANONICAL_ENTITIES: CanonicalEntityName[] = [
  'Tenant',
  'Organization',
  'User',
  'Customer',
  'Product',
  'Transaction',
  'Interaction',
  'Location',
  'Campaign',
  'BusinessEvent',
];

export function IndustryProfileStudio() {
  const {
    industryProfiles,
    activeTenant,
    activeManagedIndustryProfile,
    saveIndustryProfileDraft,
    createIndustryProfileVersion,
    cloneIndustryProfile,
    publishIndustryProfile,
    archiveIndustryProfile,
    deleteIndustryProfile,
    setIndustryOverride,
  } = usePlatform();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    activeManagedIndustryProfile.profileId
  );
  const [editorDraft, setEditorDraft] = useState<ManagedIndustryProfile | null>(null);
  const [newExtKey, setNewExtKey] = useState('');
  const [newExtLabel, setNewExtLabel] = useState('');
  const [newExtEntity, setNewExtEntity] = useState<CanonicalEntityName>('Customer');
  const [newExtType, setNewExtType] = useState<'string' | 'number' | 'date'>('string');
  const [newKpiLabel, setNewKpiLabel] = useState('');
  const [newKpiFormula, setNewKpiFormula] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedProfile = useMemo(
    () =>
      industryProfiles.find((p) => p.profileId === selectedProfileId) ?? industryProfiles[0],
    [industryProfiles, selectedProfileId]
  );

  const workingProfile =
    editorDraft && editorDraft.profileId === selectedProfile.profileId
      ? editorDraft
      : selectedProfile;

  const schemaReport = useMemo(
    () => validateIndustryProfileSchema(workingProfile),
    [workingProfile]
  );

  const isPublishedImmutable = workingProfile.lifecycleStatus === 'Published';

  const startEditing = (profile: ManagedIndustryProfile) => {
    setSelectedProfileId(profile.profileId);
    setEditorDraft(structuredClone(profile));
    setStatusMessage(null);
  };

  const handleCreateNextVersion = () => {
    const res = createIndustryProfileVersion(
      workingProfile.profileId,
      `Created editable Draft v${workingProfile.version + 1} from immutable v${workingProfile.version}`
    );
    setStatusMessage({ ok: res.ok, text: res.message });
    if (res.ok && res.profile) {
      setEditorDraft(structuredClone(res.profile));
    }
  };

  const handleClone = () => {
    const res = cloneIndustryProfile(
      workingProfile.profileId,
      cloneName.trim() || `${workingProfile.name} Enterprise Custom`
    );
    setStatusMessage({ ok: res.ok, text: res.message });
    if (res.ok && res.profile) {
      setSelectedProfileId(res.profile.profileId);
      setEditorDraft(structuredClone(res.profile));
      setCloneName('');
    }
  };

  const handleSaveDraft = () => {
    const res = saveIndustryProfileDraft(workingProfile);
    setStatusMessage({ ok: res.ok, text: res.message });
  };

  const handlePublish = () => {
    if (editorDraft) {
      const saved = saveIndustryProfileDraft(workingProfile);
      if (!saved.ok) {
        setStatusMessage({ ok: false, text: saved.message });
        return;
      }
    }
    const res = publishIndustryProfile(workingProfile.profileId);
    setStatusMessage({ ok: res.ok, text: res.message });
    if (res.ok) setEditorDraft(null);
  };

  const handleAddSchemaExtension = () => {
    if (isPublishedImmutable) return;
    if (!newExtKey.trim() || !newExtLabel.trim()) return;
    const next: ManagedIndustryProfile = {
      ...workingProfile,
      schemaExtensions: [
        ...workingProfile.schemaExtensions,
        {
          key: newExtKey.trim().toLowerCase().replace(/\s+/g, '_'),
          label: newExtLabel.trim(),
          dataType: newExtType,
          entity: newExtEntity,
          required: false,
          description: `Custom ${workingProfile.name} extension field on canonical ${newExtEntity}.`,
        },
      ],
    };
    setEditorDraft(next);
    setNewExtKey('');
    setNewExtLabel('');
  };

  const handleAddKpi = () => {
    if (isPublishedImmutable) return;
    if (!newKpiLabel.trim()) return;
    const next: ManagedIndustryProfile = {
      ...workingProfile,
      kpiDefinitions: [
        ...workingProfile.kpiDefinitions,
        {
          key: `kpi_custom_${Date.now().toString().slice(-4)}`,
          label: newKpiLabel.trim(),
          unit: '%',
          formulaDescription:
            newKpiFormula.trim() || 'Configured tenant metric computed from canonical transactions.',
          targetBenchmark: 'Configured per tenant',
        },
      ],
    };
    setEditorDraft(next);
    setNewKpiLabel('');
    setNewKpiFormula('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-slate-500">
            BM09 · Industry Extension Framework &amp; Visual Profile Builder
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[#102B4D]">
            Industry Profiles Studio
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Configure Automotive, Retail, Banking, Insurance, Property, and Healthcare via versioned
            configuration contracts on top of canonical entities — zero code duplication.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={cloneName}
            onChange={(e) => setCloneName(e.target.value)}
            placeholder="Custom profile name..."
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs"
          />
          <button
            type="button"
            onClick={handleClone}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1769AA] px-3.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Clone Profile</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs font-medium ${
            statusMessage.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Catalog List */}
        <div className="space-y-2.5 lg:col-span-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Managed Profiles ({industryProfiles.length})
          </div>
          {industryProfiles.map((prof) => {
            const isSelected = prof.profileId === workingProfile.profileId;
            const isAssignedToTenant = activeManagedIndustryProfile.profileId === prof.profileId;
            return (
              <button
                key={prof.profileId}
                type="button"
                onClick={() => startEditing(prof)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-[#1769AA] bg-sky-50/70'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-sm font-bold text-[#102B4D]">
                    {prof.name}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      prof.lifecycleStatus === 'Published'
                        ? 'bg-emerald-50 text-emerald-700'
                        : prof.lifecycleStatus === 'Draft'
                          ? 'bg-amber-50 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    v{prof.version} · {prof.lifecycleStatus}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{prof.description}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {prof.kpiDefinitions.length} KPIs · {prof.schemaExtensions.length} Extensions
                  </span>
                  {isAssignedToTenant && (
                    <span className="font-semibold text-[#1769AA]">Active on Tenant</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Visual Industry Profile Builder */}
        <div className="space-y-5 lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            {/* Builder Top Action Bar */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#1769AA]" />
                  <h2 className="font-display text-lg font-bold text-[#102B4D]">
                    {workingProfile.name}
                  </h2>
                  <span className="font-mono text-xs text-slate-500">
                    v{workingProfile.version} · {workingProfile.lifecycleStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Profile ID: <span className="font-mono">{workingProfile.profileId}</span> · Base:{' '}
                  {workingProfile.baseIndustryId} · Updated {workingProfile.updatedAt}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isPublishedImmutable ? (
                  <button
                    type="button"
                    onClick={handleCreateNextVersion}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1769AA] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#102B4D]"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Create v{workingProfile.version + 1} Draft</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePublish}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Validate &amp; Publish v{workingProfile.version}</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setIndustryOverride(workingProfile.baseIndustryId, workingProfile.profileId)
                  }
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#1769AA] hover:bg-sky-100"
                >
                  Apply to {activeTenant.shortName}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const res = archiveIndustryProfile(workingProfile.profileId);
                    setStatusMessage({ ok: res.ok, text: res.message });
                  }}
                  title="Archive profile"
                  className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const res = deleteIndustryProfile(workingProfile.profileId);
                    setStatusMessage({ ok: res.ok, text: res.message });
                  }}
                  title="Delete profile (blocked if referenced by active tenants)"
                  className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {isPublishedImmutable && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" />
                <span>
                  Published version v{workingProfile.version} is immutable for tenant audit
                  integrity. Click{' '}
                  <span className="font-semibold">Create v{workingProfile.version + 1} Draft</span>{' '}
                  to modify terminology, KPIs, or schema extensions safely.
                </span>
              </div>
            )}

            {/* Schema Compatibility Validator Summary */}
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-slate-800">
                  {schemaReport.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                  )}
                  <span>
                    Canonical Schema Compatibility:{' '}
                    {schemaReport.valid ? 'Passed' : `${schemaReport.errors.length} Blocking Error(s)`}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  {schemaReport.checkedEntities} Entities · {schemaReport.extensionFieldCount}{' '}
                  Extensions · {schemaReport.warnings.length} Warnings
                </span>
              </div>
              {schemaReport.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-rose-700">
                  {schemaReport.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {schemaReport.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-amber-700">
                  {schemaReport.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Domain Terminology & Profile Metadata */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Customer Plural Label
                </label>
                <input
                  type="text"
                  disabled={isPublishedImmutable}
                  value={workingProfile.terminology.customerPlural}
                  onChange={(e) =>
                    setEditorDraft({
                      ...workingProfile,
                      terminology: {
                        ...workingProfile.terminology,
                        customerPlural: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Product / Offering Label
                </label>
                <input
                  type="text"
                  disabled={isPublishedImmutable}
                  value={workingProfile.terminology.productSingular}
                  onChange={(e) =>
                    setEditorDraft({
                      ...workingProfile,
                      terminology: {
                        ...workingProfile.terminology,
                        productSingular: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Primary Revenue Metric Label
                </label>
                <input
                  type="text"
                  disabled={isPublishedImmutable}
                  value={workingProfile.terminology.primaryRevenueLabel}
                  onChange={(e) =>
                    setEditorDraft({
                      ...workingProfile,
                      terminology: {
                        ...workingProfile.terminology,
                        primaryRevenueLabel: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Branch / Operational Unit Label
                </label>
                <input
                  type="text"
                  disabled={isPublishedImmutable}
                  value={workingProfile.terminology.branchSingular}
                  onChange={(e) =>
                    setEditorDraft({
                      ...workingProfile,
                      terminology: {
                        ...workingProfile.terminology,
                        branchSingular: e.target.value,
                      },
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:bg-slate-50"
                />
              </div>
            </div>

            {/* Schema Extensions on Canonical Entities */}
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-display text-sm font-bold text-[#102B4D]">
                Canonical Schema Extensions ({workingProfile.schemaExtensions.length})
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Supported canonical entities: {workingProfile.supportedEntities.join(', ')}
              </p>

              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Extension Key</th>
                      <th className="px-3 py-2">Label</th>
                      <th className="px-3 py-2">Canonical Entity</th>
                      <th className="px-3 py-2">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workingProfile.schemaExtensions.map((ext) => (
                      <tr key={ext.key}>
                        <td className="px-3 py-2 font-mono text-[11px] text-[#1769AA]">
                          {ext.key}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">{ext.label}</td>
                        <td className="px-3 py-2 text-slate-600">{ext.entity}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                          {ext.dataType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!isPublishedImmutable && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <input
                    type="text"
                    value={newExtKey}
                    onChange={(e) => setNewExtKey(e.target.value)}
                    placeholder="snake_case_key"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-xs sm:col-span-3"
                  />
                  <input
                    type="text"
                    value={newExtLabel}
                    onChange={(e) => setNewExtLabel(e.target.value)}
                    placeholder="Field Display Label"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs sm:col-span-4"
                  />
                  <select
                    value={newExtEntity}
                    onChange={(e) => setNewExtEntity(e.target.value as CanonicalEntityName)}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-2"
                  >
                    {CANONICAL_ENTITIES.map((ent) => (
                      <option key={ent} value={ent}>
                        {ent}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newExtType}
                    onChange={(e) => setNewExtType(e.target.value as 'string' | 'number' | 'date')}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs sm:col-span-1"
                  >
                    <option value="string">str</option>
                    <option value="number">num</option>
                    <option value="date">date</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddSchemaExtension}
                    className="inline-flex items-center justify-center gap-1 rounded-md bg-[#102B4D] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1769AA] sm:col-span-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              )}
            </div>

            {/* KPI Definitions */}
            <div className="mt-6 border-t border-slate-200 pt-5">
              <h3 className="font-display text-sm font-bold text-[#102B4D]">
                Configured KPI Definitions ({workingProfile.kpiDefinitions.length})
              </h3>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {workingProfile.kpiDefinitions.map((kpi) => (
                  <div
                    key={kpi.key}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="font-semibold text-slate-900">
                      {kpi.label} <span className="font-mono text-slate-500">({kpi.unit})</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-600">
                      {kpi.formulaDescription}
                    </div>
                  </div>
                ))}
              </div>
              {!isPublishedImmutable && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <input
                    type="text"
                    value={newKpiLabel}
                    onChange={(e) => setNewKpiLabel(e.target.value)}
                    placeholder="New KPI Name (e.g. Repeat Purchase Rate)"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs sm:col-span-5"
                  />
                  <input
                    type="text"
                    value={newKpiFormula}
                    onChange={(e) => setNewKpiFormula(e.target.value)}
                    placeholder="Formula / calculation note..."
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs sm:col-span-5"
                  />
                  <button
                    type="button"
                    onClick={handleAddKpi}
                    className="inline-flex items-center justify-center gap-1 rounded-md bg-[#102B4D] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1769AA] sm:col-span-2"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add KPI</span>
                  </button>
                </div>
              )}
            </div>

            {/* Version History & Governance Access Notes */}
            <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 md:grid-cols-2">
              <div>
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-600">
                  Version History &amp; Rollback Reference
                </h3>
                <div className="mt-2 space-y-2">
                  {workingProfile.versionHistory.map((vh, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>
                          v{vh.version} ({vh.status})
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {vh.publishedAt}
                        </span>
                      </div>
                      <div className="mt-0.5 text-slate-600">{vh.changeSummary}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-600">
                  Industry Governance &amp; Access Controls
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-600">
                  {workingProfile.accessRequirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
