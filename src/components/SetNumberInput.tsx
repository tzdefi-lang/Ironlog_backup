import React, { useEffect, useRef, useState } from 'react';

interface SetNumberInputProps {
  value: number;
  onValueChange: (v: number) => void;
  inputMode?: 'numeric' | 'decimal';
  className?: string;
}

const SetNumberInput: React.FC<SetNumberInputProps> = ({
  value,
  onValueChange,
  inputMode = 'decimal',
  className = '',
}) => {
  const [text, setText] = useState<string>(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const commit = () => {
    const t = text.trim();
    const n = t === '' ? 0 : Number(t);
    const v = Number.isFinite(n) ? n : 0;
    setText(String(v));
    onValueChange(v);
  };

  return (
    <input
      type="text"
      inputMode={inputMode}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        if (text === '0') setText('');
        requestAnimationFrame(() => e.currentTarget.select());
      }}
      onClick={(e) => {
        requestAnimationFrame(() => e.currentTarget.select());
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const trimmed = t.trim();
        if (trimmed === '') return;
        const n = Number(trimmed);
        if (Number.isFinite(n)) onValueChange(n);
      }}
      className={className}
    />
  );
};

export default React.memo(SetNumberInput);
