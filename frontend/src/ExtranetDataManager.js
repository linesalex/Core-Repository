import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip,
  Alert, Snackbar, Tooltip, Grid, FormControl, InputLabel, Select, MenuItem, Collapse,
  FormControlLabel, Switch, Autocomplete, DialogContentText, Tabs, Tab, Badge, Link
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import BusinessIcon from '@mui/icons-material/Business';
import ContactsIcon from '@mui/icons-material/Contacts';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { API_BASE_URL } from './config';
import axios from 'axios';
import LoadingIndicator from './components/LoadingIndicator';
import { ValidatedTextField, ValidatedSelect, createValidator, scrollToFirstError } from './components/FormValidation';


const ExtranetDataManager = ({ hasPermission, initialTab = 0, permissionModule = 'extranet_providers' }) => {
  
  // Data states
  const [providers, setProviders] = useState([]);
  const [products, setProducts] = useState({});
  const [contacts, setContacts] = useState({});
  const [overdueContacts, setOverdueContacts] = useState([]);
  const [locationsList, setLocationsList] = useState([]);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState({});
  const [contactsLoading, setContactsLoading] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedProvider, setExpandedProvider] = useState(null);
  
  // Dialog states
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [moreInfoDialogOpen, setMoreInfoDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previouslyKnownAsDialogOpen, setPreviouslyKnownAsDialogOpen] = useState(false);
  const [previouslyKnownAsContent, setPreviouslyKnownAsContent] = useState([]);
  
  // Dialog modes
  const [providerDialogMode, setProviderDialogMode] = useState('add');
  const [productDialogMode, setProductDialogMode] = useState('add');
  const [contactDialogMode, setContactDialogMode] = useState('add');
  
  // File handling state
  const [existingDesignFile, setExistingDesignFile] = useState(null);
  const [existingDesignTemplate, setExistingDesignTemplate] = useState(null);
  const [fileDeleteLoading, setFileDeleteLoading] = useState(false);
  const [templateDeleteLoading, setTemplateDeleteLoading] = useState(false);
  
  // Selected items
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedContact, setSelectedContact] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [moreInfoContent, setMoreInfoContent] = useState('');
  const [productTracking, setProductTracking] = useState(null);
  const [currentProductForInfo, setCurrentProductForInfo] = useState(null);
  
  // Search and filter states
  const [searchText, setSearchText] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterAvailable, setFilterAvailable] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [currentTab, setCurrentTab] = useState(0);
  
  // Form data
  const [providerFormData, setProviderFormData] = useState({
    provider_name: '',
    region: 'AMERs',
    salesperson_assigned: '',
    provider_resiliency: '',
    website_link: '',
    available: true,
    more_info: '',
    previously_known_as: ''
  });

  const [productFormData, setProductFormData] = useState({
    product_name: '',
    isf: '',
    suggested_bandwidth: '',
    primary_datacenter: '',
    secondary_datacenters: '',
    primary_pricing_city: '',
    isf_resiliency: '',
    more_info: '',
    design_file: null,
    design_template: null
  });

  const [contactFormData, setContactFormData] = useState({
    contact_name: '',
    job_title: '',
    phone_number: '',
    email: '',
    contact_type: '',
    contact_level: '',
    notes: ''
  });
  
  // Contact type and level options (same as Manage Carriers)
  const contactTypeOptions = [
    'Primary Support Contact',
    'Primary Order Contact',
    'Billing Contact',
    'Primary Legal Contact',
    'Account Manager',
    'Service Manager',
    'Support - Peer to Peer Escalation',
    'Delivery - Peer to Peer Escalation',
    'Service Management - Peer to Peer Escalation',
    'Account Management - Peer to Peer Escalation',
    'Cease Contact'
  ];
  
  const contactLevelOptions = [
    'General',
    '1st Level',
    '2nd Level',
    '3rd Level',
    '4th Level',
    '5th Level'
  ];

  // Validation states
  const [contactErrors, setContactErrors] = useState({});
  const [productErrors, setProductErrors] = useState({});
  const [providerErrors, setProviderErrors] = useState({});

  // Validation rules
  const contactValidationRules = {
    contact_name: { type: 'required', message: 'Contact Name is required' },
    job_title: { type: 'required', message: 'Job Title is required' },
    contact_type: { type: 'required', message: 'Contact Type is required' },
    phone_number: { 
      type: 'oneOf', 
      fields: ['phone_number', 'email'], 
      message: 'Either Phone Number or Email is required' 
    },
    email: { 
      type: 'oneOf', 
      fields: ['phone_number', 'email'], 
      message: 'Either Phone Number or Email is required' 
    }
  };

  const productValidationRules = {
    product_name: { type: 'required', message: 'Product Name is required' },
    isf: { type: 'required', message: 'ISF is required' }
  };

  const providerValidationRules = {
    provider_name: { type: 'required', message: 'Provider Name is required' },
    region: { type: 'required', message: 'Region is required' }
  };

  // Validation functions
  const validateContact = createValidator(contactValidationRules);
  const validateProduct = createValidator(productValidationRules);
  const validateProvider = createValidator(providerValidationRules);

  const regions = ['AMERs', 'APAC', 'EMEA'];
  const providerResiliencyOptions = ['Multi-Site Resilient', 'Split-Site Resilient', 'Single-Site Resilient', 'Single-Site Non-Resilient'];
  const isfResiliencyOptions = ['Single-Site Resilient', 'Multi-Site Resilient', 'Split-Site Resilient', 'Non-Resilient', 'Multi-Region Resilient'];

  // Load data on component mount
  useEffect(() => {
    loadProviders();
    loadLocations();
    loadOverdueContacts();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchText) params.append('search', searchText);
      if (filterRegion) params.append('region', filterRegion);
      if (filterAvailable) params.append('available', filterAvailable);

      const response = await axios.get(`${API_BASE_URL}/extranets?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setProviders(response.data);
    } catch (err) {
      setError('Failed to load providers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranet-data/locations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setLocationsList(response.data);
    } catch (err) {
      console.error('Failed to load locations:', err);
    }
  };

  const loadProducts = async (providerId) => {
    try {
      setProductsLoading(prev => ({ ...prev, [providerId]: true }));
      const params = new URLSearchParams();
      if (productSearchText) params.append('search', productSearchText);

      const response = await axios.get(`${API_BASE_URL}/extranets/${providerId}/products?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setProducts(prev => ({
        ...prev,
        [providerId]: response.data
      }));
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setProductsLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const loadContacts = async (providerId) => {
    try {
      setContactsLoading(prev => ({ ...prev, [providerId]: true }));
      const response = await axios.get(`${API_BASE_URL}/extranets/${providerId}/contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setContacts(prev => ({
        ...prev,
        [providerId]: response.data
      }));
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setContactsLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const loadOverdueContacts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranets/overdue-contacts`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setOverdueContacts(response.data);
    } catch (err) {
      console.error('Failed to load overdue contacts:', err);
    }
  };

  const handleApproveContact = async (contactId) => {
    try {
      await axios.post(`${API_BASE_URL}/extranets/contacts/${contactId}/approve`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setSuccess('Contact approved successfully');
      await loadOverdueContacts();
    } catch (err) {
      setError('Failed to approve contact: ' + (err.response?.data?.error || err.message));
    }
  };

  // Handlers
  const handleProviderRowClick = async (provider) => {
    if (expandedProvider === provider.id) {
      setExpandedProvider(null);
    } else {
      setExpandedProvider(provider.id);
      if (initialTab === 0 && !products[provider.id]) {
        await loadProducts(provider.id);
      } else if (initialTab === 1 && !contacts[provider.id]) {
        await loadContacts(provider.id);
      }
    }
  };

  // Provider handlers
  const handleAddProvider = () => {
    setProviderDialogMode('add');
    setSelectedProvider(null);
    setProviderFormData({
      provider_name: '',
      region: 'AMERs',
      salesperson_assigned: '',
      provider_resiliency: '',
      website_link: '',
      available: true,
      more_info: '',
      previously_known_as: ''
    });
    setProviderDialogOpen(true);
  };

  const handleEditProvider = (provider) => {
    setProviderDialogMode('edit');
    setSelectedProvider(provider);
    setProviderFormData({
      provider_name: provider.provider_name,
      region: provider.region,
      salesperson_assigned: provider.salesperson_assigned || '',
      provider_resiliency: provider.provider_resiliency || '',
      website_link: provider.website_link || '',
      available: Boolean(provider.available),
      more_info: provider.more_info || '',
      previously_known_as: provider.previously_known_as || ''
    });
    setProviderDialogOpen(true);
  };

  const handleDeleteProvider = (provider) => {
    setDeleteTarget({ type: 'provider', item: provider });
    setDeleteDialogOpen(true);
  };

  // Normalize text for duplicate checking
  const normalizeText = (text) => {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  };

  const handleProviderSubmit = async () => {
    try {
      const validationErrors = validateProvider(providerFormData);
      setProviderErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      // Duplicate prevention
      const normalizedProviderName = normalizeText(providerFormData.provider_name);
      
      if (providerDialogMode === 'add') {
        const existingProvider = providers.find(p => 
          normalizeText(p.provider_name) === normalizedProviderName &&
          p.region === providerFormData.region
        );
        
        if (existingProvider) {
          setError(`A provider with the name "${providerFormData.provider_name}" already exists in the ${providerFormData.region} region.`);
          return;
        }

        await axios.post(`${API_BASE_URL}/extranets`, providerFormData, { headers });
        setSuccess('Provider created successfully');
      } else {
        const existingProvider = providers.find(p => 
          p.id !== selectedProvider.id &&
          normalizeText(p.provider_name) === normalizedProviderName &&
          p.region === providerFormData.region
        );
        
        if (existingProvider) {
          setError(`A provider with the name "${providerFormData.provider_name}" already exists in the ${providerFormData.region} region.`);
          return;
        }

        await axios.put(`${API_BASE_URL}/extranets/${selectedProvider.id}`, providerFormData, { headers });
        setSuccess('Provider updated successfully');
      }

      setProviderDialogOpen(false);
      await loadProviders();

    } catch (err) {
      setError('Failed to save provider: ' + (err.response?.data?.error || err.message));
    }
  };

  // Product handlers
  const handleAddProduct = (provider) => {
    setProductDialogMode('add');
    setSelectedProvider(provider);
    setSelectedProduct(null);
    setExistingDesignFile(null);
    setProductFormData({
      product_name: '',
      isf: '',
      suggested_bandwidth: '',
      primary_datacenter: '',
      secondary_datacenters: '',
      primary_pricing_city: '',
      isf_resiliency: '',
      more_info: '',
      design_file: null,
      design_template: null
    });
    setExistingDesignFile(null);
    setExistingDesignTemplate(null);
    setProductErrors({});
    setProductDialogOpen(true);
  };

  const handleEditProduct = (provider, product) => {
    setProductDialogMode('edit');
    setSelectedProvider(provider);
    setSelectedProduct(product);
    setExistingDesignFile(product.design_file_path || null);
    setExistingDesignTemplate(product.design_template_path || null);
    setProductFormData({
      product_name: product.product_name || '',
      isf: product.isf || '',
      suggested_bandwidth: product.suggested_bandwidth || '',
      primary_datacenter: product.primary_datacenter || '',
      secondary_datacenters: product.secondary_datacenters || '',
      primary_pricing_city: product.primary_pricing_city || '',
      isf_resiliency: product.isf_resiliency || '',
      more_info: product.more_info || '',
      design_file: null,
      design_template: null
    });
    setProductErrors({});
    setProductDialogOpen(true);
  };

  const handleDeleteProduct = (provider, product) => {
    setSelectedProvider(provider);
    setDeleteTarget({ type: 'product', item: product });
    setDeleteDialogOpen(true);
  };

  const handleProductSubmit = async () => {
    try {
      const validationErrors = validateProduct(productFormData);
      setProductErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        scrollToFirstError(validationErrors);
        return;
      }

      // Duplicate prevention
      const providerProducts = products[selectedProvider.id] || [];
      const normalizedProductName = normalizeText(productFormData.product_name);
      
      if (productDialogMode === 'add') {
        const existingProduct = providerProducts.find(p => 
          normalizeText(p.product_name) === normalizedProductName
        );
        
        if (existingProduct) {
          setError(`A product with the name "${productFormData.product_name}" already exists for this provider.`);
          return;
        }
      } else {
        const existingProduct = providerProducts.find(p => 
          p.id !== selectedProduct.id && 
          normalizeText(p.product_name) === normalizedProductName
        );
        
        if (existingProduct) {
          setError(`A product with the name "${productFormData.product_name}" already exists for this provider.`);
          return;
        }
      }

      const formData = new FormData();
      Object.keys(productFormData).forEach(key => {
        if (key === 'design_file' && productFormData[key]) {
          formData.append('design_file', productFormData[key]);
        } else if (key === 'design_template' && productFormData[key]) {
          formData.append('design_template', productFormData[key]);
        } else if (key !== 'design_file' && key !== 'design_template') {
          formData.append(key, productFormData[key]);
        }
      });

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (productDialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/extranets/${selectedProvider.id}/products`, formData, { headers });
        setSuccess('Product created successfully');
      } else {
        await axios.put(`${API_BASE_URL}/extranets/${selectedProvider.id}/products/${selectedProduct.id}`, formData, { headers });
        setSuccess('Product updated successfully');
      }

      setProductDialogOpen(false);
      setProductErrors({});
      await loadProducts(selectedProvider.id);

    } catch (err) {
      setError('Failed to save product: ' + (err.response?.data?.error || err.message));
    }
  };

  // Contact handlers
  const handleAddContact = (provider) => {
    setContactDialogMode('add');
    setSelectedProvider(provider);
    setSelectedContact(null);
    setContactFormData({
      contact_name: '',
      job_title: '',
      phone_number: '',
      email: '',
      contact_type: '',
      contact_level: '',
      notes: ''
    });
    setContactErrors({});
    setContactDialogOpen(true);
  };

  const handleEditContact = (provider, contact) => {
    setContactDialogMode('edit');
    setSelectedProvider(provider);
    setSelectedContact(contact);
    setContactFormData({
      contact_name: contact.contact_name || '',
      job_title: contact.job_title || '',
      phone_number: contact.phone_number || '',
      email: contact.email || '',
      contact_type: contact.contact_type || '',
      contact_level: contact.contact_level || '',
      notes: contact.notes || contact.more_info || ''
    });
    setContactErrors({});
    setContactDialogOpen(true);
  };

  const handleDeleteContact = (provider, contact) => {
    setSelectedProvider(provider);
    setDeleteTarget({ type: 'contact', item: contact });
    setDeleteDialogOpen(true);
  };

  const handleContactSubmit = async () => {
    try {
      const errors = validateContact(contactFormData);
      setContactErrors(errors);
      
      if (Object.keys(errors).length > 0) {
        scrollToFirstError(errors);
        return;
      }

      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json'
      };

      if (contactDialogMode === 'add') {
        await axios.post(`${API_BASE_URL}/extranets/${selectedProvider.id}/contacts`, contactFormData, { headers });
        setSuccess('Contact created successfully');
      } else {
        await axios.put(`${API_BASE_URL}/extranets/${selectedProvider.id}/contacts/${selectedContact.id}`, contactFormData, { headers });
        setSuccess('Contact updated successfully');
      }

      setContactDialogOpen(false);
      setContactErrors({});
      await loadContacts(selectedProvider.id);

    } catch (err) {
      setError('Failed to save contact: ' + (err.response?.data?.error || err.message));
    }
  };

  // Delete handler
  const handleConfirmDelete = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      };

      if (deleteTarget.type === 'provider') {
        await axios.delete(`${API_BASE_URL}/extranets/${deleteTarget.item.id}`, { headers });
        setSuccess('Provider deleted successfully');
        await loadProviders();
      } else if (deleteTarget.type === 'product') {
        await axios.delete(`${API_BASE_URL}/extranets/${selectedProvider.id}/products/${deleteTarget.item.id}`, { headers });
        setSuccess('Product deleted successfully');
        await loadProducts(selectedProvider.id);
      } else if (deleteTarget.type === 'contact') {
        await axios.delete(`${API_BASE_URL}/extranets/${selectedProvider.id}/contacts/${deleteTarget.item.id}`, { headers });
        setSuccess('Contact deleted successfully');
        await loadContacts(selectedProvider.id);
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);

    } catch (err) {
      setError('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  // Utility functions
  const handleProviderInputChange = (field, value) => {
    setProviderFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProductInputChange = (field, value) => {
    setProductFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactInputChange = (field, value) => {
    setContactFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are allowed');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError('File size must be less than 2MB');
        return;
      }
      setProductFormData(prev => ({
        ...prev,
        design_file: file
      }));
    }
  };

  const handleTemplateFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Template file size must be less than 10MB');
        return;
      }
      setProductFormData(prev => ({
        ...prev,
        design_template: file
      }));
    }
  };

  const handleDeleteDesignFile = async () => {
    if (!selectedProduct || !selectedProvider) return;
    
    setFileDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/extranets/${selectedProvider.id}/products/${selectedProduct.id}/design-file`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete design file');
      }
      
      setExistingDesignFile(null);
      setSuccess('Design file deleted successfully');
      
      await loadProducts(selectedProvider.id);
    } catch (error) {
      console.error('Error deleting design file:', error);
      setError('Failed to delete design file: ' + error.message);
    } finally {
      setFileDeleteLoading(false);
    }
  };

  const handleDeleteDesignTemplate = async () => {
    if (!selectedProduct || !selectedProvider) return;
    
    setTemplateDeleteLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/extranets/${selectedProvider.id}/products/${selectedProduct.id}/design-template`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete design template');
      }
      
      setExistingDesignTemplate(null);
      setSuccess('Design template deleted successfully');
      
      await loadProducts(selectedProvider.id);
    } catch (error) {
      console.error('Error deleting design template:', error);
      setError('Failed to delete design template: ' + error.message);
    } finally {
      setTemplateDeleteLoading(false);
    }
  };

  const handleDownloadDesign = async (providerId, productId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranets/${providerId}/products/${productId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        responseType: 'blob'
      });
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'design.pdf';
      if (contentDisposition) {
        // Match filename="value" or filename=value (stop at ; or end of string)
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"|filename=([^;\s]+)/);
        if (filenameMatch) {
          filename = (filenameMatch[1] || filenameMatch[2]).replace(/['"]/g, '');
        }
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading design:', error);
      setError('Failed to download design file');
    }
  };

  const handleDownloadTemplate = async (providerId, productId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/extranets/${providerId}/products/${productId}/download-template`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        responseType: 'blob'
      });
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'design_template';
      if (contentDisposition) {
        // Match filename="value" or filename=value (stop at ; or end of string)
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"|filename=([^;\s]+)/);
        if (filenameMatch) {
          filename = (filenameMatch[1] || filenameMatch[2]).replace(/['"]/g, '');
        }
      }

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template file: ' + err.message);
    }
  };

  // Helper function to format date
  const formatTrackingDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    try {
      const date = new Date(dateString);
      const options = {
        month: 'short',
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      };
      return date.toLocaleString('en-US', options).replace(',', '') + ' GMT';
    } catch (err) {
      return 'Invalid date';
    }
  };

  const handleMoreInfo = (content) => {
    setMoreInfoContent(content || 'No additional information available.');
    setCurrentProductForInfo(null);
    setProductTracking(null);
    setMoreInfoDialogOpen(true);
  };

  const handleProductMoreInfo = async (product, providerId) => {
    setMoreInfoContent(product.more_info || 'No additional information available.');
    setCurrentProductForInfo(product);
    setMoreInfoDialogOpen(true);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/extranets/${providerId}/products/${product.id}/tracking`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });
      setProductTracking(response.data);
    } catch (err) {
      console.error('Failed to fetch product tracking:', err);
      setProductTracking(null);
    }
  };

  const getStatusChip = (available) => {
    return available ? (
      <CheckCircleIcon sx={{ color: 'green', fontSize: 20 }} />
    ) : (
      <CancelIcon sx={{ color: 'red', fontSize: 20 }} />
    );
  };

  const getRegionChip = (region) => {
    const colors = {
      'AMERs': 'primary',
      'APAC': 'success',
      'EMEA': 'secondary'
    };
    return <Chip label={region} color={colors[region] || 'default'} size="small" />;
  };

  const getResiliencyChip = (resiliency) => {
    if (!resiliency) return '-';
    const colors = {
      'Resilient': 'success',
      'Non-Resilient': 'warning',
      'Split Site Resilient': 'info',
      'Multi-Region Resilient': 'primary'
    };
    return <Chip label={resiliency} color={colors[resiliency] || 'default'} size="small" />;
  };

  const renderDesignFileCell = (product, providerId) => {
    if (product.design_file_path) {
      return (
        <Button
          onClick={() => handleDownloadDesign(providerId, product.id)}
          color="success"
          size="small"
          startIcon={<CheckCircleIcon color="success" />}
        >
          <CloudDownloadIcon fontSize="small" />
        </Button>
      );
    } else {
      return <CancelIcon sx={{ color: 'red', fontSize: 16 }} />;
    }
  };

  const renderDesignTemplateCell = (product, providerId) => {
    if (product.design_template_path) {
      return (
        <Button
          onClick={() => handleDownloadTemplate(providerId, product.id)}
          color="info"
          size="small"
          startIcon={<CheckCircleIcon color="info" />}
        >
          <CloudDownloadIcon fontSize="small" />
        </Button>
      );
    } else {
      return <CancelIcon sx={{ color: 'grey', fontSize: 16 }} />;
    }
  };

  // Filter providers based on search and filters
  const filteredProviders = providers.filter(provider => {
    const searchLower = searchText.toLowerCase();
    const matchesName = provider.provider_name.toLowerCase().includes(searchLower);
    const matchesPreviouslyKnownAs = provider.previously_known_as && 
      provider.previously_known_as.toLowerCase().includes(searchLower);
    const matchesSearch = !searchText || matchesName || matchesPreviouslyKnownAs;
    const matchesRegion = !filterRegion || provider.region === filterRegion;
    const matchesAvailable = !filterAvailable || (filterAvailable === 'true' ? provider.available : !provider.available);
    
    return matchesSearch && matchesRegion && matchesAvailable;
  });

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" component="h2">
          Extranet Data
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {hasPermission && hasPermission(permissionModule, 'create') && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddProvider}
            >
              Add Provider
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadProviders}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ width: '100%' }}>
        {/* Search and Filter */}
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              label="Search Provider"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search by provider name..."
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Region</InputLabel>
              <Select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                label="Region"
              >
                <MenuItem value="">All Regions</MenuItem>
                {regions.map(region => (
                  <MenuItem key={region} value={region}>{region}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Available</InputLabel>
              <Select
                value={filterAvailable}
                onChange={(e) => setFilterAvailable(e.target.value)}
                label="Available"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Available</MenuItem>
                <MenuItem value="false">Not Available</MenuItem>
              </Select>
            </FormControl>
            {initialTab === 0 && (
              <TextField
                size="small"
                label="Search Products"
                value={productSearchText}
                onChange={(e) => setProductSearchText(e.target.value)}
                placeholder="Search by product name..."
                sx={{ minWidth: 200 }}
              />
            )}
          </Box>

          {/* Tabs only for Contacts module */}
          {initialTab === 1 && (
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
              <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)}>
                <Tab label="Extranet Contacts" />
                <Tab 
                  label={
                    <Badge badgeContent={overdueContacts.length} color="warning">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon fontSize="small" />
                        Overdue Contacts
                      </Box>
                    </Badge>
                  }
                />
              </Tabs>
            </Box>
          )}
        </Box>

        {/* Extranet Providers View (initialTab === 0) */}
        {initialTab === 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Region</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Salesperson</TableCell>
                  <TableCell>Resiliency</TableCell>
                  <TableCell>Website</TableCell>
                  <TableCell>Available</TableCell>
                  <TableCell>Previously Known As</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <React.Fragment key={provider.id}>
                    <TableRow 
                      hover
                      onClick={() => handleProviderRowClick(provider)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{getRegionChip(provider.region)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <BusinessIcon />
                          <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.875rem' }}>
                            {provider.provider_name}
                          </Typography>
                          {expandedProvider === provider.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {provider.salesperson_assigned || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>{getResiliencyChip(provider.provider_resiliency)}</TableCell>
                      <TableCell>
                        {provider.website_link ? (
                          <Link 
                            href={provider.website_link.startsWith('http') ? provider.website_link : `https://${provider.website_link}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                          >
                            <OpenInNewIcon fontSize="small" />
                          </Link>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusChip(provider.available)}</TableCell>
                      <TableCell>
                        {provider.previously_known_as ? (
                          <IconButton 
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviouslyKnownAsContent(provider.previously_known_as.split(',').map(name => name.trim()));
                              setPreviouslyKnownAsDialogOpen(true);
                            }}
                          >
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {hasPermission && hasPermission(permissionModule, 'edit') && (
                            <>
                              <Tooltip title="Add Product">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddProduct(provider);
                                  }}
                                >
                                  <AddIcon />
                                </IconButton>
                              </Tooltip>
                              {hasPermission(permissionModule, 'create') && (
                                <Tooltip title="Edit Provider">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditProvider(provider);
                                    }}
                                  >
                                    <EditIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </>
                          )}
                          {hasPermission && hasPermission(permissionModule, 'delete') && (
                            <Tooltip title="Delete Provider">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProvider(provider);
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          {provider.more_info && (
                            <Tooltip title="More Info">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoreInfo(provider.more_info);
                                }}
                              >
                                <InfoIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Products Table */}
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                        <Collapse in={expandedProvider === provider.id} timeout="auto" unmountOnExit>
                          <Box sx={{ margin: 1 }}>
                            <Typography variant="h6" gutterBottom component="div">
                              Products
                            </Typography>
                            {productsLoading[provider.id] ? (
                              <LoadingIndicator message="Loading products..." size={16} sx={{ p: 1 }} />
                            ) : products[provider.id] && products[provider.id].length > 0 ? (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Product Name</TableCell>
                                    <TableCell>ISF</TableCell>
                                    <TableCell>Suggested Bandwidth (Mb)</TableCell>
                                    <TableCell>Source Datacenters</TableCell>
                                    <TableCell>ISF Resiliency</TableCell>
                                    <TableCell>Design PDF</TableCell>
                                    <TableCell>Design Template</TableCell>
                                    <TableCell>More Info</TableCell>
                                    <TableCell align="center">Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {products[provider.id]
                                    .filter(product => !productSearchText || product.product_name.toLowerCase().includes(productSearchText.toLowerCase()))
                                    .map((product) => (
                                    <TableRow key={product.id}>
                                      <TableCell>{product.product_name}</TableCell>
                                      <TableCell>{product.isf || '-'}</TableCell>
                                      <TableCell>{product.suggested_bandwidth || '-'}</TableCell>
                                      <TableCell>
                                        <Typography variant="body2" sx={{ fontSize: '0.75rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {product.primary_datacenter || '-'}
                                        </Typography>
                                        {product.secondary_datacenters && (
                                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                            +{product.secondary_datacenters.split(',').length} secondary
                                          </Typography>
                                        )}
                                      </TableCell>
                                      <TableCell>{getResiliencyChip(product.isf_resiliency)}</TableCell>
                                      <TableCell>{renderDesignFileCell(product, provider.id)}</TableCell>
                                      <TableCell>{renderDesignTemplateCell(product, provider.id)}</TableCell>
                                      <TableCell>
                                        <IconButton size="small" onClick={() => handleProductMoreInfo(product, provider.id)}>
                                          <InfoIcon />
                                        </IconButton>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                          {hasPermission && hasPermission(permissionModule, 'edit') && (
                                            <IconButton
                                              size="small"
                                              onClick={() => handleEditProduct(provider, product)}
                                            >
                                              <EditIcon />
                                            </IconButton>
                                          )}
                                          {hasPermission && hasPermission(permissionModule, 'edit') && (
                                            <IconButton
                                              size="small"
                                              onClick={() => handleDeleteProduct(provider, product)}
                                            >
                                              <DeleteIcon />
                                            </IconButton>
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            ) : (
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                No products found for this provider.
                              </Typography>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Extranet Contacts View (initialTab === 1) */}
        {initialTab === 1 && (
          <>
            {/* Contacts Tab */}
            {currentTab === 0 && (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Region</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Available</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProviders.map((provider) => (
                      <React.Fragment key={provider.id}>
                        <TableRow 
                          hover
                          onClick={() => handleProviderRowClick(provider)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>{getRegionChip(provider.region)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ContactsIcon />
                              <Typography variant="body1" fontWeight="bold" sx={{ fontSize: '0.875rem' }}>
                                {provider.provider_name}
                              </Typography>
                              {expandedProvider === provider.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </Box>
                          </TableCell>
                          <TableCell>{getStatusChip(provider.available)}</TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              {hasPermission && hasPermission(permissionModule, 'edit') && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddContact(provider);
                                  }}
                                >
                                  Add Contact
                                </Button>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>

                        {/* Expanded Contacts Table */}
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
                            <Collapse in={expandedProvider === provider.id} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 1 }}>
                                <Typography variant="h6" gutterBottom component="div">
                                  Contacts
                                </Typography>
                                {contactsLoading[provider.id] ? (
                                  <LoadingIndicator message="Loading contacts..." size={16} sx={{ p: 1 }} />
                                ) : contacts[provider.id] && contacts[provider.id].length > 0 ? (
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Contact Type</TableCell>
                                        <TableCell>Contact Level</TableCell>
                                        <TableCell>Name</TableCell>
                                        <TableCell>Job Title</TableCell>
                                        <TableCell>Phone Number</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Last Updated</TableCell>
                                        <TableCell>Notes</TableCell>
                                        <TableCell align="center">Actions</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {contacts[provider.id].map((contact) => (
                                        <TableRow key={contact.id}>
                                          <TableCell>{contact.contact_type || '-'}</TableCell>
                                          <TableCell>{contact.contact_level || '-'}</TableCell>
                                          <TableCell>{contact.contact_name}</TableCell>
                                          <TableCell>{contact.job_title || '-'}</TableCell>
                                          <TableCell>{contact.phone_number || '-'}</TableCell>
                                          <TableCell>{contact.email || '-'}</TableCell>
                                          <TableCell>
                                            <Box>
                                              <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                                {contact.updated_at || contact.last_contact_updated ? 
                                                  formatTrackingDate(contact.updated_at || contact.last_contact_updated) : 
                                                  (contact.created_at ? formatTrackingDate(contact.created_at) : 'Unknown')
                                                }
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                                                {contact.username || 'System'}
                                              </Typography>
                                            </Box>
                                          </TableCell>
                                          <TableCell>
                                            {(contact.notes || contact.more_info) ? (
                                              <IconButton size="small" onClick={() => handleMoreInfo(contact.notes || contact.more_info)}>
                                                <InfoIcon />
                                              </IconButton>
                                            ) : '-'}
                                          </TableCell>
                                          <TableCell align="center">
                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                              {hasPermission && hasPermission(permissionModule, 'edit') && (
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleEditContact(provider, contact)}
                                                >
                                                  <EditIcon />
                                                </IconButton>
                                              )}
                                              {hasPermission && hasPermission(permissionModule, 'edit') && (
                                                <IconButton
                                                  size="small"
                                                  onClick={() => handleDeleteContact(provider, contact)}
                                                >
                                                  <DeleteIcon />
                                                </IconButton>
                                              )}
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                                    No contacts found for this provider.
                                  </Typography>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Overdue Contacts Tab */}
            {currentTab === 1 && (
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Provider</TableCell>
                      <TableCell>Contact Name</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Phone</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Days Overdue</TableCell>
                      <TableCell>Last Updated</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overdueContacts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 4, fontSize: '0.75rem' }}>
                            No overdue contacts found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      overdueContacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>{contact.provider_name}</TableCell>
                          <TableCell>{contact.contact_name}</TableCell>
                          <TableCell>{contact.email}</TableCell>
                          <TableCell>{contact.phone || '-'}</TableCell>
                          <TableCell>{contact.role || '-'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={`${contact.days_overdue} days`}
                              color="warning" 
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(contact.last_contact_updated).toLocaleDateString()}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Mark as updated (approve for another year)">
                              <IconButton 
                                size="small" 
                                onClick={() => handleApproveContact(contact.id)}
                                sx={{ color: 'green' }}
                              >
                                <CheckIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </Box>

      {/* Provider Dialog */}
      <Dialog open={providerDialogOpen} onClose={() => setProviderDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {providerDialogMode === 'add' ? 'Add Provider' : 'Edit Provider'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Provider Name *"
                value={providerFormData.provider_name}
                onChange={(e) => handleProviderInputChange('provider_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Salesperson Assigned"
                value={providerFormData.salesperson_assigned}
                onChange={(e) => handleProviderInputChange('salesperson_assigned', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Region</InputLabel>
                <Select
                  value={providerFormData.region}
                  onChange={(e) => handleProviderInputChange('region', e.target.value)}
                  label="Region"
                >
                  {regions.map(region => (
                    <MenuItem key={region} value={region}>{region}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Provider Resiliency</InputLabel>
                <Select
                  value={providerFormData.provider_resiliency}
                  onChange={(e) => handleProviderInputChange('provider_resiliency', e.target.value)}
                  label="Provider Resiliency"
                >
                  <MenuItem value="">None</MenuItem>
                  {providerResiliencyOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Website Link"
                value={providerFormData.website_link}
                onChange={(e) => handleProviderInputChange('website_link', e.target.value)}
                placeholder="https://example.com"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={providerFormData.available}
                    onChange={(e) => handleProviderInputChange('available', e.target.checked)}
                  />
                }
                label="Available"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Previously Known As"
                value={providerFormData.previously_known_as}
                onChange={(e) => handleProviderInputChange('previously_known_as', e.target.value)}
                placeholder="Enter previous names (comma-separated)"
                helperText="Multiple previous names can be entered, separated by commas"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="More Info"
                multiline
                rows={3}
                value={providerFormData.more_info}
                onChange={(e) => handleProviderInputChange('more_info', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProviderDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleProviderSubmit} variant="contained">
            {providerDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {productDialogMode === 'add' ? 'Add Product' : 'Edit Product'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="Product Name *"
                value={productFormData.product_name}
                onChange={(e) => handleProductInputChange('product_name', e.target.value)}
                required
                field="product_name"
                errors={productErrors}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                fullWidth
                label="ISF *"
                value={productFormData.isf}
                onChange={(e) => handleProductInputChange('isf', e.target.value)}
                required
                field="isf"
                errors={productErrors}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Suggested Bandwidth (Mb)"
                value={productFormData.suggested_bandwidth}
                onChange={(e) => handleProductInputChange('suggested_bandwidth', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>ISF Resiliency</InputLabel>
                <Select
                  value={productFormData.isf_resiliency}
                  onChange={(e) => handleProductInputChange('isf_resiliency', e.target.value)}
                  label="ISF Resiliency"
                >
                  <MenuItem value="">None</MenuItem>
                  {isfResiliencyOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={locationsList}
                value={productFormData.primary_datacenter || ''}
                onChange={(event, newValue) => {
                  handleProductInputChange('primary_datacenter', newValue || '');
                }}
                onInputChange={(event, newInputValue, reason) => {
                  if (reason === 'input') {
                    handleProductInputChange('primary_datacenter', newInputValue);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Primary Datacenter"
                    placeholder="Enter POP code (e.g., EQXLON4)"
                    helperText="Primary datacenter / POP code for this product"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Primary Pricing City"
                value={productFormData.primary_pricing_city}
                onChange={(e) => handleProductInputChange('primary_pricing_city', e.target.value)}
                helperText="Set manually if POP code doesn't resolve to a pricing city"
                placeholder="e.g., London"
              />
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={locationsList}
                value={productFormData.secondary_datacenters ? productFormData.secondary_datacenters.split(',').map(dc => dc.trim()).filter(dc => dc) : []}
                onChange={(event, newValue) => {
                  handleProductInputChange('secondary_datacenters', newValue.join(', '));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Secondary Datacenter(s)"
                    placeholder="Select or enter secondary datacenter codes"
                    helperText="Additional / secondary datacenter POP codes (optional)"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Design File (PDF)
                </Typography>
                
                {existingDesignFile && !productFormData.design_file ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.75rem' }}>
                      Current file: {existingDesignFile}
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleDeleteDesignFile}
                      disabled={fileDeleteLoading}
                    >
                      {fileDeleteLoading ? 'Deleting...' : 'Delete'}
                    </Button>
                  </Box>
                ) : null}
                
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachFileIcon />}
                  sx={{ height: '56px' }}
                >
                  {productFormData.design_file ? productFormData.design_file.name : 
                   (existingDesignFile ? 'Replace PDF Design' : 'Upload PDF Design')}
                  <input
                    type="file"
                    hidden
                    accept=".pdf"
                    onChange={handleFileChange}
                  />
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  Design Template (Any file, max 10MB)
                </Typography>
                
                {existingDesignTemplate && !productFormData.design_template ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="body2" sx={{ flexGrow: 1, fontSize: '0.75rem' }}>
                      Current template: {existingDesignTemplate}
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleDeleteDesignTemplate}
                      disabled={templateDeleteLoading}
                    >
                      {templateDeleteLoading ? 'Deleting...' : 'Delete'}
                    </Button>
                  </Box>
                ) : null}
                
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachFileIcon />}
                  sx={{ height: '56px' }}
                >
                  {productFormData.design_template ? productFormData.design_template.name : 
                   (existingDesignTemplate ? 'Replace Template' : 'Upload Design Template')}
                  <input
                    type="file"
                    hidden
                    onChange={handleTemplateFileChange}
                  />
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="More Info"
                multiline
                rows={3}
                value={productFormData.more_info}
                onChange={(e) => handleProductInputChange('more_info', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProductDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleProductSubmit} variant="contained">
            {productDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={contactDialogOpen} onClose={() => setContactDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {contactDialogMode === 'add' ? 'Add Contact' : 'Edit Contact'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={!!contactErrors.contact_type}>
                <InputLabel>Contact Type</InputLabel>
                <Select
                  value={contactFormData.contact_type}
                  onChange={(e) => handleContactInputChange('contact_type', e.target.value)}
                  label="Contact Type"
                >
                  {contactTypeOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
                {contactErrors.contact_type && (
                  <Typography variant="caption" color="error">{contactErrors.contact_type}</Typography>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Contact Level</InputLabel>
                <Select
                  value={contactFormData.contact_level}
                  onChange={(e) => handleContactInputChange('contact_level', e.target.value)}
                  label="Contact Level"
                >
                  <MenuItem value="">None</MenuItem>
                  {contactLevelOptions.map(option => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="contact_name"
                errors={contactErrors}
                required
                fullWidth
                label="Contact Name"
                name="contact_name"
                value={contactFormData.contact_name}
                onChange={(e) => handleContactInputChange('contact_name', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="job_title"
                errors={contactErrors}
                required
                fullWidth
                label="Job Title"
                name="job_title"
                value={contactFormData.job_title}
                onChange={(e) => handleContactInputChange('job_title', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="phone_number"
                errors={contactErrors}
                fullWidth
                label="Phone Number"
                name="phone_number"
                value={contactFormData.phone_number}
                onChange={(e) => handleContactInputChange('phone_number', e.target.value)}
                helperText="Required if Email is not provided"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <ValidatedTextField
                field="email"
                errors={contactErrors}
                fullWidth
                label="Email"
                type="email"
                name="email"
                value={contactFormData.email}
                onChange={(e) => handleContactInputChange('email', e.target.value)}
                helperText="Required if Phone Number is not provided"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={contactFormData.notes}
                onChange={(e) => handleContactInputChange('notes', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleContactSubmit} variant="contained">
            {contactDialogMode === 'add' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* More Info Dialog */}
      <Dialog open={moreInfoDialogOpen} onClose={() => {
        setMoreInfoDialogOpen(false);
        setProductTracking(null);
        setCurrentProductForInfo(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>More Information</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            {moreInfoContent}
          </DialogContentText>
          
          {/* Tracking Information */}
          {currentProductForInfo && (
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                {productTracking && productTracking.updated_date ? (
                  <>Last Updated: {productTracking.username || 'Unknown User'} {formatTrackingDate(productTracking.updated_date)}</>
                ) : (
                  'Last Updated: Not available'
                )}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMoreInfoDialogOpen(false);
            setProductTracking(null);
            setCurrentProductForInfo(null);
          }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Previously Known As Dialog */}
      <Dialog open={previouslyKnownAsDialogOpen} onClose={() => setPreviouslyKnownAsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Previously Known As</DialogTitle>
        <DialogContent>
          {previouslyKnownAsContent.length > 0 ? (
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {previouslyKnownAsContent.map((name, index) => (
                <li key={index}>
                  <Typography variant="body1">{name}</Typography>
                </li>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No previous names recorded.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviouslyKnownAsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this {deleteTarget?.type}? This action cannot be undone.
            {deleteTarget?.type === 'provider' && ' This will also delete all associated products and contacts.'}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success/Error Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
      >
        <Alert onClose={() => setSuccess(null)} severity="success" sx={{ width: '100%' }}>
          {success}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ExtranetDataManager;

