// Admin Dashboard - NEW VERSION
const API = {
  token() { return localStorage.getItem('adminToken') || ''; },
  headers(json=true){ return { 'Authorization': 'Bearer ' + API.token(), ...(json? {'Content-Type':'application/json'}:{}) }; }
};

function requireAuth() {
  if(!API.token()) { window.location.href = 'adminlogin.html'; }
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
    const r = await fetch(`/api/pages/sections/${page}`, { headers: API.headers() });
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
    } else if(page === 'portfolio'){
      html += `
        <div class="form-group">
          <label class="form-label">Portfolio Items (managed in Portfolio tab)</label>
          <p style="opacity:0.8">Use the Portfolio tab to add/edit/delete items</p>
        </div>
      `;
    } else if(page === 'blog'){
      html += `
        <div class="form-group">
          <label class="form-label">Blog Posts (managed in Blog tab)</label>
          <p style="opacity:0.8">Use the Blog tab to create/edit/delete posts</p>
        </div>
      `;
    }

    html += `<button id="savePageSectionsBtn" class="btn-primary">Save Changes</button></div>`;
    container.innerHTML = html;

    document.getElementById('savePageSectionsBtn').addEventListener('click', async ()=>{
      const payload = { page, sections: {} };
      if(page === 'index'){
        payload.sections.interImage = document.getElementById('interImage').value;
        payload.sections.recentProjects = JSON.parse(document.getElementById('recentProjects').value || '[]');
      }
      await savePageSections(payload);
    });
  } catch(e) {
    container.innerHTML = `<p style="color:#FF5555">Error: ${e.message}</p>`;
  }
}

async function savePageSections(payload){
  try {
    const r = await fetch('/api/pages/sections/save', { method:'PUT', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Page sections saved successfully!');
    document.getElementById('pageEditContainer').innerHTML = '<p style="color:var(--primary-accent)">✓ Changes saved!</p>';
  } catch(e) {
    alert('Save failed: '+e.message);
  }
}

// ===== PORTFOLIO MANAGEMENT =====
async function publishPortfolio(){
  const title = document.getElementById('pfTitle').value;
  const category = document.getElementById('pfCategory').value;
  const description = document.getElementById('pfDescription').value;
  const image = document.getElementById('pfImage').value;
  const url = document.getElementById('pfUrl').value;

  if(!title || !description || !image) return alert('Please fill all required fields');

  const editingId = document.getElementById('pfEditingId').value;
  const payload = { title, category, description, image, url };

  try {
    let endpoint = '/api/portfolio';
    let method = 'POST';
    if(editingId){
      endpoint += '?id='+encodeURIComponent(editingId);
      method = 'PUT';
    }
    const r = await fetch(endpoint, { method, headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert(editingId ? 'Portfolio item updated' : 'Portfolio item published');
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

async function refreshPortfolioList(){
  try {
    const r = await fetch('/api/portfolio', { headers: API.headers() });
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
    const r = await fetch('/api/portfolio?id='+encodeURIComponent(id), { headers: API.headers() });
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
    const r = await fetch('/api/portfolio?id='+encodeURIComponent(id), { method:'DELETE', headers: API.headers() });
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
  const content = document.getElementById('blogContent').value;

  if(!title || !content) return alert('Please fill title and content');

  const payload = { title, category, image, content };
  try {
    const r = await fetch('/api/blog', { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Blog post published');
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogCategory').value = '';
    document.getElementById('blogImage').value = '';
    document.getElementById('blogContent').value = '';
    await refreshBlogPosts();
  } catch(e) {
    alert('Publish failed: '+e.message);
  }
}

async function refreshBlogPosts(){
  try {
    const r = await fetch('/api/blog', { headers: API.headers() });
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
          <button class="btn-danger" onclick="deleteBlogPost('${post.id}')">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
  } catch(e) {
    console.error(e);
  }
}

async function deleteBlogPost(id){
  if(!confirm('Delete this blog post?')) return;
  try {
    const r = await fetch('/api/blog?id='+encodeURIComponent(id), { method:'DELETE', headers: API.headers() });
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
  if(newPassword !== confirmPass) return alert('Passwords do not match');
  if(!newUsername && !newPassword) return alert('Enter at least username or password');

  const payload = { currentPassword: currentPass, newUsername, newPassword };
  try {
    const r = await fetch('/api/admin/update-credentials', { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
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

  const payload = { gaId, customScripts: customScripts ? JSON.parse(customScripts) : [] };
  try {
    const r = await fetch('/api/settings', { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Settings saved');
  } catch(e) {
    alert('Save failed: '+e.message);
  }
}

// ===== ANALYTICS =====
async function loadAnalytics(){
  try {
    const r = await fetch('/api/analytics', { headers: API.headers() });
    if(!r.ok) throw new Error('Failed');
    const data = await r.json();

    document.getElementById('totalVisitors').textContent = data.totalVisitors || 0;
    document.getElementById('todayVisitors').textContent = data.todayVisitors || 0;
    document.getElementById('uniqueVisitors').textContent = data.uniqueVisitors || 0;

    // Countries
    let countryHTML = '';
    const countries = data.countryStats || [];
    if(countries.length) {
      countryHTML = countries.map(c=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${c.country}</span>: ${c.count} visitors</div>`).join('');
    } else {
      countryHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('countryStats').innerHTML = countryHTML;

    // Browsers
    let browserHTML = '';
    const browsers = data.browserStats || [];
    if(browsers.length) {
      browserHTML = browsers.map(b=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${b.browser}</span>: ${b.count} visitors</div>`).join('');
    } else {
      browserHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('browserStats').innerHTML = browserHTML;

    // Page views
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
function attachEvents(){
  document.getElementById('logoutBtn').addEventListener('click', ()=>{
    localStorage.removeItem('adminToken');
    window.location.href = 'adminlogin.html';
  });

  document.getElementById('loadPageBtn').addEventListener('click', loadPageSections);
  document.getElementById('publishPortfolioBtn').addEventListener('click', publishPortfolio);
  document.getElementById('publishBlogBtn').addEventListener('click', publishBlog);
  document.getElementById('updateCredsBtn').addEventListener('click', updateAdminCredentials);
  document.getElementById('saveSiteSettingsBtn').addEventListener('click', saveSiteSettings);

  // Load analytics when tab opens
  document.querySelector('[data-tab="analytics"]').addEventListener('click', loadAnalytics);
}

window.addEventListener('load', ()=>{
  try{
    requireAuth();
  } catch(e){
    window.location.href = 'adminlogin.html';
  }
  initTabs();
  attachEvents();
  refreshPortfolioList();
  refreshBlogPosts();
});
