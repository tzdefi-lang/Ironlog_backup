import React, { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ui';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & { resolve: (confirmed: boolean) => void };

export const useConfirm = () => {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const dialog = useMemo(() => {
    if (!pending) return null;

    return (
      <ConfirmDialog
        isOpen={true}
        title={pending.title}
        message={pending.message}
        confirmText={pending.confirmText}
        cancelText={pending.cancelText}
        danger={pending.danger}
        onConfirm={() => {
          pending.resolve(true);
          setPending(null);
        }}
        onCancel={() => {
          pending.resolve(false);
          setPending(null);
        }}
      />
    );
  }, [pending]);

  return { confirm, confirmDialog: dialog };
};
