import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, Tab, Select, MenuItem, FormControl, InputLabel, Chip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Grid, Card, CardContent,
  Alert, CircularProgress, Tooltip, List, ListItem, ListItemText, Divider, Badge
} from '@mui/material';
import {
  BugReport as BugIcon,
  Lightbulb as FeatureIcon,
  Send as SendIcon,
  AttachFile as AttachIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Comment as CommentIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import {
  submitFeedback,
  getMyFeedback,
  getAllFeedback,
  getFeedbackStatistics,
  getFeedbackDetails,
  updateFeedbackStatus,
  addFeedbackComment,
  downloadFeedbackAttachment,
  deleteFeedbackAttachment
} from './api';
import { useAuth } from './AuthContext';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const FeedbackManager = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrator';
  
  // State
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    type: 'Bug',
    priority: 2,
    description: ''
  });
  const [attachments, setAttachments] = useState([]);
  
  // My submissions state
  const [mySubmissions, setMySubmissions] = useState([]);
  const [myFilters, setMyFilters] = useState({ status: '', type: '' });
  
  // Admin state
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [adminFilters, setAdminFilters] = useState({ status: '', type: '', priority: '', search: '' });
  const [statistics, setStatistics] = useState(null);
  
  // Details dialog state
  const [detailsDialog, setDetailsDialog] = useState({ open: false, feedback: null });
  const [newComment, setNewComment] = useState('');
  
  // Status update dialog state
  const [statusDialog, setStatusDialog] = useState({ 
    open: false, 
    feedbackId: null, 
    currentStatus: '', 
    newStatus: '',
    adminNotes: '',
    versionCompleted: ''
  });
  
  useEffect(() => {
    if (currentTab === 1) {
      loadMySubmissions();
    } else if (currentTab === 2 && isAdmin) {
      loadAllSubmissions();
      loadStatistics();
    }
  }, [currentTab, myFilters, adminFilters]);
  
  // Load user's own submissions
  const loadMySubmissions = async () => {
    setLoading(true);
    try {
      const data = await getMyFeedback(myFilters);
      setMySubmissions(data);
    } catch (err) {
      setError(`Failed to load submissions: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Load all submissions (admin)
  const loadAllSubmissions = async () => {
    setLoading(true);
    try {
      const data = await getAllFeedback(adminFilters);
      setAllSubmissions(data);
    } catch (err) {
      setError(`Failed to load submissions: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Load statistics (admin)
  const loadStatistics = async () => {
    try {
      const stats = await getFeedbackStatistics();
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load statistics:', err);
    }
  };
  
  // Handle form input change
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  // Handle file selection
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    
    // Check max 3 files
    if (files.length > 3) {
      setError('Maximum 3 files allowed');
      return;
    }
    
    // Check file sizes (5MB each)
    const oversized = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      setError(`File(s) too large: ${oversized.map(f => f.name).join(', ')}. Maximum 5MB per file.`);
      return;
    }
    
    setAttachments(files);
    setError('');
  };
  
  // Remove attachment
  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  
  // Submit feedback
  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      setError('Please provide a description');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const data = new FormData();
      data.append('type', formData.type);
      data.append('priority', formData.priority);
      data.append('description', formData.description);
      
      attachments.forEach((file) => {
        data.append('attachments', file);
      });
      
      const response = await submitFeedback(data);
      setSuccess(`Feedback submitted successfully! Your request ID is #${response.data.feedback_id}`);
      
      // Reset form
      setFormData({ type: 'Bug', priority: 2, description: '' });
      setAttachments([]);
      
      // Switch to My Submissions tab
      setTimeout(() => {
        setCurrentTab(1);
      }, 2000);
    } catch (err) {
      setError(`Failed to submit feedback: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Open details dialog
  const handleViewDetails = async (feedbackId) => {
    setLoading(true);
    try {
      const details = await getFeedbackDetails(feedbackId);
      setDetailsDialog({ open: true, feedback: details });
    } catch (err) {
      setError(`Failed to load details: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Close details dialog
  const handleCloseDetails = () => {
    setDetailsDialog({ open: false, feedback: null });
    setNewComment('');
  };
  
  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      await addFeedbackComment(detailsDialog.feedback.id, newComment.trim());
      setNewComment('');
      // Reload details
      const details = await getFeedbackDetails(detailsDialog.feedback.id);
      setDetailsDialog({ open: true, feedback: details });
      setSuccess('Comment added successfully');
    } catch (err) {
      setError(`Failed to add comment: ${err.response?.data?.error || err.message}`);
    }
  };
  
  // Open status update dialog (admin)
  const handleOpenStatusDialog = (feedback) => {
    setStatusDialog({
      open: true,
      feedbackId: feedback.id,
      currentStatus: feedback.status,
      newStatus: feedback.status,
      adminNotes: '',
      versionCompleted: feedback.version_completed || ''
    });
  };
  
  // Close status dialog
  const handleCloseStatusDialog = () => {
    setStatusDialog({
      open: false,
      feedbackId: null,
      currentStatus: '',
      newStatus: '',
      adminNotes: '',
      versionCompleted: ''
    });
  };
  
  // Update status (admin)
  const handleUpdateStatus = async () => {
    if (!statusDialog.newStatus) {
      setError('Please select a status');
      return;
    }
    
    setLoading(true);
    try {
      await updateFeedbackStatus(statusDialog.feedbackId, {
        status: statusDialog.newStatus,
        admin_notes: statusDialog.adminNotes.trim() || undefined,
        version_completed: statusDialog.newStatus === 'Complete' ? statusDialog.versionCompleted : undefined
      });
      
      setSuccess('Status updated successfully');
      handleCloseStatusDialog();
      
      // Reload data
      if (detailsDialog.open) {
        const details = await getFeedbackDetails(detailsDialog.feedback.id);
        setDetailsDialog({ open: true, feedback: details });
      }
      loadAllSubmissions();
      loadStatistics();
    } catch (err) {
      setError(`Failed to update status: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Get priority label
  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return 'Urgent';
      case 2: return 'ASAP';
      case 3: return 'Informational';
      default: return 'Unknown';
    }
  };
  
  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 1: return 'error';
      case 2: return 'warning';
      case 3: return 'info';
      default: return 'default';
    }
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'New': return 'info';
      case 'In Progress': return 'warning';
      case 'Complete': return 'success';
      case 'Closed/Won\'t Fix': return 'default';
      default: return 'default';
    }
  };
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };
  
  // Handle tab change
  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setError('');
    setSuccess('');
  };
  
  return (
    <Box sx={{ width: '100%', p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Feedback & Bug Reports
      </Typography>
      
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Tabs value={currentTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="New Submission" />
        <Tab label="My Submissions" />
        {isAdmin && <Tab label="Admin Dashboard" />}
      </Tabs>
      
      {/* Tab 1: New Submission */}
      <TabPanel value={currentTab} index={0}>
        <Paper sx={{ p: 3, maxWidth: 800 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Submit a Bug Report or Feature Request
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="User"
                value={user?.full_name || user?.username || ''}
                disabled
                fullWidth
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  label="Type"
                >
                  <MenuItem value="Bug">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BugIcon color="error" />
                      Bug
                    </Box>
                  </MenuItem>
                  <MenuItem value="Feature Request">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FeatureIcon color="primary" />
                      Feature Request
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                  label="Priority"
                >
                  <MenuItem value={1}>1 - Urgent</MenuItem>
                  <MenuItem value={2}>2 - ASAP</MenuItem>
                  <MenuItem value={3}>3 - Informational</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                label="Bug / Feature Info"
                multiline
                rows={6}
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
                placeholder="Please describe the bug or feature request in detail..."
                fullWidth
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachIcon />}
                  sx={{ mb: 2 }}
                >
                  Upload Files (Max 3, 5MB each)
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={handleFileChange}
                  />
                </Button>
                
                {attachments.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {attachments.map((file, index) => (
                      <Chip
                        key={index}
                        label={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
                        onDelete={() => removeAttachment(index)}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </Box>
            </Grid>
            
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<SendIcon />}
                onClick={handleSubmit}
                disabled={loading || !formData.description.trim()}
                fullWidth
              >
                {loading ? <CircularProgress size={24} /> : 'Submit Feedback'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </TabPanel>
      
      {/* Tab 2: My Submissions */}
      <TabPanel value={currentTab} index={1}>
        <Paper sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Status</InputLabel>
                <Select
                  value={myFilters.status}
                  onChange={(e) => setMyFilters({ ...myFilters, status: e.target.value })}
                  label="Filter by Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Complete">Complete</MenuItem>
                  <MenuItem value="Closed/Won't Fix">Closed/Won't Fix</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Filter by Type</InputLabel>
                <Select
                  value={myFilters.type}
                  onChange={(e) => setMyFilters({ ...myFilters, type: e.target.value })}
                  label="Filter by Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="Bug">Bug</MenuItem>
                  <MenuItem value="Feature Request">Feature Request</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={loadMySubmissions}
                fullWidth
              >
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </Paper>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mySubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No submissions found
                    </TableCell>
                  </TableRow>
                ) : (
                  mySubmissions.map((submission) => (
                    <TableRow 
                      key={submission.id}
                      sx={{ 
                        backgroundColor: submission.priority === 1 ? 'rgba(211, 47, 47, 0.08)' : 'inherit'
                      }}
                    >
                      <TableCell>#{submission.id}</TableCell>
                      <TableCell>
                        <Chip
                          icon={submission.type === 'Bug' ? <BugIcon /> : <FeatureIcon />}
                          label={submission.type}
                          size="small"
                          color={submission.type === 'Bug' ? 'error' : 'primary'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getPriorityLabel(submission.priority)}
                          size="small"
                          color={getPriorityColor(submission.priority)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300 }} noWrap>
                          {submission.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={submission.status}
                          size="small"
                          color={getStatusColor(submission.status)}
                        />
                      </TableCell>
                      <TableCell>{formatDate(submission.created_at)}</TableCell>
                      <TableCell>
                        {submission.version_completed || '-'}
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Details">
                          <IconButton onClick={() => handleViewDetails(submission.id)} size="small">
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        {submission.comment_count > 0 && (
                          <Badge badgeContent={submission.comment_count} color="primary">
                            <CommentIcon fontSize="small" />
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>
      
      {/* Tab 3: Admin Dashboard */}
      {isAdmin && (
        <TabPanel value={currentTab} index={2}>
          {/* Statistics Cards */}
          {statistics && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>
                      Total Submissions
                    </Typography>
                    <Typography variant="h4">
                      {statistics.total}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'error.light', color: 'white' }}>
                  <CardContent>
                    <Typography gutterBottom>
                      Urgent Bugs
                    </Typography>
                    <Typography variant="h4">
                      {statistics.urgentBugs}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
                  <CardContent>
                    <Typography gutterBottom>
                      Urgent Features
                    </Typography>
                    <Typography variant="h4">
                      {statistics.urgentFeatures}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ bgcolor: 'success.light', color: 'white' }}>
                  <CardContent>
                    <Typography gutterBottom>
                      Completed
                    </Typography>
                    <Typography variant="h4">
                      {statistics.byStatus?.find(s => s.status === 'Complete')?.count || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
          
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Search"
                  size="small"
                  value={adminFilters.search}
                  onChange={(e) => setAdminFilters({ ...adminFilters, search: e.target.value })}
                  fullWidth
                  placeholder="Search description or user..."
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={adminFilters.status}
                    onChange={(e) => setAdminFilters({ ...adminFilters, status: e.target.value })}
                    label="Status"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="New">New</MenuItem>
                    <MenuItem value="In Progress">In Progress</MenuItem>
                    <MenuItem value="Complete">Complete</MenuItem>
                    <MenuItem value="Closed/Won't Fix">Closed/Won't Fix</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={adminFilters.type}
                    onChange={(e) => setAdminFilters({ ...adminFilters, type: e.target.value })}
                    label="Type"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="Bug">Bug</MenuItem>
                    <MenuItem value="Feature Request">Feature Request</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={adminFilters.priority}
                    onChange={(e) => setAdminFilters({ ...adminFilters, priority: e.target.value })}
                    label="Priority"
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="1">Urgent</MenuItem>
                    <MenuItem value="2">ASAP</MenuItem>
                    <MenuItem value="3">Informational</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button
                  variant="contained"
                  startIcon={<FilterIcon />}
                  onClick={loadAllSubmissions}
                  fullWidth
                >
                  Apply Filters
                </Button>
              </Grid>
            </Grid>
          </Paper>
          
          {/* Admin Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {allSubmissions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No submissions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    allSubmissions.map((submission) => (
                      <TableRow 
                        key={submission.id}
                        sx={{ 
                          backgroundColor: submission.priority === 1 ? 'rgba(211, 47, 47, 0.08)' : 'inherit'
                        }}
                      >
                        <TableCell>#{submission.id}</TableCell>
                        <TableCell>{submission.full_name || submission.username}</TableCell>
                        <TableCell>
                          <Chip
                            icon={submission.type === 'Bug' ? <BugIcon /> : <FeatureIcon />}
                            label={submission.type}
                            size="small"
                            color={submission.type === 'Bug' ? 'error' : 'primary'}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getPriorityLabel(submission.priority)}
                            size="small"
                            color={getPriorityColor(submission.priority)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300 }} noWrap>
                            {submission.description}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={submission.status}
                            size="small"
                            color={getStatusColor(submission.status)}
                          />
                        </TableCell>
                        <TableCell>{formatDate(submission.created_at)}</TableCell>
                        <TableCell>
                          <Tooltip title="View Details">
                            <IconButton onClick={() => handleViewDetails(submission.id)} size="small">
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Update Status">
                            <IconButton onClick={() => handleOpenStatusDialog(submission)} size="small" color="primary">
                              <CommentIcon />
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
        </TabPanel>
      )}
      
      {/* Details Dialog */}
      <Dialog 
        open={detailsDialog.open} 
        onClose={handleCloseDetails}
        maxWidth="md"
        fullWidth
      >
        {detailsDialog.feedback && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Feedback #{detailsDialog.feedback.id} - {detailsDialog.feedback.type}
                </Typography>
                <IconButton onClick={handleCloseDetails} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">Submitted By</Typography>
                  <Typography>{detailsDialog.feedback.full_name || detailsDialog.feedback.username}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">Priority</Typography>
                  <Chip
                    label={getPriorityLabel(detailsDialog.feedback.priority)}
                    size="small"
                    color={getPriorityColor(detailsDialog.feedback.priority)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">Status</Typography>
                  <Chip
                    label={detailsDialog.feedback.status}
                    size="small"
                    color={getStatusColor(detailsDialog.feedback.status)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="textSecondary">Version Completed</Typography>
                  <Typography>{detailsDialog.feedback.version_completed || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="textSecondary">Description</Typography>
                  <Paper sx={{ p: 2, mt: 1, bgcolor: 'grey.100' }}>
                    <Typography>{detailsDialog.feedback.description}</Typography>
                  </Paper>
                </Grid>
                
                {detailsDialog.feedback.attachments && detailsDialog.feedback.attachments.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                      Attachments
                    </Typography>
                    {detailsDialog.feedback.attachments.map((attachment) => (
                      <Chip
                        key={attachment.id}
                        label={attachment.original_filename}
                        onClick={() => downloadFeedbackAttachment(detailsDialog.feedback.id, attachment.filename)}
                        icon={<DownloadIcon />}
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Grid>
                )}
                
                {detailsDialog.feedback.history && detailsDialog.feedback.history.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                      Status History
                    </Typography>
                    <List dense>
                      {detailsDialog.feedback.history.map((entry) => (
                        <ListItem key={entry.id}>
                          <ListItemText
                            primary={`${entry.old_status} → ${entry.new_status}`}
                            secondary={
                              <>
                                <Typography variant="body2" component="span">
                                  By {entry.full_name || entry.username} on {formatDate(entry.changed_at)}
                                </Typography>
                                {entry.admin_notes && (
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    Note: {entry.admin_notes}
                                  </Typography>
                                )}
                              </>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                )}
                
                {detailsDialog.feedback.comments && detailsDialog.feedback.comments.length > 0 && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                      Comments
                    </Typography>
                    <List dense>
                      {detailsDialog.feedback.comments.map((comment) => (
                        <React.Fragment key={comment.id}>
                          <ListItem>
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2" fontWeight="bold">
                                    {comment.full_name || comment.username}
                                  </Typography>
                                  {comment.is_admin_note === 1 && (
                                    <Chip label="Admin" size="small" color="secondary" />
                                  )}
                                </Box>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2">{comment.comment}</Typography>
                                  <Typography variant="caption" color="textSecondary">
                                    {formatDate(comment.created_at)}
                                  </Typography>
                                </>
                              }
                            />
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                    </List>
                  </Grid>
                )}
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" color="textSecondary" sx={{ mb: 1 }}>
                    Add Comment
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Type your comment..."
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<SendIcon />}
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    sx={{ mt: 1 }}
                  >
                    Add Comment
                  </Button>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
      
      {/* Status Update Dialog (Admin only) */}
      <Dialog open={statusDialog.open} onClose={handleCloseStatusDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Update Status</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>New Status</InputLabel>
                <Select
                  value={statusDialog.newStatus}
                  onChange={(e) => setStatusDialog({ ...statusDialog, newStatus: e.target.value })}
                  label="New Status"
                >
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Complete">Complete</MenuItem>
                  <MenuItem value="Closed/Won't Fix">Closed/Won't Fix</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            {statusDialog.newStatus === 'Complete' && (
              <Grid item xs={12}>
                <TextField
                  label="Version Completed"
                  value={statusDialog.versionCompleted}
                  onChange={(e) => setStatusDialog({ ...statusDialog, versionCompleted: e.target.value })}
                  placeholder="e.g., v2.5.0"
                  fullWidth
                />
              </Grid>
            )}
            
            <Grid item xs={12}>
              <TextField
                label="Admin Notes"
                multiline
                rows={4}
                value={statusDialog.adminNotes}
                onChange={(e) => setStatusDialog({ ...statusDialog, adminNotes: e.target.value })}
                placeholder="Add notes about this status change..."
                fullWidth
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStatusDialog}>Cancel</Button>
          <Button 
            onClick={handleUpdateStatus} 
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Update Status'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FeedbackManager;

