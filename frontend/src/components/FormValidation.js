import React from 'react';
import { TextField, FormControl, InputLabel, Select, FormHelperText, Box } from '@mui/material';

// Utility function to check if a field has errors
export const hasFieldError = (field, errors) => {
  return errors && errors[field] && errors[field].length > 0;
};

// Utility function to get error message for a field
export const getFieldError = (field, errors) => {
  return errors && errors[field] && errors[field].length > 0 ? errors[field][0] : '';
};

// Enhanced TextField with validation styling
export const ValidatedTextField = ({ 
  field, 
  errors, 
  required = false, 
  children,
  sx = {},
  ...props 
}) => {
  const hasError = hasFieldError(field, errors);
  const errorMessage = getFieldError(field, errors);
  
  return (
    <TextField
      {...props}
      required={required}
      error={hasError}
      helperText={hasError ? errorMessage : props.helperText}
      sx={{
        '& .MuiOutlinedInput-root': {
          '&.Mui-error': {
            '& fieldset': {
              borderColor: '#d32f2f',
              borderWidth: '2px',
            },
          },
        },
        ...sx
      }}
    >
      {children}
    </TextField>
  );
};

// Enhanced Select with validation styling
export const ValidatedSelect = ({ 
  field, 
  errors, 
  required = false, 
  label,
  children,
  sx = {},
  ...props 
}) => {
  const hasError = hasFieldError(field, errors);
  const errorMessage = getFieldError(field, errors);
  
  return (
    <FormControl fullWidth required={required} error={hasError} sx={sx}>
      <InputLabel>{label}</InputLabel>
      <Select
        {...props}
        label={label}
        sx={{
          '&.Mui-error': {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#d32f2f',
              borderWidth: '2px',
            },
          },
        }}
      >
        {children}
      </Select>
      {hasError && <FormHelperText>{errorMessage}</FormHelperText>}
    </FormControl>
  );
};

// Validation function generator
export const createValidator = (rules) => {
  return (formData) => {
    const errors = {};
    
    Object.keys(rules).forEach(field => {
      const fieldRules = Array.isArray(rules[field]) ? rules[field] : [rules[field]];
      const value = formData[field];
      
      fieldRules.forEach(rule => {
        if (typeof rule === 'object') {
          const { type, message, ...options } = rule;
          
          switch (type) {
            case 'required':
              if (!value || (typeof value === 'string' && value.trim() === '')) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || `${field} is required`);
              }
              break;
              
            case 'email':
              if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || 'Please enter a valid email address');
              }
              break;
              
            case 'phone':
              if (value && !/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[-\s\(\)]/g, ''))) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || 'Please enter a valid phone number');
              }
              break;
              
            case 'minLength':
              if (value && value.length < options.min) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || `Minimum length is ${options.min} characters`);
              }
              break;
              
            case 'oneOf':
              if (!options.fields.some(f => formData[f] && formData[f].trim() !== '')) {
                options.fields.forEach(f => {
                  if (!errors[f]) errors[f] = [];
                  errors[f].push(message || 'At least one of these fields is required');
                });
              }
              break;
              
            case 'pattern':
              if (value && !options.pattern.test(value)) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || 'Invalid format');
              }
              break;
              
            case 'number':
              if (value && (isNaN(value) || isNaN(parseFloat(value)))) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || 'Must be a valid number');
              }
              break;
              
            case 'min':
              if (value && parseFloat(value) < options.min) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || `Value must be greater than or equal to ${options.min}`);
              }
              break;
              
            case 'max':
              if (value && parseFloat(value) > options.max) {
                if (!errors[field]) errors[field] = [];
                errors[field].push(message || `Value must be less than or equal to ${options.max}`);
              }
              break;
              
            default:
              break;
          }
        }
      });
    });
    
    return errors;
  };
};

// Utility to scroll to first error
export const scrollToFirstError = (errors) => {
  if (!errors || Object.keys(errors).length === 0) return;
  
  const firstErrorField = Object.keys(errors)[0];
  const element = document.querySelector(`[name="${firstErrorField}"]`) || 
                 document.querySelector(`[data-field="${firstErrorField}"]`);
  
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    element.focus();
  }
};

// Higher-order component for form validation
export const withFormValidation = (WrappedComponent, validationRules) => {
  return function ValidatedForm(props) {
    const [errors, setErrors] = React.useState({});
    
    const validate = React.useCallback(
      createValidator(validationRules),
      [validationRules]
    );
    
    const validateForm = (formData) => {
      const newErrors = validate(formData);
      setErrors(newErrors);
      
      const hasErrors = Object.keys(newErrors).length > 0;
      if (hasErrors) {
        scrollToFirstError(newErrors);
      }
      
      return !hasErrors;
    };
    
    const clearErrors = () => setErrors({});
    
    return (
      <WrappedComponent
        {...props}
        errors={errors}
        validateForm={validateForm}
        clearErrors={clearErrors}
        hasFieldError={(field) => hasFieldError(field, errors)}
        getFieldError={(field) => getFieldError(field, errors)}
      />
    );
  };
}; 