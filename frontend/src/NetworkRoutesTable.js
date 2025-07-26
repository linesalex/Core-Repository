import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { downloadTestResults } from './api';
import { API_BASE_URL } from './config';

const columns = [
  { id: 'location_a', label: 'Location\nA', vertical: true },
  { id: 'location_b', label: 'Location\nB', vertical: true },
  { id: 'circuit_id', label: 'UCN' },
  { id: 'expected_latency', label: 'Expected\nLatency\n(ms)', vertical: true },
  { id: 'live_latency', label: 'Live\nLatency\n(ms)', vertical: true },
  { id: 'bandwidth', label: 'Bandwidth' },
  { id: 'underlying_carrier', label: 'Underlying\nCarrier', vertical: true },
  { id: 'cable_system', label: 'Cable\nSystem', vertical: true },
  { id: 'is_special', label: 'Special/\nULL', vertical: true },
  { id: 'capacity_usage_percent', label: 'Capacity\nUsage %', vertical: true },
  { id: 'kmz_file_path', label: 'KMZ\nFile', align: 'center', vertical: true },
  { id: 'test_results_file', label: 'Test\nResults', align: 'center', vertical: true },
  { id: 'mtu', label: 'MTU\n(bytes)', vertical: true },
  { id: 'sla_latency', label: 'SLA\nLatency\n(ms)', vertical: true },
  { id: 'more_details', label: 'More\nDetails', vertical: true, align: 'center' },
];

const textCellStyle = {
  maxWidth: 220,
  maxHeight: 80,
  overflow: 'auto',
  whiteSpace: 'pre-line',
  wordBreak: 'break-word',
  padding: '6px 8px',
};

const SmallTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.75rem', // ~12px, 2pt smaller than default
  padding: '6px 8px',
}));

const SmallTableHeaderCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.8125rem', // ~13px, 2pt smaller than default header
  fontWeight: 600,
  padding: '6px 8px',
}));

const VerticalHeaderCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.8125rem',
  fontWeight: 600,
  padding: '6px 4px',
  whiteSpace: 'pre-line',
  textAlign: 'center',
  lineHeight: 1.2,
  minWidth: '60px',
}));

const compactButtonStyle = {
  fontSize: '0.75rem',
  minWidth: 0,
  padding: '2px 8px',
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

const linkStyle = {
  fontSize: '0.75rem',
  color: '#1976d2',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
  margin: 0,
  background: 'none',
  border: 'none',
  lineHeight: 1.5,
  display: 'inline',
};
const darkFiberLinkStyle = {
  ...linkStyle,
  color: '#9c27b0', // MUI secondary.main
};

function NetworkRoutesTable({ rows, onMoreDetails, onSelectRow, selectedRow, onOpenDarkFiber }) {
  const handleDownloadKMZ = async (filename) => {
    try {
      // Use fetch with authorization header
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/download_kmz/${filename}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      // Get the file blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('KMZ download failed:', error);
      alert('Failed to download KMZ file');
    }
  };
  const handleDownloadTestResults = async (circuit_id) => {
    try {
      await downloadTestResults(circuit_id);
    } catch (e) {
      alert('Failed to download test results files');
    }
  };
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map(col => {
              const HeaderCell = col.vertical ? VerticalHeaderCell : SmallTableHeaderCell;
              return (
                <HeaderCell key={col.id} align={col.align || 'left'}>
                  {col.label}
                </HeaderCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.circuit_id}
              hover
              selected={selectedRow && selectedRow.circuit_id === row.circuit_id}
              onClick={() => onSelectRow && onSelectRow(row)}
              style={{ cursor: onSelectRow ? 'pointer' : 'default' }}
            >
              {columns.map(col => {
                if (col.id === 'more_details') {
                  return (
                    <SmallTableCell key={col.id} style={{ ...textCellStyle, verticalAlign: 'middle', whiteSpace: 'nowrap' }} align="center">
                      <span
                        style={linkStyle}
                        onClick={e => { e.stopPropagation(); onMoreDetails(row); }}
                        tabIndex={0}
                        role="button"
                        onKeyPress={e => { if (e.key === 'Enter') { e.stopPropagation(); onMoreDetails(row); } }}
                      >
                        More Details
                      </span>
                    </SmallTableCell>
                  );
                }
                if (col.id === 'bandwidth' && row.bandwidth === 'Dark Fiber') {
                  return (
                    <SmallTableCell key={col.id} style={{ ...textCellStyle, verticalAlign: 'middle' }} align="left">
                      <span
                        style={darkFiberLinkStyle}
                        onClick={e => { e.stopPropagation(); onOpenDarkFiber(row.circuit_id); }}
                        tabIndex={0}
                        role="button"
                        onKeyPress={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenDarkFiber(row.circuit_id); } }}
                      >
                        Dark Fiber Details
                      </span>
                    </SmallTableCell>
                  );
                }
                if (col.id === 'kmz_file_path') {
                  return (
                    <SmallTableCell key={col.id} style={textCellStyle} align={col.align || 'left'}>
                      {row.kmz_file_path ? (
                        <Button onClick={e => { e.stopPropagation(); handleDownloadKMZ(row.kmz_file_path); }} color="success" size="small" startIcon={<CheckCircleIcon color="success" />}>
                          <CloudDownloadIcon fontSize="small" />
                        </Button>
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </SmallTableCell>
                  );
                }
                if (col.id === 'test_results_file') {
                  return (
                    <SmallTableCell key={col.id} style={textCellStyle} align={col.align || 'left'}>
                      {row.test_results_file ? (
                        <Button onClick={e => { e.stopPropagation(); handleDownloadTestResults(row.circuit_id); }} color="success" size="small" startIcon={<CheckCircleIcon color="success" />}>
                          <CloudDownloadIcon fontSize="small" />
                        </Button>
                      ) : (
                        <CancelIcon color="error" />
                      )}
                    </SmallTableCell>
                  );
                }
                const textHeavy = [
                  'test_results_link',
                  'cable_system',
                  'underlying_carrier',
                  'location_a',
                  'location_b',
                  'bandwidth',
                  'more_details',
                ];
                return (
                  <SmallTableCell key={col.id} style={textHeavy.includes(col.id) ? textCellStyle : {}} align={col.align || 'left'}>
                    {col.id === 'is_special' ? (row[col.id] ? 'Yes' : 'No') :
                     col.id === 'capacity_usage_percent' && row[col.id] ? `${row[col.id]}%` :
                     row[col.id]}
                  </SmallTableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default NetworkRoutesTable; 