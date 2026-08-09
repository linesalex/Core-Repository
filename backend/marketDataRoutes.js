const express = require('express');
const router = express.Router();
const db = require('./db');
const { authenticateToken, authorizeModulePermission } = require('./auth');

const MODULE = 'market_data_contacts';

const logChange = (userId, tableName, recordId, action, oldValues, newValues, req) => {
  if (!tableName || !action) return;
  const safeUserId = userId || req?.user?.id;
  if (!safeUserId) return;
  const safeRecordId = recordId || 'N/A';
  const changes = [];
  if (oldValues && newValues) {
    Object.keys(newValues).forEach((key) => {
      if (oldValues[key] !== newValues[key]) {
        changes.push(`${key}: ${oldValues[key]} → ${newValues[key]}`);
      }
    });
  }
  const changesSummary = changes.length > 0 ? changes.join(', ') : `${action} operation`;
  const ipAddress = req?.ip || req?.connection?.remoteAddress || 'Unknown';
  const userAgent = req?.get?.('User-Agent') || 'Unknown';
  db.run(
    'INSERT INTO change_logs (user_id, table_name, record_id, action, old_values, new_values, changes_summary, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [safeUserId, tableName, safeRecordId, action, JSON.stringify(oldValues), JSON.stringify(newValues), changesSummary, ipAddress, userAgent],
    (err) => {
      if (err) console.error('Failed to log change:', err.message);
    }
  );
};

// List organizations (exchange + extranet parents for contacts)
router.get('/market-data/organizations', authenticateToken, authorizeModulePermission(MODULE, 'read_only'), (req, res) => {
  const { search, region, available, organization_type } = req.query;
  let sql = 'SELECT * FROM market_data_organizations WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND organization_name LIKE ?';
    params.push(`%${search}%`);
  }
  if (region) {
    sql += ' AND region = ?';
    params.push(region);
  }
  if (available === 'true' || available === 'false') {
    sql += ' AND available = ?';
    params.push(available === 'true' ? 1 : 0);
  }
  if (organization_type === 'exchange' || organization_type === 'extranet') {
    sql += ' AND organization_type = ?';
    params.push(organization_type);
  }

  sql += ' ORDER BY organization_type, region, organization_name';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/market-data/organizations', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const {
    organization_name,
    organization_type = 'exchange',
    region,
    salesperson_assigned,
    available = true
  } = req.body;

  if (!organization_name || !region) {
    return res.status(400).json({ error: 'Organization name and region are required' });
  }
  if (!['exchange', 'extranet'].includes(organization_type)) {
    return res.status(400).json({ error: 'organization_type must be exchange or extranet' });
  }

  db.run(
    `INSERT INTO market_data_organizations
      (organization_name, organization_type, region, salesperson_assigned, available, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      organization_name,
      organization_type,
      region,
      salesperson_assigned || null,
      available ? 1 : 0,
      req.user.id,
      req.user.id
    ],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'An organization with that name, type, and region already exists' });
        }
        return res.status(500).json({ error: err.message });
      }

      const recordId = this.lastID;
      try {
        logChange(req.user.id, 'market_data_organizations', recordId, 'CREATE', null, {
          organization_name, organization_type, region, salesperson_assigned, available
        }, req);
      } catch (logError) {
        console.error('Failed to log organization creation:', logError);
      }

      res.status(201).json({ id: recordId, message: 'Organization created successfully' });
    }
  );
});

router.put('/market-data/organizations/:id', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const orgId = req.params.id;
  const {
    organization_name,
    organization_type,
    region,
    salesperson_assigned,
    available
  } = req.body;

  db.get('SELECT * FROM market_data_organizations WHERE id = ?', [orgId], (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRow) return res.status(404).json({ error: 'Organization not found' });

    const nextType = organization_type || oldRow.organization_type;
    if (!['exchange', 'extranet'].includes(nextType)) {
      return res.status(400).json({ error: 'organization_type must be exchange or extranet' });
    }

    db.run(
      `UPDATE market_data_organizations
       SET organization_name = ?, organization_type = ?, region = ?, salesperson_assigned = ?,
           available = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        organization_name ?? oldRow.organization_name,
        nextType,
        region ?? oldRow.region,
        salesperson_assigned !== undefined ? salesperson_assigned : oldRow.salesperson_assigned,
        available !== undefined ? (available ? 1 : 0) : oldRow.available,
        req.user.id,
        orgId
      ],
      function(updateErr) {
        if (updateErr) {
          if (updateErr.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'An organization with that name, type, and region already exists' });
          }
          return res.status(500).json({ error: updateErr.message });
        }

        logChange(req.user.id, 'market_data_organizations', orgId, 'UPDATE', oldRow, {
          organization_name, organization_type: nextType, region, salesperson_assigned, available
        }, req);

        res.json({ message: 'Organization updated successfully' });
      }
    );
  });
});

router.delete('/market-data/organizations/:id', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const orgId = req.params.id;

  db.get('SELECT * FROM market_data_organizations WHERE id = ?', [orgId], (err, oldRow) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!oldRow) return res.status(404).json({ error: 'Organization not found' });

    db.run('DELETE FROM market_data_organizations WHERE id = ?', [orgId], function(deleteErr) {
      if (deleteErr) return res.status(500).json({ error: deleteErr.message });

      logChange(req.user.id, 'market_data_organizations', orgId, 'DELETE', oldRow, null, req);
      res.json({ message: 'Organization deleted successfully' });
    });
  });
});

