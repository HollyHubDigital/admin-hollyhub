// Admin Dashboard - COMPLETE VERSION
if (typeof ADMIN_INITIALIZED !== 'undefined') {
  console.log('[Admin] Script already loaded, skipping re-initialization');
} else {
  window.ADMIN_INITIALIZED = true;
  
const API = {
  baseURL() { return (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL) ? window.API_BASE_URL : ''; },
  buildURL(path) { 
    const base = API.baseURL();
    if (!base) return path; // Use relative path if no base URL is set
    return base + path;
  },
  token() { return localStorage.getItem('adminToken') || ''; },
  visitorsURL() { return (typeof window.VISITORS_BASE_URL === 'string' && window.VISITORS_BASE_URL) ? window.VISITORS_BASE_URL : 'https://hollyhubdigitals.vercel.app'; },
  headers(json=true){ 
    const headers = {};
    const token = API.token();
    console.log('[API.headers] Building headers... token present:', !!token);
    if(token) {
      headers['Authorization'] = 'Bearer ' + token;
      console.log('[API.headers] Authorization header set, length:', headers['Authorization'].length);
    } else {
      console.warn('[API.headers] No token available');
    }
    if(json) headers['Content-Type'] = 'application/json';
    return headers;
  }
};

// Small toast helper
function showToast(message, actionLabel, actionFn, timeout=5000){
  let el = document.getElementById('adminToast');
  if(!el){
    el = document.createElement('div');
    el.id = 'adminToast';
    el.style.position = 'fixed';
    el.style.right = '20px';
    el.style.bottom = '20px';
    el.style.zIndex = 9999;
    document.body.appendChild(el);
  }
  const item = document.createElement('div');
  item.style.background = 'linear-gradient(90deg,#222,#111)';
  item.style.color = '#fff';
  item.style.padding = '12px 14px';
  item.style.borderRadius = '8px';
  item.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
  item.style.marginTop = '8px';
  item.style.minWidth = '220px';
  item.style.fontSize = '14px';
  item.textContent = message;
  if(actionLabel && actionFn){
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.style.marginLeft = '10px';
    btn.style.padding = '6px 8px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', ()=>{ actionFn(); document.getElementById('adminToast') && item.remove(); });
    item.appendChild(btn);
  }
  el.appendChild(item);
  setTimeout(()=>{ try{ item.remove(); }catch(e){} }, timeout);
}

function requireAuth() {
  const token = API.token();
  console.log('[requireAuth] Checking authentication...');
  console.log('[requireAuth] Token present:', !!token);
  if(token) {
    console.log('[requireAuth] Token length:', token.length);
    console.log('[requireAuth] Token preview:', token.substring(0, 30) + '...');
  } else {
    console.warn('[requireAuth] No token found, redirecting to login');
  }
  if(!token) { 
    // Prevent infinite redirect loops - only redirect once
    if (!sessionStorage.getItem('redirectedToLogin')) {
      sessionStorage.setItem('redirectedToLogin', 'true');
      window.location.href = 'adminlogin.html'; 
    }
  }
}

// ===== TAB SWITCHING =====
function initTabs(){
  document.querySelectorAll('.admin-tab-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const tab = btn.dataset.tab;
      document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab).classList.add('active');
    });
  });
}

// ===== EDIT PAGES SECTION =====
async function loadPageSections(){
  const page = document.getElementById('pageSelector').value;
  if(!page) return alert('Please select a page');

  const container = document.getElementById('pageEditContainer');
  container.innerHTML = '<p style="opacity:0.8">Loading...</p>';

  try {
    const r = await fetch(API.buildURL(`/api/pages/sections/${page}`), { headers: API.headers() });
    if(!r.ok) throw new Error('Failed to load sections');
    const sections = await r.json();

    let html = `<div class="section-card"><h3 class="section-title">${page.charAt(0).toUpperCase() + page.slice(1)} Editable Sections</h3>`;
    
    if(page === 'index'){
      html += `
        <div class="form-group">
          <label class="form-label">Hero Image (.inter)</label>
          <input id="interImage" class="form-input" value="${sections.interImage || ''}" placeholder="Image URL" />
          <small style="opacity:0.7">Current: ${sections.interImage || 'None'}</small>
        </div>
        <div class="form-group">
          <label class="form-label">Recent Projects Cards</label>
          <textarea id="recentProjects" class="form-input" placeholder="JSON array of project cards">${JSON.stringify(sections.recentProjects || [], null, 2)}</textarea>
        </div>
      `;
      // inject preview iframe area
      setTimeout(()=>{
        const preview = document.getElementById('pagePreviewArea');
        if(preview){
          const visitorsUrl = API.visitorsURL();
          preview.innerHTML = `<iframe id="pagePreviewFrame" src="${visitorsUrl}/" style="width:100%;height:420px;border:1px solid rgba(255,255,255,0.06);border-radius:8px"></iframe>`;
        }
      }, 50);
    } else if(page === 'portfolio'){
      html += `<div class="form-group"><label class="form-label">Portfolio Items (managed in Portfolio tab)</label><p style="opacity:0.8">Use the Portfolio tab to add/edit/delete items</p></div>`;
    } else if(page === 'blog'){
      html += `<div class="form-group"><label class="form-label">Blog Posts (managed in Blog tab)</label><p style="opacity:0.8">Use the Blog tab to create/edit/delete posts</p></div>`;
    }

    html += `<button id="savePageSectionsBtn" class="btn-primary">Save Changes</button></div>`;
    container.innerHTML = html;

    document.getElementById('savePageSectionsBtn').addEventListener('click', async ()=>{
      const payload = { page, sections: {} };
      if(page === 'index'){
        payload.sections.interImage = document.getElementById('interImage').value;
        try {
          payload.sections.recentProjects = JSON.parse(document.getElementById('recentProjects').value || '[]');
        } catch(e) {
          return alert('Invalid JSON in Recent Projects field');
        }
      }
      await savePageSections(payload);
    });
  } catch(e) {
    container.innerHTML = `<p style="color:#FF5555">Error: ${e.message}</p>`;
  }
}

