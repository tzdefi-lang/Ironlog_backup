import React from 'react';
import { BODY_PART_OPTIONS } from '@/constants';

interface CategoryPickerProps {
  value: string;
  onChange: (v: string) => void;
}

const CategoryPicker: React.FC<CategoryPickerProps> = ({ value, onChange }) => {
  return (
    <div className="mb-4">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category</div>
      <div className="flex flex-wrap gap-2">
        {BODY_PART_OPTIONS.map((opt) => {
          const isActive = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                isActive ? 'bg-amber-400 text-gray-900' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryPicker;