// Contacts under an organization
router.get('/market-data/organizations/:id/contacts', authenticateToken, authorizeModulePermission(MODULE, 'read_only'), (req, res) => {
  const orgId = req.params.id;

  db.all(
    `SELECT mc.*, u.username, u.full_name
     FROM market_data_contacts mc
     LEFT JOIN users u ON mc.updated_by = u.id
     WHERE mc.organization_id = ?
     ORDER BY mc.contact_name`,
    [orgId],
    (err, contacts) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(contacts);
    }
  );
});

router.post('/market-data/organizations/:id/contacts', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const orgId = req.params.id;
  const {
    contact_name, job_title, country, phone_number, email,
    contact_type, daily_contact, more_info
  } = req.body;

  if (!contact_name) {
    return res.status(400).json({ error: 'Contact name is required' });
  }

  const now = new Date().toISOString();
  db.run(
    `INSERT INTO market_data_contacts (
      organization_id, contact_name, job_title, country, phone_number, email,
      contact_type, daily_contact, more_info, created_by, updated_by, updated_date, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orgId, contact_name, job_title || null, country || null, phone_number || null, email || null,
      contact_type || null, (daily_contact === 'true' || daily_contact === true) ? 1 : 0, more_info || null,
      req.user.id, req.user.id, now, now
    ],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });

      const recordId = this.lastID;
      try {
        logChange(req.user.id, 'market_data_contacts', recordId || contact_name, 'CREATE', null, {
          organization_id: orgId, contact_name, job_title, country, phone_number,
          email, contact_type, daily_contact, more_info
        }, req);
      } catch (logError) {
        console.error('Failed to log contact creation:', logError);
      }

      res.status(201).json({ id: recordId, contact_name, message: 'Contact created successfully' });
    }
  );
});

router.put('/market-data/organizations/:orgId/contacts/:contactId', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const { orgId, contactId } = req.params;
  const {
    contact_name, job_title, country, phone_number, email,
    contact_type, daily_contact, more_info
  } = req.body;

  db.get(
    'SELECT * FROM market_data_contacts WHERE id = ? AND organization_id = ?',
    [contactId, orgId],
    (err, oldContact) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!oldContact) return res.status(404).json({ error: 'Contact not found' });

      const now = new Date().toISOString();
      db.run(
        `UPDATE market_data_contacts SET
          contact_name = ?, job_title = ?, country = ?, phone_number = ?, email = ?,
          contact_type = ?, daily_contact = ?, more_info = ?, updated_date = ?, last_updated = ?,
          updated_by = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [
          contact_name, job_title || null, country || null, phone_number || null, email || null,
          contact_type || null, (daily_contact === 'true' || daily_contact === true) ? 1 : 0, more_info || null,
          now, now, req.user.id, contactId, orgId
        ],
        function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });

          logChange(req.user.id, 'market_data_contacts', contactId, 'UPDATE', oldContact, {
            contact_name, job_title, country, phone_number, email,
            contact_type, daily_contact, more_info
          }, req);

          res.json({ message: 'Contact updated successfully' });
        }
      );
    }
  );
});

router.delete('/market-data/organizations/:orgId/contacts/:contactId', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const { orgId, contactId } = req.params;

  db.get(
    'SELECT * FROM market_data_contacts WHERE id = ? AND organization_id = ?',
    [contactId, orgId],
    (err, oldContact) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!oldContact) return res.status(404).json({ error: 'Contact not found' });

      db.run(
        'DELETE FROM market_data_contacts WHERE id = ? AND organization_id = ?',
        [contactId, orgId],
        function(deleteErr) {
          if (deleteErr) return res.status(500).json({ error: deleteErr.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });

          logChange(req.user.id, 'market_data_contacts', contactId, 'DELETE', oldContact, null, req);
          res.json({ message: 'Contact deleted successfully' });
        }
      );
    }
  );
});

router.get('/market-data/overdue-contacts', authenticateToken, authorizeModulePermission(MODULE, 'read_only'), (req, res) => {
  const sql = `
    SELECT
      mc.*,
      o.organization_name,
      o.organization_type,
      o.region,
      julianday('now') - julianday(COALESCE(mc.last_updated, mc.updated_date, mc.created_at)) as days_since_update
    FROM market_data_contacts mc
    JOIN market_data_organizations o ON mc.organization_id = o.id
    WHERE julianday('now') - julianday(COALESCE(mc.last_updated, mc.updated_date, mc.created_at)) >= 365
    ORDER BY days_since_update DESC, o.organization_name, mc.contact_name
  `;

  db.all(sql, [], (err, contacts) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(contacts);
  });
});

router.post('/market-data/organizations/:orgId/contacts/:contactId/approve', authenticateToken, authorizeModulePermission(MODULE, 'provisioner'), (req, res) => {
  const { orgId, contactId } = req.params;

  db.get(
    'SELECT * FROM market_data_contacts WHERE id = ? AND organization_id = ?',
    [contactId, orgId],
    (err, contact) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!contact) return res.status(404).json({ error: 'Contact not found' });

      db.run(
        `UPDATE market_data_contacts
         SET last_updated = CURRENT_TIMESTAMP, updated_date = CURRENT_TIMESTAMP,
             updated_by = ?, approved_by = ?, approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ?`,
        [req.user.id, req.user.id, contactId, orgId],
        function(updateErr) {
          if (updateErr) return res.status(500).json({ error: updateErr.message });
          if (this.changes === 0) return res.status(404).json({ error: 'Contact not found' });

          logChange(req.user.id, 'market_data_contacts', contactId, 'APPROVE_YEARLY_UPDATE', contact, {
            approved_by: req.user.id,
            approved_at: new Date().toISOString()
          }, req);

          res.json({ message: 'Contact yearly update approved successfully' });
        }
      );
    }
  );
});

module.exports = router;
