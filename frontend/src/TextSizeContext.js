import React, { createContext, useContext, useState, useEffect } from 'react';

const TextSizeContext = createContext();

export const useTextSize = () => {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error('useTextSize must be used within TextSizeProvider');
  }
  return context;
};

export const TextSizeProvider = ({ children }) => {
  // Initialize from localStorage or default to 100%
  const [textSizeScale, setTextSizeScale] = useState(() => {
    const saved = localStorage.getItem('textSizeScale');
    return saved ? parseFloat(saved) : 100;
  });

  // Persist to localStorage and apply scaling whenever it changes
  useEffect(() => {
    localStorage.setItem('textSizeScale', textSizeScale.toString());
    
    // Scale the root font-size (16px base * scale factor)
    // This will scale all rem-based font sizes proportionally
    document.documentElement.style.fontSize = `${(16 * textSizeScale) / 100}px`;
  }, [textSizeScale]);

  const updateTextSize = (scale) => {
    // Clamp between 80% and 120%
    const clampedScale = Math.min(Math.max(scale, 80), 120);
    setTextSizeScale(clampedScale);
  };

  const resetTextSize = () => {
    setTextSizeScale(100);
  };

  return (
    <TextSizeContext.Provider value={{ 
      textSizeScale, 
      updateTextSize, 
      resetTextSize 
    }}>
      {children}
    </TextSizeContext.Provider>
  );
};

