import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';

const LoadingIndicator = ({ 
  message = "Loading...", 
  size = 20, 
  showSpinner = true, 
  sx = {} 
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        p: 2,
        ...sx 
      }}
    >
      {showSpinner && <CircularProgress size={size} />}
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
};

export default LoadingIndicator; 