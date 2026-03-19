import { labelCls } from '../lib/ui';

interface Props {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}

export default function FormField({ label, children, error, required }: Props) {
  return (
    <div>
      <label className={labelCls}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
