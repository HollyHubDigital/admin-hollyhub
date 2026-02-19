// Admin Dashboard - Proxy server to forward API calls to visitors domain
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const VISITORS_API = process.env.VISITORS_API_URL || 'https://hollyhubdigital.vercel.app';

console.log(`⚙️ Admin Dashboard proxy initialized`);
console.log(`📍 Forwarding API calls to: ${VISITORS_API}`);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static admin files
app.use(express.static(path.join(__dirname)));

// Ensure admin JS and related static paths are served explicitly
app.get(['/admin.js','/admin/admin.js'], (req, res) => {
  return res.sendFile(path.join(__dirname, 'admin', 'admin.js'));
});

// ✅ Proxy all API requests to visitors domain
app.use('/api', async (req, res) => {
  try {
    const reqPath = req.path;
    const url = `${VISITORS_API}/api${reqPath}${req.url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    
    const options = {
      method: req.method,
      headers: {}
    };

    // Copy incoming headers (except host) so content-type and cookies are preserved
    Object.keys(req.headers || {}).forEach(h => {
      if (h.toLowerCase() === 'host') return;
      options.headers[h] = req.headers[h];
    });

    // Ensure a sensible User-Agent
    options.headers['user-agent'] = options.headers['user-agent'] || 'Admin-Proxy/1.0';

    // Forward body:
    // - For JSON requests, use the parsed body
    // - For others (multipart/form-data, binary), stream the raw request
    const incomingContentType = (req.headers['content-type'] || '');
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      if (incomingContentType.includes('application/json')) {
        options.body = JSON.stringify(req.body || {});
      } else {
        // stream the raw request to upstream
        options.body = req;
      }
    }

    console.log(`[PROXY] ${req.method} /api${reqPath} → ${VISITORS_API}/api${reqPath}`);

    const response = await fetch(url, options);

    // Try to parse JSON response; if it fails, capture text and wrap it
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

// Serve admin.html for root and sub-routes (SPA)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

// Fallback to admin.html for any unmatched routes (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Admin Dashboard running on port ${PORT}`);
  console.log(`📗 Open: http://localhost:${PORT}/admin`);
});

app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});