async function savePageSections(payload){
  try {
    const r = await fetch(API.buildURL('/api/pages/sections/save'), { method:'PUT', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    showToast('Page sections saved', 'View', ()=>window.open('/', '_blank'));
    document.getElementById('pageEditContainer').innerHTML = '<p style="color:var(--primary-accent)">✓ Changes saved!</p>';
    // refresh preview iframe if present
    try{ const f = document.getElementById('pagePreviewFrame'); if(f && f.contentWindow) f.contentWindow.location.reload(); }catch(e){}
  } catch(e) {
    showToast('Save failed: '+e.message, null, null, 6000);
  }
}

// ===== PORTFOLIO MANAGEMENT =====
async function publishPortfolio(){
  const title = document.getElementById('pfTitle').value;
  const category = document.getElementById('pfCategory').value;
  const description = document.getElementById('pfDescription').value;
  const imageInput = document.getElementById('pfImage');
  const image = imageInput.value;
  const url = document.getElementById('pfUrl').value;
  const fileInput = document.getElementById('pfImageFile');
  const addToRecent = document.getElementById('pfAddToRecent') && document.getElementById('pfAddToRecent').checked;

  if(!title || !description || (!image && !(fileInput && fileInput.files && fileInput.files[0]))) return alert('Please fill all required fields');

  const editingId = document.getElementById('pfEditingId').value;
  const payload = { title, category, description, image, url };

  try {
    let uploadedMeta = null;
    // If a file is selected, upload it first
    if(fileInput && fileInput.files && fileInput.files[0]){
      const file = fileInput.files[0];
      uploadedMeta = await uploadFile(file, ['portfolio', addToRecent? 'recent-projects': '']);
    }
    let endpoint = '/api/portfolio';
    let method = 'POST';
    if(editingId){
      endpoint += '?id='+encodeURIComponent(editingId);
      method = 'PUT';
    }
    // prefer uploaded filename if available
    if(uploadedMeta && uploadedMeta.filename){ payload.image = uploadedMeta.filename; }
    
    const token = API.token();
    const headers = API.headers();
    const fullUrl = API.buildURL(endpoint);
    console.log('[publishPortfolio] ===== PORTFOLIO PUBLISH START =====');
    console.log('[publishPortfolio] Endpoint:', endpoint);
    console.log('[publishPortfolio] Full URL:', fullUrl);
    console.log('[publishPortfolio] Method:', method);
    console.log('[publishPortfolio] Token present:', !!token);
    console.log('[publishPortfolio] Token length:', token ? token.length : 0);
    console.log('[publishPortfolio] Token starts with:', token ? token.substring(0, 30) + '...' : 'EMPTY');
    console.log('[publishPortfolio] Headers object:', headers);
    console.log('[publishPortfolio] Authorization header value:', headers.Authorization);
    
    const r = await fetch(fullUrl, { method, headers, body: JSON.stringify(payload) });
    if(!r.ok) {
      const errText = await r.text();
      console.error('[publishPortfolio] Request failed - Status:', r.status, '| Response:', errText);
      throw new Error(`Server error (${r.status}): ${errText}`);
    }
    const createdItem = await r.json();
    showToast(editingId ? 'Portfolio item updated' : 'Portfolio item published', 'Open', ()=>window.open('/portfolio.html','_blank'));
    // Optionally add to recentProjects on home page
    if(addToRecent){
      try{
        // fetch current sections
        const sres = await fetch(API.buildURL('/api/pages/sections/index'), { headers: API.headers() });
        const sections = sres.ok ? await sres.json() : {};
        sections.recentProjects = sections.recentProjects || [];
        // create project entry
        const proj = { id: (editingId || createdItem.id) || Date.now().toString(), title: payload.title, description: payload.description, image: payload.image || '', url: payload.url || '' };
        // if editing, replace matching id
        const idx = sections.recentProjects.findIndex(p=>p.id===proj.id);
        if(idx!==-1) sections.recentProjects[idx] = proj; else sections.recentProjects.unshift(proj);
        await savePageSections({ page: 'index', sections });
      }catch(e){ console.error('Add to recent failed', e); }
    }
    document.getElementById('pfTitle').value = '';
    document.getElementById('pfCategory').value = '';
    document.getElementById('pfDescription').value = '';
    document.getElementById('pfImage').value = '';
    document.getElementById('pfUrl').value = '';
    document.getElementById('pfEditingId').value = '';
    await refreshPortfolioList();
  } catch(e) {
    alert('Publish failed: '+e.message);
  }
}

async function uploadFile(file, targets){
  const token = API.token();
  console.log('[uploadFile] Token status:', token ? 'Present' : 'Missing');
  console.log('[uploadFile] Token length:', token ? token.length : 0);
  console.log('[uploadFile] Token preview:', token ? token.substring(0, 20) + '...' : 'NONE');
  console.log('[uploadFile] API Base URL:', API.baseURL());
  
  if(!token) {
    throw new Error('Authentication required. Please log in again.');
  }
  
  const fd = new FormData();
  fd.append('file', file);
  if(targets && targets.length) fd.append('targets', targets.filter(Boolean).join(','));
  
  const headers = { 'Authorization': 'Bearer ' + token };
  const uploadUrl = API.buildURL('/api/upload');
  console.log('[uploadFile] Uploading to:', uploadUrl);
  console.log('[uploadFile] Authorization header:', headers.Authorization);
  console.log('[uploadFile] Full header object:', headers);
  
  const r = await fetch(uploadUrl, { method: 'POST', headers, body: fd });
  
  if(!r.ok) {
    const errText = await r.text();
    console.error('[uploadFile] Upload failed - Status:', r.status, 'Text:', errText);
    throw new Error(`Upload failed (${r.status}): ${errText}`);
  }
  
  return await r.json();
}

async function refreshPortfolioList(){
  try {
    const url = API.buildURL('/api/portfolio');
    console.log('[portfolio] Loading from:', url);
    const r = await fetch(url, { headers: API.headers() });
    
    if(!r.ok) {
      console.error('[portfolio] Fetch failed:', r.status, r.statusText);
      throw new Error(`Failed to load portfolio (${r.status})`);
    }
    
    const items = await r.json();
    console.log('[portfolio] Loaded items:', items ? items.length : 0);
    
    const container = document.getElementById('portfolioList');
    if (!container) return;
    
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.innerHTML = '<p style="opacity:0.6">No portfolio items yet. Create one above.</p>';
      return;
    }
    
    items.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'portfolio-item';
      div.innerHTML = `
        <div>
          <div style="font-weight:700">${item.title}</div>
          <div style="opacity:0.8;font-size:0.9rem">${item.category} • ${new Date(item.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" data-action="edit-portfolio" data-id="${item.id}">Edit</button>
          <button class="btn-danger" data-action="delete-portfolio" data-id="${item.id}">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
    
    // Attach event listeners for edit/delete buttons
    container.querySelectorAll('[data-action="edit-portfolio"]').forEach(btn => {
      btn.addEventListener('click', (e) => editPortfolioItem(e.target.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-portfolio"]').forEach(btn => {
      btn.addEventListener('click', (e) => deletePortfolioItem(e.target.dataset.id));
    });
  } catch(e) {
    console.error('[portfolio] Error:', e);
    const container = document.getElementById('portfolioList');
    if (container) {
      container.innerHTML = `<p style="color:#ff6b6b">Error: ${e.message}</p>`;
    }
  }
}

async function editPortfolioItem(id){
  try {
    const r = await fetch(API.buildURL('/api/portfolio?id='+encodeURIComponent(id)), { headers: API.headers() });
    if(!r.ok) throw new Error('Not found');
    const item = await r.json();
    document.getElementById('pfTitle').value = item.title;
    document.getElementById('pfCategory').value = item.category || '';
    document.getElementById('pfDescription').value = item.description;
    document.getElementById('pfImage').value = item.image;
    document.getElementById('pfUrl').value = item.url || '';
    document.getElementById('pfEditingId').value = item.id;
    document.querySelector('[data-tab="portfolio"]').click();
  } catch(e) {
    alert('Error loading item: '+e.message);
  }
}

async function deletePortfolioItem(id){
  if(!confirm('Delete this portfolio item?')) return;
  try {
    const r = await fetch(API.buildURL('/api/portfolio?id='+encodeURIComponent(id)), { method:'DELETE', headers: API.headers() });
    if(!r.ok) throw new Error(await r.text());
    alert('Item deleted');
    await refreshPortfolioList();
  } catch(e) {
    alert('Delete failed: '+e.message);
  }
}

// ===== BLOG MANAGEMENT =====
async function publishBlog(){
  const title = document.getElementById('blogTitle').value;
  const category = document.getElementById('blogCategory').value;
  const image = document.getElementById('blogImage').value;
  const imageFileInput = document.getElementById('blogImageFile');
  const content = document.getElementById('blogContent').value;
  const editingId = document.getElementById('blogEditingId').value;

  if(!title || !content) return alert('Please fill title and content');

  const payload = { title, category, image, content };
  try {
    let uploadedMeta = null;
    if(imageFileInput && imageFileInput.files && imageFileInput.files[0]){
      uploadedMeta = await uploadFile(imageFileInput.files[0], ['blog']);
    }
    if(uploadedMeta && uploadedMeta.filename){ payload.image = uploadedMeta.filename; }

    let endpoint = '/api/blog';
    let method = 'POST';
    if(editingId){ endpoint += '?id='+encodeURIComponent(editingId); method = 'PUT'; }
    
    const token = API.token();
    const headers = API.headers();
    const fullUrl = API.buildURL(endpoint);
    console.log('[publishBlog] ===== BLOG PUBLISH START =====');
    console.log('[publishBlog] Endpoint:', endpoint);
    console.log('[publishBlog] Full URL:', fullUrl);
    console.log('[publishBlog] Method:', method);
    console.log('[publishBlog] Token present:', !!token);
    console.log('[publishBlog] Token length:', token ? token.length : 0);
    console.log('[publishBlog] Token starts with:', token ? token.substring(0, 30) + '...' : 'EMPTY');
    console.log('[publishBlog] Headers object:', headers);
    console.log('[publishBlog] Authorization header value:', headers.Authorization);
    
    const r = await fetch(fullUrl, { method, headers, body: JSON.stringify(payload) });
    if(!r.ok) {
      const errText = await r.text();
      console.error('[publishBlog] Request failed - Status:', r.status, '| Response:', errText);
      throw new Error(`Server error (${r.status}): ${errText}`);
    }
    const post = await r.json();
    showToast(editingId? 'Blog post updated' : 'Blog post published', 'Open', ()=>window.open('/blog.html','_blank'));
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogCategory').value = '';
    document.getElementById('blogImage').value = '';
    document.getElementById('blogContent').value = '';
    document.getElementById('blogEditingId').value = '';
    await refreshBlogPosts();
  } catch(e) {
    showToast('Publish failed: '+e.message, null, null, 6000);
  }
}

async function editBlogPost(id){
  try{
    const r = await fetch(API.buildURL('/api/blog'), { headers: API.headers() });
    if(!r.ok) throw new Error('Failed to load posts');
    const posts = await r.json();
    const post = posts.find(p=>p.id===id);
    if(!post) throw new Error('Post not found');
    document.getElementById('blogTitle').value = post.title;
    document.getElementById('blogCategory').value = post.category || '';
    document.getElementById('blogImage').value = post.image || '';
    document.getElementById('blogContent').value = post.content || '';
    document.getElementById('blogEditingId').value = post.id;
    document.querySelector('[data-tab="blog"]').click();
  }catch(e){ showToast('Load failed: '+e.message, null, null, 6000); }
}

async function refreshBlogPosts(){
  try {
    const url = API.buildURL('/api/blog');
    console.log('[blog] Loading from:', url);
    const r = await fetch(url, { headers: API.headers() });
    
    if(!r.ok) {
      console.error('[blog] Fetch failed:', r.status, r.statusText);
      throw new Error(`Failed to load blog posts (${r.status})`);
    }
    
    const posts = await r.json();
    console.log('[blog] Loaded posts:', posts ? posts.length : 0);
    
    const container = document.getElementById('publishedPosts');
    if (!container) return;
    
    container.innerHTML = '';
    if (!posts || posts.length === 0) {
      container.innerHTML = '<p style="opacity:0.6">No blog posts yet. Create one above.</p>';
      return;
    }
    
    posts.forEach(post=>{
      const div = document.createElement('div');
      div.className = 'blog-item';
      div.innerHTML = `
        <div>
          <div style="font-weight:700">${post.title}</div>
          <div style="opacity:0.8">${post.category} • ${new Date(post.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" data-action="edit-blog" data-id="${post.id}">Edit</button>
          <button class="btn-danger" data-action="delete-blog" data-id="${post.id}">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
    
    // Attach event listeners for edit/delete buttons
    container.querySelectorAll('[data-action="edit-blog"]').forEach(btn => {
      btn.addEventListener('click', (e) => editBlogPost(e.target.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-blog"]').forEach(btn => {
      btn.addEventListener('click', (e) => deleteBlogPost(e.target.dataset.id));
    });
  } catch(e) {
    console.error('[blog] Error:', e);
    const container = document.getElementById('publishedPosts');
    if (container) {
      container.innerHTML = `<p style="color:#ff6b6b">Error: ${e.message}</p>`;
    }
  }
}

// ===== COMMENTS MODERATION =====
async function refreshCommentsModeration(){
  try{
    const r = await fetch(API.buildURL('/api/blog/comments'), { headers: API.headers() });
    if(!r.ok) throw new Error(`Failed to load comments (${r.status})`);
    const comments = await r.json();
    const container = document.getElementById('commentsModeration');
    if (!container) return;
    container.innerHTML = '';
    if(!comments || comments.length===0){ container.innerHTML = '<p style="opacity:0.8">No comments yet</p>'; return; }
    comments.slice().reverse().forEach(c=>{
      const div = document.createElement('div');
      div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
      div.style.padding = '0.5rem 0'; div.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      div.innerHTML = `<div style="max-width:78%"><div style="font-weight:700">${c.author||'Anonymous'}</div><div style="opacity:0.8;font-size:0.95rem">${(c.content||'').slice(0,200)}${(c.content && c.content.length>200? '...':'')}</div><div style="opacity:0.7;font-size:0.85rem">on post ${c.postId} • ${new Date(c.createdAt).toLocaleString()}</div></div>`;
      const btns = document.createElement('div');
      const del = document.createElement('button'); del.className='btn-danger'; del.textContent='Delete';
      del.addEventListener('click', async ()=>{
        if(!confirm('Delete this comment?')) return;
        try{ const dr = await fetch(API.buildURL('/api/blog/comment?id='+encodeURIComponent(c.id)), { method:'DELETE', headers: API.headers() }); if(!dr.ok) throw new Error(await dr.text()); showToast('Comment deleted'); await refreshCommentsModeration(); }catch(e){ alert('Delete failed: '+e.message); }
      });
      btns.appendChild(del);
      div.appendChild(btns);
      container.appendChild(div);
    });
  }catch(e){ 
    console.error('refreshCommentsModeration error:', e);
    const container = document.getElementById('commentsModeration');
    if (container) {
      container.innerHTML = `<p style="color:#ff6b6b">Error: ${e.message}</p>`;
    }
  }
}

async function deleteBlogPost(id){
  if(!confirm('Delete this blog post?')) return;
  try {
    const r = await fetch(API.buildURL('/api/blog?id='+encodeURIComponent(id)), { method:'DELETE', headers: API.headers() });
    if(!r.ok) throw new Error(await r.text());
    alert('Post deleted');
    await refreshBlogPosts();
  } catch(e) {
    alert('Delete failed: '+e.message);
  }
}

// ===== SETTINGS =====
async function updateAdminCredentials(){
  const currentPass = document.getElementById('currentPassword').value;
  const newUsername = document.getElementById('newUsername').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;

  if(!currentPass) return alert('Enter current password');
  if(newPassword && newPassword !== confirmPass) return alert('Passwords do not match');
  if(!newUsername && !newPassword) return alert('Enter at least username or password');

  const payload = { currentPassword: currentPass, newUsername, newPassword };
  try {
    const r = await fetch(API.buildURL('/api/admin/update-credentials'), { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Admin credentials updated. Please log in again.');
    localStorage.removeItem('adminToken');
    window.location.href = 'adminlogin.html';
  } catch(e) {
    alert('Update failed: '+e.message);
  }
}

async function saveSiteSettings(){
  const gaId = document.getElementById('gaId').value;
  const customScripts = document.getElementById('customScripts').value;
  const whatsappNumber = document.getElementById('whatsappNumber') ? document.getElementById('whatsappNumber').value : '';

  let scripts = [];
  if(customScripts){
    try {
      scripts = JSON.parse(customScripts);
    } catch(e) {
      return alert('Invalid JSON in Custom Scripts');
    }
  }

  const payload = { gaId, customScripts: scripts, whatsappNumber };
  try {
    const r = await fetch(API.buildURL('/api/settings'), { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Settings saved');
  } catch(e) {
    alert('Save failed: '+e.message);
  }
}

async function loadSiteSettings(){
  try{
    const r = await fetch(API.buildURL('/api/settings'), { headers: API.headers() });
    if(!r.ok) {
      if(r.status === 401) {
        console.warn('Settings require authentication - user may not be logged in yet');
      } else {
        throw new Error('Failed to load settings');
      }
      return;
    }
    const s = await r.json();
    if(document.getElementById('gaId')) document.getElementById('gaId').value = s.gaId || '';
    if(document.getElementById('customScripts')) document.getElementById('customScripts').value = JSON.stringify(s.customScripts || [], null, 2);
    if(document.getElementById('whatsappNumber')) document.getElementById('whatsappNumber').value = s.whatsappNumber || '';
  }catch(e){ console.warn('loadSiteSettings failed', e); }
}

// ===== APPS MANAGEMENT =====
let allAppsRegistry = {};
let currentAppsConfig = { enabled: {}, disabled: [] };
let currentFilterCategory = 'all';

async function loadAppsRegistry() {
  try {
    const r = await fetch(API.buildURL('/api/apps?registry=true'));
    if (!r.ok) throw new Error('Failed to load apps');
    const data = await r.json();
    allAppsRegistry = data.apps || {};
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
  } catch(e) {
    console.error('Load apps error:', e);
    showToast('Failed to load apps: ' + e.message, null, null, 6000);
  }
}

async function loadAppsConfiguration() {
  try {
    const r = await fetch(API.buildURL('/api/apps?config=true'), { headers: API.headers() });
    if (!r.ok) {
      // if auth failed or token invalid, try unauthenticated public config as a fallback
      const publicRes = await fetch(API.buildURL('/api/apps?config=true'));
      if (!publicRes.ok) throw new Error('Failed to load config');
      currentAppsConfig = await publicRes.json();
      return;
    }
    currentAppsConfig = await r.json();
  } catch(e) {
    console.error('Load config error:', e);
    // attempt public fallback so admin UI still shows active apps even when token is invalid
    try{
      const r2 = await fetch(API.buildURL('/api/apps?config=true'));
      if (r2.ok) currentAppsConfig = await r2.json();
    }catch(e2){ console.error('Public config fallback failed', e2); }
  }
}

function renderAppsList() {
  const container = document.getElementById('appsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Filter apps
  let apps = Object.values(allAppsRegistry);
  if (currentFilterCategory !== 'all') {
    apps = apps.filter(app => app.category === currentFilterCategory);
  }
  
  apps.forEach(app => {
    const enabled = !!currentAppsConfig.enabled[app.id];
    const configured = enabled && Object.keys(currentAppsConfig.enabled[app.id]).length > 0;
    
    const card = document.createElement('div');
    card.className = 'app-card' + (enabled ? ' enabled' : '');
    card.innerHTML = `
      <div class="app-icon">${app.icon || '🔌'}</div>
      <div class="app-name">${app.name}</div>
      <div class="app-category">${app.category}</div>
      <div class="app-description">${app.description}</div>
      <div class="app-status ${enabled ? 'enabled' : 'disabled'}">
        ${enabled ? '✓ Active' : 'Inactive'}
        ${configured ? ' • Configured' : (enabled ? ' • Needs Config' : '')}
      </div>
      <div class="app-actions">
        <button class="btn-secondary" onclick="openAppConfigModal('${app.id}')" style="flex:1;">
          ${enabled ? 'Edit' : 'Install'}
        </button>
        ${enabled ? `<button class="btn-danger" onclick="disableApp('${app.id}')" style="flex:0;">Disable</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function updateActiveAppsList() {
  const container = document.getElementById('activeAppsList');
  if (!container) return;
  
  const activeApps = Object.keys(currentAppsConfig.enabled);
  if (activeApps.length === 0) {
    container.innerHTML = '<p style="opacity:0.8; margin:0;">No apps installed yet. Choose an app above to get started.</p>';
    return;
  }
  
  let html = '<div style="display:flex; gap:0.5rem; flex-wrap:wrap;">';
  activeApps.forEach(appId => {
    const app = allAppsRegistry[appId];
    if (app) {
      html += `<span style="background:rgba(0,255,0,0.2); color:#0f0; padding:0.5rem 0.75rem; border-radius:6px; font-size:0.9rem; display:flex; align-items:center; gap:0.5rem;">
        ${app.icon || '🔌'} ${app.name}
      </span>`;
    }
  });
  html += '</div>';
  container.innerHTML = html;
}

function openAppConfigModal(appId) {
  const app = allAppsRegistry[appId];
  if (!app) return;
  
  const isEnabled = !!currentAppsConfig.enabled[appId];
  const currentConfig = currentAppsConfig.enabled[appId] || {};
  
  const modal = document.getElementById('appConfigModal');
  const title = document.getElementById('appModalTitle');
  const body = document.getElementById('appModalBody');
  
  title.textContent = `Configure ${app.name}`;
  
  let html = `<p style="opacity:0.8; margin-bottom:1.5rem;">${app.description}</p>`;
  if (app.helpUrl) {
    html += `<div style="margin-bottom:0.75rem;"><a href="${app.helpUrl}" target="_blank" rel="noopener" class="btn-secondary">Open ${app.name} Dashboard</a></div>`;
  }
  html += `<form id="appConfigForm">`;
  
  // Generate form fields
  app.configFields.forEach(field => {
    const value = currentConfig[field.name] || (field.default || '');
    const required = field.required ? 'required' : '';
    
    html += `
      <div class="form-group">
        <label class="form-label">${field.label}${field.required ? ' *' : ''}</label>
    `;
    
    if (field.type === 'select') {
      html += `<select name="${field.name}" class="form-select" ${required}>
        <option value="">-- Select --</option>
    `;
      (field.options || []).forEach(option => {
        const selected = value === option ? 'selected' : '';
        html += `<option value="${option}" ${selected}>${option}</option>`;
      });
      html += `</select>`;
    } else {
      html += `<input type="${field.type}" name="${field.name}" class="form-input" placeholder="${field.placeholder || ''}" value="${value}" ${required} />`;
    }
    
    if (field.adminOnly) {
      html += `<small style="opacity:0.7; display:block; margin-top:0.25rem;">⚠️ Admin-only field (not shared with visitors)</small>`;
    }
    html += `</div>`;
  });
  
  html += `<div style="display:flex; gap:0.5rem; margin-top:2rem;">
    <button type="button" class="btn-primary" onclick="saveAppConfig('${appId}')">Install & Save</button>
    <button type="button" class="btn-secondary" onclick="closeAppModal()">Cancel</button>
  </div>`;
  html += `</form>`;
  
  body.innerHTML = html;
  modal.classList.add('active');
}

function closeAppModal() {
  const modal = document.getElementById('appConfigModal');
  modal.classList.remove('active');
}

async function saveAppConfig(appId) {
  const form = document.getElementById('appConfigForm');
  if (!form) return;
  
  // Collect form data
  const config = {};
  new FormData(form).forEach((value, key) => {
    config[key] = value;
  });
  
  try {
    const r = await fetch(API.buildURL('/api/apps'), {
      method: 'PUT',
      headers: API.headers(),
      body: JSON.stringify({
        appId,
        action: 'enable',
        config
      })
    });
    
    if (!r.ok) throw new Error(await r.text());
    
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
    closeAppModal();
    showToast(`App installed successfully! Refresh your pages to see changes.`, null, null, 5000);
  } catch(e) {
    alert('Failed to save configuration: ' + e.message);
  }
}

async function disableApp(appId) {
  if (!confirm('Disable this app?')) return;
  
  try {
    const r = await fetch(API.buildURL('/api/apps'), {
      method: 'PUT',
      headers: API.headers(),
      body: JSON.stringify({
        appId,
        action: 'disable'
      })
    });
    
    if (!r.ok) throw new Error(await r.text());
    
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
    showToast('App disabled. Refresh your pages to see changes.', null, null, 5000);
  } catch(e) {
    alert('Failed to disable app: ' + e.message);
  }
}

function attachAppFilterEvents() {
  document.querySelectorAll('.app-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.app-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilterCategory = tab.dataset.category;
      renderAppsList();
    });
  });
}

// ===== ANALYTICS =====
async function loadAnalytics(){
  try {
    const r = await fetch(API.buildURL('/api/analytics'), { headers: API.headers() });
    if(!r.ok) throw new Error('Failed');
    const data = await r.json();

    document.getElementById('totalVisitors').textContent = data.totalVisitors || 0;
    document.getElementById('todayVisitors').textContent = data.todayVisitors || 0;
    document.getElementById('uniqueVisitors').textContent = data.uniqueVisitors || 0;

    let countryHTML = '';
    const countries = data.countryStats || [];
    if(countries.length) {
      countryHTML = countries.map(c=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${c.country}</span>: ${c.count} visitors</div>`).join('');
    } else {
      countryHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('countryStats').innerHTML = countryHTML;

    let browserHTML = '';
    const browsers = data.browserStats || [];
    if(browsers.length) {
      browserHTML = browsers.map(b=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${b.browser}</span>: ${b.count} visitors</div>`).join('');
    } else {
      browserHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('browserStats').innerHTML = browserHTML;

    let pageHTML = '';
    const pages = data.pageViewStats || [];
    if(pages.length) {
      pageHTML = pages.map(p=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${p.page}</span>: ${p.views} views</div>`).join('');
    } else {
      pageHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('pageViewStats').innerHTML = pageHTML;
  } catch(e) {
    console.error('Analytics error:', e);
  }
}

// ===== INIT =====
// ===== DOWNLOAD FILES MANAGEMENT =====
async function loadDownloadFilesUI() {
  try {
    // Load download files (published with tokens)
    const dfRes = await fetch(window.API_BASE_URL + '/api/download-files');
    const downloadFiles = dfRes.ok ? await dfRes.json() : [];

    // Get full file metadata from admin endpoint
    let fullDownloadFiles = [];
    try {
      const adminRes = await fetch(window.API_BASE_URL + '/api/admin/download-files', { headers: API.headers() });
      if(adminRes.ok) {
        const data = await adminRes.json();
        fullDownloadFiles = data || [];
      }
    } catch(e) { /* Use empty list if admin endpoint not available */ }

    // Load success files
    let successFiles = [];
    try {
      const sfRes = await fetch(window.API_BASE_URL + '/api/success-files', { headers: API.headers() });
      if(sfRes.ok) {
        successFiles = await sfRes.json();
      }
    } catch(e) { /* Use empty list */ }

    // Render published download files
    const publishedContainer = document.getElementById('publishedDownloadFiles');
    if(publishedContainer) {
      if(fullDownloadFiles.length === 0) {
        publishedContainer.innerHTML = '<p style="opacity:0.8">No published download files yet</p>';
      } else {
        publishedContainer.innerHTML = fullDownloadFiles.map(f => `
          <div style="padding:0.75rem; border:1px solid rgba(255,255,255,0.1); border-radius:6px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600">${f.originalname || f.filename}</div>
              <div style="opacity:0.7; font-size:0.9rem">Token: <code style="background:rgba(255,255,255,0.05); padding:2px 4px; border-radius:3px;">${f.token}</code> • ${(f.size / 1024).toFixed(1)} KB</div>
              <div style="opacity:0.7; font-size:0.85rem">${new Date(f.uploadedAt).toLocaleString()}</div>
            </div>
            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
              <button class="btn-primary" onclick="viewAdminFile('${f.filename}')" style="min-width:70px; background-color:#4A90E2;">View</button>
              <button class="btn-primary" onclick="downloadAdminFile('${f.filename}')" style="min-width:70px; background-color:#2ECC71;">Download</button>
              <button class="btn-danger" onclick="deleteDownloadFile('${f.id}')" style="min-width:70px;">Delete</button>
            </div>
          </div>
        `).join('');
      }
    }

    // Render success page uploads
    const successContainer = document.getElementById('successPageUploads');
    if(successContainer) {
      if(successFiles.length === 0) {
        successContainer.innerHTML = '<p style="opacity:0.8">No success page uploads yet</p>';
      } else {
        successContainer.innerHTML = successFiles.map(f => `
          <div style="padding:0.75rem; border:1px solid rgba(255,255,255,0.1); border-radius:6px; margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-weight:600">${f.originalname || f.filename}</div>
              <div style="opacity:0.7; font-size:0.9rem">👤 ${f.fullName || 'N/A'} • ${(f.size / 1024).toFixed(1)} KB</div>
              <div style="opacity:0.7; font-size:0.85rem">${new Date(f.uploadedAt).toLocaleString()}</div>
            </div>
            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
              <button class="btn-primary" onclick="viewSuccessFile('${f.filename}')" style="min-width:70px; background-color:#4A90E2;">View</button>
              <button class="btn-primary" onclick="downloadSuccessFile('${f.filename}')" style="min-width:70px; background-color:#2ECC71;">Download</button>
              <button class="btn-danger" onclick="deleteSuccessFile('${f.id}')" style="min-width:70px;">Delete</button>
            </div>
          </div>
        `).join('');
      }
    }
  } catch(e) {
    console.error('loadDownloadFilesUI error:', e);
    const container = document.getElementById('publishedDownloadFiles');
    if(container) container.innerHTML = '<p style="color:#FF5555">Error loading files. Check console.</p>';
  }
}

async function publishDownloadFile() {
  const fileInput = document.getElementById('dfFileInput');
  const tokenInput = document.getElementById('dfTokenInput');
  const statusMsg = document.getElementById('dfStatusMsg');

  if(!fileInput.files || !fileInput.files[0]) {
    statusMsg.textContent = '⚠️ Please select a file';
    statusMsg.className = 'token-status-msg error';
    statusMsg.style.display = 'block';
    return;
  }

  const token = (tokenInput.value || '').trim();
  if(!token || token.length < 6 || token.length > 8 || !/^\d+$/.test(token)) {
    statusMsg.textContent = '⚠️ Token must be 6-8 digits';
    statusMsg.className = 'token-status-msg error';
    statusMsg.style.display = 'block';
    return;
  }

  try {
    statusMsg.textContent = '⏳ Uploading file...';
    statusMsg.style.color = '#5555ff';
    statusMsg.className = '';
    statusMsg.style.display = 'block';

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('token', token);

    const r = await fetch(window.API_BASE_URL + '/api/upload-download-file', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + API.token() },
      body: formData
    });

    if(!r.ok) {
      const error = await r.json();
      throw new Error(error.error || 'Upload failed');
    }

    const result = await r.json();
    statusMsg.textContent = '✅ File published successfully!';
    statusMsg.className = 'token-status-msg success';
    statusMsg.style.display = 'block';

    fileInput.value = '';
    tokenInput.value = '';

    setTimeout(() => loadDownloadFilesUI(), 500);
  } catch(e) {
    statusMsg.textContent = '❌ ' + e.message;
    statusMsg.className = 'token-status-msg error';
    statusMsg.style.display = 'block';
  }
}

async function deleteDownloadFile(fileId) {
  if(!confirm('Delete this download file?')) return;

  try {
    const r = await fetch(window.API_BASE_URL + '/api/download-file?id=' + encodeURIComponent(fileId), {
      method: 'DELETE',
      headers: API.headers()
    });

    if(!r.ok) throw new Error(await r.text());

    showToast('Download file deleted');
    await loadDownloadFilesUI();
  } catch(e) {
    alert('Delete failed: ' + e.message);
  }
}

async function deleteSuccessFile(fileId) {
  if(!confirm('Delete this success file?')) return;

  try {
    const r = await fetch(window.API_BASE_URL + '/api/success-file?id=' + encodeURIComponent(fileId), {
      method: 'DELETE',
      headers: API.headers()
    });

    if(!r.ok) throw new Error(await r.text());

    showToast('Success file deleted');
    await loadDownloadFilesUI();
  } catch(e) {
    alert('Delete failed: ' + e.message);
  }
}

function viewAdminFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  window.open(url, '_blank');
}

function downloadAdminFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  
  // Fetch file as blob and trigger download
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Failed to download file');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    });
}

function viewSuccessFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  window.open(url, '_blank');
}

function downloadSuccessFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  
  // Fetch file as blob and trigger download
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Failed to download file');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    });
}

function viewAdminFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  window.open(url, '_blank');
}

function downloadAdminFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  
  // Fetch file as blob and trigger download
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Failed to download file');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    });
}

function viewSuccessFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  window.open(url, '_blank');
}

function downloadSuccessFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  
  // Fetch file as blob and trigger download
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Failed to download file');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    });
}

// ===== PROJECTS MANAGEMENT =====
async function loadProjectsUI() {
  try {
    const r = await fetch(window.API_BASE_URL + '/api/projects', { headers: API.headers() });
    if (!r.ok) throw new Error('Failed to load projects');
    const projects = await r.json();

    const container = document.getElementById('projectsContainer');
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = '<p style="opacity:0.8">No projects submitted yet</p>';
      return;
    }

    container.innerHTML = projects.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).map(p => {
      const email = p.userEmail || (p.contact && p.contact.includes('@') ? p.contact : 'Not provided');
      const projectId = p.id || 'N/A';
      const phone = p.phone || (p.contact && !p.contact.includes('@') ? p.contact : 'Not provided');
      return `
      <div style="padding:1rem; border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
          <div>
            <div style="font-weight:600; color:var(--primary-accent); font-size:1.1rem;">${p.projectType}</div>
            <div style="opacity:0.8; font-size:0.9rem;"><strong>📋 Project ID:</strong> <code style="background:rgba(255,255,255,0.05); padding:0.2rem 0.5rem; border-radius:4px; font-family:monospace;">${projectId}</code></div>
            <div style="opacity:0.8; font-size:0.9rem;">👤 ${p.name} • 📧 ${email}</div>
            ${phone ? `<div style="opacity:0.8; font-size:0.9rem;">📱 ${phone}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.85rem; opacity:0.7;">${new Date(p.uploadedAt).toLocaleString()}</div>
          </div>
        </div>
        
        <div style="background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:6px; margin-bottom:1rem;">
          <div style="font-weight:600; margin-bottom:0.5rem;">Description:</div>
          <div style="opacity:0.85;">${p.description}</div>
        </div>

        <div style="background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:6px; margin-bottom:1rem;">
          <div style="font-weight:600; margin-bottom:0.5rem;">Files (${p.files.length}):</div>
          <div style="opacity:0.85; font-size:0.9rem;">
            ${p.files.map(f => `<div>📄 ${f.originalname} (${(f.size / 1024).toFixed(1)} KB)</div>`).join('')}
          </div>
        </div>

        <div style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; background:${p.status === 'finished' ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.1)'}; border:1px solid ${p.status === 'finished' ? 'rgba(0,255,0,0.3)' : 'rgba(255,165,0,0.3)'}; border-radius:6px; cursor:pointer; font-size:0.9rem;">
            <input type="checkbox" ${p.status === 'finished' ? 'checked' : ''} onchange="toggleProjectStatus('${p.id}', this.checked)" style="cursor:pointer;"/>
            <span style="color:${p.status === 'finished' ? '#0f0' : '#ffcc00'};">${p.status === 'finished' ? 'Delivered' : 'Pending'}</span>
          </label>
          
          <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; background:${p.payment === 'verified' ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.1)'}; border:1px solid ${p.payment === 'verified' ? 'rgba(0,255,0,0.3)' : 'rgba(255,165,0,0.3)'}; border-radius:6px; cursor:pointer; font-size:0.9rem;">
            <input type="checkbox" ${p.payment === 'verified' ? 'checked' : ''} onchange="toggleProjectPayment('${p.id}', this.checked)" style="cursor:pointer;"/>
            <span style="color:${p.payment === 'verified' ? '#0f0' : '#ffcc00'};">${p.payment === 'verified' ? 'Paid' : 'Verifying'}</span>
          </label>
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          ${p.files.map((f, idx) => `
            <button class="btn-primary" onclick="viewProjectFile('${f.filename}')" style="min-width:70px; background-color:#4A90E2; padding:0.6rem 1rem; font-size:0.9rem;">View ${idx + 1}</button>
            <button class="btn-primary" onclick="downloadProjectFile('${f.filename}')" style="min-width:70px; background-color:#2ECC71; padding:0.6rem 1rem; font-size:0.9rem;">DL ${idx + 1}</button>
          `).join('')}
          <div style="position:relative; display:inline-block;">
            <button onclick="openChatModal('${p.id}', '${email}', 'admin')" style="position:relative; padding:0.5rem; border-radius:6px; font-weight:600; font-size:0.9rem; background:none; color:var(--secondary-accent); border:none; cursor:pointer; transition:all 0.2s; display:inline-flex; align-items:center; gap:0.5rem;">
              <img src="https://cdn.jsdelivr.net/gh/HollyHubDigital/hollyhub-visitors@main/public/assets/chat-icon.png" alt="Chat" style="width:32px; height:32px;" />
            </button>
            <span class="admin-chat-badge" data-project-id="${p.id}" style="position:absolute; top:-8px; right:-8px; background:var(--primary-accent); color:white; border-radius:50%; width:24px; height:24px; display:none; align-items:center; justify-content:center; font-weight:bold; font-size:0.8rem; border:2px solid #1a1a1a;"></span>
          </div>
          <button class="btn-danger" onclick="deleteProject('${p.id}')" style="min-width:70px; padding:0.6rem 1rem; font-size:0.9rem;">Delete</button>
        </div>
      </div>
    `;
    }).join('');
  } catch (e) {
    console.error('loadProjectsUI error:', e);
    const container = document.getElementById('projectsContainer');
    if (container) container.innerHTML = '<p style="color:#FF5555">Error loading projects. Check console.</p>';
  }
}

function viewProjectFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  window.open(url, '_blank');
}

function downloadProjectFile(filename) {
  const url = `https://raw.githubusercontent.com/HollyHubDigital/hollyhub-visitors/main/public/uploads/${filename}`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) throw new Error('Failed to download file');
      return response.blob();
    })
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(error => {
      console.error('Download error:', error);
      alert('Download failed: ' + error.message);
    });
}

async function toggleProjectStatus(projectId, isFinished) {
  try {
    const r = await fetch(window.API_BASE_URL + '/api/projects/' + projectId, {
      method: 'PUT',
      headers: API.headers(),
      body: JSON.stringify({ status: isFinished ? 'finished' : 'pending' })
    });

    if (!r.ok) throw new Error(await r.text());

    showToast(isFinished ? '✓ Project marked as finished' : '⏳ Project marked as pending');
    await loadProjectsUI();
  } catch (e) {
    alert('Error updating status: ' + e.message);
  }
}

async function toggleProjectPayment(projectId, isVerified) {
  try {
    const r = await fetch(window.API_BASE_URL + '/api/projects/' + projectId, {
      method: 'PUT',
      headers: API.headers(),
      body: JSON.stringify({ payment: isVerified ? 'verified' : 'verifying' })
    });

    if (!r.ok) throw new Error(await r.text());

    showToast(isVerified ? '✓ Payment verified' : '💰 Payment marked as verifying');
    await loadProjectsUI();
  } catch (e) {
    alert('Error updating payment: ' + e.message);
  }
}

async function deleteProject(projectId) {
  if (!confirm('Delete this project permanently?')) return;

  try {
    const r = await fetch(window.API_BASE_URL + '/api/projects/' + projectId, {
      method: 'DELETE',
      headers: API.headers()
    });

    if (!r.ok) throw new Error(await r.text());

    showToast('Project deleted');
    await loadProjectsUI();
  } catch (e) {
    alert('Delete failed: ' + e.message);
  }
}

async function loadHeadlineUI() {
  try {
    const res = await fetch('/api/headline');
    if (!res.ok) throw new Error('Failed to load headline');
    const headline = await res.json();
    
    const textArea = document.getElementById('headlineText');
    const statusDiv = document.getElementById('headlineStatus');
    const statusText = document.getElementById('headlineStatusText');
    const lastUpdated = document.getElementById('headlineLastUpdated');
    const toggleBtn = document.getElementById('toggleHeadlineBtn');
    
    if (textArea) textArea.value = headline.text || '';
    
    if (statusDiv && statusText) {
      statusDiv.style.display = 'block';
      statusText.textContent = headline.enabled ? '✅ Headline is ACTIVE (displaying on homepage)' : '🔴 Headline is INACTIVE (not displaying)';
      if (headline.lastUpdated) {
        lastUpdated.textContent = `Last updated: ${new Date(headline.lastUpdated).toLocaleString()}`;
      }
    }
    
    if (toggleBtn) {
      toggleBtn.textContent = headline.enabled ? '🟢 ON' : '🔴 OFF';
      toggleBtn.style.background = headline.enabled ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
    }
  } catch (e) {
    console.error('Load headline error:', e);
    alert('Failed to load headline: ' + e.message);
  }
}

async function editHeadline() {
  const textArea = document.getElementById('headlineText');
  const editBtn = document.getElementById('editHeadlineBtn');
  const updateBtn = document.getElementById('updateHeadlineBtn');
  
  if (textArea.readOnly) {
    // Enable editing
    textArea.readOnly = false;
    textArea.style.opacity = '1';
    textArea.style.cursor = 'text';
    editBtn.style.display = 'none';
    updateBtn.style.display = 'block';
    textArea.focus();
  }
}

async function updateHeadline() {
  try {
    const textArea = document.getElementById('headlineText');
    const editBtn = document.getElementById('editHeadlineBtn');
    const updateBtn = document.getElementById('updateHeadlineBtn');
    const toggleBtn = document.getElementById('toggleHeadlineBtn');
    const res = await fetch('/api/headline');
    const currentHeadline = await res.json();
    
    const text = textArea.value.trim();
    if (!text) {
      alert('Headline text cannot be empty');
      return;
    }
    
    const updateRes = await fetch('/api/headline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '') },
      body: JSON.stringify({ text, enabled: currentHeadline.enabled || false })
    });
    
    if (!updateRes.ok) throw new Error('Failed to update headline');
    
    // Reset to readonly
    textArea.readOnly = true;
    textArea.style.opacity = '0.8';
    editBtn.style.display = 'block';
    updateBtn.style.display = 'none';
    
    showToast('Headline updated!');
    await loadHeadlineUI();
  } catch (e) {
    console.error('Update headline error:', e);
    alert('Failed to update headline: ' + e.message);
  }
}

async function toggleHeadline() {
  try {
    const res = await fetch('/api/headline');
    const currentHeadline = await res.json();
    
    const newEnabled = !currentHeadline.enabled;
    const updateRes = await fetch('/api/headline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('adminToken') || '') },
      body: JSON.stringify({ text: currentHeadline.text || '', enabled: newEnabled })
    });
    
    if (!updateRes.ok) throw new Error('Failed to toggle headline');
    
    showToast(newEnabled ? 'Headline enabled!' : 'Headline disabled!');
    await loadHeadlineUI();
  } catch (e) {
    console.error('Toggle headline error:', e);
    alert('Failed to toggle headline: ' + e.message);
  }
}

function attachEvents(){
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) {
    logoutBtn.addEventListener('click', ()=>{
      localStorage.removeItem('adminToken');
      window.location.href = 'adminlogin.html';
    });
  } else { console.warn('attachEvents: logoutBtn not found'); }

  const loadPageBtn = document.getElementById('loadPageBtn');
  if(loadPageBtn) loadPageBtn.addEventListener('click', loadPageSections); else { console.warn('attachEvents: loadPageBtn not found'); }

  // Download Files Tab listener
  const downloadFilesTab = document.querySelector('[data-tab="download-files"]');
  if(downloadFilesTab) {
    downloadFilesTab.addEventListener('click', () => {
      setTimeout(() => {
        loadDownloadFilesUI();
        // Attach button listener when tab is opened
        const btn = document.getElementById('publishDownloadFileBtn');
        if(btn && !btn._listenerAttached) {
          btn.addEventListener('click', publishDownloadFile);
          btn._listenerAttached = true;
        }
      }, 50);
    });
  }

  // Projects Tab listener
  const projectsTab = document.querySelector('[data-tab="projects"]');
  if(projectsTab) {
    projectsTab.addEventListener('click', () => {
      setTimeout(() => {
        loadProjectsUI();
      }, 50);
    });
  }

  // Headline Tab listener
  const headlineTab = document.querySelector('[data-tab="headline"]');
  if(headlineTab) {
    headlineTab.addEventListener('click', () => {
      setTimeout(() => {
        loadHeadlineUI();
      }, 50);
    });
  }

  // Headline Buttons
  const editHeadlineBtn = document.getElementById('editHeadlineBtn');
  const updateHeadlineBtn = document.getElementById('updateHeadlineBtn');
  const toggleHeadlineBtn = document.getElementById('toggleHeadlineBtn');
  
  if(editHeadlineBtn) editHeadlineBtn.addEventListener('click', editHeadline);
  if(updateHeadlineBtn) updateHeadlineBtn.addEventListener('click', updateHeadline);
  if(toggleHeadlineBtn) toggleHeadlineBtn.addEventListener('click', toggleHeadline);

  // Publish Download File Button (deferred attachment)
  const publishDownloadFileBtn = document.getElementById('publishDownloadFileBtn');
  if(publishDownloadFileBtn) {
    publishDownloadFileBtn.addEventListener('click', publishDownloadFile);
    publishDownloadFileBtn._listenerAttached = true;
  }

  const publishPortfolioBtn = document.getElementById('publishPortfolioBtn');
  if(publishPortfolioBtn) publishPortfolioBtn.addEventListener('click', publishPortfolio); else { console.warn('attachEvents: publishPortfolioBtn not found'); }

  const publishBlogBtn = document.getElementById('publishBlogBtn');
  if(publishBlogBtn) publishBlogBtn.addEventListener('click', publishBlog); else { console.warn('attachEvents: publishBlogBtn not found'); }

  const updateCredsBtn = document.getElementById('updateCredsBtn');
  if(updateCredsBtn) updateCredsBtn.addEventListener('click', updateAdminCredentials); else { console.warn('attachEvents: updateCredsBtn not found'); }

  const saveSiteSettingsBtn = document.getElementById('saveSiteSettingsBtn');
  if(saveSiteSettingsBtn) saveSiteSettingsBtn.addEventListener('click', saveSiteSettings); else { console.warn('attachEvents: saveSiteSettingsBtn not found'); }

  // Apps management
  attachAppFilterEvents();

  const analyticsTab = document.querySelector('[data-tab="analytics"]');
  if(analyticsTab) {
    analyticsTab.addEventListener('click', loadAnalytics);
  }
  // refresh comments moderation when blog tab activated
  const blogTabBtn = document.querySelector('[data-tab="blog"]');
  if(blogTabBtn){
    blogTabBtn.addEventListener('click', ()=>{ refreshBlogPosts(); refreshCommentsModeration(); });
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('appConfigModal');
  if(modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAppModal();
    });
  }

  // ===== OVERLAY TAB EVENTS =====
  const masterOverlayToggle = document.getElementById('masterOverlayToggle');
  if(masterOverlayToggle) masterOverlayToggle.addEventListener('click', toggleMasterOverlay);
  
  const editModal1Btn = document.getElementById('editModal1Btn');
  if(editModal1Btn) editModal1Btn.addEventListener('click', () => {
    document.getElementById('modal1ImageFile').disabled = false;
    document.getElementById('modal1Description').readOnly = false;
    document.getElementById('modal1ButtonText').readOnly = false;
    document.getElementById('modal1ImageUrl').readOnly = false;
    document.getElementById('editModal1Btn').style.display = 'none';
    document.getElementById('saveModal1Btn').style.display = 'inline-block';
  });

  const saveModal1Btn = document.getElementById('saveModal1Btn');
  if(saveModal1Btn) saveModal1Btn.addEventListener('click', saveModal1Config);

  const toggleModal1Btn = document.getElementById('toggleModal1Btn');
  if(toggleModal1Btn) toggleModal1Btn.addEventListener('click', () => toggleModalState('modal1'));

  const editModal2Btn = document.getElementById('editModal2Btn');
  if(editModal2Btn) editModal2Btn.addEventListener('click', () => {
    document.getElementById('modal2MediaFile').disabled = false;
    document.getElementById('modal2Description').readOnly = false;
    document.getElementById('modal2MediaUrl').readOnly = false;
    document.getElementById('editModal2Btn').style.display = 'none';
    document.getElementById('saveModal2Btn').style.display = 'inline-block';
  });

  const saveModal2Btn = document.getElementById('saveModal2Btn');
  if(saveModal2Btn) saveModal2Btn.addEventListener('click', saveModal2Config);

  const toggleModal2Btn = document.getElementById('toggleModal2Btn');
  if(toggleModal2Btn) toggleModal2Btn.addEventListener('click', () => toggleModalState('modal2'));

  // Load overlay on tab click
  const overlayTabBtn = document.querySelector('[data-tab="overlay"]');
  if(overlayTabBtn) overlayTabBtn.addEventListener('click', loadOverlayUI);
}

// ===== OVERLAY MANAGEMENT =====
async function loadOverlayUI() {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load overlay config');
    const overlay = await r.json();

    // Update master toggle
    const masterBtn = document.getElementById('masterOverlayToggle');
    masterBtn.textContent = overlay.masterEnabled ? '🟢 All Modals ON' : '🔴 All Modals OFF';
    masterBtn.style.background = overlay.masterEnabled ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.1)';

    // Update Modal 1
    document.getElementById('modal1ImageUrl').value = overlay.modal1?.image || '';
    document.getElementById('modal1Description').value = overlay.modal1?.description || '';
    document.getElementById('modal1ButtonText').value = overlay.modal1?.buttonText || 'Get Started';
    const modal1Btn = document.getElementById('toggleModal1Btn');
    modal1Btn.textContent = overlay.modal1?.enabled ? '🟢 ON' : '🔴 OFF';
    modal1Btn.style.background = overlay.modal1?.enabled ? 'rgba(0,255,0,0.2)' : '';

    // Update Modal 2
    document.getElementById('modal2MediaUrl').value = overlay.modal2?.media || '';
    document.getElementById('modal2Description').value = overlay.modal2?.description || '';
    const modal2Btn = document.getElementById('toggleModal2Btn');
    modal2Btn.textContent = overlay.modal2?.enabled ? '🟢 ON' : '🔴 OFF';
    modal2Btn.style.background = overlay.modal2?.enabled ? 'rgba(0,255,0,0.2)' : '';

    // Disable edit/save buttons by default
    document.getElementById('modal1ImageFile').disabled = true;
    document.getElementById('modal1Description').readOnly = true;
    document.getElementById('modal1ButtonText').readOnly = true;
    document.getElementById('modal1ImageUrl').readOnly = true;
    document.getElementById('editModal1Btn').style.display = 'inline-block';
    document.getElementById('saveModal1Btn').style.display = 'none';

    document.getElementById('modal2MediaFile').disabled = true;
    document.getElementById('modal2Description').readOnly = true;
    document.getElementById('modal2MediaUrl').readOnly = true;
    document.getElementById('editModal2Btn').style.display = 'inline-block';
    document.getElementById('saveModal2Btn').style.display = 'none';
  } catch(e) {
    console.error('Error loading overlay UI:', e);
    showToast('Failed to load overlay config', null, null, 3000);
  }
}

async function toggleMasterOverlay() {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load current config');
    const overlay = await r.json();

    const newMasterState = !overlay.masterEnabled;

    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: newMasterState,
        modal1: overlay.modal1,
        modal2: overlay.modal2
      })
    });

    if(!saveR.ok) throw new Error('Failed to save');
    
    const btn = document.getElementById('masterOverlayToggle');
    btn.textContent = newMasterState ? '🟢 All Modals ON' : '🔴 All Modals OFF';
    btn.style.background = newMasterState ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.1)';
    showToast(newMasterState ? 'All overlays enabled' : 'All overlays disabled', null, null, 3000);
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

