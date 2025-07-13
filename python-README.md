# Network Inventory Backend (Python Implementation Guide)

This guide provides instructions for implementing a Python-based backend for the Network Inventory management system. The React frontend remains unchanged and connects to the Python backend API with full feature compatibility.

## Overview

The Python backend implementation supports all Network Inventory features:
- **Multiple Repository Management**: Extensible architecture for different inventory types
- **Dark Fiber & DWDM Tracking**: Channel management with reservation system
- **60-Day Reservation System**: Automatic expiry and audit trail
- **Multiple File Management**: KMZ uploads and ZIP test results downloads
- **Advanced Search & Export**: CSV exports with filtering capabilities

## Requirements

### Core Dependencies
- **Python 3.8+**: Modern Python version with async support
- **SQLite3**: Database engine (included with Python)
- **pip**: Package manager

### Recommended Python Packages
```txt
Flask==2.3.3
Flask-RESTful==0.3.10
Flask-CORS==4.0.0
Flask-SQLAlchemy==3.0.5
python-dotenv==1.0.0
APScheduler==3.10.4
zipfile36==0.1.3
```

### Additional Dependencies for Full Feature Support
```txt
Werkzeug==2.3.7      # File upload handling
SQLAlchemy==2.0.21   # Database ORM
python-dateutil==2.8.2  # Date handling for reservations
cryptography==41.0.4    # Security features
```

## Setup

### 1. Environment Setup
```bash
# Create and activate virtual environment
python -m venv network_inventory_env
source network_inventory_env/bin/activate  # On Windows: network_inventory_env\Scripts\activate

# Navigate to your Python backend directory
cd backend_python
```

### 2. Install Dependencies
```bash
# Install core packages
pip install Flask Flask-RESTful Flask-CORS Flask-SQLAlchemy python-dotenv APScheduler

# Install additional packages
pip install Werkzeug python-dateutil cryptography

# Create requirements.txt
pip freeze > requirements.txt
```

### 3. Database Setup

#### Schema Implementation
Create `models.py` with SQLAlchemy models:
```python
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta

db = SQLAlchemy()

class RepositoryType(db.Model):
    __tablename__ = 'repository_types'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class NetworkRoute(db.Model):
    __tablename__ = 'network_routes'
    circuit_id = db.Column(db.String(12), primary_key=True)
    repository_type_id = db.Column(db.Integer, db.ForeignKey('repository_types.id'), default=1)
    # ... other fields from schema
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class DarkFiberDetail(db.Model):
    __tablename__ = 'dark_fiber_details'
    id = db.Column(db.Integer, primary_key=True)
    circuit_id = db.Column(db.String(12), db.ForeignKey('network_routes.circuit_id'))
    dwdm_wavelength = db.Column(db.String(50))
    dwdm_ucn = db.Column(db.String(50))  # New DWDM UCN field
    equipment = db.Column(db.String(255))
    in_use = db.Column(db.Boolean, default=False)
    is_reserved = db.Column(db.Boolean, default=False)
    reserved_at = db.Column(db.DateTime)
    reserved_by = db.Column(db.String(255))
    reservation_expires_at = db.Column(db.DateTime)
    capex_cost_to_light = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ReservationLog(db.Model):
    __tablename__ = 'reservation_logs'
    id = db.Column(db.Integer, primary_key=True)
    dark_fiber_id = db.Column(db.Integer, db.ForeignKey('dark_fiber_details.id'))
    circuit_id = db.Column(db.String(12), db.ForeignKey('network_routes.circuit_id'))
    dwdm_ucn = db.Column(db.String(50))
    action = db.Column(db.String(20), nullable=False)  # RESERVED, RELEASED, EXPIRED
    reserved_by = db.Column(db.String(255))
    reservation_date = db.Column(db.DateTime, default=datetime.utcnow)
    expiry_date = db.Column(db.DateTime)
    notes = db.Column(db.Text)
```

