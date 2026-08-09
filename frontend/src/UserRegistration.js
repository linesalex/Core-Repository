import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link as MuiLink
} from '@mui/material';
import { registerUser } from './api';

const UserRegistration = ({ onShowLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});

  const handleChange = (field) => (event) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await registerUser(formData);
      setMessage({
        type: 'success',
        text: 'Registration request submitted successfully! An administrator will review your request and approve your account. You will receive notification once approved.'
      });
      
      // Clear form
      setFormData({
        username: '',
        full_name: '',
        email: ''
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.error || 'Registration failed. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    if (onShowLogin) {
      onShowLogin();
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        padding: 2
      }}
    >
      <Card sx={{ maxWidth: 500, width: '100%' }}>
        <CardContent sx={{ padding: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Request Account Access
          </Typography>
          
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Submit a request to create a new user account. An administrator will review and approve your request.
          </Typography>

          {message && (
            <Alert 
              severity={message.type} 
              sx={{ mb: 3 }}
              onClose={() => setMessage(null)}
            >
              {message.text}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              margin="normal"
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleChange('username')}
              error={!!errors.username}
              helperText={errors.username}
              disabled={loading}
              autoFocus
            />

            <TextField
              fullWidth
              margin="normal"
              label="Full Name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange('full_name')}
              error={!!errors.full_name}
              helperText={errors.full_name}
              disabled={loading}
            />

            <TextField
              fullWidth
              margin="normal"
              label="Email Address"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              error={!!errors.email}
              helperText={errors.email}
              disabled={loading}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Submitting Request...
                </>
              ) : (
                'Submit Registration Request'
              )}
            </Button>

            <Box textAlign="center">
              <MuiLink
                component="button"
                type="button"
                variant="body2"
                onClick={handleBackToLogin}
                disabled={loading}
                sx={{ cursor: 'pointer' }}
              >
                Back to Login
              </MuiLink>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default UserRegistration;