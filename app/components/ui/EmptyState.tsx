import React from 'react';

interface EmptyStateProps {
  children: React.ReactNode;
  className?: string;
}

// Uniforme lege-staat: gecentreerde, gedempte tekst.
export default function EmptyState({ children, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-8 text-gray-400 text-sm ${className}`}>
      {children}
    </div>
  );
}
