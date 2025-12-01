import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Button, CircularProgress, Checkbox, FormControlLabel, Alert,
  FormGroup, Divider, IconButton, TextField, Autocomplete, Accordion, AccordionSummary,
  AccordionDetails, Chip, Paper, List, ListItem, ListItemText, ListItemIcon, Menu, MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import HomeIcon from '@mui/icons-material/Home';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RouteIcon from '@mui/icons-material/Route';
import PaletteIcon from '@mui/icons-material/Palette';
import { Viewer, Ion, KmlDataSource, Cartesian3, Cartographic, Math as CesiumMath, UrlTemplateImageryProvider, CustomDataSource, ScreenSpaceEventHandler, ScreenSpaceEventType, defined, Color, HeightReference, SceneMode, JulianDate, DistanceDisplayCondition, VerticalOrigin, LabelStyle, Cartesian2 } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { API_BASE_URL } from './config';
import { fetchRoutesByBandwidth, fetchRouteCounts, searchKMZRoutes } from './api';

// Configure Cesium to load assets from public folder
window.CESIUM_BASE_URL = '/cesium/';

// Disable Cesium Ion completely - we're using CartoDB Light
Ion.defaultAccessToken = '';

function KMZMapViewer({ onClose, routeFinderData }) {
  const cesiumContainer = useRef(null);
  const viewerRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerReady, setViewerReady] = useState(false);
  
  // Primary filters state - nested regional structure
  const [filters, setFilters] = useState({
    dark_fiber: { EMEA: true, AMERs: false, APAC: false, INTER: false },  // Auto-load EMEA only
    gb_100: { EMEA: false, AMERs: false, APAC: false, INTER: false },
    gb_10: { EMEA: false, AMERs: false, APAC: false, INTER: false },
    lt_10gb: { EMEA: false, AMERs: false, APAC: false, INTER: false }
  });
  
  // Available route counts per filter (nested by region)
  const [availableCounts, setAvailableCounts] = useState({
    dark_fiber: { EMEA: 0, AMERs: 0, APAC: 0, INTER: 0, total: 0 },
    gb_100: { EMEA: 0, AMERs: 0, APAC: 0, INTER: 0, total: 0 },
    gb_10: { EMEA: 0, AMERs: 0, APAC: 0, INTER: 0, total: 0 },
    lt_10gb: { EMEA: 0, AMERs: 0, APAC: 0, INTER: 0, total: 0 }
  });
  
  // Regions list
  const REGIONS = ['EMEA', 'AMERs', 'APAC', 'INTER'];
  
  // Loaded routes by category
  const [loadedRoutes, setLoadedRoutes] = useState({
    dark_fiber: [],
    gb_100: [],
    gb_10: [],
    lt_10gb: [],
    advanced: [],
    route_finder_primary: [],
    route_finder_secondary: []
  });
  
  // Route visibility toggles
  const [routeVisibility, setRouteVisibility] = useState({});
  
  // Locations visibility toggle
  const [showLocations, setShowLocations] = useState(true);
  
  // Route colors (session-only, 8 preset colors)
  const [routeColors, setRouteColors] = useState({}); // { circuit_id: 'red', ... }
  const [colorMenuAnchor, setColorMenuAnchor] = useState(null);
  const [colorMenuRoute, setColorMenuRoute] = useState(null);
  
  // Preset colors with Cesium ABGR format (16 colors for better differentiation)
  const PRESET_COLORS = [
    { name: 'Red', hex: '#FF0000', cesium: 'ff0000ff' },
    { name: 'Blue', hex: '#0066FF', cesium: 'ffff6600' },
    { name: 'Green', hex: '#00CC00', cesium: 'ff00cc00' },
    { name: 'Yellow', hex: '#FFCC00', cesium: 'ff00ccff' },
    { name: 'Orange', hex: '#FF6600', cesium: 'ff0066ff' },
    { name: 'Purple', hex: '#9933FF', cesium: 'ffff3399' },
    { name: 'Pink', hex: '#FF3399', cesium: 'ff9933ff' },
    { name: 'Cyan', hex: '#00CCCC', cesium: 'ffcccc00' },
    { name: 'Magenta', hex: '#CC0099', cesium: 'ff9900cc' },
    { name: 'Lime', hex: '#99FF00', cesium: 'ff00ff99' },
    { name: 'Teal', hex: '#009999', cesium: 'ff999900' },
    { name: 'Coral', hex: '#FF6666', cesium: 'ff6666ff' },
    { name: 'Gold', hex: '#FFD700', cesium: 'ff00d7ff' },
    { name: 'Navy', hex: '#000099', cesium: 'ff990000' },
    { name: 'Olive', hex: '#669900', cesium: 'ff009966' },
    { name: 'Maroon', hex: '#990033', cesium: 'ff330099' }
  ];
  
  // Track last used color index to avoid consecutive repetition
  const lastColorIndexRef = useRef(-1);
  
  // Advanced filter
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Selected route info (for popup)
  const [selectedRoute, setSelectedRoute] = useState(null);
  
  // Route Finder mode state
  const [routeFinderMode, setRouteFinderMode] = useState(false);
  const [routeFinderWarnings, setRouteFinderWarnings] = useState([]);
  
  // Filter accordion expanded states (controlled for route finder mode)
  const [filterAccordionExpanded, setFilterAccordionExpanded] = useState({
    dark_fiber: true, // Default expanded when not in route finder mode
    gb_100: false,
    gb_10: false,
    lt_10gb: false
  });
  
  // DataSource references
  const dataSourcesRef = useRef({});
  
  // Reference for permanent locations data source
  const locationsDataSourceRef = useRef(null);
  
  // Initialize Cesium Viewer
  useEffect(() => {
    if (!cesiumContainer.current) return;

    try {
      // Create viewer in FORCED 2D MODE (flat map, no globe)
      const viewer = new Viewer(cesiumContainer.current, {
        imageryProvider: false, // Start with no imagery
        baseLayerPicker: false,
        geocoder: false,
        terrainProvider: undefined,
        timeline: false,
        animation: false,
        homeButton: true,
        sceneModePicker: false, // Disable mode picker (forced 2D)
        navigationHelpButton: true,
        fullscreenButton: true,
        vrButton: false,
        sceneMode: SceneMode.SCENE2D, // FORCE 2D flat map mode
        requestRenderMode: false,
        maximumRenderTimeChange: Infinity
      });

      viewerRef.current = viewer;
      
      // NOW add CartoDB Light tiles (exactly like the button did)
      const cartoProvider = new UrlTemplateImageryProvider({
        url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
        credit: '© OpenStreetMap contributors, © CartoDB',
        maximumLevel: 19
      });
      
      viewer.scene.imageryLayers.addImageryProvider(cartoProvider);

      // Set initial view to London metro area
      viewer.camera.setView({
        destination: Cartesian3.fromDegrees(-0.1276, 51.5074, 500000), // London (longitude, latitude, altitude in meters)
      });

      // Set up click handler for route selection
      const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        const pickedObject = viewer.scene.pick(movement.position);
        if (defined(pickedObject) && defined(pickedObject.id)) {
          const entity = pickedObject.id;
          // Extract circuit_id from entity ID (format: "circuitId_entityIndex")
          const entityId = entity.id;
          if (typeof entityId === 'string' && entityId.includes('_')) {
            const circuitId = entityId.split('_')[0];
            handleRouteClick(circuitId);
          }
        }
      }, ScreenSpaceEventType.LEFT_CLICK);

      // Wait for scene to be ready
      const checkSceneReady = () => {
        if (viewer.scene && viewer.scene.globe) {
          setLoading(false);
          setViewerReady(true);
        } else {
          setTimeout(checkSceneReady, 100);
        }
      };
      checkSceneReady();

    } catch (err) {
      console.error('Failed to initialize Cesium viewer:', err);
      setError('Failed to initialize 3D globe viewer: ' + err.message);
      setLoading(false);
    }

    // Cleanup on unmount
    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.destroy();
        } catch (err) {
          console.error('Error destroying viewer:', err);
        }
        viewerRef.current = null;
        setViewerReady(false);
      }
    };
  }, []);

  // Fetch available counts on mount
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const counts = await fetchRouteCounts();
        setAvailableCounts(counts);
      } catch (err) {
        console.error('Failed to fetch route counts:', err);
      }
    };
    loadCounts();
  }, []);

  // Auto-load EMEA Dark Fiber only on startup (but NOT when coming from Route Finder)
  useEffect(() => {
    if (!viewerReady) return;
    
    // Skip auto-loading Dark Fiber if we're in Route Finder mode
    if (routeFinderData) return;
    
    // Only load EMEA Dark Fiber on startup
    if (filters.dark_fiber.EMEA) {
      loadRoutesByFilter('dark_fiber', ['EMEA']);
    }
  }, [viewerReady, routeFinderData]);

  // Load permanent locations.kmz template when viewer is ready
  // In Route Finder mode, we'll load and then filter to show only source/destination
  useEffect(() => {
    if (!viewerReady || !viewerRef.current) return;
    
    const loadLocationsTemplate = async () => {
      try {
        console.log('Loading permanent locations template...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/kmz_templates/download/locations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.warn('Locations template not available:', response.status);
          return; // Silently fail if template not uploaded yet
        }
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Convert to Blob (Cesium requires Blob, not blob URL or arrayBuffer)
        const blob = new Blob([arrayBuffer], { type: 'application/vnd.google-earth.kmz' });
        
        // Load KMZ directly from Blob object (no blob URL needed - avoids security issues)
        const locationsDataSource = await KmlDataSource.load(blob, {
          camera: viewerRef.current.camera,
          canvas: viewerRef.current.canvas
          // Removed clampToGround - causes issues in 2D mode
        });
        
        // Diagnostic logging to check coordinates
        const entities = locationsDataSource.entities.values;
        console.log(`✓ Loaded ${entities.length} location entities (2D mode - using original KML coordinates)`);
        
        // Log first entity's position for debugging
        if (entities.length > 0) {
          const firstEntity = entities.find(e => e.position);
          if (firstEntity) {
            const position = firstEntity.position.getValue(JulianDate.now());
            if (position) {
              const cartographic = Cartographic.fromCartesian(position);
              const lon = CesiumMath.toDegrees(cartographic.longitude);
              const lat = CesiumMath.toDegrees(cartographic.latitude);
              console.log(`  └─ Sample location: "${firstEntity.name}" at Lon: ${lon.toFixed(4)}°, Lat: ${lat.toFixed(4)}°`);
              console.log(`     (Expected: London area should be around Lon: -0.1°, Lat: 51.5°)`);
            }
          }
        }
        
        // Set distance-based visibility for labels (only show when zoomed in)
        // Pins always visible, labels only visible at city-level zoom
        let labelCount = 0;
        entities.forEach(entity => {
          if (entity.label) {
            // Labels only visible when camera is within 250km (closer city-level zoom)
            // 0 = minimum distance, 250000 = maximum distance in meters (250km)
            entity.label.distanceDisplayCondition = new DistanceDisplayCondition(0, 125000);
            labelCount++;
          }
          // Pins (billboards/points) - no distance condition, always visible
        });
        
        if (labelCount > 0) {
          console.log(`  └─ Set distance-based visibility for ${labelCount} labels (visible within 250km)`);
        }
        
        // Add to viewer - these pins stay permanent
        viewerRef.current.dataSources.add(locationsDataSource);
        locationsDataSourceRef.current = locationsDataSource;
        
        console.log('✓ Permanent locations loaded successfully with', entities.length, 'pins');
        
        // If in Route Finder mode, zoom to source location (but show ALL pins)
        if (routeFinderData) {
          const { source } = routeFinderData;
          console.log(`Route Finder mode: Showing all pins, zooming to source ${source}`);
          
          // Find source entity to zoom to it
          let sourceEntity = null;
          entities.forEach(entity => {
            const entityName = entity.name || '';
            const isSource = entityName.includes(source) || entityName === source;
            if (isSource) {
              sourceEntity = entity;
              console.log(`  ✓ Found source for zoom: ${entityName}`);
            }
          });
          
          // Zoom to source location if found
          if (sourceEntity && sourceEntity.position) {
            const position = sourceEntity.position.getValue(JulianDate.now());
            if (position) {
              const cartographic = Cartographic.fromCartesian(position);
              const lon = CesiumMath.toDegrees(cartographic.longitude);
              const lat = CesiumMath.toDegrees(cartographic.latitude);
              console.log(`Zooming to source: ${source} at lat=${lat.toFixed(4)}, lon=${lon.toFixed(4)}`);
              
              setTimeout(() => {
                if (viewerRef.current) {
                  viewerRef.current.camera.flyTo({
                    destination: Cartesian3.fromDegrees(lon, lat, 1000000),
                    duration: 2
                  });
                }
              }, 500);
            }
          } else {
            console.log(`  ⚠ Source ${source} not found in location pins`);
          }
        }
        
      } catch (err) {
        console.error('Error loading locations template:', err);
        // Don't show error to user - locations template is optional enhancement
      }
    };
    
    loadLocationsTemplate();
  }, [viewerReady, routeFinderData]);

  // Toggle locations visibility
  useEffect(() => {
    if (locationsDataSourceRef.current) {
      locationsDataSourceRef.current.show = showLocations;
    }
  }, [showLocations]);

  // Handle Route Finder data when provided
  useEffect(() => {
    if (!viewerReady || !viewerRef.current || !routeFinderData) return;
    
    const loadRouteFinderRoutes = async () => {
      console.log('Route Finder Mode: Loading routes from Route Finder');
      setRouteFinderMode(true);
      setLoading(true);
      
      // Collapse all filter accordions in route finder mode
      setFilterAccordionExpanded({
        dark_fiber: false,
        gb_100: false,
        gb_10: false,
        lt_10gb: false
      });
      
      const warnings = [];
      
      // Clear all existing routes first
      Object.keys(dataSourcesRef.current).forEach(circuitId => {
        try {
          const viewer = viewerRef.current;
          const { dataSource } = dataSourcesRef.current[circuitId];
          viewer.dataSources.remove(dataSource);
          delete dataSourcesRef.current[circuitId];
        } catch (err) {
          console.warn('Error removing route:', err);
        }
      });
      
      // Reset state
      setLoadedRoutes({
        dark_fiber: [],
        gb_100: [],
        gb_10: [],
        lt_10gb: [],
        advanced: [],
        route_finder_primary: [],
        route_finder_secondary: []
      });
      setRouteVisibility({});
      setRouteColors({});
      setFilters({
        dark_fiber: { EMEA: false, AMERs: false, APAC: false, INTER: false },
        gb_100: { EMEA: false, AMERs: false, APAC: false, INTER: false },
        gb_10: { EMEA: false, AMERs: false, APAC: false, INTER: false },
        lt_10gb: { EMEA: false, AMERs: false, APAC: false, INTER: false }
      });
      
      const { primaryPath, diversePath, source, locations } = routeFinderData;
      
      // Define colors for primary (red) and secondary (blue)
      const primaryColor = { hex: '#FF0000', cesium: 'ff0000ff' }; // Red (ABGR)
      const secondaryColor = { hex: '#0066FF', cesium: 'ffff6600' }; // Blue (ABGR)
      
      // Load primary path routes
      if (primaryPath && primaryPath.route) {
        console.log(`Loading ${primaryPath.route.length} primary path segments`);
        for (const segment of primaryPath.route) {
          if (segment.circuit_id) {
            try {
              await loadKMZRouteWithColor(segment, 'route_finder_primary', primaryColor);
            } catch (err) {
              console.warn(`Failed to load primary segment ${segment.circuit_id}:`, err);
              warnings.push(`Primary: ${segment.from} → ${segment.to} (${segment.circuit_id})`);
            }
          }
        }
      }
      
      // Load secondary/diverse path routes
      if (diversePath && diversePath.route) {
        console.log(`Loading ${diversePath.route.length} secondary path segments`);
        for (const segment of diversePath.route) {
          if (segment.circuit_id) {
            try {
              await loadKMZRouteWithColor(segment, 'route_finder_secondary', secondaryColor);
            } catch (err) {
              console.warn(`Failed to load secondary segment ${segment.circuit_id}:`, err);
              warnings.push(`Secondary: ${segment.from} → ${segment.to} (${segment.circuit_id})`);
            }
          }
        }
      }
      
      // Note: Location pins are loaded and filtered by the loadLocationsTemplate useEffect
      // which handles showing only source/destination pins from the KMZ template
      // The zoom to source is also handled there after the template loads
      console.log('Route Finder mode: Location pins will be loaded from KMZ template and filtered');
      
      setRouteFinderWarnings(warnings);
      setLoading(false);
    };
    
    loadRouteFinderRoutes();
  }, [viewerReady, routeFinderData]);

  // Load routes by bandwidth filter and regions
  const loadRoutesByFilter = async (bandwidth, regions) => {
    if (!viewerRef.current) return;
    
    setLoading(true);
    try {
      const filterMap = {
        dark_fiber: 'dark_fiber',
        gb_100: '100gb',
        gb_10: '10gb',
        lt_10gb: 'lt10gb'
      };
      
      const data = await fetchRoutesByBandwidth(filterMap[bandwidth], regions.join(','));
      
      // Get routes for this bandwidth
      const routes = data[bandwidth] || [];
      
      console.log(`Loading ${routes.length} routes for ${bandwidth} in ${regions.join(', ')}`);
      
      const newLoadedRoutes = { ...loadedRoutes };
      
      for (const route of routes) {
        // Skip if already loaded
        if (!dataSourcesRef.current[route.circuit_id]) {
          await loadKMZRoute(route, bandwidth);
          newLoadedRoutes[bandwidth] = [...newLoadedRoutes[bandwidth], route];
        }
      }
      
      setLoadedRoutes(newLoadedRoutes);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load routes:', err);
      setError('Failed to load routes: ' + err.message);
      setLoading(false);
    }
  };

  // Load a single KMZ route
  const loadKMZRoute = async (route, category) => {
    if (!viewerRef.current) return;
    
    const viewer = viewerRef.current;
    const token = localStorage.getItem('authToken');
    
    try {
      const response = await fetch(`${API_BASE_URL}/download_kmz/${route.kmz_file_path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`Failed to fetch KMZ for ${route.circuit_id}`);
        return;
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const tempDataSource = await KmlDataSource.load(blobUrl, {
        camera: viewer.camera,
        canvas: viewer.canvas,
        clampToGround: true
      });

      // Create a BRAND NEW clean CustomDataSource
      const cleanDataSource = new CustomDataSource(`${route.circuit_id}_clean`);
      
      const entities = tempDataSource.entities.values;
      
      // Copy entities to NEW dataSource with guaranteed valid IDs
      // IMPORTANT: Only copy route lines (polylines), skip all point-based entities (pins/placemarks)
      // Permanent location pins are loaded from locations.kmz template separately
      entities.forEach((entity, index) => {
        try {
          // Skip entities that are points/pins/placemarks (don't have polylines)
          // We only want route lines from circuit KMZ files
          if (!entity.polyline && (entity.point || entity.billboard || (entity.position && !entity.polyline))) {
            return; // Skip this entity - it's a pin/placemark
          }
          
          const newId = `${route.circuit_id}_${index}`;
          cleanDataSource.entities.add({
            id: newId,
            name: entity.name || route.circuit_id,
            description: entity.description,
            position: entity.position,
            // Don't copy billboard/label/point for circuit KMZs - those are from locations.kmz only
            // billboard: entity.billboard,
            // label: entity.label,
            // point: entity.point,
            polyline: entity.polyline, // Keep route lines
            polygon: entity.polygon,
            model: entity.model,
            path: entity.path,
            wall: entity.wall,
            corridor: entity.corridor,
            cylinder: entity.cylinder,
            ellipse: entity.ellipse,
            ellipsoid: entity.ellipsoid,
            rectangle: entity.rectangle,
            orientation: entity.orientation,
            viewFrom: entity.viewFrom,
            properties: entity.properties
          });
        } catch (err) {
          console.warn(`Could not copy entity ${index}:`, err);
        }
      });

      await viewer.dataSources.add(cleanDataSource);
      
      // Assign a random color to this route
      const randomColor = getRandomColor();
      const colorEntities = cleanDataSource.entities.values;
      colorEntities.forEach(entity => {
        if (entity.polyline && entity.polyline.material) {
          try {
            // Convert cesium hex color (ABGR) to Cesium.Color
            const a = parseInt(randomColor.cesium.substring(0, 2), 16) / 255;
            const b = parseInt(randomColor.cesium.substring(2, 4), 16) / 255;
            const g = parseInt(randomColor.cesium.substring(4, 6), 16) / 255;
            const r = parseInt(randomColor.cesium.substring(6, 8), 16) / 255;
            entity.polyline.material = new Color(r, g, b, a);
          } catch (err) {
            console.warn('Failed to set initial polyline color:', err);
          }
        }
      });
      
      // Store dataSource reference
      dataSourcesRef.current[route.circuit_id] = {
        dataSource: cleanDataSource,
        blobUrl: blobUrl,
        category: category,
        route: route
      };
      
      // Set visibility and store initial color
      setRouteVisibility(prev => ({ ...prev, [route.circuit_id]: true }));
      setRouteColors(prev => ({ ...prev, [route.circuit_id]: randomColor.hex }));
      
      // Cleanup temp blob
      URL.revokeObjectURL(blobUrl);

    } catch (err) {
      console.error(`Failed to load KMZ for ${route.circuit_id}:`, err);
    }
  };

  // Load a single KMZ route with a specific color (for Route Finder)
  const loadKMZRouteWithColor = async (segment, category, colorObj) => {
    if (!viewerRef.current) return;
    
    const viewer = viewerRef.current;
    const token = localStorage.getItem('authToken');
    
    // First, fetch the route details to get the kmz_file_path
    const routeResponse = await fetch(`${API_BASE_URL}/network_routes?circuit_id=${encodeURIComponent(segment.circuit_id)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!routeResponse.ok) {
      throw new Error(`Failed to fetch route details for ${segment.circuit_id}`);
    }
    
    const routeData = await routeResponse.json();
    const route = routeData.find(r => r.circuit_id === segment.circuit_id);
    
    if (!route || !route.kmz_file_path) {
      throw new Error(`No KMZ file available for ${segment.circuit_id}`);
    }
    
    // Fetch the KMZ file
    const response = await fetch(`${API_BASE_URL}/download_kmz/${route.kmz_file_path}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch KMZ for ${segment.circuit_id}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const tempDataSource = await KmlDataSource.load(blobUrl, {
      camera: viewer.camera,
      canvas: viewer.canvas,
      clampToGround: true
    });

    // Create a BRAND NEW clean CustomDataSource
    const cleanDataSource = new CustomDataSource(`${segment.circuit_id}_clean`);
    
    const entities = tempDataSource.entities.values;
    
    // Copy entities to NEW dataSource with guaranteed valid IDs
    entities.forEach((entity, index) => {
      try {
        // Skip entities that are points/pins/placemarks (don't have polylines)
        if (!entity.polyline && (entity.point || entity.billboard || (entity.position && !entity.polyline))) {
          return; // Skip this entity - it's a pin/placemark
        }
        
        const newId = `${segment.circuit_id}_${index}`;
        cleanDataSource.entities.add({
          id: newId,
          name: entity.name || segment.circuit_id,
          description: entity.description,
          position: entity.position,
          polyline: entity.polyline,
          polygon: entity.polygon,
          model: entity.model,
          path: entity.path,
          wall: entity.wall,
          corridor: entity.corridor,
          cylinder: entity.cylinder,
          ellipse: entity.ellipse,
          ellipsoid: entity.ellipsoid,
          rectangle: entity.rectangle,
          orientation: entity.orientation,
          viewFrom: entity.viewFrom,
          properties: entity.properties
        });
      } catch (err) {
        console.warn(`Could not copy entity ${index}:`, err);
      }
    });

    await viewer.dataSources.add(cleanDataSource);
    
    // Apply the specified color to all polylines
    const colorEntities = cleanDataSource.entities.values;
    colorEntities.forEach(entity => {
      if (entity.polyline && entity.polyline.material) {
        try {
          // Convert cesium hex color (ABGR) to Cesium.Color
          const a = parseInt(colorObj.cesium.substring(0, 2), 16) / 255;
          const b = parseInt(colorObj.cesium.substring(2, 4), 16) / 255;
          const g = parseInt(colorObj.cesium.substring(4, 6), 16) / 255;
          const r = parseInt(colorObj.cesium.substring(6, 8), 16) / 255;
          entity.polyline.material = new Color(r, g, b, a);
        } catch (err) {
          console.warn('Failed to set polyline color:', err);
        }
      }
    });
    
    // Build route object for state
    const routeObj = {
      circuit_id: segment.circuit_id,
      location_a: segment.from,
      location_b: segment.to,
      ...route
    };
    
    // Store dataSource reference
    dataSourcesRef.current[segment.circuit_id] = {
      dataSource: cleanDataSource,
      blobUrl: blobUrl,
      category: category,
      route: routeObj
    };
    
    // Set visibility and store color
    setRouteVisibility(prev => ({ ...prev, [segment.circuit_id]: true }));
    setRouteColors(prev => ({ ...prev, [segment.circuit_id]: colorObj.hex }));
    setLoadedRoutes(prev => ({
      ...prev,
      [category]: [...(prev[category] || []), routeObj]
    }));
    
    // Cleanup temp blob
    URL.revokeObjectURL(blobUrl);
  };

  // Handle parent filter checkbox (toggles all regions)
  const handleParentFilterChange = async (bandwidth) => {
    const allChecked = REGIONS.every(r => filters[bandwidth][r]);
    const newState = !allChecked;
    
    // Update all regions for this bandwidth
    const newFilters = {
      ...filters,
      [bandwidth]: REGIONS.reduce((acc, r) => ({ ...acc, [r]: newState }), {})
    };
    setFilters(newFilters);
    
    if (newState) {
      // Load all regions for this bandwidth
      await loadRoutesByFilter(bandwidth, REGIONS);
    } else {
      // Remove all routes for this bandwidth
      const routesToRemove = loadedRoutes[bandwidth];
      routesToRemove.forEach(route => {
        removeRoute(route.circuit_id);
      });
      setLoadedRoutes(prev => ({ ...prev, [bandwidth]: [] }));
    }
  };
  
  // Handle individual region checkbox
  const handleRegionFilterChange = async (bandwidth, region) => {
    const newState = !filters[bandwidth][region];
    
    const newFilters = {
      ...filters,
      [bandwidth]: {
        ...filters[bandwidth],
        [region]: newState
      }
    };
    setFilters(newFilters);
    
    if (newState) {
      // Load routes for this bandwidth/region
      await loadRoutesByFilter(bandwidth, [region]);
    } else {
      // Remove routes for this bandwidth/region
      const routesToRemove = loadedRoutes[bandwidth].filter(route => route.region === region);
      routesToRemove.forEach(route => {
        removeRoute(route.circuit_id);
      });
      setLoadedRoutes(prev => ({
        ...prev,
        [bandwidth]: prev[bandwidth].filter(route => route.region !== region)
      }));
    }
  };

  // Handle advanced search
  const handleSearch = async (event, value) => {
    setSearchQuery(value);
    
    if (!value || value.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const results = await searchKMZRoutes(value);
      
      // Group results by location for bulk add
      const grouped = {};
      results.forEach(route => {
        // Check if search term matches a location
        const searchUpper = value.toUpperCase();
        if (route.location_a && route.location_a.toUpperCase().includes(searchUpper)) {
          const key = route.location_a;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(route);
        }
        if (route.location_b && route.location_b.toUpperCase().includes(searchUpper)) {
          const key = route.location_b;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(route);
        }
      });
      
      // If multiple routes found for same location, add bulk option
      const bulkOptions = [];
      Object.entries(grouped).forEach(([location, routes]) => {
        if (routes.length > 1) {
          bulkOptions.push({
            isBulkOption: true,
            location: location,
            routes: routes,
            count: routes.length
          });
        }
      });
      
      setSearchResults([...bulkOptions, ...results]);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Add route from advanced filter
  const handleAddAdvancedRoute = async (route) => {
    if (!route) return;
    
    // Handle bulk add
    if (route.isBulkOption) {
      let addedCount = 0;
      for (const r of route.routes) {
        if (!dataSourcesRef.current[r.circuit_id]) {
          await loadKMZRoute(r, 'advanced');
          setLoadedRoutes(prev => ({
            ...prev,
            advanced: [...prev.advanced, r]
          }));
          addedCount++;
        }
      }
      alert(`Added ${addedCount} routes for ${route.location}`);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }
    
    // Check if already loaded
    if (dataSourcesRef.current[route.circuit_id]) {
      alert('Route already loaded');
      return;
    }
    
    await loadKMZRoute(route, 'advanced');
    setLoadedRoutes(prev => ({
      ...prev,
      advanced: [...prev.advanced, route]
    }));
    
    // Clear search
    setSearchQuery('');
    setSearchResults([]);
  };

  // Remove route from map
  const removeRoute = (circuitId) => {
    if (!viewerRef.current || !dataSourcesRef.current[circuitId]) return;
    
    const viewer = viewerRef.current;
    const { dataSource, category } = dataSourcesRef.current[circuitId];
    
    viewer.dataSources.remove(dataSource);
    delete dataSourcesRef.current[circuitId];
    
    // Remove from loaded routes
    setLoadedRoutes(prev => ({
      ...prev,
      [category]: prev[category].filter(r => r.circuit_id !== circuitId)
    }));
    
    // Remove visibility entry
    setRouteVisibility(prev => {
      const newVisibility = { ...prev };
      delete newVisibility[circuitId];
      return newVisibility;
    });
  };

  // Toggle route visibility
  const toggleRouteVisibility = (circuitId) => {
    if (!dataSourcesRef.current[circuitId]) return;
    
    const dataSource = dataSourcesRef.current[circuitId].dataSource;
    const newVisibility = !routeVisibility[circuitId];
    
    dataSource.show = newVisibility;
    setRouteVisibility(prev => ({ ...prev, [circuitId]: newVisibility }));
  };

  // Open color picker menu
  const handleColorMenuOpen = (event, circuitId) => {
    event.stopPropagation();
    setColorMenuAnchor(event.currentTarget);
    setColorMenuRoute(circuitId);
  };

  // Close color picker menu
  const handleColorMenuClose = () => {
    setColorMenuAnchor(null);
    setColorMenuRoute(null);
  };

  // Change route color
  const changeRouteColor = (colorHex, cesiumColor) => {
    if (!dataSourcesRef.current[colorMenuRoute]) {
      handleColorMenuClose();
      return;
    }
    
    const dataSource = dataSourcesRef.current[colorMenuRoute].dataSource;
    const entities = dataSource.entities.values;
    
    // Update all polyline entities with the new color
    entities.forEach(entity => {
      if (entity.polyline && entity.polyline.material) {
        try {
          // Convert cesium hex color (ABGR) to Cesium.Color
          const a = parseInt(cesiumColor.substring(0, 2), 16) / 255;
          const b = parseInt(cesiumColor.substring(2, 4), 16) / 255;
          const g = parseInt(cesiumColor.substring(4, 6), 16) / 255;
          const r = parseInt(cesiumColor.substring(6, 8), 16) / 255;
          
          entity.polyline.material = new Color(r, g, b, a);
        } catch (err) {
          console.error('Failed to set polyline color:', err);
        }
      }
    });
    
    // Store the color for this route (session-only)
    setRouteColors(prev => ({ ...prev, [colorMenuRoute]: colorHex }));
    handleColorMenuClose();
  };

  // Handle route click
  const handleRouteClick = (circuitId) => {
    if (dataSourcesRef.current[circuitId]) {
      setSelectedRoute(dataSourcesRef.current[circuitId].route);
    }
  };

  // Zoom to route
  const zoomToRoute = (circuitId) => {
    if (!viewerRef.current || !dataSourcesRef.current[circuitId]) return;
    
    const viewer = viewerRef.current;
    const { dataSource } = dataSourcesRef.current[circuitId];
    const entities = dataSource.entities.values;
    
    const positions = [];
    
    for (const entity of entities) {
      try {
        if (entity.position) {
          const pos = entity.position.getValue(viewer.clock.currentTime);
          if (pos) positions.push(pos);
        }
        
        if (entity.polyline && entity.polyline.positions) {
          const linePositions = entity.polyline.positions.getValue(viewer.clock.currentTime);
          if (linePositions && linePositions.length > 0) {
            positions.push(...linePositions);
          }
        }
        
        if (entity.polygon && entity.polygon.hierarchy) {
          const hierarchy = entity.polygon.hierarchy.getValue(viewer.clock.currentTime);
          if (hierarchy && hierarchy.positions) {
            positions.push(...hierarchy.positions);
          }
        }
      } catch (err) {
        continue;
      }
    }

    if (positions.length > 0) {
      let totalLat = 0;
      let totalLon = 0;
      
      positions.forEach(pos => {
        const cartographic = Cartographic.fromCartesian(pos);
        totalLat += CesiumMath.toDegrees(cartographic.latitude);
        totalLon += CesiumMath.toDegrees(cartographic.longitude);
      });
      
      const centerLat = totalLat / positions.length;
      const centerLon = totalLon / positions.length;
      
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(centerLon, centerLat, 500000),
        duration: 2
      });
    }
  };

  // Reset camera view
  const resetView = () => {
    if (!viewerRef.current) return;
    viewerRef.current.camera.flyTo({
      destination: Cartesian3.fromDegrees(0, 20, 20000000),
      duration: 2
    });
  };

  // Clear all routes
  const clearAllRoutes = () => {
    if (!viewerRef.current) return;
    
    Object.keys(dataSourcesRef.current).forEach(circuitId => {
      removeRoute(circuitId);
    });
    
    setLoadedRoutes({
      dark_fiber: [],
      gb_100: [],
      gb_10: [],
      lt_10gb: [],
      advanced: [],
      route_finder_primary: [],
      route_finder_secondary: []
    });
    
    setFilters({
      dark_fiber: { EMEA: false, AMERs: false, APAC: false, INTER: false },
      gb_100: { EMEA: false, AMERs: false, APAC: false, INTER: false },
      gb_10: { EMEA: false, AMERs: false, APAC: false, INTER: false },
      lt_10gb: { EMEA: false, AMERs: false, APAC: false, INTER: false }
    });
    
    // Clear route finder mode
    setRouteFinderMode(false);
    setRouteFinderWarnings([]);
  };
  
  // Helper: Get count of loaded routes for a bandwidth/region
  const getLoadedCount = (bandwidth, region) => {
    return loadedRoutes[bandwidth].filter(r => r.region === region).length;
  };
  
  // Get a random color, avoiding the last used color
  const getRandomColor = () => {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * PRESET_COLORS.length);
    } while (newIndex === lastColorIndexRef.current && PRESET_COLORS.length > 1);
    lastColorIndexRef.current = newIndex;
    return PRESET_COLORS[newIndex];
  };
  
  // Helper: Check if any regions are checked for a bandwidth
  const hasAnyRegionChecked = (bandwidth) => {
    return REGIONS.some(r => filters[bandwidth][r]);
  };
  
  // Helper: Check if all regions are checked for a bandwidth
  const hasAllRegionsChecked = (bandwidth) => {
    return REGIONS.every(r => filters[bandwidth][r]);
  };

  // Calculate total loaded routes
  const getTotalRoutes = () => {
    return Object.values(loadedRoutes).reduce((sum, arr) => sum + arr.length, 0);
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={onClose}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', height: '85vh', position: 'relative' }}>
      {/* Left Sidebar - Filters and Loaded Routes */}
      <Paper 
        elevation={3} 
        sx={{ 
          width: 350, 
          overflowY: 'auto', 
          p: 2,
          borderRadius: 0
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {routeFinderMode ? 'Route Finder Map' : 'KMZ Route Viewer'}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Route Finder Mode Info */}
        {routeFinderMode && (
          <Box sx={{ mb: 2 }}>
            <Alert severity="info" sx={{ mb: 1 }}>
              Showing Route Finder results. Primary path is <strong style={{ color: '#FF0000' }}>RED</strong>, Secondary path is <strong style={{ color: '#0066FF' }}>BLUE</strong>.
            </Alert>
            {routeFinderWarnings.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                  Some segments could not be displayed (no KMZ file available):
                </Typography>
                {routeFinderWarnings.map((warning, idx) => (
                  <Typography key={idx} variant="caption" display="block">
                    • {warning}
                  </Typography>
                ))}
              </Alert>
            )}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Primary Filters */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Primary Filters
          </Typography>
          
          {/* Show Location Pins */}
          <FormControlLabel
            control={
              <Checkbox
                checked={showLocations}
                onChange={() => setShowLocations(!showLocations)}
                size="small"
              />
            }
            label="Show Location Pins"
            sx={{ mb: 1, borderBottom: '1px solid #e0e0e0', pb: 1 }}
          />
          
          {/* Dark Fiber - Expanded by default (but collapsed in route finder mode) */}
          <Accordion 
            expanded={filterAccordionExpanded.dark_fiber}
            onChange={() => setFilterAccordionExpanded(prev => ({ ...prev, dark_fiber: !prev.dark_fiber }))}
            sx={{ boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent' }}
          >
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 40, py: 0, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasAllRegionsChecked('dark_fiber')}
                    indeterminate={hasAnyRegionChecked('dark_fiber') && !hasAllRegionsChecked('dark_fiber')}
                    onChange={() => handleParentFilterChange('dark_fiber')}
                    onClick={(e) => e.stopPropagation()}
                    disabled={loading}
                    size="small"
                  />
                }
                label={`Dark Fiber (${loadedRoutes.dark_fiber.length}/${availableCounts.dark_fiber.total})`}
                onClick={(e) => e.stopPropagation()}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 'bold', fontSize: '0.8125rem' } }}
              />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1, pl: 4 }}>
              <FormGroup>
                {REGIONS.map(region => (
                  <FormControlLabel
                    key={region}
                    control={
                      <Checkbox
                        checked={filters.dark_fiber[region]}
                        onChange={() => handleRegionFilterChange('dark_fiber', region)}
                        disabled={loading}
                        size="small"
                      />
                    }
                    label={`${region} (${getLoadedCount('dark_fiber', region)}/${availableCounts.dark_fiber[region]})`}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
          
          {/* 100Gb - Collapsed by default */}
          <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 40, py: 0, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasAllRegionsChecked('gb_100')}
                    indeterminate={hasAnyRegionChecked('gb_100') && !hasAllRegionsChecked('gb_100')}
                    onChange={() => handleParentFilterChange('gb_100')}
                    onClick={(e) => e.stopPropagation()}
                    disabled={loading}
                    size="small"
                  />
                }
                label={`100Gb (${loadedRoutes.gb_100.length}/${availableCounts.gb_100.total})`}
                onClick={(e) => e.stopPropagation()}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 'bold', fontSize: '0.8125rem' } }}
              />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1, pl: 4 }}>
              <FormGroup>
                {REGIONS.map(region => (
                  <FormControlLabel
                    key={region}
                    control={
                      <Checkbox
                        checked={filters.gb_100[region]}
                        onChange={() => handleRegionFilterChange('gb_100', region)}
                        disabled={loading}
                        size="small"
                      />
                    }
                    label={`${region} (${getLoadedCount('gb_100', region)}/${availableCounts.gb_100[region]})`}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
          
          {/* 10-99Gb - Collapsed by default */}
          <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 40, py: 0, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasAllRegionsChecked('gb_10')}
                    indeterminate={hasAnyRegionChecked('gb_10') && !hasAllRegionsChecked('gb_10')}
                    onChange={() => handleParentFilterChange('gb_10')}
                    onClick={(e) => e.stopPropagation()}
                    disabled={loading}
                    size="small"
                  />
                }
                label={`10-99Gb (${loadedRoutes.gb_10.length}/${availableCounts.gb_10.total})`}
                onClick={(e) => e.stopPropagation()}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 'bold', fontSize: '0.8125rem' } }}
              />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1, pl: 4 }}>
              <FormGroup>
                {REGIONS.map(region => (
                  <FormControlLabel
                    key={region}
                    control={
                      <Checkbox
                        checked={filters.gb_10[region]}
                        onChange={() => handleRegionFilterChange('gb_10', region)}
                        disabled={loading}
                        size="small"
                      />
                    }
                    label={`${region} (${getLoadedCount('gb_10', region)}/${availableCounts.gb_10[region]})`}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
          
          {/* <10Gb - Collapsed by default */}
          <Accordion sx={{ boxShadow: 'none', '&:before': { display: 'none' }, bgcolor: 'transparent' }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{ minHeight: 40, py: 0, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={hasAllRegionsChecked('lt_10gb')}
                    indeterminate={hasAnyRegionChecked('lt_10gb') && !hasAllRegionsChecked('lt_10gb')}
                    onChange={() => handleParentFilterChange('lt_10gb')}
                    onClick={(e) => e.stopPropagation()}
                    disabled={loading}
                    size="small"
                  />
                }
                label={`<10Gb (${loadedRoutes.lt_10gb.length}/${availableCounts.lt_10gb.total})`}
                onClick={(e) => e.stopPropagation()}
                sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 'bold', fontSize: '0.8125rem' } }}
              />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1, pl: 4 }}>
              <FormGroup>
                {REGIONS.map(region => (
                  <FormControlLabel
                    key={region}
                    control={
                      <Checkbox
                        checked={filters.lt_10gb[region]}
                        onChange={() => handleRegionFilterChange('lt_10gb', region)}
                        disabled={loading}
                        size="small"
                      />
                    }
                    label={`${region} (${getLoadedCount('lt_10gb', region)}/${availableCounts.lt_10gb[region]})`}
                    sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.8125rem' } }}
                  />
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Advanced Filter */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Advanced Filter
          </Typography>
          <Autocomplete
            freeSolo
            options={searchResults}
            loading={searchLoading}
            onInputChange={handleSearch}
            onChange={(event, value) => {
              if (value && typeof value === 'object') {
                handleAddAdvancedRoute(value);
              }
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              if (option.isBulkOption) return `🗂️ Add all ${option.count} routes for ${option.location}`;
              return `${option.circuit_id} (${option.location_a} → ${option.location_b})`;
            }}
            renderOption={(props, option) => {
              if (option.isBulkOption) {
                return (
                  <li {...props} style={{ fontWeight: 'bold', backgroundColor: '#e3f2fd' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="primary">
                        🗂️ Add all {option.count} routes for {option.location}
                      </Typography>
                    </Box>
                  </li>
                );
              }
              return (
                <li {...props}>
                  <Typography variant="body2">
                    {option.circuit_id} <Typography component="span" variant="caption" color="text.secondary">({option.location_a} → {option.location_b})</Typography>
                  </Typography>
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search by site code or circuit ID..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {searchLoading ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Search by site code (e.g., IPCLON1) or circuit ID
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Loaded Routes */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Loaded Routes: {getTotalRoutes()}
            </Typography>
            {getTotalRoutes() > 0 && (
              <Button 
                size="small" 
                color="error" 
                onClick={clearAllRoutes}
                startIcon={<DeleteIcon />}
              >
                Clear All
              </Button>
            )}
          </Box>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={30} />
            </Box>
          )}

          {/* Grouped routes */}
          {Object.entries(loadedRoutes).map(([category, routes]) => {
            if (routes.length === 0) return null;
            
            const categoryNames = {
              dark_fiber: 'Dark Fiber',
              gb_100: '100Gb',
              gb_10: '10-99Gb',
              lt_10gb: '<10Gb',
              advanced: 'Custom Routes',
              route_finder_primary: 'Primary Path (Red)',
              route_finder_secondary: 'Secondary Path (Blue)'
            };
            
            return (
              <Accordion key={category} defaultExpanded={category === 'dark_fiber' || category === 'gb_100'}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {categoryNames[category]} ({routes.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <List dense>
                    {routes.map(route => (
                      <ListItem
                        key={route.circuit_id}
                        sx={{ 
                          py: 0.5,
                          borderBottom: '1px solid #f0f0f0',
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <Checkbox
                            edge="start"
                            checked={routeVisibility[route.circuit_id] || false}
                            onChange={() => toggleRouteVisibility(route.circuit_id)}
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 'bold', display: 'block' }}>
                              {route.circuit_id}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                              {route.location_a} → {route.location_b}
                            </Typography>
                          }
                          sx={{ my: 0 }}
                        />
                        <IconButton 
                          size="small" 
                          onClick={(e) => handleColorMenuOpen(e, route.circuit_id)}
                          title="Change color"
                          sx={{ 
                            color: routeColors[route.circuit_id] || '#FF0000',
                            border: '2px solid currentColor',
                            width: 28,
                            height: 28,
                            mr: 0.5
                          }}
                        >
                          <PaletteIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => zoomToRoute(route.circuit_id)}
                          title="Zoom to route"
                        >
                          <ZoomInIcon fontSize="small" />
                        </IconButton>
                        <IconButton 
                          size="small" 
                          onClick={() => removeRoute(route.circuit_id)}
                          title="Remove route"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>

        {/* Controls */}
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            fullWidth
            startIcon={<HomeIcon />}
            onClick={resetView}
          >
            Reset View
          </Button>
        </Box>
      </Paper>

      {/* Cesium Globe Container */}
      <Box 
        ref={cesiumContainer} 
        sx={{ 
          flexGrow: 1, 
          position: 'relative',
          '& .cesium-viewer-bottom': {
            display: 'none' // Hide Cesium credits bar
          }
        }} 
      />

      {/* Route Info Popup (Sidebar) */}
      {selectedRoute && (
        <Paper 
          elevation={6} 
          sx={{ 
            position: 'absolute',
            right: 16,
            top: 16,
            width: 350,
            maxHeight: '80%',
            overflowY: 'auto',
            p: 2,
            zIndex: 1000
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouteIcon color="primary" />
              Route Details
            </Typography>
            <IconButton size="small" onClick={() => setSelectedRoute(null)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">UCN (Circuit ID)</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {selectedRoute.circuit_id}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Source Location</Typography>
              <Typography variant="body2">
                {selectedRoute.location_a}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Destination Location</Typography>
              <Typography variant="body2">
                {selectedRoute.location_b}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Bandwidth</Typography>
              <Typography variant="body2">
                {selectedRoute.bandwidth ? `${selectedRoute.bandwidth} Mbps` : 'N/A'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Expected Latency</Typography>
              <Typography variant="body2">
                {selectedRoute.expected_latency ? `${selectedRoute.expected_latency} ms` : 'N/A'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Cable System</Typography>
              <Typography variant="body2">
                {selectedRoute.cable_system || 'N/A'}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary">Underlying Carrier</Typography>
              <Typography variant="body2">
                {selectedRoute.underlying_carrier || 'N/A'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              startIcon={<ZoomInIcon />}
              onClick={() => {
                zoomToRoute(selectedRoute.circuit_id);
                setSelectedRoute(null);
              }}
            >
              Zoom to Route
            </Button>
            <Button
              variant="outlined"
              size="small"
              fullWidth
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => {
                removeRoute(selectedRoute.circuit_id);
                setSelectedRoute(null);
              }}
            >
              Remove
            </Button>
          </Box>
        </Paper>
      )}

      {/* Color Picker Menu */}
      <Menu
        anchorEl={colorMenuAnchor}
        open={Boolean(colorMenuAnchor)}
        onClose={handleColorMenuClose}
        PaperProps={{
          sx: { width: 200 }
        }}
      >
        <MenuItem disabled sx={{ fontWeight: 'bold', fontSize: '0.875rem' }}>
          <PaletteIcon sx={{ mr: 1 }} fontSize="small" />
          Choose Color
        </MenuItem>
        <Divider />
        {PRESET_COLORS.map(color => (
          <MenuItem 
            key={color.name}
            onClick={() => changeRouteColor(color.hex, color.cesium)}
            sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              py: 1
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                backgroundColor: color.hex,
                border: '2px solid #ddd',
                borderRadius: 1
              }}
            />
            <Typography variant="body2">{color.name}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

export default KMZMapViewer;