### 4. Application Structure
```python
# app.py - Main application file
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_restful import Api, Resource
from models import db, NetworkRoute, DarkFiberDetail, ReservationLog
from datetime import datetime, timedelta
import os
import zipfile
import tempfile

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///network_inventory.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = 'uploads'

db.init_app(app)
CORS(app)
api = Api(app)

# Create upload directories
os.makedirs('uploads/kmz_files', exist_ok=True)
os.makedirs('uploads/test_results_files', exist_ok=True)
```

## API Implementation

### Core Routes
```python
class NetworkRoutes(Resource):
    def get(self):
        # GET /network_routes
        repository_type_id = request.args.get('repository_type_id')
        query = NetworkRoute.query
        if repository_type_id:
            query = query.filter_by(repository_type_id=repository_type_id)
        routes = query.all()
        return [route.to_dict() for route in routes]
    
    def post(self):
        # POST /network_routes
        data = request.get_json()
        # Validate Circuit ID format (6 letters + 6 digits)
        import re
        if not re.match(r'^[A-Z]{6}[0-9]{6}$', data.get('circuit_id', '')):
            return {'error': 'Invalid circuit_id format'}, 400
        
        route = NetworkRoute(**data)
        db.session.add(route)
        db.session.commit()
        return {'circuit_id': route.circuit_id}, 201

class DarkFiberResource(Resource):
    def get(self, circuit_id):
        # GET /dark_fiber_details/<circuit_id>
        details = DarkFiberDetail.query.filter_by(circuit_id=circuit_id).all()
        return [detail.to_dict() for detail in details]

class ReservationResource(Resource):
    def post(self, fiber_id):
        # POST /dark_fiber_details/<fiber_id>/reserve
        data = request.get_json()
        reserved_by = data.get('reserved_by')
        
        if not reserved_by:
            return {'error': 'reserved_by is required'}, 400
        
        fiber = DarkFiberDetail.query.get(fiber_id)
        if not fiber or fiber.is_reserved:
            return {'error': 'Cannot reserve - already reserved or not found'}, 400
        
        # Set 60-day reservation
        reserved_at = datetime.utcnow()
        expires_at = reserved_at + timedelta(days=60)
        
        fiber.is_reserved = True
        fiber.reserved_at = reserved_at
        fiber.reserved_by = reserved_by
        fiber.reservation_expires_at = expires_at
        
        # Log the reservation
        log = ReservationLog(
            dark_fiber_id=fiber_id,
            circuit_id=fiber.circuit_id,
            dwdm_ucn=fiber.dwdm_ucn,
            action='RESERVED',
            reserved_by=reserved_by,
            expiry_date=expires_at,
            notes='60-day reservation'
        )
        db.session.add(log)
        db.session.commit()
        
        return {
            'message': 'Reserved successfully',
            'reserved_at': reserved_at.isoformat(),
            'expires_at': expires_at.isoformat()
        }
```

### File Management
```python
@app.route('/network_routes/<circuit_id>/upload_test_results', methods=['POST'])
def upload_test_results(circuit_id):
    files = request.files.getlist('test_results_files')
    if not files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    uploaded_files = []
    for file in files:
        if file.filename:
            filename = secure_filename(file.filename)
            timestamp = int(time.time())
            unique_filename = f"{timestamp}_{filename}"
            filepath = os.path.join('uploads/test_results_files', unique_filename)
            file.save(filepath)
            
            # Save to database
            file_record = TestResultsFile(
                circuit_id=circuit_id,
                filename=unique_filename,
                original_name=filename,
                file_size=os.path.getsize(filepath)
            )
            db.session.add(file_record)
            uploaded_files.append({
                'id': file_record.id,
                'filename': unique_filename,
                'original_name': filename
            })
    
    db.session.commit()
    return jsonify({'message': 'Files uploaded', 'files': uploaded_files})

@app.route('/network_routes/<circuit_id>/download_test_results', methods=['GET'])
def download_test_results(circuit_id):
    files = TestResultsFile.query.filter_by(circuit_id=circuit_id).all()
    if not files:
        return jsonify({'error': 'No test results files found'}), 404
    
    # Create temporary ZIP file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
        with zipfile.ZipFile(tmp_file.name, 'w') as zip_file:
            for file_record in files:
                file_path = os.path.join('uploads/test_results_files', file_record.filename)
                if os.path.exists(file_path):
                    zip_file.write(file_path, file_record.original_name)
        
        return send_file(
            tmp_file.name,
            as_attachment=True,
            download_name=f'{circuit_id}_test_results.zip',
            mimetype='application/zip'
        )
```

