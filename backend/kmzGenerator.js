const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs').promises;
const path = require('path');

// KML namespace constant
const NS_KML = "http://www.opengis.net/kml/2.2";
const NS_GX = "http://www.google.com/kml/ext/2.2";

// Batch size for yielding to event loop during heavy processing
const SEGMENT_BATCH_SIZE = 50;
// Concurrency limit for parallel circuit file loading
const CIRCUIT_CONCURRENCY = 3;

/**
 * Yield to the event loop to prevent blocking during heavy processing
 */
function yieldEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Escape special XML characters in text content
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Read and parse KML text from KMZ or KML file
 */
async function readKMLText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.kmz') {
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);
    
    // Find KML file in ZIP
    const kmlFiles = Object.keys(zip.files).filter(name => name.toLowerCase().endsWith('.kml'));
    if (kmlFiles.length === 0) {
      throw new Error(`No KML file found in ${path.basename(filePath)}`);
    }
    
    // Prefer doc.kml if it exists
    const kmlFile = kmlFiles.find(name => name.toLowerCase().endsWith('/doc.kml') || name.toLowerCase() === 'doc.kml') || kmlFiles[0];
    return await zip.files[kmlFile].async('string');
  } else if (ext === '.kml') {
    return await fs.readFile(filePath, 'utf-8');
  }
  
  throw new Error(`Unsupported file type: ${ext}`);
}

/**
 * Parse coordinates from KML text (space-separated lon,lat pairs)
 */
function parseKMLCoords(text) {
  if (!text) return [];
  const coords = [];
  const tokens = text.trim().split(/\s+/);
  
  for (const token of tokens) {
    if (!token) continue;
    const parts = token.split(',');
    if (parts.length >= 2) {
      coords.push({
        lon: parseFloat(parts[0]),
        lat: parseFloat(parts[1]),
        alt: parts.length >= 3 ? parseFloat(parts[2]) : 0
      });
    }
  }
  
  return coords;
}

/**
 * Extract route coordinates from parsed KML structure
 */
function extractRoutes(kmlObj) {
  const routes = [];
  
  // Helper to recursively find all Placemarks
  function findPlacemarks(obj) {
    if (!obj || typeof obj !== 'object') return [];
    
    let placemarks = [];
    
    if (obj.Placemark) {
      placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
    }
    
    // Recursively search in Document and Folder
    if (obj.Document) {
      placemarks = placemarks.concat(findPlacemarks(obj.Document));
    }
    if (obj.Folder) {
      const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
      folders.forEach(folder => {
        placemarks = placemarks.concat(findPlacemarks(folder));
      });
    }
    
    return placemarks;
  }
  
  const placemarks = findPlacemarks(kmlObj.kml);
  
  for (const placemark of placemarks) {
    // Extract LineString coordinates
    if (placemark.LineString && placemark.LineString.coordinates) {
      const coords = parseKMLCoords(placemark.LineString.coordinates);
      if (coords.length >= 2) {
        routes.push(coords);
      }
    }
    
    // Extract MultiGeometry LineStrings
    if (placemark.MultiGeometry && placemark.MultiGeometry.LineString) {
      const lineStrings = Array.isArray(placemark.MultiGeometry.LineString) 
        ? placemark.MultiGeometry.LineString 
        : [placemark.MultiGeometry.LineString];
      
      for (const ls of lineStrings) {
        if (ls.coordinates) {
          const coords = parseKMLCoords(ls.coordinates);
          if (coords.length >= 2) {
            routes.push(coords);
          }
        }
      }
    }
  }
  
  return routes;
}

/**
 * Extract point locations with names from KML
 */
