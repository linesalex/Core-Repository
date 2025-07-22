import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import config from './config';

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

  // Configure axios to include auth token
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get(`${config.API_BASE_URL}/me`);
          setUser(response.data.user);
          setPermissions(response.data.permissions);
          setModuleVisibility(response.data.moduleVisibility || {});
          setConnectionError(null); // Clear any previous connection errors
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          
          if (isConnectionError(error)) {
            setConnectionError(errorMessage);
            console.error('Connection error during auth check:', errorMessage);
          } else {
            console.error('Auth check failed:', errorMessage);
            logout(); // Only logout for auth failures, not connection issues
          }
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (username, password) => {
    try {
      setConnectionError(null); // Clear any previous connection errors
      
      const response = await axios.post(`${config.API_BASE_URL}/login`, {
        username,
        password
      });

      const { token, user, permissions, moduleVisibility } = response.data;
      
      setToken(token);
      setUser(user);
      setPermissions(permissions);
      setModuleVisibility(moduleVisibility || {});
      
      localStorage.setItem('authToken', token);
      
      return { success: true };
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
    setToken(null);
    setUser(null);
    setPermissions({});
    setModuleVisibility({});
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.put(`${config.API_BASE_URL}/change-password`, {
        currentPassword,
        newPassword
      });
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Password change failed' 
      };
    }
  };

  const clearConnectionError = () => {
    setConnectionError(null);
  };

  // Check if user has permission for a specific action on a module
  const hasPermission = (module, action) => {
    if (!permissions[module]) return false;
    return permissions[module][`can_${action}`] || false;
  };

  // Check if user has access to a module (both permissions and visibility)
  const hasModuleAccess = (module) => {
    return hasPermission(module, 'view') && isModuleVisible(module);
  };
  
  // Check if a module is visible to the user
  const isModuleVisible = (module) => {
    // If no specific visibility setting exists, default to visible
    return moduleVisibility[module] !== false;
  };

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
    clearConnectionError,
    hasPermission,
    hasModuleAccess,
    isModuleVisible,
    hasRole,
    isAdmin,
    isProvisioner,
    isReadOnly,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 