import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box,
  Chip, Stack, Divider, CircularProgress, Alert, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import MapIcon from '@mui/icons-material/Map';
import { customerRouteApi } from './api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString();
}

function locationLabel(route, prefix) {
  return route?.[`${prefix}_pop_code`] || '—';
}

// Quick-access popup for a Customer Routes row: shows the route summary and
// its full KMZ upload history, with every file (current + historical)
// downloadable directly from the list.
function CustomerRouteKmzHistoryDialog({ open, onClose, route, onEdit }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !route?.circuit_id) return;
    setError('');
    setLoading(true);
    customerRouteApi.getKmzHistory(route.circuit_id)
      .then((files) => setHistory(files || []))
      .catch((err) => {
        console.error('Failed to load KMZ history:', err);
        setError('Failed to load KMZ history: ' + (err.response?.data?.error || err.message));
        setHistory([]);
      })
      .finally(() => setLoading(false));
  }, [open, route]);

  const handleDownload = (file) => {
    customerRouteApi.downloadKmz(file.id, file.original_filename);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          {route?.circuit_id}
          {route?.route_type && (
            <Chip
              size="small"
              label={route.route_type}
              color={route.route_type === 'Aggregate' ? 'primary' : 'default'}
              variant="outlined"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="body2"><strong>Customer:</strong> {route?.customer_name}</Typography>
          <Typography variant="body2"><strong>Location A:</strong> {locationLabel(route, 'location_a')}</Typography>
          <Typography variant="body2"><strong>Location B:</strong> {locationLabel(route, 'location_b')}</Typography>
          {route?.notes && (
            <Typography variant="body2"><strong>Notes:</strong> {route.notes}</Typography>
          )}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon fontSize="small" /> KMZ Upload History
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : history.length > 0 ? (
          <Stack spacing={1}>
            {history.map((file, idx) => (
              <Box
                key={file.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, border: '1px solid #ddd', borderRadius: 1 }}
              >
                {idx === 0 && <Chip label="Current" size="small" color="primary" />}
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {file.original_filename}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    uploaded {formatDate(file.uploaded_at)}
                  </Typography>
                </Typography>
                <Button size="small" startIcon={<DownloadIcon />} onClick={() => handleDownload(file)}>
                  Download
                </Button>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No KMZ files uploaded yet
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {onEdit && (
          <Button onClick={() => onEdit(route)}>Edit Route</Button>
        )}
        <Button onClick={onClose} variant="contained">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default CustomerRouteKmzHistoryDialog;
