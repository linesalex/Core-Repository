import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeModeContext = createContext();

export const useThemeMode = () => {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeModeProvider');
  }
  return context;
};

// Soft tint tokens used across the app (primary.50, success.200, etc.).
// Light mode keeps Material pastel shades; dark mode uses translucent accents.
const buildTintAugment = (mode) => {
  const tint = (color, lightHex, darkOpacity) =>
    mode === 'dark' ? alpha(color, darkOpacity) : lightHex;

  return {
    primary: {
      50: tint('#90caf9', '#e3f2fd', 0.16),
      200: tint('#90caf9', '#90caf9', 0.45),
    },
    secondary: {
      50: tint('#ce93d8', '#f3e5f5', 0.16),
      200: tint('#ce93d8', '#ce93d8', 0.45),
    },
    success: {
      50: tint('#81c784', '#e8f5e9', 0.16),
      200: tint('#81c784', '#a5d6a7', 0.45),
    },
    info: {
      50: tint('#64b5f6', '#e3f2fd', 0.16),
      200: tint('#64b5f6', '#90caf9', 0.45),
    },
    warning: {
      50: tint('#ffb74d', '#fff3e0', 0.16),
      200: tint('#ffb74d', '#ffcc80', 0.45),
    },
    error: {
      50: tint('#e57373', '#ffebee', 0.16),
      200: tint('#e57373', '#ef9a9a', 0.45),
    },
  };
};

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => {
    const saved = localStorage.getItem('themeMode');
    // Default to dark when no preference has been saved yet
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setThemeMode = (nextMode) => {
    if (nextMode === 'light' || nextMode === 'dark') {
      setMode(nextMode);
    }
  };

  const theme = useMemo(() => {
    const tints = buildTintAugment(mode);
    const base = createTheme({
      palette: {
        mode,
        ...(mode === 'dark'
          ? {
              background: {
                default: '#121212',
                paper: '#1e1e1e',
              },
            }
          : {}),
      },
    });

    return createTheme(base, {
      palette: {
        primary: tints.primary,
        secondary: tints.secondary,
        success: tints.success,
        info: tints.info,
        warning: tints.warning,
        error: tints.error,
      },
    });
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      isDarkMode: mode === 'dark',
      toggleMode,
      setThemeMode,
    }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};