async function saveModal1Config() {
  try {
    const imageFile = document.getElementById('modal1ImageFile').files[0];
    const description = document.getElementById('modal1Description').value;
    const buttonText = document.getElementById('modal1ButtonText').value;

    let imageUrl = document.getElementById('modal1ImageUrl').value;

    // Upload image if new file selected
    if(imageFile) {
      const formData = new FormData();
      formData.append('file', imageFile);
      const uploadR = await fetch(API.buildURL('/api/upload'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + API.token() },
        body: formData
      });
      if(!uploadR.ok) throw new Error('Image upload failed');
      const uploadData = await uploadR.json();
      imageUrl = uploadData.url;
    }

    // Get current config
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    // Save Modal 1 config
    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: overlay.masterEnabled,
        modal1: {
          type: 'contactForm',
          enabled: true,
          image: imageUrl,
          description: description,
          buttonText: buttonText,
          web3formsKey: '4eab8d69-b661-4f80-92b2-a99786eddbf9'
        },
        modal2: { ...overlay.modal2, enabled: false }
      })
    });

    if(!saveR.ok) throw new Error('Failed to save Modal 1');
    
    document.getElementById('modal1ImageUrl').readOnly = true;
    document.getElementById('modal1ImageUrl').value = imageUrl;
    document.getElementById('editModal1Btn').style.display = 'inline-block';
    document.getElementById('saveModal1Btn').style.display = 'none';
    document.getElementById('toggleModal1Btn').textContent = '🟢 ON';
    showToast('Modal 1 saved and enabled!', null, null, 3000);
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

