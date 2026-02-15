import React from 'react';
import { Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Portal from '@/components/Portal';
import { useI18n } from '@/i18n/useI18n';

const FloatingAddButton: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();

  if (location.pathname !== '/') return null;

  return (
    <Portal>
      <div className="fixed left-1/2 -translate-x-1/2 z-[9999] bottom-[calc(5.2rem+env(safe-area-inset-bottom))]">
        <button
          onClick={() => navigate('/workout/new')}
          data-testid="fab-add-workout"
          className="pressable float-glow w-14 h-14 bg-brand text-gray-900 rounded-full border border-brand shadow-xl shadow-brand-soft flex items-center justify-center hover:brightness-95 active:scale-90 transition-all"
          aria-label={t('fab.addWorkout')}
          title={t('fab.addWorkout')}
        >
          <Plus size={28} />
        </button>
      </div>
    </Portal>
  );
};

export default FloatingAddButton;
