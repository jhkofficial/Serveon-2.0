import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  metaItems?: string[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, metaItems, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {metaItems && metaItems.length > 0 && (
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            {metaItems.map((item, idx) => (
              <React.Fragment key={item}>
                {idx > 0 && <span aria-hidden="true">·</span>}
                <span>{item}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}
