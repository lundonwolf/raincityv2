import { useState } from 'react';
import { Wrench } from 'lucide-react';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = '', fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center bg-[#141418] text-[#A1A1AA] border border-white/10 ${className}`}
      >
        <Wrench className="w-7 h-7 mb-2 text-[#E8452C]" aria-hidden="true" />
        <span className="font-mono text-xs tracking-wide">{fallbackTitle ?? alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
