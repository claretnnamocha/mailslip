export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-[27px] font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 text-[15px] text-text-2">{description}</p>
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">{children}</div>
    </div>
  );
}
