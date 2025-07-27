import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Card,
  CardContent,
  CardHeader,
  InputAdornment,
  IconButton
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  AccountCircle,
  Lock
} from '@mui/icons-material';
import { useAuth } from './AuthContext';
import ForcedPasswordChange from './ForcedPasswordChange';

const LoginForm = () => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForcedPasswordChange, setShowForcedPasswordChange] = useState(false);
  
  const { login, connectionError, clearConnectionError, passwordResetRequired, isAuthenticated } = useAuth();

  // Watch for passwordResetRequired changes (e.g., admin resets password while user is logged in)
  useEffect(() => {
    if (isAuthenticated && passwordResetRequired) {
      setShowForcedPasswordChange(true);
    }
  }, [isAuthenticated, passwordResetRequired]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (error) setError('');
    if (connectionError) clearConnectionError();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      setError('Please enter both username and password');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const result = await login(credentials.username, credentials.password);
      
      if (result.success) {
        if (result.passwordResetRequired) {
          setShowForcedPasswordChange(true);
        }
        // If no password reset required, the AuthContext will handle the redirect
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    }
    
    setLoading(false);
  };

  const handleForcedPasswordChangeClose = () => {
    setShowForcedPasswordChange(false);
    // Clear credentials for security
    setCredentials({ username: '', password: '' });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4
        }}
      >
        <Card elevation={8} sx={{ width: '100%', maxWidth: 400 }}>
          <CardHeader
            title={
              <Typography variant="h4" component="h1" align="center" gutterBottom>
                Network Inventory
              </Typography>
            }
            subheader={
              <Typography variant="h6" color="text.secondary" align="center">
                Please sign in to continue
              </Typography>
            }
            sx={{ pb: 2 }}
          />
          
          <CardContent>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
              {(connectionError || error) && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {connectionError || error}
                </Alert>
              )}
              
              <TextField
                margin="normal"
                required
                fullWidth
                id="username"
                label="Username"
                name="username"
                autoComplete="username"
                autoFocus
                value={credentials.username}
                onChange={handleChange}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountCircle />
                    </InputAdornment>
                  ),
                }}
              />
              
              <TextField
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="current-password"
                value={credentials.password}
                onChange={handleChange}
                disabled={loading}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Sign In'
                )}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
      
      {/* Development Note */}
      <Paper 
        elevation={2} 
        sx={{ 
          mt: 2, 
          p: 2, 
          backgroundColor: '#f5f5f5',
          textAlign: 'center'
        }}
      >
        <Typography variant="body2" color="text.secondary">
          <strong>Default Admin Credentials:</strong><br />
          Username: admin<br />
          Password: admin123<br />
          <em>Please change the password after first login</em>
        </Typography>
      </Paper>

      {showForcedPasswordChange && (
        <ForcedPasswordChange
          open={showForcedPasswordChange}
          onClose={handleForcedPasswordChangeClose}
        />
      )}
    </Container>
  );
};

export default LoginForm; 