function extractPointsWithNames(kmlObj) {
  const points = [];
  
  function findPlacemarks(obj) {
    if (!obj || typeof obj !== 'object') return [];
    
    let placemarks = [];
    
    if (obj.Placemark) {
      placemarks = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
    }
    
    if (obj.Document) {
      placemarks = placemarks.concat(findPlacemarks(obj.Document));
    }
    if (obj.Folder) {
      const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
      folders.forEach(folder => {
        placemarks = placemarks.concat(findPlacemarks(folder));
      });
    }
    
    return placemarks;
  }
  
  const placemarks = findPlacemarks(kmlObj.kml);
  
  for (const placemark of placemarks) {
    if (placemark.Point && placemark.Point.coordinates) {
      const name = placemark.name || 'Unnamed';
      const coords = parseKMLCoords(placemark.Point.coordinates);
      if (coords.length > 0) {
        points.push({
          name: name,
          lon: coords[0].lon,
          lat: coords[0].lat
        });
      }
    }
  }
  
  return points;
}

/**
 * Prepare disclaimer bundle for inclusion in output KMZ
 */
async function prepareDisclaimerBundle(disclaimerPath) {
  const data = await fs.readFile(disclaimerPath);
  const zip = await JSZip.loadAsync(data);
  
  const files = {};
  const kmlFiles = [];
  
  for (const [filename, fileObj] of Object.entries(zip.files)) {
    if (fileObj.dir) continue;
    
    files[filename] = await fileObj.async('nodebuffer');
    
    if (filename.toLowerCase().endsWith('.kml')) {
      kmlFiles.push(filename);
    }
  }
  
  if (kmlFiles.length === 0) {
    throw new Error('Disclaimer KMZ has no KML file');
  }
  
  // Prefer doc.kml
  const entryKml = kmlFiles.find(name => 
    name.toLowerCase().endsWith('/doc.kml') || name.toLowerCase() === 'doc.kml'
  ) || kmlFiles[0];
  
  return {
    files,
    entryKml: `disclaimer/${entryKml}`
  };
}

/**
 * Build coordinate string for a single route segment.
 * Returns the raw "lon,lat,alt lon,lat,alt ..." string.
 */
function buildCoordString(segmentCoords) {
  // Use a pre-sized array and manual loop for efficiency with large coordinate sets
  const parts = new Array(segmentCoords.length);
  for (let i = 0; i < segmentCoords.length; i++) {
    const c = segmentCoords[i];
    parts[i] = `${c.lon},${c.lat},${c.alt || 0}`;
  }
  return parts.join(' ');
}

/**
 * Build route LineString XML elements in batches, yielding to the event loop
 * between batches to prevent blocking. Uses MultiGeometry to group all segments
 * under a single Placemark (eliminates duplicate Style blocks per segment).
 */
async function buildRouteXML(routeSegments, pathName, kmlColor, lineWidth) {
  if (!routeSegments || routeSegments.length === 0) return '';
  
  const parts = [];
  parts.push('<Folder>');
  parts.push(`<name>${escapeXml(pathName)}</name>`);
  parts.push('<Placemark>');
  parts.push(`<name>${escapeXml(pathName)}</name>`);
  parts.push(`<Style><LineStyle><color>${kmlColor}</color><width>${lineWidth}</width></LineStyle></Style>`);
  parts.push('<MultiGeometry>');
  
  let totalCoords = 0;
  
  // Process route segments in batches, yielding between batches
  for (let i = 0; i < routeSegments.length; i += SEGMENT_BATCH_SIZE) {
    const batchEnd = Math.min(i + SEGMENT_BATCH_SIZE, routeSegments.length);
    
    for (let j = i; j < batchEnd; j++) {
      const coordString = buildCoordString(routeSegments[j]);
      totalCoords += routeSegments[j].length;
      parts.push(`<LineString><coordinates>${coordString}</coordinates></LineString>`);
    }
    
    // Yield to event loop between batches to prevent blocking
    if (batchEnd < routeSegments.length) {
      await yieldEventLoop();
    }
  }
  
  parts.push('</MultiGeometry>');
  parts.push('</Placemark>');
  parts.push('</Folder>');
  
  console.log(`    ✓ Built ${pathName} XML: ${routeSegments.length} segments, ${totalCoords} total coordinates`);
  
  return parts.join('\n');
}

/**
 * Build KMZ file with combined routes, locations, and disclaimer.
 * 
 * OPTIMIZATIONS vs previous version:
 * - Builds KML XML manually (avoids synchronous XMLBuilder bottleneck on large documents)
 * - Uses MultiGeometry to group route segments (1 Placemark+Style per path instead of N)
 * - Yields to event loop during coordinate string building (prevents Node.js blocking)
 * - Uses compression level 6 instead of 9 (significantly faster, still good compression)
 */
