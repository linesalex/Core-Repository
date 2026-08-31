/**
 * POST /assistant/query - the "Ask" chat assistant (route finding + promo
 * pricing, V1). Mounted from backend/index.js; routes.js is not touched.
 */

const express = require('express');
const db = require('../db');
const { authenticateToken, authorizeRole, authorizeModulePermission } = require('../auth');
const { handleQuery } = require('./conversation');

const router = express.Router();

// TEMP: restricted to admin users only while this feature is still in
// progress - remove authorizeRole('administrator') once it's ready for everyone.
router.post('/assistant/query', authenticateToken, authorizeRole('administrator'), authorizeModulePermission('route_finder', 'read_only'), async (req, res) => {
  const startTime = Date.now();
  const { message, conversation } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader ? authHeader.split(' ')[1] : null;

  try {
    const response = await handleQuery({ message, conversation, token });
    const executionTime = Date.now() - startTime;

    db.run(
      `INSERT INTO audit_logs (action_type, user_id, user_name, parameters, results, execution_time, ip_address, user_agent, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        'ASSISTANT_QUERY',
        req.user.id,
        req.user.username,
        JSON.stringify({ message, conversation: conversation || null }),
        JSON.stringify({ status: response.status, slots: response.slots || response.conversation?.slots || null }),
        executionTime,
        req.ip || req.connection.remoteAddress,
        req.headers['user-agent']
      ],
      (err) => {
        if (err) console.error('Failed to log assistant query:', err);
      }
    );

    res.json(response);
  } catch (err) {
    console.error('Assistant query error:', err);
    res.status(500).json({ error: 'Failed to process the request: ' + err.message });
  }
});

module.exports = router;