async function saveModal2Config() {
  try {
    const mediaFile = document.getElementById('modal2MediaFile').files[0];
    const description = document.getElementById('modal2Description').value;

    let mediaUrl = document.getElementById('modal2MediaUrl').value;

    // Upload media if new file selected
    if(mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      const uploadR = await fetch(API.buildURL('/api/upload'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + API.token() },
        body: formData
      });
      if(!uploadR.ok) throw new Error('Media upload failed');
      const uploadData = await uploadR.json();
      mediaUrl = uploadData.url;
    }

    if(!mediaUrl && !mediaFile) throw new Error('Please upload or enter a media URL');

    // Get current config
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    // Save Modal 2 config
    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: overlay.masterEnabled,
        modal1: { ...overlay.modal1, enabled: false },
        modal2: {
          type: 'mediaDisplay',
          enabled: true,
          media: mediaUrl,
          mediaType: mediaUrl.match(/youtube|vimeo/) ? 'embed' : (mediaUrl.match(/\.mp4|\.webm/) ? 'video' : 'image'),
          description: description
        }
      })
    });

    if(!saveR.ok) throw new Error('Failed to save Modal 2');
    
    document.getElementById('modal2MediaUrl').readOnly = true;
    document.getElementById('modal2MediaUrl').value = mediaUrl;
    document.getElementById('editModal2Btn').style.display = 'inline-block';
    document.getElementById('saveModal2Btn').style.display = 'none';
    document.getElementById('toggleModal2Btn').textContent = '🟢 ON';
    showToast('Modal 2 saved and enabled!', null, null, 3000);
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

