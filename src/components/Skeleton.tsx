import React from 'react';

type SkeletonProps = {
  className?: string;
};

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return <div className={`animate-pulse rounded-xl bg-gray-200/80 dark:bg-gray-800/80 ${className}`} />;
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="h-full bg-white dark:bg-gray-950 flex flex-col overflow-hidden transition-colors">
      <div className="shrink-0 px-6 pt-8">
        <header className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-40 rounded-2xl" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </header>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] space-y-10">
        <Skeleton className="h-56 w-full rounded-[32px]" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-56 w-full rounded-[32px]" />
        </div>
      </div>
    </div>
  );
};

export const HistorySkeleton: React.FC = () => {
  return (
    <div className="h-full bg-white dark:bg-gray-950 flex flex-col overflow-hidden transition-colors">
      <div className="shrink-0 px-6 pt-8">
        <header className="flex justify-between items-center mb-8">
          <Skeleton className="h-10 w-36 rounded-2xl" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </header>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-[calc(7.5rem+env(safe-area-inset-bottom))] space-y-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
};

export default Skeleton;