async function buildKMZ(options) {
  const {
    outputPath,
    disclaimerPath,
    routes,
    sourceLocation,
    destLocation,
    documentName // "{Quote} - {Customer} - {Source} - {Destination}"
  } = options;
  
  const startTime = Date.now();
  
  // 1. Prepare disclaimer bundle
  console.log('    Building KMZ - preparing disclaimer...');
  const disclaimer = await prepareDisclaimerBundle(disclaimerPath);
  
  // 2. Build KML XML manually for better performance with large route collections
  console.log('    Building KMZ - constructing KML...');
  const kmlParts = [];
  
  kmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
  kmlParts.push(`<kml xmlns="${NS_KML}" xmlns:gx="${NS_GX}">`);
  kmlParts.push('<Document>');
  kmlParts.push(`<name>${escapeXml(documentName || 'Network Route')}</name>`);
  
  // NetworkLink to disclaimer
  kmlParts.push('<NetworkLink>');
  kmlParts.push('<name>Disclaimer</name>');
  kmlParts.push('<visibility>1</visibility>');
  kmlParts.push('<Link>');
  kmlParts.push(`<href>${escapeXml(disclaimer.entryKml)}</href>`);
  kmlParts.push('<refreshMode>onChange</refreshMode>');
  kmlParts.push('</Link>');
  kmlParts.push('</NetworkLink>');
  
  // 3. Add Locations folder
  if (sourceLocation || destLocation) {
    kmlParts.push('<Folder>');
    kmlParts.push('<name>Locations</name>');
    
    if (sourceLocation) {
      kmlParts.push('<Placemark>');
      kmlParts.push(`<name>${escapeXml(sourceLocation.name)}</name>`);
      kmlParts.push(`<Point><coordinates>${sourceLocation.lon},${sourceLocation.lat},0</coordinates></Point>`);
      kmlParts.push('<Style><IconStyle><scale>1.0</scale></IconStyle></Style>');
      kmlParts.push('</Placemark>');
    }
    
    if (destLocation) {
      kmlParts.push('<Placemark>');
      kmlParts.push(`<name>${escapeXml(destLocation.name)}</name>`);
      kmlParts.push(`<Point><coordinates>${destLocation.lon},${destLocation.lat},0</coordinates></Point>`);
      kmlParts.push('<Style><IconStyle><scale>1.0</scale></IconStyle></Style>');
      kmlParts.push('</Placemark>');
    }
    
    kmlParts.push('</Folder>');
  }
  
  // 4. Add Primary Path folder (using MultiGeometry + batched yielding)
  if (routes.primary && routes.primary.length > 0) {
    console.log(`    Building KMZ - processing ${routes.primary.length} primary route segments...`);
    const primaryXml = await buildRouteXML(routes.primary, 'Primary Path', 'ff0000ff', 3.0);
    kmlParts.push(primaryXml);
    await yieldEventLoop();
  }
  
  // 5. Add Secondary Path folder (using MultiGeometry + batched yielding)
  if (routes.secondary && routes.secondary.length > 0) {
    console.log(`    Building KMZ - processing ${routes.secondary.length} secondary route segments...`);
    const secondaryXml = await buildRouteXML(routes.secondary, 'Secondary Path', 'ffff0000', 3.0);
    kmlParts.push(secondaryXml);
    await yieldEventLoop();
  }
  
  kmlParts.push('</Document>');
  kmlParts.push('</kml>');
  
  // Join all parts into final KML string
  const kmlXml = kmlParts.join('\n');
  console.log(`    Building KMZ - KML size: ${(kmlXml.length / 1024).toFixed(1)} KB`);
  
  // Free the parts array now that we have the joined string
  kmlParts.length = 0;
  
  await yieldEventLoop();
  
  // 6. Create ZIP (KMZ) with moderate compression (level 6 instead of 9 for much faster compression)
  console.log('    Building KMZ - compressing...');
  const zip = new JSZip();
  
  // Add doc.kml
  zip.file('doc.kml', kmlXml);
  
  // Add all disclaimer files under disclaimer/
  for (const [filename, content] of Object.entries(disclaimer.files)) {
    zip.file(`disclaimer/${filename}`, content);
  }
  
  // Generate final KMZ with balanced compression (level 6 is ~3-5x faster than level 9)
  const kmzBuffer = await zip.generateAsync({ 
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  
  await fs.writeFile(outputPath, kmzBuffer);
  
  const elapsed = Date.now() - startTime;
  console.log(`    ✓ KMZ built in ${elapsed}ms (${(kmzBuffer.length / 1024).toFixed(1)} KB compressed)`);
  
  return outputPath;
}

/**
 * Process a single circuit: look up KMZ path, read file, parse, extract routes.
 * Returns { routes: [], circuitId } on success, throws on failure.
 */
async function processCircuit(circuitId, kmzDir, parser, getKMZPath) {
  const kmzFilename = await getKMZPath(circuitId);
  const kmzPath = path.join(kmzDir, kmzFilename);
  
  await fs.access(kmzPath);
  const kmlText = await readKMLText(kmzPath);
  const kmlObj = parser.parse(kmlText);
  const circuitRoutes = extractRoutes(kmlObj);
  
  return { routes: circuitRoutes, circuitId };
}

/**
 * Process circuits in parallel with a concurrency limit.
 * Loads, parses, and extracts routes from multiple circuit KMZ files simultaneously.
 */
async function processCircuitsParallel(circuitIds, pathType, kmzDir, parser, getKMZPath) {
  const allRoutes = [];
  const skipped = [];
  
  for (let i = 0; i < circuitIds.length; i += CIRCUIT_CONCURRENCY) {
    const batch = circuitIds.slice(i, Math.min(i + CIRCUIT_CONCURRENCY, circuitIds.length));
    
    console.log(`  - Loading ${pathType} circuits batch ${Math.floor(i / CIRCUIT_CONCURRENCY) + 1}: [${batch.join(', ')}]`);
    
    const results = await Promise.allSettled(
      batch.map(circuitId => processCircuit(circuitId, kmzDir, parser, getKMZPath))
    );
    
    for (let j = 0; j < results.length; j++) {
      const circuitId = batch[j];
      
      if (results[j].status === 'fulfilled') {
        const { routes } = results[j].value;
        // Use loop instead of spread to avoid stack overflow with large arrays
        for (const route of routes) {
          allRoutes.push(route);
        }
        console.log(`    ✓ ${circuitId}: ${routes.length} route segment(s)`);
      } else {
        const reason = results[j].reason?.message || 'Unknown error';
        console.warn(`    ✗ Skipping ${circuitId}: ${reason}`);
        skipped.push({ circuitId, reason });
      }
    }
    
    // Yield between batches
    if (i + CIRCUIT_CONCURRENCY < circuitIds.length) {
      await yieldEventLoop();
    }
  }
  
  return { routes: allRoutes, skipped };
}

/**
 * Main function to generate KMZ from network design.
 * 
 * Optimized for large route collections:
 * - Parallel circuit file loading (3 concurrent)
 * - MultiGeometry grouping (reduces XML overhead)
 * - Event loop yielding (prevents Node.js blocking)
 * - Balanced compression (level 6)
 */
async function generateNetworkDesignKMZ(options) {
  const {
    primaryCircuits = [],
    secondaryCircuits = [],
    sourceLocationCode,
    destLocationCode,
    quoteRequestId,
    customerName,
    kmzDir,
    locationsTemplatePath,
    disclaimerPath,
    outputDir,
    db // Database connection to look up kmz_file_path
  } = options;
  
  const totalStartTime = Date.now();
  
  // Ensure output directory exists
  const fsSync = require('fs');
  if (!fsSync.existsSync(outputDir)) {
    fsSync.mkdirSync(outputDir, { recursive: true });
    console.log(`✓ Created output directory: ${outputDir}`);
  }
  
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });
  
  // Helper function to get KMZ path from database
  const getKMZPath = (circuitId) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT circuit_id, kmz_file_path FROM network_routes WHERE circuit_id = ?',
        [circuitId],
        (err, row) => {
          if (err) {
            console.log(`    • Database error for ${circuitId}:`, err.message);
            return reject(err);
          }
          if (!row) {
            console.log(`    • Circuit ${circuitId} not found in database`);
            return reject(new Error('Circuit not found in database'));
          }
          console.log(`    • Database row for ${circuitId}:`, JSON.stringify(row));
          if (!row.kmz_file_path || row.kmz_file_path.trim() === '') {
            console.log(`    • Circuit ${circuitId} has empty/null kmz_file_path`);
            return reject(new Error('No KMZ file path in database'));
          }
          resolve(row.kmz_file_path);
        }
      );
    });
  };
  
  // Process primary and secondary circuits in parallel batches
  console.log(`  - Processing ${primaryCircuits.length} primary + ${secondaryCircuits.length} secondary circuits...`);
  
  const primaryResult = await processCircuitsParallel(
    primaryCircuits, 'primary', kmzDir, parser, getKMZPath
  );
  
  const secondaryResult = await processCircuitsParallel(
    secondaryCircuits, 'secondary', kmzDir, parser, getKMZPath
  );
  
  const routes = {
    primary: primaryResult.routes,
    secondary: secondaryResult.routes
  };
  
  const skippedCircuits = [...primaryResult.skipped, ...secondaryResult.skipped];
  
  const loadElapsed = Date.now() - totalStartTime;
  console.log(`  - ✓ Circuit loading complete in ${loadElapsed}ms`);
  console.log(`    Primary: ${routes.primary.length} segments, Secondary: ${routes.secondary.length} segments`);
  
  // Extract source and destination from locations template
  let sourceLocation = null;
  let destLocation = null;
  
  if (locationsTemplatePath) {
    try {
      const locKmlText = await readKMLText(locationsTemplatePath);
      const locKmlObj = parser.parse(locKmlText);
      const points = extractPointsWithNames(locKmlObj);
      
      // Find matching locations (case-insensitive)
      sourceLocation = points.find(p => 
        p.name.toUpperCase().includes(sourceLocationCode.toUpperCase())
      );
      destLocation = points.find(p => 
        p.name.toUpperCase().includes(destLocationCode.toUpperCase())
      );
      
      if (!sourceLocation) {
        console.warn(`Source location ${sourceLocationCode} not found in template`);
      }
      if (!destLocation) {
        console.warn(`Destination location ${destLocationCode} not found in template`);
      }
    } catch (error) {
      console.error('Error loading locations template:', error);
    }
  }
  
  // Generate output filename and document name
  const sanitizeName = (name) => name.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${sanitizeName(quoteRequestId || 'Quote')}_${sanitizeName(customerName || 'Customer')}_${sourceLocationCode}_${destLocationCode}.kmz`;
  const outputPath = path.join(outputDir, filename);
  
  // Document name for display in KML (with proper formatting)
  const documentName = `${quoteRequestId || 'Quote'} - ${customerName || 'Customer'} - ${sourceLocationCode} - ${destLocationCode}`;
  
  console.log(`  - Building KMZ: ${documentName}`);
  console.log(`  - Output file: ${filename}`);
  
  // Build final KMZ
  await buildKMZ({
    outputPath,
    disclaimerPath,
    routes,
    sourceLocation,
    destLocation,
    documentName
  });
  
  const totalElapsed = Date.now() - totalStartTime;
  console.log(`  - ✓ Total KMZ generation time: ${totalElapsed}ms`);
  
  return {
    outputPath,
    filename,
    skippedCircuits,
    stats: {
      primaryCircuits: primaryCircuits.length,
      secondaryCircuits: secondaryCircuits.length,
      primaryRoutes: routes.primary.length,
      secondaryRoutes: routes.secondary.length,
      skipped: skippedCircuits.length,
      generationTimeMs: totalElapsed
    }
  };
}

module.exports = {
  generateNetworkDesignKMZ,
  readKMLText,
  extractRoutes,
  extractPointsWithNames
};
