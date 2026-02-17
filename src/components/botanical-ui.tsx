import React from 'react';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
};

export const ScreenShell: React.FC<ScreenShellProps> = ({
  title,
  subtitle,
  leading,
  trailing,
  children,
  className = '',
  contentClassName = '',
  headerClassName = '',
}) => {
  return (
    <div
      className={`h-full bg-[var(--surface-card)] dark:bg-[var(--surface-card)] flex flex-col overflow-hidden view-enter transition-colors ${className}`}
    >
      <div className={`shrink-0 px-6 pt-8 ${headerClassName}`}>
        <header className="flex justify-between items-center mb-8 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 min-w-0">
              {leading}
              <h1 className="text-4xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate display-serif">
                {title}
              </h1>
            </div>
            {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          {trailing}
        </header>
      </div>
      <div
        className={`flex-1 overflow-y-auto scroll-area px-6 pb-[calc(8.4rem+env(safe-area-inset-bottom))] ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
};

type SurfaceCardProps = {
  children: React.ReactNode;
  className?: string;
  tone?: 'paper' | 'muted' | 'accent' | 'emphasis';
  interactive?: boolean;
  archTop?: boolean;
};

export const SurfaceCard: React.FC<SurfaceCardProps> = ({
  children,
  className = '',
  tone = 'paper',
  interactive = false,
  archTop = false,
}) => {
  const toneClass: Record<NonNullable<SurfaceCardProps['tone']>, string> = {
    paper: 'bg-[var(--surface-card)] border border-[var(--surface-border)]',
    muted: 'bg-[var(--surface-muted)] border border-transparent',
    accent: 'bg-amber-100/70 border border-amber-200/70',
    emphasis: 'bg-red-50 border border-red-100',
  };

  const interactiveClass = interactive
    ? 'cursor-pointer active:scale-[0.98] transition-all duration-500 ease-out'
    : '';

  return (
    <section
      className={`rounded-3xl ${archTop ? 'rounded-t-[40px]' : ''} ${toneClass[tone]} shadow-[var(--surface-shadow)] ${interactiveClass} ${className}`}
    >
      {children}
    </section>
  );
};

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  className?: string;
};

export const SectionTitle: React.FC<SectionTitleProps> = ({ title, subtitle, className = '' }) => {
  return (
    <div className={`mb-3 ${className}`}>
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-[0.16em]">{title}</h2>
      {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
};

type FilterChipProps = {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export const FilterChip: React.FC<FilterChipProps> = ({
  children,
  active = false,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-500 ease-out active:scale-[0.98] ${
        active
          ? 'bg-amber-400 text-gray-900 shadow-[var(--surface-shadow)]'
          : 'bg-[var(--surface-muted)] text-gray-600 dark:text-gray-300 border border-[var(--surface-border)]'
      } ${className}`}
    >
      {children}
    </button>
  );
};

type DataMetricCardProps = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  className?: string;
};

export const DataMetricCard: React.FC<DataMetricCardProps> = ({
  label,
  value,
  valueClassName = '',
  className = '',
}) => {
  return (
    <SurfaceCard tone="muted" className={`p-4 ${className}`}>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-[0.18em]">{label}</p>
      <div className={`mt-2 text-4xl font-semibold leading-none text-gray-900 dark:text-gray-100 display-serif ${valueClassName}`}>
        {value}
      </div>
    </SurfaceCard>
  );
};
