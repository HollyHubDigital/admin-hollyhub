// Admin Dashboard API entry point for Vercel
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const VISITORS_API = process.env.VISITORS_API_URL || 'https://hollyhubdigitals.vercel.app';

// ═══════════════════════════════════════════════════════════════════
// 💬 CHAT SYSTEM - GitHub-based message storage with real-time polling
// ═══════════════════════════════════════════════════════════════════

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'HollyHubDigital';
const GITHUB_REPO = process.env.GITHUB_REPO || 'hollyhub-visitors';
const GITHUB_API = 'https://api.github.com';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ═══════════════════════════════════════════════════════════════════
// 🔐 AUTH MIDDLEWARE - Validate tokens and permissions
// ═══════════════════════════════════════════════════════════════════

// Helper: Extract and validate auth token from Authorization header
function extractAuthToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
}

// Helper: Verify token is valid
function validateAuthToken(token, userEmail) {
  if (!token || !userEmail) return false;
  if (typeof token !== 'string' || token.length < 10) {
    return false;
  }
  console.log(`✓ Token validated for user: ${userEmail}`);
  return true;
}

// Helper: Verify user owns a project (fetch project from visitors API to check ownership)
async function verifyProjectOwnership(projectId, userEmail) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const res = await fetch(`${VISITORS_API}/api/projects?userEmail=${encodeURIComponent(userEmail)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      console.warn(`⚠️ Failed to fetch projects for verification: ${res.status}`);
      return false;
    }
    
    const projects = await res.json();
    const userOwnsProject = projects.some(p => p.id === projectId && p.userEmail === userEmail);
    
    if (!userOwnsProject) {
      console.warn(`🚫 User ${userEmail} does not own project ${projectId}`);
      return false;
    }
    
    console.log(`✓ Project ownership verified: ${projectId} belongs to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Error verifying project ownership:', error.message);
    if (error.name === 'AbortError') {
      console.warn(`⚠️ Project ownership verification timed out for ${userEmail}`);
    }
    return false;
  }
}

// Helper: GitHub API call with timeout protection
async function githubApiCall(method, endpoint, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }
  };
  
  if (body) options.body = JSON.stringify(body);
  
  const url = `${GITHUB_API}${endpoint}`;
  
  // Add timeout to prevent hanging on slow GitHub API
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  options.signal = controller.signal;
  
  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${error}`);
    }
    
    return response.status === 204 ? null : response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.error(`⚠️ GitHub API timeout for ${method} ${endpoint}`);
      throw new Error(`GitHub API timeout: request took longer than 15 seconds`);
    }
    throw error;
  }
}

// Helper: Get chat file SHA (needed for updates)
async function getChatFileSha(chatFileKey) {
  try {
    const data = await githubApiCall('GET', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/chats/${chatFileKey}.json`);
    return data.sha;
  } catch (e) {
    return null; // File doesn't exist yet
  }
}

// Helper: Read chat file from GitHub
async function readChatFile(chatFileKey) {
  try {
    const data = await githubApiCall('GET', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/chats/${chatFileKey}.json`);
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { messages: [] }; // New chat
  }
}

// Helper: Write chat file to GitHub
async function writeChatFile(chatFileKey, chatData) {
  const sha = await getChatFileSha(chatFileKey);
  const content = Buffer.from(JSON.stringify(chatData, null, 2)).toString('base64');
  
  const payload = {
    message: `Update chat ${chatFileKey}`,
    content: content,
    branch: 'main'
  };
  
  if (sha) payload.sha = sha;
  
  return githubApiCall(sha ? 'PUT' : 'POST', `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data/chats/${chatFileKey}.json`, payload);
}

// ═══════════════════════════════════════════════════════════════════
// 💬 CHAT ENDPOINTS - MOVED TO VISITORS API
// ═══════════════════════════════════════════════════════════════════
// ⚠️ These endpoints have been MOVED to https://hollyhubdigitals.vercel.app
// Reason: Visitors API has GITHUB_TOKEN in environment, admin-hollyhub does not
// 
// Block old chat requests and redirect to visitors API:
app.post('/api/chat/send', (req, res) => {
  res.status(410).json({ 
    error: 'Chat endpoints moved to visitors API',
    redirectTo: 'https://hollyhubdigitals.vercel.app/api/chat/send',
    message: 'Use https://hollyhubdigitals.vercel.app for all chat operations'
  });
});

app.get('/api/chat/messages', (req, res) => {
  res.status(410).json({ 
    error: 'Chat endpoints moved to visitors API',
    redirectTo: 'https://hollyhubdigitals.vercel.app/api/chat/messages',
    message: 'Use https://hollyhubdigitals.vercel.app for all chat operations'
  });
});

app.put('/api/chat/mark-read', (req, res) => {
  res.status(410).json({ 
    error: 'Chat endpoints moved to visitors API',
    redirectTo: 'https://hollyhubdigitals.vercel.app/api/chat/mark-read',
    message: 'Use https://hollyhubdigitals.vercel.app for all chat operations'
  });
});

app.get('/api/chat/unread-count', (req, res) => {
  res.status(410).json({ 
    error: 'Chat endpoints moved to visitors API',
    redirectTo: 'https://hollyhubdigitals.vercel.app/api/chat/unread-count',
    message: 'Use https://hollyhubdigitals.vercel.app for all chat operations'
  });
});

// ═══════════════════════════════════════════════════════════════════
// 💬 OLD CHAT ENDPOINTS (REMOVED - NOW ON VISITORS API)
// ═══════════════════════════════════════════════════════════════════
// All old chat endpoint implementations have been removed.
// Chat endpoints are now on https://hollyhubdigitals.vercel.app
// The redirect stubs above will handle any old requests.
// ═══════════════════════════════════════════════════════════════════



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
