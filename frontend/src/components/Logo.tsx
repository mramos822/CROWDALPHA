import { useState } from 'react';

interface LogoProps {
  symbol: string;
  companyName?: string;
  size?: number;
  className?: string;
  fallbackText?: string;
  lazy?: boolean;
  theme?: 'light' | 'dark' | 'auto';
}

export default function Logo({ 
  symbol, 
  size = 40, 
  className = '', 
  fallbackText
}: LogoProps) {
  const [imageError, setImageError] = useState(false);
  const displayText = fallbackText || symbol.charAt(0);
  
  // Try to load logo from a logo service
  const logoUrl = `https://storage.googleapis.com/iex/api/logos/${symbol}.png`;
  
  return (
    <div 
      className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ width: size, height: size }}
    >
      {imageError ? (
        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-400">
          {displayText}
        </div>
      ) : (
        <img
          src={logoUrl}
          alt={`${symbol} logo`}
          className="w-full h-full object-contain"
          onError={() => setImageError(true)}
        />
      )}
    </div>
  );
}

