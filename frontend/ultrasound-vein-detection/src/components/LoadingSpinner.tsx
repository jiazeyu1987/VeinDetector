import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'white' | 'gray';
  text?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const colorClasses = {
  blue: 'border-blue-500',
  white: 'border-white',
  gray: 'border-gray-500',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'blue',
  text,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center space-y-2 ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          border-2
          ${colorClasses[color]}
          border-t-transparent
          rounded-full
          animate-spin
        `}
      />
      {text && (
        <div className="text-sm text-gray-400 animate-pulse">
          {text}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;