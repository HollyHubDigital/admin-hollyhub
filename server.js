// Admin Dashboard - Proxy server to forward API calls to visitors domain
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const VISITORS_API = process.env.VISITORS_API_URL || 'https://hollyhubdigitals.vercel.app';

console.log(`⚙️ Admin Dashboard proxy initialized`);
console.log(`📍 Forwarding API calls to: ${VISITORS_API}`);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve static CSS file explicitly with correct MIME type
app.get('/styles.css', (req, res) => {
  const filePath = path.join(__dirname, 'styles.css');
  res.type('text/css; charset=UTF-8');
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ✅ Serve all static files from admin folder
app.get('/admin/:file', (req, res) => {
  const filePath = path.join(__dirname, 'admin', req.params.file);
  if (filePath.endsWith('.js')) {
    res.type('application/javascript; charset=UTF-8');
  } else if (filePath.endsWith('.html')) {
    res.type('text/html; charset=UTF-8');
  }
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ✅ Serve adminlogin.html at root level (for login flow)
app.get('/adminlogin.html', (req, res) => {
  const filePath = path.join(__dirname, 'adminlogin.html');
  res.type('text/html; charset=UTF-8');
  res.sendFile(filePath, (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// Generic static files
app.use(express.static(path.join(__dirname)));

// ═══════════════════════════════════════════════════════════════════
// 💬 CHAT SYSTEM - GitHub-based message storage with real-time polling
// ═══════════════════════════════════════════════════════════════════

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'HollyHubDigital';
const GITHUB_REPO = process.env.GITHUB_REPO || 'hollyhub-visitors';
const GITHUB_API = 'https://api.github.com';

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

// Helper: Verify token is valid (currently uses a simple validation)
// In production, you'd verify JWT signature or check against a token database
function validateAuthToken(token, userEmail) {
  if (!token || !userEmail) return false;
  
  // Basic validation: token must exist and be non-empty
  // In production, you'd:
  // 1. Verify JWT signature with secret key
  // 2. Check token expiration
  // 3. Verify email matches token claims
  // 4. Check token against a blacklist
  
  if (typeof token !== 'string' || token.length < 10) {
    return false;
  }
  
  console.log(`✓ Token validated for user: ${userEmail}`);
  return true;
}

// Helper: Verify user owns a project (fetch project from visitors API to check ownership)
async function verifyProjectOwnership(projectId, userEmail) {
  try {
    // Make request to visitors API to verify project ownership
    const VISITORS_API = process.env.VISITORS_API_URL || 'https://hollyhubdigitals.vercel.app';
    const res = await fetch(`${VISITORS_API}/api/projects?userEmail=${encodeURIComponent(userEmail)}`);
    
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
    console.error('Error verifying project ownership:', error);
    return false; // Fail secure
  }
}

// Helper: GitHub API call
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
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }
  
  return response.status === 204 ? null : response.json();
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

// ✅ POST /api/chat/send - Send a message (with auth validation)
app.post('/api/chat/send', async (req, res) => {
  try {
    const { projectId, userEmail, senderType, senderEmail, text } = req.body;
    
    // ═══════ INPUT VALIDATION ═══════
    if (!projectId || !userEmail || !senderType || !senderEmail || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['user', 'admin'].includes(senderType)) {
      return res.status(400).json({ error: 'Invalid senderType (must be "user" or "admin")' });
    }
    
    // ═══════ AUTH VALIDATION ═══════
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Chat send: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    // ═══════ PERMISSION VALIDATION ═══════
    // For user senders: validate they own the project and their email matches
    if (senderType === 'user') {
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Chat send: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      if (senderEmail !== userEmail) {
        console.warn(`🚫 Chat send: User sender email ${senderEmail} does not match project owner ${userEmail}`);
        return res.status(403).json({ error: 'User cannot send messages from a different email' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Chat send: User ${userEmail} does not own project ${projectId}`);
        return res.status(403).json({ error: 'You do not have permission to message this project' });
      }
    }
    // For admin senders: admins can message any project (validate token exists for logging)
    else if (senderType === 'admin') {
      if (!validateAuthToken(token, senderEmail)) {
        console.warn(`🚫 Chat send: Invalid admin token for ${senderEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      // Admins can message any project - no ownership check needed
      console.log(`✓ Admin ${senderEmail} verified to message project ${projectId}`);
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    const message = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sender: senderType,
      senderEmail: senderEmail,
      text: text,
      timestamp: new Date().toISOString(),
      read: false,
      readAt: null
    };
    
    chatData.messages.push(message);
    await writeChatFile(chatFileKey, chatData);
    
    console.log(`✉️ Message sent to chat ${chatFileKey} by ${senderEmail}`);
    res.json({ success: true, message });
  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/chat/messages - Get all messages for a chat (with auth validation)
app.get('/api/chat/messages', async (req, res) => {
  try {
    const { projectId, userEmail, viewerType } = req.query;
    
    // ═══════ INPUT VALIDATION ═══════
    if (!projectId || !userEmail) {
      return res.status(400).json({ error: 'Missing projectId or userEmail' });
    }
    
    const viewType = viewerType || 'user'; // Default to user if not specified
    if (!['admin', 'user'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid viewerType' });
    }
    
    // ═══════ AUTH VALIDATION ═══════
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Chat fetch: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    // ═══════ PERMISSION VALIDATION ═══════
    if (viewType === 'admin') {
      // Admin can view any project's messages - just validate token exists
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Chat fetch: Invalid admin token`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      console.log(`✓ Admin viewing messages for project ${projectId} (owner: ${userEmail})`);
    } else {
      // User can only view their own project's messages
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Chat fetch: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Chat fetch: User ${userEmail} attempted to access project ${projectId} they don't own`);
        return res.status(403).json({ error: 'You do not have permission to view this chat' });
      }
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    console.log(`📨 Fetching ${chatData.messages?.length || 0} messages for chat ${chatFileKey}`);
    res.json(chatData.messages || []);
  } catch (error) {
    console.error('Chat fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ PUT /api/chat/mark-read - Mark messages as read and schedule deletion (with auth validation)
app.put('/api/chat/mark-read', async (req, res) => {
  try {
    const { projectId, userEmail, messageIds, viewerType } = req.body;
    
    // ═══════ INPUT VALIDATION ═══════
    if (!projectId || !userEmail || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'Missing required fields or invalid messageIds' });
    }
    
    const viewType = viewerType || 'user'; // Default to user if not specified
    if (!['admin', 'user'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid viewerType' });
    }
    
    // ═══════ AUTH VALIDATION ═══════
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Mark read: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    // ═══════ PERMISSION VALIDATION ═══════
    if (viewType === 'admin') {
      // Admin can mark any project's messages as read
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Mark read: Invalid admin token`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      console.log(`✓ Admin marking messages as read for project ${projectId}`);
    } else {
      // User can only mark their own project's messages as read
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Mark read: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Mark read: User ${userEmail} attempted to modify chat for project ${projectId} they don't own`);
        return res.status(403).json({ error: 'You do not have permission to modify this chat' });
      }
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    const now = new Date();
    const deleteAfterTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
    
    chatData.messages = chatData.messages.map(msg => {
      if (messageIds.includes(msg.id)) {
        return {
          ...msg,
          read: true,
          readAt: now.toISOString(),
          deleteAt: deleteAfterTime.toISOString()
        };
      }
      return msg;
    });
    
    // Remove messages that have expired (older than 3 hours from readAt)
    const beforeCount = chatData.messages.length;
    chatData.messages = chatData.messages.filter(msg => {
      if (msg.deleteAt && new Date(msg.deleteAt) < now) {
        return false; // Remove expired message
      }
      return true;
    });
    const removedCount = beforeCount - chatData.messages.length;
    
    await writeChatFile(chatFileKey, chatData);
    
    console.log(`✓ Marked ${messageIds.length} messages as read; removed ${removedCount} expired messages`);
    res.json({ success: true, unreadCount: chatData.messages.filter(m => !m.read).length });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ✅ GET /api/chat/unread-count - Get unread count for a chat (with auth validation)
app.get('/api/chat/unread-count', async (req, res) => {
  try {
    const { projectId, userEmail, viewerType } = req.query;
    
    // ═══════ INPUT VALIDATION ═══════
    if (!projectId || !userEmail) {
      return res.status(400).json({ error: 'Missing projectId or userEmail' });
    }
    
    const viewType = viewerType || 'user'; // Default to user if not specified
    if (!['admin', 'user'].includes(viewType)) {
      return res.status(400).json({ error: 'Invalid viewerType' });
    }
    
    // ═══════ AUTH VALIDATION ═══════
    const token = extractAuthToken(req);
    if (!token) {
      console.warn('🚫 Unread count: Missing authentication token');
      return res.status(401).json({ error: 'Missing or invalid authentication token' });
    }
    
    // ═══════ PERMISSION VALIDATION ═══════
    if (viewType === 'admin') {
      // Admin can check unread count for any project
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Unread count: Invalid admin token`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      console.log(`✓ Admin checking unread count for project ${projectId}`);
    } else {
      // User can only check unread count for their own projects
      if (!validateAuthToken(token, userEmail)) {
        console.warn(`🚫 Unread count: Invalid token for user ${userEmail}`);
        return res.status(401).json({ error: 'Invalid or expired authentication token' });
      }
      
      const ownsProject = await verifyProjectOwnership(projectId, userEmail);
      if (!ownsProject) {
        console.warn(`🚫 Unread count: User ${userEmail} attempted to access unread count for project ${projectId} they don't own`);
        return res.status(403).json({ error: 'You do not have permission to access this chat' });
      }
    }
    
    const chatFileKey = `${projectId}_${userEmail}`;
    const chatData = await readChatFile(chatFileKey);
    
    // Filter unread messages by viewer type
    // If viewerType='user', filter for admin messages (user hasn't read)
    // If viewerType='admin', filter for user messages (admin hasn't read)
    const unreadMessages = chatData.messages.filter(msg => {
      if (!msg.read) {
        if (viewType === 'user' && msg.sender === 'admin') return true;
        if (viewType === 'admin' && msg.sender === 'user') return true;
      }
      return false;
    });
    
    console.log(`📊 Unread count for ${chatFileKey}: ${unreadMessages.length} messages`);
    res.json({ unreadCount: unreadMessages.length, messages: unreadMessages });
  } catch (error) {
    console.error('Unread count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════

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
        // undici/node fetch requires duplex when sending a stream body
        options.duplex = 'half';
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
    // If upstream is failing due to read-only filesystem (common on serverless), surface a helpful message
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
  // Read fresh from disk each time to ensure updates are served (no caching)
  // Serve from root admin.html (not from admin/admin.html nested folder)
  let html = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
  // NOTE: The admin.html now has dynamic API_BASE_URL configuration that detects
  // localhost vs production. We do NOT override it here to preserve the logic.
  return html;
}

// ✅ Explicitly serve admin.js
app.get('/admin.js', (req, res) => {
  const filePath = path.join(__dirname, 'admin.js');
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

// Fallback to admin.html for any unmatched routes WITHOUT file extensions (SPA behavior)
app.get('*', (req, res) => {
  // Don't intercept requests with file extensions - let express.static handle them
  if (req.path.includes('.')) {
    return res.status(404).send('Not found');
  }
  res.type('text/html; charset=UTF-8');
  res.send(getAdminHtmlWithCorrectUrl());
});

// Error handler must be defined before listen
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel; listen locally
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Admin Dashboard running on port ${PORT}`);
    console.log(`📗 Open: http://localhost:${PORT}/admin`);
  });
}
