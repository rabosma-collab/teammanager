import React from 'react';

interface SpinnerProps {
  className?: string;
  'aria-label'?: string;
}

// Uniforme laad-spinner.
export default function Spinner({ className = 'w-6 h-6', 'aria-label': ariaLabel = 'Laden' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={`inline-block border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin ${className}`}
    />
  );
}
