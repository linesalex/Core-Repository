const fs = require('fs');
const path = require('path');
const db = require('./db');

const schemaPath = path.resolve(__dirname, '../network_routes_schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
  if (err) {
    console.error('Error initializing database:', err.message);
  } else {
    console.log('Database initialized successfully.');
  }
  db.close();
}); 