### Automatic Reservation Expiry
```python
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime

def check_expired_reservations():
    """Background task to check and expire reservations"""
    expired_reservations = DarkFiberDetail.query.filter(
        DarkFiberDetail.is_reserved == True,
        DarkFiberDetail.reservation_expires_at < datetime.utcnow()
    ).all()
    
    for reservation in expired_reservations:
        # Log expiry
        log = ReservationLog(
            dark_fiber_id=reservation.id,
            circuit_id=reservation.circuit_id,
            dwdm_ucn=reservation.dwdm_ucn,
            action='EXPIRED',
            reserved_by=reservation.reserved_by,
            expiry_date=reservation.reservation_expires_at,
            notes='Automatically expired after 60 days'
        )
        
        # Clear reservation
        reservation.is_reserved = False
        reservation.reserved_at = None
        reservation.reserved_by = None
        reservation.reservation_expires_at = None
        
        db.session.add(log)
    
    db.session.commit()
    print(f"Expired {len(expired_reservations)} reservations")

# Set up scheduler
scheduler = BackgroundScheduler()
scheduler.add_job(check_expired_reservations, 'interval', hours=1)  # Check every hour
scheduler.start()
```

## Configuration

### Environment Variables (.env)
```env
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///network_inventory.db
UPLOAD_FOLDER=uploads
MAX_CONTENT_LENGTH=16777216  # 16MB max file size
```

### Application Configuration
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///network_inventory.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16777216))
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
```

## Running the Application

### Development Mode
```bash
# Set environment
export FLASK_APP=app.py
export FLASK_ENV=development

# Initialize database
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Run server
flask run --host=0.0.0.0 --port=4000
```

### Production Mode
```bash
# Use a WSGI server like Gunicorn
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:4000 app:app
```

## Testing

### Unit Tests
```python
import unittest
from app import app, db
from models import NetworkRoute, DarkFiberDetail

class NetworkInventoryTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
        self.app = app.test_client()
        db.create_all()
    
    def tearDown(self):
        db.session.remove()
        db.drop_all()
    
    def test_create_route(self):
        response = self.app.post('/network_routes', 
            json={'circuit_id': 'LONLON123456', 'location_a': 'London', 'location_b': 'Paris'})
        self.assertEqual(response.status_code, 201)
    
    def test_reservation_system(self):
        # Create a dark fiber detail
        # Test reservation functionality
        pass

if __name__ == '__main__':
    unittest.main()
```

## Deployment Considerations

### Database Migration
```python
# Create migration script similar to Node.js version
from flask_migrate import Migrate

migrate = Migrate(app, db)

# Generate migrations
flask db migrate -m "Add reservation features"
flask db upgrade
```

### Security Features
- **Input Validation**: Use Flask-WTF for form validation
- **Authentication**: Implement JWT or session-based auth
- **File Upload Security**: Validate file types and sizes
- **SQL Injection Protection**: Use SQLAlchemy ORM parameterized queries

### Performance Optimization
- **Database Indexing**: Add indexes on frequently queried fields
- **Caching**: Use Flask-Caching for API response caching
- **Background Tasks**: Use Celery for heavy operations
- **Connection Pooling**: Configure SQLAlchemy connection pool

## API Compatibility

Ensure the Python backend provides the same API endpoints as the Node.js version:
- All HTTP methods (GET, POST, PUT, DELETE)
- Same URL patterns and parameters
- Identical JSON response formats
- Compatible error handling and status codes

The React frontend will work seamlessly with either backend implementation.

---

**Network Inventory Python Backend** - Alternative implementation maintaining full feature compatibility 