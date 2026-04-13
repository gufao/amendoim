import { useState, useRef, useEffect } from "react";

interface Props {
  value: unknown;
  onSave: (newValue: unknown) => void;
  onCancel: () => void;
  onTab: () => void;
}

export function InlineEdit({ value, onSave, onCancel, onTab }: Props) {
  const raw = value === null || value === undefined
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  const [editValue, setEditValue] = useState(raw);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const newValue = editValue === "" ? null : editValue;
    onSave(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Tab") {
      e.preventDefault();
      handleSave();
      onTab();
    }
  };

  return (
    <input
      ref={inputRef}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleSave}
      className="w-full bg-bg-primary border-[1.5px] border-accent rounded px-2 py-[3px] text-xs text-text-primary outline-none shadow-[0_0_0_2px_rgba(194,149,106,0.15)]"
    />
  );
}
