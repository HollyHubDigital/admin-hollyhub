// Admin Dashboard - COMPLETE VERSION
if (typeof ADMIN_INITIALIZED !== 'undefined') {
  console.log('[Admin] Script already loaded, skipping re-initialization');
} else {
  window.ADMIN_INITIALIZED = true;
const API = {
  token() { return localStorage.getItem('adminToken') || ''; },
  headers(json=true){ return { 'Authorization': 'Bearer ' + API.token(), ...(json? {'Content-Type':'application/json'}:{}) };// Admin Dashboard - COMPLETE VERSION
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
      // inject preview iframe area
      setTimeout(()=>{
        const preview = document.getElementById('pagePreviewArea');
        if(preview){
          preview.innerHTML = '<iframe id="pagePreviewFrame" src="/" style="width:100%;height:420px;border:1px solid rgba(255,255,255,0.06);border-radius:8px"></iframe>';
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
    const r = await fetch('/api/pages/sections/save', { method:'PUT', headers: API.headers(), body: JSON.stringify(payload) });
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
  const addToRecent = document.getElementById('pfAdd
} // End of ADMIN_INITIALIZED guard
