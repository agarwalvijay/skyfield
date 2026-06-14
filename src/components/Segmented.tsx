import { motion } from "motion/react";

interface Option<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  id,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  id: string;
}) {
  return (
    <div className="seg">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} className="seg-btn" data-active={active} onClick={() => onChange(o.value)}>
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="seg-pill"
                transition={{ type: "spring", stiffness: 460, damping: 36 }}
              />
            )}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
