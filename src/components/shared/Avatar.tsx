import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getFileUrl } from '@/lib/api';

interface AvatarProps {
  initials?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bg?: string;
  className?: string;
  src?: string;
}

const sizeMap = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-9 h-9 text-xs',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-24 h-24 text-3xl',
};

const defaultColors = [
  'bg-blue-600',
  'bg-indigo-600',
  'bg-purple-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600',
];

export function Avatar({ initials, name, size = 'md', bg = 'bg-blue-500', className, src }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  let displayInitials = initials?.trim();
  if (!displayInitials && name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      displayInitials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 0) {
      displayInitials = parts[0][0].toUpperCase();
    }
  }
  if (!displayInitials) displayInitials = 'U';

  let bgColor = bg;
  if (!bgColor) {
    const charCode = displayInitials.charCodeAt(0) || 0;
    bgColor = defaultColors[charCode % defaultColors.length];
  }

  const finalSrc = src && !imgError ? (src.startsWith('data:') || src.startsWith('http') ? src : getFileUrl(src)) : null;

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none overflow-hidden shadow-sm',
        sizeMap[size],
        bgColor,
        className
      )}
    >
      {finalSrc ? (
        <img
          src={finalSrc}
          alt={name || "avatar"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        displayInitials
      )}
    </div>
  );
}
