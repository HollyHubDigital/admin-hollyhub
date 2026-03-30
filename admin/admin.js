// Admin Dashboard - COMPLETE VERSION
if (typeof ADMIN_INITIALIZED !== 'undefined') {
  console.log('[Admin] Script already loaded, skipping re-initialization');
} else {
  window.ADMIN_INITIALIZED = true;
const API_BASE_URL = (typeof window !== 'undefined' && window.API_BASE_URL) ? window.API_BASE_URL : 'https://hollyhubdigitals.vercel.app';
  
const API = {
  token() { return localStorage.getItem('adminToken') || ''; },
  headers(json=true){ return { 'Authorization': 'Bearer ' + API.token(), ...(json? {'Content-Type':'application/json'}:{}) }; }
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
  if(!API.token()) { 
    window.location.href = 'adminlogin.html';
    throw new Error('Redirecting to login');
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
    const r = await fetch(`${API_BASE_URL}/api/pages/sections/${page}`, { headers: API.headers() });
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
      // inject preview iframe area pointing to visitors site
      setTimeout(()=>{
        const preview = document.getElementById('pagePreviewArea');
        if(preview){
          preview.innerHTML = `<iframe id="pagePreviewFrame" src="${API_BASE_URL}/" style="width:100%;height:420px;border:1px solid rgba(255,255,255,0.06);border-radius:8px"></iframe>`;
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
    const r = await fetch(API_BASE_URL + '/api/pages/sections/save', { method:'PUT', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    showToast('Page sections saved', 'View', ()=>window.open(API_BASE_URL + '/', '_blank'));
    document.getElementById('pageEditContainer').innerHTML = '<p style="color:var(--primary-accent)">✓ Changes saved!</p>';
    // refresh preview iframe if present
    try{ const f = document.getElementById('pagePreviewFrame'); if(f && f.contentWindow && f.contentWindow.location) f.contentWindow.location.reload(); }catch(e){}
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
    const r = await fetch(API_BASE_URL + endpoint, { method, headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    const createdItem = await r.json();
    showToast(editingId ? 'Portfolio item updated' : 'Portfolio item published', 'Open', ()=>window.open('/portfolio.html','_blank'));
    // Optionally add to recentProjects on home page
    if(addToRecent){
      try{
        // fetch current sections
        const sres = await fetch(API_BASE_URL + '/api/pages/sections/index', { headers: API.headers() });
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
  const fd = new FormData();
  fd.append('file', file);
  if(targets && targets.length) fd.append('targets', targets.filter(Boolean).join(','));
  const headers = { 'Authorization': 'Bearer ' + API.token() };
  const r = await fetch(API_BASE_URL + '/api/upload', { method: 'POST', headers, body: fd });
  if(!r.ok) throw new Error(await r.text());
  return await r.json();
}

async function refreshPortfolioList(){
  try {
    const r = await fetch(API_BASE_URL + '/api/portfolio', { headers: API.headers() });
    if(!r.ok) throw new Error('Failed');
    const items = await r.json();
    const container = document.getElementById('portfolioList');
    container.innerHTML = '';
    items.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'portfolio-item';
      div.innerHTML = `
        <div>
          <div style="font-weight:700">${item.title}</div>
          <div style="opacity:0.8;font-size:0.9rem">${item.category} • ${new Date(item.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" onclick="editPortfolioItem('${item.id}')">Edit</button>
          <button class="btn-danger" onclick="deletePortfolioItem('${item.id}')">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch(e) {
    console.error(e);
  }
}

async function editPortfolioItem(id){
  try {
    const r = await fetch(API_BASE_URL + '/api/portfolio?id='+encodeURIComponent(id), { headers: API.headers() });
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
    const r = await fetch(API_BASE_URL + '/api/portfolio?id='+encodeURIComponent(id), { method:'DELETE', headers: API.headers() });
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
    const r = await fetch(API_BASE_URL + endpoint, { method, headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
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
    const r = await fetch(API_BASE_URL + '/api/blog');
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
    const r = await fetch(API_BASE_URL + '/api/blog', { headers: API.headers() });
    if(!r.ok) return;
    const posts = await r.json();
    const container = document.getElementById('publishedPosts');
    container.innerHTML = '';
    posts.forEach(post=>{
      const div = document.createElement('div');
      div.className = 'blog-item';
      div.innerHTML = `
        <div>
          <div style="font-weight:700">${post.title}</div>
          <div style="opacity:0.8">${post.category} • ${new Date(post.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" onclick="editBlogPost('${post.id}')">Edit</button>
          <button class="btn-danger" onclick="deleteBlogPost('${post.id}')">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch(e) {
    console.error(e);
  }
}

// ===== COMMENTS MODERATION =====
async function refreshCommentsModeration(){
  try{
    const r = await fetch(API_BASE_URL + '/api/blog/comments', { headers: API.headers() });
    if(!r.ok) throw new Error('Failed to load comments');
    const comments = await r.json();
    const container = document.getElementById('commentsModeration');
    container.innerHTML = '';
    if(comments.length===0){ container.innerHTML = '<p style="opacity:0.8">No comments yet</p>'; return; }
    comments.slice().reverse().forEach(c=>{
      const div = document.createElement('div');
      div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
      div.style.padding = '0.5rem 0'; div.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      div.innerHTML = `<div style="max-width:78%"><div style="font-weight:700">${c.author||'Anonymous'}</div><div style="opacity:0.8;font-size:0.95rem">${(c.content||'').slice(0,200)}${(c.content && c.content.length>200? '...':'')}</div><div style="opacity:0.7;font-size:0.85rem">on post ${c.postId} • ${new Date(c.createdAt).toLocaleString()}</div></div>`;
      const btns = document.createElement('div');
      const del = document.createElement('button'); del.className='btn-danger'; del.textContent='Delete';
      del.addEventListener('click', async ()=>{
        if(!confirm('Delete this comment?')) return;
        try{ const dr = await fetch(API_BASE_URL + '/api/blog/comment?id='+encodeURIComponent(c.id), { method:'DELETE', headers: API.headers() }); if(!dr.ok) throw new Error(await dr.text()); showToast('Comment deleted'); await refreshCommentsModeration(); }catch(e){ alert('Delete failed: '+e.message); }
      });
      btns.appendChild(del);
      div.appendChild(btns);
      container.appendChild(div);
    });
  }catch(e){ console.error(e); }
}

async function deleteBlogPost(id){
  if(!confirm('Delete this blog post?')) return;
  try {
    const r = await fetch(API_BASE_URL + '/api/blog?id='+encodeURIComponent(id), { method:'DELETE', headers: API.headers() });
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
    const r = await fetch(API_BASE_URL + '/api/admin/update-credentials', { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
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
    const r = await fetch(API_BASE_URL + '/api/settings', { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Settings saved');
  } catch(e) {
    alert('Save failed: '+e.message);
  }
}

async function loadSiteSettings(){
  try{
    const token = API.token();
    if(!token){
      console.warn('loadSiteSettings: No token available, skipping');
      return;
    }
    const r = await fetch(API_BASE_URL + '/api/settings', { headers: API.headers() });
    if(!r.ok) throw new Error('Failed to load settings');
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
    const r = await fetch(API_BASE_URL + '/api/apps?registry=true');
    if (!r.ok) {
      console.warn('Load apps registry: HTTP ' + r.status);
      return;
    }
    const data = await r.json();
    allAppsRegistry = data.apps || {};
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
  } catch(e) {
    console.error('Load apps error:', e);
    // Silently fail - apps management is optional
  }
}

async function loadAppsConfiguration() {
  try {
    const r = await fetch(API_BASE_URL + '/api/apps?config=true', { headers: API.headers() });
    if (!r.ok) {
      // if auth failed or token invalid, try unauthenticated public config as a fallback
      const publicRes = await fetch(API_BASE_URL + '/api/apps?config=true');
      if (!publicRes.ok) throw new Error('Failed to load config');
      currentAppsConfig = await publicRes.json();
      return;
    }
    currentAppsConfig = await r.json();
  } catch(e) {
    console.error('Load config error:', e);
    // attempt public fallback so admin UI still shows active apps even when token is invalid
    try{
      const r2 = await fetch(API_BASE_URL + '/api/apps?config=true');
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
    const r = await fetch(API_BASE_URL + '/api/apps', {
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
    const r = await fetch(API_BASE_URL + '/api/apps', {
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
    const r = await fetch(API_BASE_URL + '/api/analytics', { headers: API.headers() });
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

// ===== OVERLAY MODAL MANAGEMENT =====
async function loadOverlayUI() {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if (!r.ok) throw new Error('Failed to load overlay config');
    const overlay = await r.json();

    // Set Modal 1 fields
    document.getElementById('modal1ImageUrl').value = overlay.modal1?.image || '';
    document.getElementById('modal1ImageUrl').readOnly = true;
    document.getElementById('modal1Description').value = overlay.modal1?.description || '';
    document.getElementById('modal1Description').readOnly = true;
    document.getElementById('modal1ButtonText').value = overlay.modal1?.buttonText || 'Get Special Offer';
    document.getElementById('modal1ButtonText').readOnly = true;
    
    // Set Modal 2 fields
    document.getElementById('modal2MediaUrl').value = overlay.modal2?.media || '';
    document.getElementById('modal2MediaUrl').readOnly = true;
    document.getElementById('modal2Description').value = overlay.modal2?.description || '';
    document.getElementById('modal2Description').readOnly = true;

    // Set toggle states
    document.getElementById('toggleModal1Btn').textContent = overlay.modal1?.enabled ? '🟢 ON' : '⚪ OFF';
    document.getElementById('toggleModal1Btn').style.background = overlay.modal1?.enabled ? 'rgba(0,255,0,0.2)' : '';
    document.getElementById('toggleModal2Btn').textContent = overlay.modal2?.enabled ? '🟢 ON' : '⚪ OFF';
    document.getElementById('toggleModal2Btn').style.background = overlay.modal2?.enabled ? 'rgba(0,255,0,0.2)' : '';

    // Hide save buttons by default
    document.getElementById('saveModal1Btn').style.display = 'none';
    document.getElementById('saveModal2Btn').style.display = 'none';
    document.getElementById('editModal1Btn').style.display = 'inline-block';
    document.getElementById('editModal2Btn').style.display = 'inline-block';

  } catch(e) {
    console.error('[loadOverlayUI] Error:', e);
    alert('Error loading overlay config: ' + e.message);
  }
}

document.getElementById('editModal1Btn')?.addEventListener('click', () => {
  document.getElementById('modal1ImageUrl').readOnly = false;
  document.getElementById('modal1Description').readOnly = false;
  document.getElementById('modal1ButtonText').readOnly = false;
  document.getElementById('modal1ImageFile').disabled = false;
  document.getElementById('editModal1Btn').style.display = 'none';
  document.getElementById('saveModal1Btn').style.display = 'inline-block';
});

document.getElementById('editModal2Btn')?.addEventListener('click', () => {
  document.getElementById('modal2MediaUrl').readOnly = false;
  document.getElementById('modal2Description').readOnly = false;
  document.getElementById('modal2MediaFile').disabled = false;
  document.getElementById('editModal2Btn').style.display = 'none';
  document.getElementById('saveModal2Btn').style.display = 'inline-block';
});

function toggleModalState(modal) {
  const btnId = 'toggle' + modal.charAt(0).toUpperCase() + modal.slice(1) + 'Btn';
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  if (btn.textContent.includes('OFF')) {
    // Enabling this modal - disable the other
    const otherModal = modal === 'Modal1' ? 'Modal2' : 'Modal1';
    const otherBtnId = 'toggle' + otherModal + 'Btn';
    const otherBtn = document.getElementById(otherBtnId);
    if (otherBtn) {
      otherBtn.textContent = '⚪ OFF';
      otherBtn.style.background = '';
    }
    btn.textContent = '🟢 ON';
    btn.style.background = 'rgba(0,255,0,0.2)';
  } else {
    btn.textContent = '⚪ OFF';
    btn.style.background = '';
  }
}

async function saveModal1Config() {
  try {
    const imageFile = document.getElementById('modal1ImageFile').files[0];
    const description = document.getElementById('modal1Description').value;
    const buttonText = document.getElementById('modal1ButtonText').value;

    let imageUrl = document.getElementById('modal1ImageUrl').value || '';

    // Upload image if new file selected
    if(imageFile) {
      const formData = new FormData();
      formData.append('file', imageFile);
      try {
        const uploadR = await fetch(API.buildURL('/api/upload'), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + API.token() },
          body: formData
        });
        if(!uploadR.ok) {
          const errData = await uploadR.text();
          throw new Error(`Image upload failed: ${uploadR.status} ${errData}`);
        }
        const uploadData = await uploadR.json();
        imageUrl = uploadData.url;
        console.log('[saveModal1] Image uploaded:', imageUrl);
      } catch(uploadErr) {
        console.error('[saveModal1] Upload error:', uploadErr);
        throw uploadErr;
      }
    }

    if(!imageUrl) {
      throw new Error('Please upload an image or paste an image URL');
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

    if(!saveR.ok) {
      const errData = await saveR.text();
      throw new Error(`Failed to save Modal 1: ${saveR.status} ${errData}`);
    }
    
    document.getElementById('modal1ImageUrl').readOnly = true;
    document.getElementById('modal1ImageUrl').value = imageUrl;
    document.getElementById('modal1Description').readOnly = true;
    document.getElementById('modal1ButtonText').readOnly = true;
    document.getElementById('modal1ImageFile').disabled = true;
    document.getElementById('editModal1Btn').style.display = 'inline-block';
    document.getElementById('saveModal1Btn').style.display = 'none';
    document.getElementById('toggleModal1Btn').textContent = '🟢 ON';
    document.getElementById('toggleModal1Btn').style.background = 'rgba(0,255,0,0.2)';
    showToast('Modal 1 saved and enabled!', null, null, 3000);
  } catch(e) {
    console.error('[saveModal1] Error:', e);
    alert('Error: ' + e.message);
  }
}

async function saveModal2Config() {
  try {
    const mediaFile = document.getElementById('modal2MediaFile').files[0];
    const description = document.getElementById('modal2Description').value;
    let mediaUrl = document.getElementById('modal2MediaUrl').value || '';

    // Upload media if new file selected
    if(mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      const uploadUrl = API.buildURL('/api/upload');
      console.log('[saveModal2] Uploading to:', uploadUrl);
      console.log('[saveModal2] File:', mediaFile.name, 'Size:', mediaFile.size);
      
      try {
        const uploadR = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + API.token() },
          body: formData
        });
        
        console.log('[saveModal2] Upload response status:', uploadR.status);
        console.log('[saveModal2] Response headers:', Array.from(uploadR.headers.entries()));
        
        if(!uploadR.ok) {
          const errData = await uploadR.text();
          console.error('[saveModal2] Upload failed with status', uploadR.status, ':', errData);
          throw new Error(`Media upload failed: ${uploadR.status} ${errData}`);
        }
        const uploadData = await uploadR.json();
        mediaUrl = uploadData.url;
        console.log('[saveModal2] Media uploaded:', mediaUrl);
      } catch(uploadErr) {
        console.error('[saveModal2] Upload error:', uploadErr.message);
        console.error('[saveModal2] Error details:', uploadErr);
        throw uploadErr;
      }
    }

    if(!mediaUrl) {
      throw new Error('Please upload media or paste a media URL (image, video, or YouTube link)');
    }

    // Get current config
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    // Detect media type - support more formats
    let mediaType = 'image';
    if(mediaUrl.match(/youtube|youtu\.be|vimeo/i)) {
      mediaType = 'embed';
    } else if(mediaUrl.match(/\.(mp4|webm|mov|avi|mkv|flv|m4v|3gp|ogv|ts)$/i)) {
      mediaType = 'video';
    }

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
          mediaType: mediaType,
          description: description
        }
      })
    });

    if(!saveR.ok) {
      const errData = await saveR.text();
      throw new Error(`Failed to save Modal 2: ${saveR.status} ${errData}`);
    }
    
    document.getElementById('modal2MediaUrl').readOnly = true;
    document.getElementById('modal2MediaUrl').value = mediaUrl;
    document.getElementById('modal2Description').readOnly = true;
    document.getElementById('modal2MediaFile').disabled = true;
    document.getElementById('editModal2Btn').style.display = 'inline-block';
    document.getElementById('saveModal2Btn').style.display = 'none';
    document.getElementById('toggleModal2Btn').textContent = '🟢 ON';
    document.getElementById('toggleModal2Btn').style.background = 'rgba(0,255,0,0.2)';
    showToast('Modal 2 saved and enabled!', null, null, 3000);
  } catch(e) {
    console.error('[saveModal2] Error:', e);
    alert('Error: ' + e.message);
  }
}

// ===== INIT =====
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
}

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
  await loadAppsRegistry();
  await loadOverlayUI();
});
// Expose functions used by inline onclick handlers in admin HTML
try{
  window.editBlogPost = editBlogPost;
  window.deleteBlogPost = deleteBlogPost;
  window.editPortfolioItem = editPortfolioItem;
  window.deletePortfolioItem = deletePortfolioItem;
  window.openAppConfigModal = openAppConfigModal;
  window.closeAppModal = closeAppModal;
  window.saveModal1Config = saveModal1Config;
  window.saveModal2Config = saveModal2Config;
  window.toggleModalState = toggleModalState;
  window.loadOverlayUI = loadOverlayUI;
}catch(e){}

} // End of ADMIN_INITIALIZED guard