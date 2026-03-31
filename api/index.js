// Admin Dashboard API entry point for Vercel
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const VISITORS_API = process.env.VISITORS_API_URL || 'https://hollyhubdigitals.vercel.app';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static CSS file explicitly with correct MIME type
app.get('/styles.css', (req, res) => {
  const filePath = path.join(__dirname, '..', 'styles.css');
  res.type('text/css; charset=UTF-8');
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ✅ Serve all static files from admin folder
app.get('/admin/:file', (req, res) => {
  const filePath = path.join(__dirname, '..', 'admin', req.params.file);
  if (filePath.endsWith('.js')) {
    res.type('application/javascript; charset=UTF-8');
  } else if (filePath.endsWith('.html')) {
    res.type('text/html; charset=UTF-8');
  }
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ✅ Serve adminlogin.html at root level
app.get('/adminlogin.html', (req, res) => {
  const filePath = path.join(__dirname, '..', 'adminlogin.html');
  res.type('text/html; charset=UTF-8');
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// Generic static files
app.use(express.static(path.join(__dirname, '..')));

// ✅ Proxy all API requests to visitors domain
app.use('/api', async (req, res) => {
  try {
    const reqPath = req.path;
    const url = `${VISITORS_API}/api${reqPath}${req.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    
    const options = {
      method: req.method,
      headers: {}
    };

    Object.keys(req.headers || {}).forEach(h => {
      if (h.toLowerCase() === 'host') return;
      options.headers[h] = req.headers[h];
    });

    options.headers['user-agent'] = options.headers['user-agent'] || 'Admin-Proxy/1.0';

    const incomingContentType = (req.headers['content-type'] || '');
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (incomingContentType.includes('application/json')) {
        options.body = JSON.stringify(req.body || {});
      } else {
        options.body = req;
        options.duplex = 'half';
      }
    }

    console.log(`[PROXY] ${req.method} /api${reqPath} → ${VISITORS_API}/api${reqPath}`);

    const response = await fetch(url, options);

    let body;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      const text = await response.text();
      try {
        body = JSON.parse(text);
      } catch (e) {
        body = { message: text };
      }
    }

    if (response.status >= 500) {
      const msg = (body && body.message) ? String(body.message) : '';
      if (msg.toLowerCase().includes('read-only') || msg.includes('EROFS')) {
        return res.status(503).json({ error: 'Visitors backend is read-only', message: 'The visitors service cannot write to disk in its current deployment. Deploy visitors as a persistent Node server or use remote storage.' });
      }
    }

    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(body));
  } catch (error) {
    console.error('❌ API Proxy Error:', error);
    res.status(503).json({ 
      error: 'Visitors API unavailable',
      message: error.message 
    });
  }
});

// ✅ Serve admin.html with dynamic API_BASE_URL configuration
function getAdminHtmlWithCorrectUrl() {
  let html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  return html;
}

// ✅ Explicitly serve admin.js
app.get('/admin.js', (req, res) => {
  const filePath = path.join(__dirname, '..', 'admin.js');
  res.type('application/javascript; charset=UTF-8');
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ admin.js not found:', filePath);
      res.status(404).send('Not found');
    }
  });
});

// Serve admin.html for root and sub-routes (SPA)
app.get('/', (req, res) => {
  res.type('text/html; charset=UTF-8');
  res.send(getAdminHtmlWithCorrectUrl());
});

app.get('/admin', (req, res) => {
  res.type('text/html; charset=UTF-8');
  res.send(getAdminHtmlWithCorrectUrl());
});

app.get('/admin.html', (req, res) => {
  res.type('text/html; charset=UTF-8');
  res.send(getAdminHtmlWithCorrectUrl());
});

// Fallback to admin.html for any unmatched routes (SPA)
app.get('*', (req, res) => {
  if (req.path.includes('.')) {
    return res.status(404).send('Not found');
  }
  res.type('text/html; charset=UTF-8');
  res.send(getAdminHtmlWithCorrectUrl());
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
