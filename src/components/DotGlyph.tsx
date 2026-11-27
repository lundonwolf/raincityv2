interface DotGlyphProps {
  size?: number;
  color?: string;
  accentColor?: string;
  className?: string;
}

/**
 * Concentric dot-matrix medallion inspired by Nothing OS dot geometry.
 */
export function DotGlyph({
  size = 56,
  color = 'currentColor',
  accentColor = '#E8452C',
  className = '',
}: DotGlyphProps) {
  const rings = [
    { r: 0, count: 1, dotR: 2.2 },
    { r: 8, count: 8, dotR: 1.8 },
    { r: 16, count: 14, dotR: 1.7 },
    { r: 24, count: 20, dotR: 1.5 },
  ];

  const dots: { cx: number; cy: number; r: number; isAccent: boolean }[] = [];
  rings.forEach((ring, ringIdx) => {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 - Math.PI / 2;
      dots.push({
        cx: 28 + Math.cos(angle) * ring.r,
        cy: 28 + Math.sin(angle) * ring.r,
        r: ring.dotR,
        isAccent: ringIdx === 0 || (ringIdx === 3 && i === 0),
      });
    }
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {dots.map((dot, idx) => (
        <circle
          key={idx}
          cx={dot.cx.toFixed(2)}
          cy={dot.cy.toFixed(2)}
          r={dot.r}
          fill={dot.isAccent ? accentColor : color}
        />
      ))}
    </svg>
  );
}
