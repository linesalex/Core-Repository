import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { downloadTestResults } from './api';

const columns = [
  { id: 'location_a', label: 'Location A' },
  { id: 'location_b', label: 'Location B' },
  { id: 'circuit_id', label: 'UCN' },
  { id: 'expected_latency', label: 'Expected Latency (ms)' },
  { id: 'live_latency', label: 'Live Latency (ms)' },
  { id: 'bandwidth', label: 'Bandwidth' },
  { id: 'underlying_carrier', label: 'Underlying Carrier' },
  { id: 'cable_system', label: 'Cable System' },
  { id: 'is_special', label: 'Special/ULL' },
  { id: 'kmz_file_path', label: 'KMZ File', align: 'center' },
  { id: 'test_results_file', label: 'Test Results', align: 'center' },
  { id: 'mtu', label: 'MTU' },
  { id: 'sla_latency', label: 'SLA Latency (ms)' },
  { id: 'more_details', label: 'More Details' },
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
  const handleDownloadKMZ = (filename) => {
    window.open(`/backend/kmz_files/${filename}`, '_blank');
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
            {columns.map(col => (
              <SmallTableHeaderCell key={col.id} align={col.align || 'left'}>{col.label}</SmallTableHeaderCell>
            ))}
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
                    <SmallTableCell key={col.id} style={{ ...textCellStyle, verticalAlign: 'middle', whiteSpace: 'nowrap' }} align="center">
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
                    {col.id === 'is_special' ? (row[col.id] ? 'Yes' : 'No') : row[col.id]}
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