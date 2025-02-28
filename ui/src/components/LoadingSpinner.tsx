'use client';

import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  white?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', white = false }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const colorClass = white ? 'text-white' : 'text-purple-600';

  return (
    <div className="flex justify-center items-center">
      <div className={`animate-spin rounded-full border-2 border-t-transparent ${colorClass} ${sizeClasses[size]}`}></div>
    </div>
  );
};

export default LoadingSpinner; 