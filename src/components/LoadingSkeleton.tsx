import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton = ({ width = '100%', height = '1em', borderRadius = 'var(--radius-sm)', className = '', style = {} }: SkeletonProps) => {
  return (
    <div 
      className={`skeleton-base ${className}`}
      style={{ 
        width, 
        height, 
        borderRadius,
        background: 'linear-gradient(90deg, var(--border-light) 25%, var(--surface-alt) 50%, var(--border-light) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-loading 1.5s infinite linear',
        ...style
      }} 
    />
  );
};

export const RideEstimateSkeleton = () => (
  <div className="skeleton-ride-item" style={{ padding: '16px 0', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <Skeleton width="48px" height="48px" borderRadius="12px" />
    <div style={{ flex: 1 }}>
      <Skeleton width="60%" height="1.2em" borderRadius="4px" />
      <Skeleton width="40%" height="0.8em" borderRadius="4px" className="mt-2" style={{ marginTop: '8px' }} />
    </div>
    <Skeleton width="50px" height="1.5em" borderRadius="8px" />
  </div>
);

export const DriverCardSkeleton = () => (
  <div className="skeleton-driver-card" style={{ padding: '20px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-md)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
    <Skeleton width="48px" height="48px" borderRadius="50%" />
    <div style={{ flex: 1 }}>
      <Skeleton width="70%" height="1.2em" borderRadius="4px" />
      <Skeleton width="50%" height="0.8em" borderRadius="4px" style={{ marginTop: '8px' }} />
    </div>
  </div>
);
