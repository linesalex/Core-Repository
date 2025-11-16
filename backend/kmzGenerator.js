const JSZip = require('jszip');
const { XMLParser, XMLBuilder } = require('fast-xml-parser');
const fs = require('fs').promises;
const path = require('path');

// KML namespace constant
const NS_KML = "http://www.opengis.net/kml/2.2";
const NS_GX = "http://www.google.com/kml/ext/2.2";

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
 * Build KMZ file with combined routes, locations, and disclaimer
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
  
  // 1. Prepare disclaimer bundle
  const disclaimer = await prepareDisclaimerBundle(disclaimerPath);
  
  // 2. Build KML structure with proper document name
  const kmlDoc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    kml: {
      '@_xmlns': NS_KML,
      '@_xmlns:gx': NS_GX,
      Document: {
        name: documentName || 'Network Route',
        // NetworkLink to disclaimer
        NetworkLink: {
          name: 'Disclaimer',
          visibility: 1,
          Link: {
            href: disclaimer.entryKml,
            refreshMode: 'onChange'
          }
        },
        Folder: []
      }
    }
  };
  
  // 3. Add Locations folder
  const locationsFolder = {
    name: 'Locations',
    Placemark: []
  };
  
  if (sourceLocation) {
    locationsFolder.Placemark.push({
      name: sourceLocation.name,
      Point: {
        coordinates: `${sourceLocation.lon},${sourceLocation.lat},0`
      },
      Style: {
        IconStyle: {
          scale: 1.0
        }
      }
    });
  }
  
  if (destLocation) {
    locationsFolder.Placemark.push({
      name: destLocation.name,
      Point: {
        coordinates: `${destLocation.lon},${destLocation.lat},0`
      },
      Style: {
        IconStyle: {
          scale: 1.0
        }
      }
    });
  }
  
  if (locationsFolder.Placemark.length > 0) {
    kmlDoc.kml.Document.Folder.push(locationsFolder);
  }
  
  // 4. Add Primary Path folder (if exists)
  if (routes.primary && routes.primary.length > 0) {
    const allCoords = routes.primary.flat();
    const coordString = allCoords.map(c => `${c.lon},${c.lat},${c.alt || 0}`).join(' ');
    
    const primaryFolder = {
      name: 'Primary Path',
      Placemark: {
        name: 'Primary Route',
        LineString: {
          coordinates: coordString
        },
        Style: {
          LineStyle: {
            color: 'ff0000ff', // Red in KML (ABGR format)
            width: 3.0
          }
        }
      }
    };
    
    kmlDoc.kml.Document.Folder.push(primaryFolder);
  }
  
  // 5. Add Secondary Path folder (if exists)
  if (routes.secondary && routes.secondary.length > 0) {
    const allCoords = routes.secondary.flat();
    const coordString = allCoords.map(c => `${c.lon},${c.lat},${c.alt || 0}`).join(' ');
    
    const secondaryFolder = {
      name: 'Secondary Path',
      Placemark: {
        name: 'Secondary Route',
        LineString: {
          coordinates: coordString
        },
        Style: {
          LineStyle: {
            color: 'ffff0000', // Blue in KML (ABGR format)
            width: 3.0
          }
        }
      }
    };
    
    kmlDoc.kml.Document.Folder.push(secondaryFolder);
  }
  
  // 5. Build XML
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    suppressEmptyNode: true
  });
  const kmlXml = builder.build(kmlDoc);
  
  // 6. Create ZIP (KMZ)
  const zip = new JSZip();
  
  // Add doc.kml
  zip.file('doc.kml', kmlXml);
  
  // Add all disclaimer files under disclaimer/
  for (const [filename, content] of Object.entries(disclaimer.files)) {
    zip.file(`disclaimer/${filename}`, content);
  }
  
  // Generate final KMZ
  const kmzBuffer = await zip.generateAsync({ 
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  
  await fs.writeFile(outputPath, kmzBuffer);
  
  return outputPath;
}

/**
 * Main function to generate KMZ from network design
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
  
  const skippedCircuits = [];
  const routes = { primary: [], secondary: [] };
  
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
  
  // Process primary circuits
  for (const circuitId of primaryCircuits) {
    try {
      // Get actual KMZ file path from database
      const kmzFilename = await getKMZPath(circuitId);
      const kmzPath = path.join(kmzDir, kmzFilename);
      
      console.log(`  - Loading primary circuit ${circuitId}: ${kmzFilename}`);
      
      await fs.access(kmzPath);
      const kmlText = await readKMLText(kmzPath);
      const kmlObj = parser.parse(kmlText);
      const circuitRoutes = extractRoutes(kmlObj);
      routes.primary.push(...circuitRoutes);
      console.log(`    ✓ Loaded ${circuitRoutes.length} route segment(s)`);
    } catch (error) {
      console.warn(`  - Skipping circuit ${circuitId}: ${error.message}`);
      skippedCircuits.push({ circuitId, reason: error.message });
    }
  }
  
  // Process secondary circuits
  for (const circuitId of secondaryCircuits) {
    try {
      // Get actual KMZ file path from database
      const kmzFilename = await getKMZPath(circuitId);
      const kmzPath = path.join(kmzDir, kmzFilename);
      
      console.log(`  - Loading secondary circuit ${circuitId}: ${kmzFilename}`);
      
      await fs.access(kmzPath);
      const kmlText = await readKMLText(kmzPath);
      const kmlObj = parser.parse(kmlText);
      const circuitRoutes = extractRoutes(kmlObj);
      routes.secondary.push(...circuitRoutes);
      console.log(`    ✓ Loaded ${circuitRoutes.length} route segment(s)`);
    } catch (error) {
      console.warn(`  - Skipping circuit ${circuitId}: ${error.message}`);
      skippedCircuits.push({ circuitId, reason: error.message });
    }
  }
  
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
  
  return {
    outputPath,
    filename,
    skippedCircuits,
    stats: {
      primaryCircuits: primaryCircuits.length,
      secondaryCircuits: secondaryCircuits.length,
      primaryRoutes: routes.primary.length,
      secondaryRoutes: routes.secondary.length,
      skipped: skippedCircuits.length
    }
  };
}

module.exports = {
  generateNetworkDesignKMZ,
  readKMLText,
  extractRoutes,
  extractPointsWithNames
};

