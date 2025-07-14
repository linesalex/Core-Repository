import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

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
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('authToken'));

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
          const response = await axios.get('http://localhost:4000/me');
          setUser(response.data.user);
          setPermissions(response.data.permissions);
        } catch (error) {
          console.error('Auth check failed:', error);
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:4000/login', {
        username,
        password
      });

      const { token, user, permissions } = response.data;
      
      setToken(token);
      setUser(user);
      setPermissions(permissions);
      
      localStorage.setItem('authToken', token);
      
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setPermissions({});
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      await axios.put('http://localhost:4000/change-password', {
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

  // Check if user has permission for a specific action on a module
  const hasPermission = (module, action) => {
    if (!permissions[module]) return false;
    return permissions[module][`can_${action}`] || false;
  };

  // Check if user has access to a module
  const hasModuleAccess = (module) => {
    return hasPermission(module, 'view');
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
    loading,
    login,
    logout,
    changePassword,
    hasPermission,
    hasModuleAccess,
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