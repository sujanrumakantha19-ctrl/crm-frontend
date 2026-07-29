interface NameTagProps {
  name?: string;
  displayId?: string;
  className?: string;
}

export function NameTag({ name, displayId, className }: NameTagProps) {
  if (!name && !displayId) return null;
  return (
    <span className={className}>
      {name}{displayId ? ` [${displayId}]` : ''}
    </span>
  );
}
