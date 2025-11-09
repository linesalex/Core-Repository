import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Grid, Tabs, Tab, CircularProgress, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  FormControl, InputLabel, Select, MenuItem, Button, TextField, IconButton,
  Chip
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PeopleIcon from '@mui/icons-material/People';
import CalculateIcon from '@mui/icons-material/Calculate';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  getAnalyticsOverview,
  getAnalyticsDesignPricing,
  getAnalyticsAllocatedCost,
  getAnalyticsUsers,
  getAnalyticsPerformance
} from './api';

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Tab Panel Component
function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// Export to CSV helper
const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Calculate growth percentage
const calculateGrowth = (current, previous) => {
  if (!previous || previous === 0) return 'N/A';
  const growth = ((current - previous) / previous) * 100;
  return growth.toFixed(1) + '%';
};

const AnalyticsDashboard = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Date range states per tab
  const [overviewDateRange, setOverviewDateRange] = useState('all');
  const [designDateRange, setDesignDateRange] = useState('all');
  const [allocatedDateRange, setAllocatedDateRange] = useState('all');
  const [userDateRange, setUserDateRange] = useState('all');
  const [performanceDateRange, setPerformanceDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [designData, setDesignData] = useState(null);
  const [allocatedData, setAllocatedData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);

  // Get date range based on selection
  const getDateRange = (rangeType, customStart, customEnd) => {
    const now = new Date();
    let startDate = null;
    let endDate = now.toISOString();

    switch (rangeType) {
      case '7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case '90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'year':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'custom':
        startDate = customStart ? new Date(customStart).toISOString() : null;
        endDate = customEnd ? new Date(customEnd).toISOString() : endDate;
        break;
      case 'all':
      default:
        startDate = null;
        endDate = null;
        break;
    }

    return { startDate, endDate };
  };

  // Load data functions
  const loadOverviewData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(overviewDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsOverview(startDate, endDate);
      setOverviewData(data);
    } catch (err) {
      console.error('Error loading overview data:', err);
      setError('Failed to load overview analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDesignData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(designDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsDesignPricing(startDate, endDate);
      setDesignData(data);
    } catch (err) {
      console.error('Error loading design pricing data:', err);
      setError('Failed to load design pricing analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAllocatedData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(allocatedDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsAllocatedCost(startDate, endDate);
      setAllocatedData(data);
    } catch (err) {
      console.error('Error loading allocated cost data:', err);
      setError('Failed to load allocated cost analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(userDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsUsers(startDate, endDate);
      setUserData(data);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load user analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(performanceDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsPerformance(startDate, endDate);
      setPerformanceData(data);
    } catch (err) {
      console.error('Error loading performance data:', err);
      setError('Failed to load performance analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load data when tab changes or date range changes
  useEffect(() => {
    if (currentTab === 0) loadOverviewData();
    // eslint-disable-next-line
  }, [currentTab, overviewDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (currentTab === 1) loadDesignData();
    // eslint-disable-next-line
  }, [currentTab, designDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (currentTab === 2) loadAllocatedData();
    // eslint-disable-next-line
  }, [currentTab, allocatedDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (currentTab === 3) loadUserData();
    // eslint-disable-next-line
  }, [currentTab, userDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (currentTab === 4) loadPerformanceData();
    // eslint-disable-next-line
  }, [currentTab, performanceDateRange, customStartDate, customEndDate]);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setError(null);
  };

  // Render date range selector
  const renderDateRangeSelector = (dateRange, setDateRange) => (
    <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel>Date Range</InputLabel>
        <Select value={dateRange} label="Date Range" onChange={(e) => setDateRange(e.target.value)}>
          <MenuItem value="all">All Time</MenuItem>
          <MenuItem value="7days">Last 7 Days</MenuItem>
          <MenuItem value="30days">Last 30 Days</MenuItem>
          <MenuItem value="90days">Last 90 Days</MenuItem>
          <MenuItem value="year">Last Year</MenuItem>
          <MenuItem value="custom">Custom Range</MenuItem>
        </Select>
      </FormControl>
      
      {dateRange === 'custom' && (
        <>
          <TextField
            type="date"
            label="Start Date"
            size="small"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            label="End Date"
            size="small"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </>
      )}
    </Box>
  );

  // Process monthly trends for visualization
  const processMonthlyTrends = (trends) => {
    if (!trends || trends.length === 0) return { chartData: [], growthData: [] };
    
    const monthlyData = {};
    trends.forEach(item => {
      if (!monthlyData[item.month]) {
        monthlyData[item.month] = { month: item.month, design: 0, allocated: 0 };
      }
      if (item.tool === 'design') {
        monthlyData[item.month].design = item.count;
      } else {
        monthlyData[item.month].allocated = item.count;
      }
    });
    
    const chartData = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    
    // Calculate growth
    const growthData = chartData.map((item, index) => {
      if (index === 0) return { ...item, growth: 'N/A' };
      const prev = chartData[index - 1];
      const currentTotal = item.design + item.allocated;
      const prevTotal = prev.design + prev.allocated;
      return {
        ...item,
        growth: calculateGrowth(currentTotal, prevTotal),
        growthValue: prevTotal === 0 ? 0 : ((currentTotal - prevTotal) / prevTotal) * 100
      };
    });
    
    return { chartData, growthData };
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Analytics Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Usage analytics for Design & Pricing and Allocated Cost Calculator tools
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={currentTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Design & Pricing" />
          <Tab label="Allocated Cost Calculator" />
          <Tab label="User Analytics" />
          <Tab label="Performance" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={currentTab} index={0}>
        {renderDateRangeSelector(overviewDateRange, setOverviewDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : overviewData ? (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Calculations
                    </Typography>
                    <Typography variant="h4">
                      {overviewData.totalCalculations.toLocaleString()}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip label={`Design: ${overviewData.designCalculations}`} size="small" color="primary" />
                      <Chip label={`Allocated: ${overviewData.allocatedCalculations}`} size="small" color="secondary" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon color="primary" />
                      <Typography color="text.secondary" gutterBottom>
                        Active Users
                      </Typography>
                    </Box>
                    <Typography variant="h4">
                      {overviewData.activeUsers}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Monthly Trends Chart */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Month-to-Month Trends</Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const { chartData } = processMonthlyTrends(overviewData.monthlyTrends);
                      exportToCSV(chartData, 'monthly_trends');
                    }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={processMonthlyTrends(overviewData.monthlyTrends).chartData.slice(-12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="design" stroke="#0088FE" name="Design & Pricing" />
                    <Line type="monotone" dataKey="allocated" stroke="#00C49F" name="Allocated Cost" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Growth Table */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Monthly Growth Analysis</Typography>
                  <IconButton
                    size="small"
                    onClick={() => {
                      const { growthData } = processMonthlyTrends(overviewData.monthlyTrends);
                      exportToCSV(growthData, 'growth_analysis');
                    }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Month</TableCell>
                        <TableCell align="right">Design & Pricing</TableCell>
                        <TableCell align="right">Allocated Cost</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right">Growth</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {processMonthlyTrends(overviewData.monthlyTrends).growthData.slice(-12).reverse().map((row) => {
                        const total = row.design + row.allocated;
                        const isNegative = row.growthValue < 0;
                        const isPositive = row.growthValue > 0;
                        return (
                          <TableRow key={row.month}>
                            <TableCell>{row.month}</TableCell>
                            <TableCell align="right">{row.design}</TableCell>
                            <TableCell align="right">{row.allocated}</TableCell>
                            <TableCell align="right"><strong>{total}</strong></TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                {row.growth}
                                {isPositive && <TrendingUpIcon sx={{ color: 'success.main', fontSize: 18 }} />}
                                {isNegative && <TrendingDownIcon sx={{ color: 'error.main', fontSize: 18 }} />}
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
      </TabPanel>

      {/* Design & Pricing Tab */}
      <TabPanel value={currentTab} index={1}>
        {renderDateRangeSelector(designDateRange, setDesignDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : designData ? (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Calculations
                    </Typography>
                    <Typography variant="h4">
                      {designData.totalCalculations.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Avg Suggested Price (USD)
                    </Typography>
                    <Typography variant="h4">
                      ${parseFloat(designData.averageSuggestedPrice || 0).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Avg Response Time
                    </Typography>
                    <Typography variant="h4">
                      {designData.averageResponseTime}ms
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Top Route Pairs */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Most Searched Route Pairs</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(designData.routePairs, 'design_route_pairs')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Route Pair</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {designData.routePairs.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.route}</TableCell>
                          <TableCell align="right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* City Codes */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top City Codes</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.cityCodes, 'design_city_codes')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>City Code</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.cityCodes.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.city}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Individual Locations */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Individual Locations</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.individualLocations, 'design_locations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Location</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.individualLocations.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.location}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              {/* Bandwidth Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Bandwidth Distribution</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.bandwidthRanges, 'design_bandwidth')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={designData.bandwidthRanges}
                          dataKey="count"
                          nameKey="range"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {designData.bandwidthRanges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Customers */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Customers</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.topCustomers, 'design_customers')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Customer</TableCell>
                            <TableCell align="right">Quotes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.topCustomers.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{item.customer}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        ) : null}
      </TabPanel>

      {/* Allocated Cost Calculator Tab */}
      <TabPanel value={currentTab} index={2}>
        {renderDateRangeSelector(allocatedDateRange, setAllocatedDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : allocatedData ? (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Calculations
                    </Typography>
                    <Typography variant="h4">
                      {allocatedData.totalCalculations.toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Unique Quote IDs
                    </Typography>
                    <Typography variant="h4">
                      {allocatedData.uniqueQuoteIds}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Avg Suggested Price (USD)
                    </Typography>
                    <Typography variant="h4">
                      ${parseFloat(allocatedData.averageSuggestedPrice || 0).toLocaleString()}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Quote Request IDs */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Quote Request IDs (Most Searched)</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(allocatedData.quoteRequestIds, 'quote_request_ids')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Quote Request ID</TableCell>
                        <TableCell align="right">Search Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allocatedData.quoteRequestIds.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.quoteId}</TableCell>
                          <TableCell align="right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            {/* Top Route Pairs */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Most Searched Route Pairs</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(allocatedData.routePairs, 'allocated_route_pairs')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Route Pair</TableCell>
                        <TableCell align="right">Count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allocatedData.routePairs.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.route}</TableCell>
                          <TableCell align="right">{item.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* City Codes */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top City Codes</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.cityCodes, 'allocated_city_codes')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>City Code</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.cityCodes.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.city}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Individual Locations */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Individual Locations</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.individualLocations, 'allocated_locations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Location</TableCell>
                            <TableCell align="right">Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.individualLocations.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.location}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              {/* Bandwidth Distribution */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Bandwidth Distribution</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.bandwidthRanges, 'allocated_bandwidth')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={allocatedData.bandwidthRanges}
                          dataKey="count"
                          nameKey="range"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {allocatedData.bandwidthRanges.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Top Customers */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Customers</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.topCustomers, 'allocated_customers')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Customer</TableCell>
                            <TableCell align="right">Quotes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.topCustomers.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{item.customer}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        ) : null}
      </TabPanel>

      {/* User Analytics Tab */}
      <TabPanel value={currentTab} index={3}>
        {renderDateRangeSelector(userDateRange, setUserDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : userData ? (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Total Registered Users
                    </Typography>
                    <Typography variant="h4">
                      {userData.totalUsers}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              {/* User Registrations Over Time */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">User Registrations Over Time</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(userData.userRegistrations, 'user_registrations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={userData.userRegistrations.slice(-12).reverse()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#0088FE" name="New Users" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Daily Login Counts */}
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Daily Login Activity (Last 30 Days)</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(userData.dailyLoginCounts, 'daily_login_counts')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={userData.dailyLoginCounts.slice(-30).reverse()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total_logins" stroke="#00C49F" name="Total Logins" />
                        <Line type="monotone" dataKey="unique_users" stroke="#0088FE" name="Unique Users" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Most Active Users */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Most Active Users</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(userData.mostActiveUsers, 'most_active_users')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell>Full Name</TableCell>
                        <TableCell align="right">Design & Pricing</TableCell>
                        <TableCell align="right">Allocated Cost</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {userData.mostActiveUsers.map((user, index) => (
                        <TableRow key={index}>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.fullName || '-'}</TableCell>
                          <TableCell align="right">{user.designCalculations}</TableCell>
                          <TableCell align="right">{user.allocatedCalculations}</TableCell>
                          <TableCell align="right"><strong>{user.totalCalculations}</strong></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
      </TabPanel>

      {/* Performance Tab */}
      <TabPanel value={currentTab} index={4}>
        {renderDateRangeSelector(performanceDateRange, setPerformanceDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : performanceData ? (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography color="text.secondary" gutterBottom>
                      Average Response Time
                    </Typography>
                    <Typography variant="h4">
                      {performanceData.averageResponseTime}ms
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Design & Pricing calculations
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Daily Average Response Times */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Daily Average Response Times (Last 30 Days)</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(performanceData.dailyAverageResponseTimes, 'daily_response_times')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData.dailyAverageResponseTimes.slice(-30).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="avgTime" stroke="#0088FE" name="Avg Response Time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Calculations Per Day */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Calculations Per Day (Last 90 Days)</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(performanceData.calculationsPerDay, 'calculations_per_day')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performanceData.calculationsPerDay.slice(-90).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#00C49F" name="Calculations" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Usage by Time of Day Heatmap */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Usage by Day of Week and Hour</Typography>
                  <IconButton size="small" onClick={() => exportToCSV(performanceData.calculationsByTimeOfDay, 'usage_by_time')}>
                    <DownloadIcon />
                  </IconButton>
                </Box>
                <TableContainer sx={{ maxHeight: 500 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Day of Week</TableCell>
                        <TableCell>Hour</TableCell>
                        <TableCell align="right">Calculations</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {performanceData.calculationsByTimeOfDay
                        .sort((a, b) => {
                          if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
                          return a.hour - b.hour;
                        })
                        .map((row, index) => {
                          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                          return (
                            <TableRow key={index}>
                              <TableCell>{days[row.day_of_week]}</TableCell>
                              <TableCell>{row.hour}:00</TableCell>
                              <TableCell align="right">{row.count}</TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        ) : null}
      </TabPanel>
    </Box>
  );
};

export default AnalyticsDashboard;