async function toggleModalState(modal) {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    const newState = modal === 'modal1' ? !overlay.modal1.enabled : !overlay.modal2.enabled;

    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: overlay.masterEnabled,
        modal1: modal === 'modal1' ? { ...overlay.modal1, enabled: newState } : { ...overlay.modal1, enabled: false },
        modal2: modal === 'modal2' ? { ...overlay.modal2, enabled: newState } : { ...overlay.modal2, enabled: false }
      })
    });

    if(!saveR.ok) throw new Error('Failed to save');
    
    const btn = document.getElementById('toggleModal' + (modal === 'modal1' ? '1' : '2') + 'Btn');
    btn.textContent = newState ? '🟢 ON' : '🔴 OFF';
    btn.style.background = newState ? 'rgba(0,255,0,0.2)' : '';
    showToast(`Modal ${modal === 'modal1' ? '1' : '2'} ${newState ? 'enabled' : 'disabled'}`, null, null, 3000);
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

// Expose functions globally for onclick handlers
window.editPortfolioItem = editPortfolioItem;
window.deletePortfolioItem = deletePortfolioItem;
window.editBlogPost = editBlogPost;
window.deleteBlogPost = deleteBlogPost;
window.publishPortfolio = publishPortfolio;
window.publishBlog = publishBlog;
window.uploadFile = uploadFile;
window.loadPageSections = loadPageSections;
window.savePageSections = savePageSections;
window.updateAdminCredentials = updateAdminCredentials;
window.saveSiteSettings = saveSiteSettings;
window.openAppConfigModal = openAppConfigModal;
window.closeAppModal = closeAppModal;
window.saveAppConfig = saveAppConfig;
window.disableApp = disableApp;
window.deleteDownloadFile = deleteDownloadFile;
window.deleteSuccessFile = deleteSuccessFile;
window.toggleProjectStatus = toggleProjectStatus;
window.toggleProjectPayment = toggleProjectPayment;
window.viewProjectFile = viewProjectFile;
window.downloadProjectFile = downloadProjectFile;
window.deleteProject = deleteProject;
window.loadProjectsUI = loadProjectsUI;
window.loadOverlayUI = loadOverlayUI;
window.toggleMasterOverlay = toggleMasterOverlay;
window.saveModal1Config = saveModal1Config;
window.saveModal2Config = saveModal2Config;
window.toggleModalState = toggleModalState;

window.addEventListener('load', async ()=>{
  try{
    requireAuth();
  } catch(e){
    window.location.href = 'adminlogin.html';
  }
  initTabs();
  attachEvents();
  refreshPortfolioList();
  refreshBlogPosts();
  await loadSiteSettings();
  loadAppsRegistry();
  loadDownloadFilesUI();
});
} // End of ADMIN_INITIALIZED guard