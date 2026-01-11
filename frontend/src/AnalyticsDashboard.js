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
  getAnalyticsPerformance,
  getAnalyticsRouteFinder,
  getAnalyticsExtranetPricing
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
  const [routeFinderDateRange, setRouteFinderDateRange] = useState('all');
  const [extranetPricingDateRange, setExtranetPricingDateRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Data states
  const [overviewData, setOverviewData] = useState(null);
  const [designData, setDesignData] = useState(null);
  const [allocatedData, setAllocatedData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);
  const [routeFinderData, setRouteFinderData] = useState(null);
  const [extranetPricingData, setExtranetPricingData] = useState(null);

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

  const loadRouteFinderData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(routeFinderDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsRouteFinder(startDate, endDate);
      setRouteFinderData(data);
    } catch (err) {
      console.error('Error loading route finder data:', err);
      setError('Failed to load route finder analytics: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadExtranetPricingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(extranetPricingDateRange, customStartDate, customEndDate);
      const data = await getAnalyticsExtranetPricing(startDate, endDate);
      setExtranetPricingData(data);
    } catch (err) {
      console.error('Error loading extranet pricing data:', err);
      setError('Failed to load extranet pricing analytics: ' + err.message);
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

  useEffect(() => {
    if (currentTab === 5) loadRouteFinderData();
    // eslint-disable-next-line
  }, [currentTab, routeFinderDateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (currentTab === 6) loadExtranetPricingData();
    // eslint-disable-next-line
  }, [currentTab, extranetPricingDateRange, customStartDate, customEndDate]);

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
          <Tab label="Route Finder" />
          <Tab label="Extranet Pricing" />
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
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Total Calculations</Typography>
                    <Typography variant="h4" fontWeight="bold">{overviewData.totalCalculations.toLocaleString()}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Chip label={`Design: ${overviewData.designCalculations}`} size="small" color="primary" />
                      <Chip label={`Allocated: ${overviewData.allocatedCalculations}`} size="small" color="secondary" />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon color="primary" fontSize="small" />
                      <Typography color="textSecondary" variant="body2" gutterBottom>Active Users</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">{overviewData.activeUsers}</Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Design & Pricing</Typography>
                    <Typography variant="h4" fontWeight="bold">{overviewData.designCalculations?.toLocaleString() || 0}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {overviewData.totalCalculations > 0 ? `${((overviewData.designCalculations / overviewData.totalCalculations) * 100).toFixed(1)}% of total` : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Allocated Cost</Typography>
                    <Typography variant="h4" fontWeight="bold">{overviewData.allocatedCalculations?.toLocaleString() || 0}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {overviewData.totalCalculations > 0 ? `${((overviewData.allocatedCalculations / overviewData.totalCalculations) * 100).toFixed(1)}% of total` : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Monthly Growth Analysis Table */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Monthly Activity Analysis</Typography>
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
                        <TableCell sx={{ fontWeight: 'bold' }}>Month</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Design & Pricing</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Allocated Cost</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Growth</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {processMonthlyTrends(overviewData.monthlyTrends).growthData.slice(-12).reverse().map((row, index) => {
                        const total = row.design + row.allocated;
                        const isNegative = row.growthValue < 0;
                        const isPositive = row.growthValue > 0;
                        return (
                          <TableRow key={row.month} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                            <TableCell>{row.month}</TableCell>
                            <TableCell align="right">{row.design}</TableCell>
                            <TableCell align="right">{row.allocated}</TableCell>
                            <TableCell align="right"><strong>{total}</strong></TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: isPositive ? 'success.main' : isNegative ? 'error.main' : 'text.secondary',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {row.growth}
                                </Typography>
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
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Total Calculations</Typography>
                    <Typography variant="h4" fontWeight="bold">{designData.totalCalculations.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Avg Suggested Price</Typography>
                    <Typography variant="h4" fontWeight="bold">${parseFloat(designData.averageSuggestedPrice || 0).toLocaleString()}</Typography>
                    <Typography variant="caption" color="textSecondary">USD</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Avg Response Time</Typography>
                    <Typography variant="h4" fontWeight="bold">{designData.averageResponseTime}ms</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Unique Routes</Typography>
                    <Typography variant="h4" fontWeight="bold">{designData.routePairs?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Data Tables in 2-Column Layout */}
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} lg={6}>
                {/* Top Route Pairs */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top 10 Route Pairs</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.routePairs, 'design_route_pairs')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 350 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Route Pair</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.routePairs.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.route}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {designData.totalCalculations > 0 ? `${((item.count / designData.totalCalculations) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Top Customers */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top 10 Customers</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.topCustomers, 'design_customers')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quotes</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.topCustomers.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{item.customer}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {designData.totalCalculations > 0 ? `${((item.count / designData.totalCalculations) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Right Column */}
              <Grid item xs={12} lg={6}>
                {/* City Codes */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top City Codes</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.cityCodes, 'design_city_codes')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>City Code</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.cityCodes.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.city}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Bandwidth Distribution */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Bandwidth Distribution</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.bandwidthRanges, 'design_bandwidth')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Bandwidth Range</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.bandwidthRanges.map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.range}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {designData.totalCalculations > 0 ? `${((item.count / designData.totalCalculations) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Individual Locations */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Individual Locations</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(designData.individualLocations, 'design_locations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {designData.individualLocations.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
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
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Total Calculations</Typography>
                    <Typography variant="h4" fontWeight="bold">{allocatedData.totalCalculations.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Unique Quote IDs</Typography>
                    <Typography variant="h4" fontWeight="bold">{allocatedData.uniqueQuoteIds}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Avg Suggested Price</Typography>
                    <Typography variant="h4" fontWeight="bold">${parseFloat(allocatedData.averageSuggestedPrice || 0).toLocaleString()}</Typography>
                    <Typography variant="caption" color="textSecondary">USD</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Unique Routes</Typography>
                    <Typography variant="h4" fontWeight="bold">{allocatedData.routePairs?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Data Tables in 2-Column Layout */}
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} lg={6}>
                {/* Quote Request IDs */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Quote Request IDs</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.quoteRequestIds, 'quote_request_ids')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Quote Request ID</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.quoteRequestIds.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
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
                      <Typography variant="h6">Top 10 Route Pairs</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.routePairs, 'allocated_route_pairs')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Route Pair</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.routePairs.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.route}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {allocatedData.totalCalculations > 0 ? `${((item.count / allocatedData.totalCalculations) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Top Customers */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top 10 Customers</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.topCustomers, 'allocated_customers')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Customer</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Quotes</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.topCustomers.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell sx={{ textTransform: 'capitalize' }}>{item.customer}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {allocatedData.totalCalculations > 0 ? `${((item.count / allocatedData.totalCalculations) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Right Column */}
              <Grid item xs={12} lg={6}>
                {/* City Codes */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top City Codes</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.cityCodes, 'allocated_city_codes')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>City Code</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.cityCodes.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.city}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Bandwidth Distribution */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Bandwidth Distribution</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.bandwidthRanges, 'allocated_bandwidth')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Bandwidth Range</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.bandwidthRanges.map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.range}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {allocatedData.totalCalculations > 0 ? `${((item.count / allocatedData.totalCalculations) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Individual Locations */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Individual Locations</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(allocatedData.individualLocations, 'allocated_locations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allocatedData.individualLocations.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
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
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PeopleIcon color="primary" fontSize="small" />
                      <Typography color="textSecondary" variant="body2" gutterBottom>Total Registered Users</Typography>
                    </Box>
                    <Typography variant="h4" fontWeight="bold">{userData.totalUsers}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Active This Month</Typography>
                    <Typography variant="h4" fontWeight="bold">{userData.mostActiveUsers?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>New Users (Last 12 Mo)</Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {userData.userRegistrations?.slice(-12).reduce((sum, m) => sum + (m.count || 0), 0) || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Avg Logins (30 days)</Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {userData.dailyLoginCounts?.length > 0 
                        ? Math.round(userData.dailyLoginCounts.slice(-30).reduce((sum, d) => sum + (d.total_logins || 0), 0) / Math.min(userData.dailyLoginCounts.length, 30))
                        : 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">per day</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Data Tables in 2-Column Layout */}
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} lg={6}>
                {/* User Registrations Table */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Monthly User Registrations</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(userData.userRegistrations, 'user_registrations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 300 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Month</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>New Users</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {userData.userRegistrations.slice(-12).reverse().map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.month}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Daily Login Activity Table */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Daily Login Activity (Last 14 Days)</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(userData.dailyLoginCounts, 'daily_login_counts')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 350 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Logins</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Unique Users</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {userData.dailyLoginCounts.slice(-14).reverse().map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.date}</TableCell>
                              <TableCell align="right">{item.total_logins}</TableCell>
                              <TableCell align="right">{item.unique_users}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Right Column - Most Active Users */}
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Most Active Users</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(userData.mostActiveUsers, 'most_active_users')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 600 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Full Name</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Design</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Allocated</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {userData.mostActiveUsers.map((user, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
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
              </Grid>
            </Grid>
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
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Avg Response Time</Typography>
                    <Typography variant="h4" fontWeight="bold">{performanceData.averageResponseTime}ms</Typography>
                    <Typography variant="caption" color="textSecondary">Design & Pricing</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Total Calculations</Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {performanceData.calculationsPerDay?.reduce((sum, d) => sum + (d.count || 0), 0) || 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">in period</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Daily Average</Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {performanceData.calculationsPerDay?.length > 0 
                        ? Math.round(performanceData.calculationsPerDay.reduce((sum, d) => sum + (d.count || 0), 0) / performanceData.calculationsPerDay.length)
                        : 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">calculations/day</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Peak Day</Typography>
                    <Typography variant="h4" fontWeight="bold">
                      {performanceData.calculationsPerDay?.length > 0 
                        ? Math.max(...performanceData.calculationsPerDay.map(d => d.count || 0))
                        : 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">max calculations</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Data Tables in 2-Column Layout */}
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} lg={6}>
                {/* Daily Response Times */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Daily Response Times (Last 14 Days)</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(performanceData.dailyAverageResponseTimes, 'daily_response_times')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 350 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Avg Response Time</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {performanceData.dailyAverageResponseTimes.slice(-14).reverse().map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.date}</TableCell>
                              <TableCell align="right">
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: item.avgTime > 500 ? 'error.main' : item.avgTime > 200 ? 'warning.main' : 'success.main',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  {item.avgTime}ms
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Calculations Per Day */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Calculations Per Day (Last 14 Days)</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(performanceData.calculationsPerDay, 'calculations_per_day')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 350 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Calculations</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {performanceData.calculationsPerDay.slice(-14).reverse().map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.date}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>

              {/* Right Column - Usage by Time */}
              <Grid item xs={12} lg={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Usage by Day of Week and Hour</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(performanceData.calculationsByTimeOfDay, 'usage_by_time')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 600 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Day</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Hour</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {performanceData.calculationsByTimeOfDay
                            .sort((a, b) => {
                              if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
                              return a.hour - b.hour;
                            })
                            .map((row, index) => {
                              const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                              return (
                                <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                  <TableCell>{days[row.day_of_week]}</TableCell>
                                  <TableCell>{String(row.hour).padStart(2, '0')}:00</TableCell>
                                  <TableCell align="right">{row.count}</TableCell>
                                </TableRow>
                              );
                            })}
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

      {/* Route Finder Tab */}
      <TabPanel value={currentTab} index={5}>
        {renderDateRangeSelector(routeFinderDateRange, setRouteFinderDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : routeFinderData ? (
          <>
            {/* Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Total Searches</Typography>
                    <Typography variant="h4" fontWeight="bold">{routeFinderData.totalSearches.toLocaleString()}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Avg Response Time</Typography>
                    <Typography variant="h4" fontWeight="bold">{routeFinderData.averageResponseTime}ms</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Unique Routes</Typography>
                    <Typography variant="h4" fontWeight="bold">{routeFinderData.routePairs?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Active Users</Typography>
                    <Typography variant="h4" fontWeight="bold">{routeFinderData.topUsers?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Data Tables in 2-Column Layout */}
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} lg={6}>
                {/* Top Route Pairs */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top 10 Route Pairs</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(routeFinderData.routePairs, 'route_finder_route_pairs')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 350 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Route Pair</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {routeFinderData.routePairs.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.route}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {routeFinderData.totalSearches > 0 ? `${((item.count / routeFinderData.totalSearches) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Top Users */}
                {routeFinderData.topUsers && routeFinderData.topUsers.length > 0 && (
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Top Users</Typography>
                        <IconButton size="small" onClick={() => exportToCSV(routeFinderData.topUsers, 'route_finder_users')}>
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      <TableContainer sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Searches</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {routeFinderData.topUsers.slice(0, 10).map((user, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell align="right">{user.count}</TableCell>
                                <TableCell align="right">
                                  {routeFinderData.totalSearches > 0 ? `${((user.count / routeFinderData.totalSearches) * 100).toFixed(1)}%` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}
              </Grid>

              {/* Right Column */}
              <Grid item xs={12} lg={6}>
                {/* City Codes */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top City Codes</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(routeFinderData.cityCodes, 'route_finder_city_codes')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 250 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>City Code</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {routeFinderData.cityCodes.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>{item.city}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Bandwidth Distribution */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Bandwidth Distribution</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(routeFinderData.bandwidthRanges, 'route_finder_bandwidth')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Bandwidth Range</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {routeFinderData.bandwidthRanges.map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.range}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {routeFinderData.totalSearches > 0 ? `${((item.count / routeFinderData.totalSearches) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Route Mode Distribution */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Route Mode Distribution</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(routeFinderData.routeModes, 'route_finder_modes')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>Route Mode</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {routeFinderData.routeModes.map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{item.mode}</TableCell>
                              <TableCell align="right">{item.count}</TableCell>
                              <TableCell align="right">
                                {routeFinderData.totalSearches > 0 ? `${((item.count / routeFinderData.totalSearches) * 100).toFixed(1)}%` : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>

                {/* Individual Locations */}
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Top Individual Locations</Typography>
                      <IconButton size="small" onClick={() => exportToCSV(routeFinderData.individualLocations, 'route_finder_locations')}>
                        <DownloadIcon />
                      </IconButton>
                    </Box>
                    <TableContainer sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Location</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {routeFinderData.individualLocations.slice(0, 10).map((item, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                              <TableCell>{index + 1}</TableCell>
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
          </>
        ) : null}
      </TabPanel>

      {/* Extranet Pricing Tab */}
      <TabPanel value={currentTab} index={6}>
        {renderDateRangeSelector(extranetPricingDateRange, setExtranetPricingDateRange)}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : extranetPricingData ? (
          <>
            {/* Key Metrics Summary Cards */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={6} sm={4} md={2}>
                <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Total Lookups</Typography>
                    <Typography variant="h5" fontWeight="bold">{extranetPricingData.totalLookups?.toLocaleString() || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>IPSec Requests</Typography>
                    <Typography variant="h5" fontWeight="bold">{extranetPricingData.ipsecStats?.required?.toLocaleString() || 0}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {extranetPricingData.totalLookups > 0 ? `${((extranetPricingData.ipsecStats?.required / extranetPricingData.totalLookups) * 100).toFixed(1)}% of total` : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Cloud Members</Typography>
                    <Typography variant="h5" fontWeight="bold">{extranetPricingData.cloudMemberCount?.toLocaleString() || 0}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {extranetPricingData.totalLookups > 0 ? `${((extranetPricingData.cloudMemberCount / extranetPricingData.totalLookups) * 100).toFixed(1)}% of total` : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Card sx={{ bgcolor: '#fce4ec', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Discounts Requested</Typography>
                    <Typography variant="h5" fontWeight="bold">{extranetPricingData.discountStats?.requestedCount?.toLocaleString() || 0}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      Avg: {extranetPricingData.discountStats?.averageDiscount || 0}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Active Users</Typography>
                    <Typography variant="h5" fontWeight="bold">{extranetPricingData.topUsers?.length || 0}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={4} md={2}>
                <Card sx={{ bgcolor: '#e0f7fa', height: '100%' }}>
                  <CardContent sx={{ py: 2 }}>
                    <Typography color="textSecondary" variant="body2" gutterBottom>Off-Net Requests</Typography>
                    <Typography variant="h5" fontWeight="bold">{extranetPricingData.offNetCount?.toLocaleString() || 0}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {extranetPricingData.totalLookups > 0 ? `${((extranetPricingData.offNetCount / extranetPricingData.totalLookups) * 100).toFixed(1)}% of total` : ''}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Main Data Tables in 2-Column Layout */}
            <Grid container spacing={3}>
              {/* Left Column */}
              <Grid item xs={12} lg={6}>
                {/* Top Providers */}
                {extranetPricingData.topProviders && extranetPricingData.topProviders.length > 0 && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Top 10 Providers</Typography>
                        <IconButton size="small" onClick={() => exportToCSV(extranetPricingData.topProviders, 'extranet_top_providers')}>
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      <TableContainer sx={{ maxHeight: 350 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Provider</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Searches</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>% of Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extranetPricingData.topProviders.slice(0, 10).map((provider, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{provider.provider}</TableCell>
                                <TableCell align="right">{provider.count}</TableCell>
                                <TableCell align="right">
                                  {extranetPricingData.totalLookups > 0 ? `${((provider.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Top City Pairs */}
                {extranetPricingData.topCityPairs && extranetPricingData.topCityPairs.length > 0 && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Top 10 City Pairs (Provider → Member)</Typography>
                        <IconButton size="small" onClick={() => exportToCSV(extranetPricingData.topCityPairs, 'extranet_city_pairs')}>
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      <TableContainer sx={{ maxHeight: 350 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>City Pair</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Searches</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extranetPricingData.topCityPairs.slice(0, 10).map((pair, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{pair.pair}</TableCell>
                                <TableCell align="right">{pair.count}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}

                {/* User Activity */}
                {extranetPricingData.topUsers && extranetPricingData.topUsers.length > 0 && (
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">User Activity</Typography>
                        <IconButton size="small" onClick={() => exportToCSV(extranetPricingData.topUsers, 'extranet_pricing_users')}>
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      <TableContainer sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>#</TableCell>
                              <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Lookups</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>% of Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extranetPricingData.topUsers.map((user, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{user.username}</TableCell>
                                <TableCell align="right">{user.count}</TableCell>
                                <TableCell align="right">
                                  {extranetPricingData.totalLookups > 0 ? `${((user.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}
              </Grid>

              {/* Right Column */}
              <Grid item xs={12} lg={6}>
                {/* Breakdown Summary Tables */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Request Breakdown Summary</Typography>
                    
                    {/* Resiliency Breakdown */}
                    {extranetPricingData.resiliencyDistribution && extranetPricingData.resiliencyDistribution.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>By Resiliency Type</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {extranetPricingData.resiliencyDistribution.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.resiliency || 'Unknown'}</TableCell>
                                  <TableCell align="right">{item.count}</TableCell>
                                  <TableCell align="right">
                                    {extranetPricingData.totalLookups > 0 ? `${((item.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {/* Contract Term Breakdown */}
                    {extranetPricingData.contractTermDistribution && extranetPricingData.contractTermDistribution.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>By Contract Term</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Term</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {extranetPricingData.contractTermDistribution.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.term} months</TableCell>
                                  <TableCell align="right">{item.count}</TableCell>
                                  <TableCell align="right">
                                    {extranetPricingData.totalLookups > 0 ? `${((item.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {/* Traffic Type Breakdown */}
                    {extranetPricingData.trafficTypeDistribution && extranetPricingData.trafficTypeDistribution.length > 0 && (
                      <Box>
                        <Typography variant="subtitle2" color="textSecondary" gutterBottom>By Traffic Type</Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {extranetPricingData.trafficTypeDistribution.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>{item.type || 'Unknown'}</TableCell>
                                  <TableCell align="right">{item.count}</TableCell>
                                  <TableCell align="right">
                                    {extranetPricingData.totalLookups > 0 ? `${((item.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}
                  </CardContent>
                </Card>

                {/* Bandwidth Distribution */}
                {extranetPricingData.bandwidthDistribution && extranetPricingData.bandwidthDistribution.length > 0 && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Bandwidth Distribution</Typography>
                        <IconButton size="small" onClick={() => exportToCSV(extranetPricingData.bandwidthDistribution, 'extranet_bandwidth_distribution')}>
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      <TableContainer sx={{ maxHeight: 250 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Bandwidth</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extranetPricingData.bandwidthDistribution.map((item, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                <TableCell>{item.bandwidth}</TableCell>
                                <TableCell align="right">{item.count}</TableCell>
                                <TableCell align="right">
                                  {extranetPricingData.totalLookups > 0 ? `${((item.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Currency Distribution */}
                {extranetPricingData.currencyDistribution && extranetPricingData.currencyDistribution.length > 0 && (
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Currency Distribution</Typography>
                        <IconButton size="small" onClick={() => exportToCSV(extranetPricingData.currencyDistribution, 'extranet_currencies')}>
                          <DownloadIcon />
                        </IconButton>
                      </Box>
                      <TableContainer sx={{ maxHeight: 200 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Currency</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Count</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 'bold' }}>%</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {extranetPricingData.currencyDistribution.map((item, index) => (
                              <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                                <TableCell>{item.currency}</TableCell>
                                <TableCell align="right">{item.count}</TableCell>
                                <TableCell align="right">
                                  {extranetPricingData.totalLookups > 0 ? `${((item.count / extranetPricingData.totalLookups) * 100).toFixed(1)}%` : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                )}
              </Grid>
            </Grid>

            {/* Top Cities - Full Width */}
            {extranetPricingData.topCities && extranetPricingData.topCities.length > 0 && (
              <Card sx={{ mt: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Top Searched Cities</Typography>
                    <IconButton size="small" onClick={() => exportToCSV(extranetPricingData.topCities, 'extranet_top_cities')}>
                      <DownloadIcon />
                    </IconButton>
                  </Box>
                  <Grid container spacing={2}>
                    {extranetPricingData.topCities.slice(0, 20).map((city, index) => (
                      <Grid item xs={6} sm={4} md={3} lg={2} key={index}>
                        <Box sx={{ 
                          p: 1.5, 
                          border: '1px solid', 
                          borderColor: 'divider', 
                          borderRadius: 1,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          bgcolor: index < 3 ? 'primary.50' : 'transparent'
                        }}>
                          <Typography variant="body2" noWrap title={city.city} sx={{ flex: 1, mr: 1 }}>
                            {index + 1}. {city.city}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {city.count}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </TabPanel>
    </Box>
  );
};

export default AnalyticsDashboard;

