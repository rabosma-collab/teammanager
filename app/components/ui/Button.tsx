import React from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

// Canonieke knopstijlen voor de hele app. Breedte/flex/afronding kan via className worden overschreven.
const variantClasses: Record<Variant, string> = {
  primary: 'bg-green-600 hover:bg-green-700 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`px-4 py-2 rounded font-bold text-sm transition disabled:opacity-50 ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  );
}
