import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './config';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [moduleVisibility, setModuleVisibility] = useState({});
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [connectionError, setConnectionError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordResetRequired, setPasswordResetRequired] = useState(false);
  
  // Session timeout refs (using useRef to avoid re-renders)
  const sessionTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  
  // Session timeout constants (in milliseconds)
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout

  // Helper function to detect connection errors
  const isConnectionError = (error) => {
    return (
      error.code === 'ERR_NETWORK' ||
      error.code === 'NETWORK_ERROR' ||
      error.message === 'Network Error' ||
      (error.request && !error.response) ||
      (error.response && error.response.status === 0)
    );
  };

  const getErrorMessage = (error) => {
    if (isConnectionError(error)) {
      return 'Unable to connect to server. Please reach out to admin user for assistance.';
    }
    return error.response?.data?.error || error.message || 'An unexpected error occurred';
  };

  // Session timeout functions
  const clearSessionTimeouts = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []); // No dependencies needed since refs don't cause re-renders

  const startSessionTimeout = useCallback(() => {
    clearSessionTimeouts();
    
    // Set warning timeout (25 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, SESSION_TIMEOUT - WARNING_TIME);
    
    // Set session timeout (30 minutes)
    sessionTimeoutRef.current = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT);
  }, [clearSessionTimeouts, SESSION_TIMEOUT, WARNING_TIME]);

  const resetSessionTimeout = useCallback(() => {
    if (isAuthenticated) {
      setShowTimeoutWarning(false);
      startSessionTimeout();
    }
  }, [isAuthenticated, startSessionTimeout]);

  const extendSession = () => {
    setShowTimeoutWarning(false);
    resetSessionTimeout();
  };

  // Configure axios to include auth token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Activity tracking
  useEffect(() => {
    if (isAuthenticated) {
      const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      const handleActivity = () => {
        resetSessionTimeout();
      };
      
      // Add event listeners for user activity
      activityEvents.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });
      
      // Start initial session timeout
      startSessionTimeout();
      
      return () => {
        // Cleanup event listeners
        activityEvents.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
        clearSessionTimeouts();
      };
    } else {
      clearSessionTimeouts();
    }
  }, [isAuthenticated, resetSessionTimeout, startSessionTimeout, clearSessionTimeouts]);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          const response = await axios.get(`${API_BASE_URL}/me`);
          setUser(response.data);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      setConnectionError(null); // Clear any previous connection errors
      
      const response = await axios.post(`${API_BASE_URL}/login`, {
        username,
        password
      });

      const { token, user, permissions, moduleVisibility, passwordResetRequired } = response.data;
      
      // Set axios headers IMMEDIATELY to prevent race condition
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('authToken', token);
      
      // Small delay to ensure axios headers are fully processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      setToken(token);
      setUser(user);
      setPermissions(permissions);
      setModuleVisibility(moduleVisibility || {});
      setPasswordResetRequired(passwordResetRequired || false);
      setIsAuthenticated(true);
      
      return { success: true, passwordResetRequired: passwordResetRequired || false };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      
      if (isConnectionError(error)) {
        setConnectionError(errorMessage);
        console.error('Connection error during login:', errorMessage);
      } else {
        console.error('Login failed:', errorMessage);
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const logout = () => {
    clearSessionTimeouts();
    setToken(null);
    setUser(null);
    setPermissions({});
    setModuleVisibility({});
    setIsAuthenticated(false);
    setPasswordResetRequired(false);
    setShowTimeoutWarning(false);
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.put(`${API_BASE_URL}/change-password`, {
        currentPassword,
        newPassword
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: getErrorMessage(error)
      };
    }
  };

  const forcedPasswordChange = async (currentPassword, newPassword) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/forced-password-change`, {
        currentPassword,
        newPassword
      });
      
      // If backend says to logout, clear everything and return logout flag
      if (response.data.logout) {
        logout();
        return { success: true, logout: true, message: response.data.message };
      }
      
      // Otherwise just clear the password reset flag
      setPasswordResetRequired(false);
      return { success: true, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        error: getErrorMessage(error)
      };
    }
  };

  const clearConnectionError = () => {
    setConnectionError(null);
  };

  // Check if user has permission for a specific action on a module
  const hasPermission = useCallback((module, action) => {
    if (!permissions[module]) return false;
    return permissions[module][`can_${action}`] || false;
  }, [permissions]);

  // Check if a module is visible to the user
  const isModuleVisible = useCallback((module) => {
    // If no specific visibility setting exists, default to visible
    return moduleVisibility[module] !== false;
  }, [moduleVisibility]);

  // Check if user has access to a module (both permissions and visibility)
  const hasModuleAccess = useCallback((module) => {
    return hasPermission(module, 'view') && isModuleVisible(module);
  }, [hasPermission, isModuleVisible]);

  // Check if user has a specific role
  const hasRole = (role) => {
    return user?.role === role;
  };

  // Check if user is admin
  const isAdmin = () => {
    return hasRole('administrator');
  };

  // Check if user is provisioner
  const isProvisioner = () => {
    return hasRole('provisioner');
  };

  // Check if user is read-only
  const isReadOnly = () => {
    return hasRole('read_only');
  };

  const value = {
    user,
    permissions,
    moduleVisibility,
    loading,
    connectionError,
    login,
    logout,
    changePassword,
    forcedPasswordChange,
    passwordResetRequired,
    clearConnectionError,
    hasPermission,
    hasModuleAccess,
    isModuleVisible,
    hasRole,
    isAdmin,
    isProvisioner,
    isReadOnly,
    isAuthenticated,
    extendSession
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      {/* Session Timeout Warning Dialog */}
      <Dialog 
        open={showTimeoutWarning} 
        disableEscapeKeyDown 
        disableBackdropClick
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>Session Timeout Warning</DialogTitle>
        <DialogContent>
          <Typography>
            Your session will expire in 5 minutes due to inactivity. 
            Would you like to extend your session?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={logout} color="secondary">
            Logout Now
          </Button>
          <Button onClick={extendSession} variant="contained" color="primary">
            Extend Session
          </Button>
        </DialogActions>
      </Dialog>
    </AuthContext.Provider>
  );
}; 