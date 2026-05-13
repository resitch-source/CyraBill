// CyraBill Frontend - CORS-Safe API Caller
const API_URL = 'https://script.google.com/macros/s/AKfycbxUJ2QP_0VbmbRMWDlD77bVzF5gHgv489oJsS3_b6D9OConuUpZMDi-9Fifn8DpLjeh/exec'; // ⬅️ REPLACE WITH YOUR DEPLOYED URL
let TOKEN = localStorage.getItem('cyra_token') || '';
let ROLE = localStorage.getItem('cyra_role') || '';

// ✅ ONLY SEND TOKEN IF IT EXISTS AND IS NON-EMPTY
async function apiCall(action, params = {}) {
  const urlParams = new URLSearchParams({ action });
  
  // 🔑 Only append token if it's valid and non-empty
  if (TOKEN && typeof TOKEN === 'string' && TOKEN.trim().length > 10) {
    urlParams.append('token', TOKEN.trim());
  }
  
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      urlParams.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  });
  
  const url = `${API_URL}?${urlParams.toString()}`;
  
  try {
    const response = await fetch(url, { 
      method: 'GET',
      cache: 'no-store',
      mode: 'cors'
    });
    
    const text = await response.text();
    if (!text.trim()) return { error: 'Empty response from server' };
    
    try {
      const data = JSON.parse(text);
      // Check for error field in body
      if (data.error) {
        console.warn('Server error:', data.error);
        return { error: data.error, hint: data.hint };
      }
      return data;
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', text.slice(0, 200));
      return { error: 'Invalid JSON response', raw: text.slice(0, 200) };
    }
  } catch (err) {
    console.error('Fetch error:', err);
    if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
      return { 
        error: 'CORS error: Check Apps Script deployment. Must be "Execute as: Me" + "Who has access: Anyone"',
        hint: 'Redeploy as New version'
      };
    }
    return { error: 'Network error: ' + err.message };
  }
}

// 🔐 Login Handler
document.getElementById('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.classList.add('loading'); btn.textContent = 'Signing in...';
  
  const result = await apiCall('login', {
    username: document.getElementById('username').value,
    pin: document.getElementById('pin').value
  });
  
  btn.classList.remove('loading'); btn.textContent = 'Sign In';
  
  if (result.token) {
    TOKEN = result.token; ROLE = result.role;
    localStorage.setItem('cyra_token', TOKEN);
    localStorage.setItem('cyra_role', ROLE);
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    loadTransactions(); loadAI();
    showToast('✅ Welcome to CyraBill');
  } else {
    showToast('❌ ' + (result.error || 'Login failed'));
  }
});

// 📥 Add Transaction
document.getElementById('addForm')?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.classList.add('loading'); btn.textContent = 'Adding...';
  
  const result = await apiCall('add', {
    type: document.getElementById('type').value,
    amount: parseFloat(document.getElementById('amount').value),
    description: document.getElementById('desc').value,
    category: document.getElementById('category').value || ''
  });
  
  btn.classList.remove('loading'); btn.textContent = 'Add Transaction';
  
  if (result.success) {
    showToast('✅ Added successfully');
    e.target.reset();
    if (result.category) document.getElementById('category').value = result.category;
    loadTransactions();
  } else {
    showToast('❌ ' + (result.error || 'Failed'));
  }
});

// 📊 Load Transactions
async function loadTransactions() {
  const result = await apiCall('list', { limit: 50 });
  if (result.error) { showToast('❌ ' + result.error); return; }
  
  const tbody = document.querySelector('#txTable tbody');
  if (!tbody) return;
  
  tbody.innerHTML = result.rows.map(r => `
    <tr>
      <td>${r.date || '-'}</td>
      <td><span class="badge ${r.type==='IN'?'in':'out'}">${r.type || '-'}</span></td>
      <td>₱${parseFloat(r.amount||0).toLocaleString()}</td>
      <td>${r.category || '-'}</td>
      <td>${r.status || '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">No transactions yet</td></tr>';
}

// 📈 Load AI Insights
async function loadAI() {
  const el = document.getElementById('aiStats');
  if (!el) return;
  el.textContent = 'Analyzing...';
  
  const result = await apiCall('list', { limit: 30 });
  if (result.error) { el.textContent = 'Error loading data'; return; }
  
  let inSum = 0, outSum = 0;
  result.rows.forEach(r => {
    const amt = parseFloat(r.amount) || 0;
    if (r.type === 'IN') inSum += amt; else outSum += amt;
  });
  
  const balance = inSum - outSum;
  el.innerHTML = `
    <p><strong>Current Balance:</strong> ₱${balance.toLocaleString(undefined, {minimumFractionDigits:2})}</p>
    <p><small>Last 30: IN ₱${inSum.toLocaleString()} | OUT ₱${outSum.toLocaleString()}</small></p>
    <p style="color:${balance>=0?'#10b981':'#ef4444'}"><strong>Trend:</strong> ${balance>=0?'📈 Positive':'📉 Negative'}</p>
  `;
}

// 💳 Initiate Checkout (PayMongo)
async function initCheckout(amount, source) {
  showToast('⏳ Preparing secure checkout...');
  
  const result = await apiCall('create_checkout', {
    amount: parseFloat(amount),
    source: source,
    success_url: window.location.origin,
    cancel_url: window.location.href
  });
  
  if (result.data?.attributes?.checkout_url) {
    showToast('✅ Redirecting to payment...');
    window.location.href = result.data.attributes.checkout_url;
  } else {
    showToast('❌ ' + (result.error?.message || result.error || 'Checkout failed'));
  }
}

// 🧪 Run AI Simulation
async function runSim() {
  const btn = document.querySelector('#simPanel button');
  const output = document.getElementById('simOutput');
  
  btn.textContent = '⏳ Running...'; btn.disabled = true;
  output.innerHTML = '<p>🔄 Generating synthetic data & running AI...</p>';
  
  const result = await apiCall('run_simulation', {
    days: document.getElementById('simDays').value,
    volume: document.getElementById('simVol').value,
    risk: document.getElementById('simRisk').value
  });
  
  btn.textContent = '▶ Run Simulation'; btn.disabled = false;
  
  if (result.success) {
    const m = result.metrics;
    const aiAcc = result.aiAccuracy || 0;
    output.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-top:8px">
        <div class="card" style="text-align:center;padding:8px"><small>Total TX</small><div style="font-size:1.3rem;font-weight:700">${m.total||0}</div></div>
        <div class="card" style="text-align:center;padding:8px"><small>AI Accuracy</small><div style="font-size:1.3rem;font-weight:700;color:${aiAcc>90?'#10b981':'#ef4444'}">${aiAcc}%</div></div>
        <div class="card" style="text-align:center;padding:8px"><small>AML Flags</small><div style="font-size:1.3rem;font-weight:700;color:${(m.flags||0)>0?'#ef4444':'#94a3b8'}">${m.flags||0}</div></div>
        <div class="card" style="text-align:center;padding:8px"><small>Net Drift</small><div style="font-size:1.1rem;font-weight:700">${(m.drift||0)>=0?'📈 +':'📉 '}₱${Math.round(m.drift||0).toLocaleString()}</div></div>
      </div>
    `;
    showToast('✅ Simulation complete');
  } else {
    output.innerHTML = `<p style="color:#ef4444">❌ ${result.error || 'Simulation failed'}</p>`;
  }
}

// 📤 Export Data
async function exportData(type) {
  showToast(`⏳ Generating ${type.toUpperCase()}...`);
  
  const result = await apiCall('export_csv');
  if (result.error) { showToast('❌ ' + result.error); return; }
  
  // Create download
  const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename || `cyra_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('✅ Exported successfully');
}

// 🔔 Toast Notifications
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = `CyraBill: ${msg}`;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3500);
}

// 🚪 Logout
function logout() {
  localStorage.clear();
  location.reload();
}

// 🔄 Auto-load if already logged in
if (TOKEN && ROLE) {
  document.getElementById('loginModal')?.classList.add('hidden');
  document.getElementById('mainApp')?.classList.remove('hidden');
  loadTransactions();
  loadAI();
}

// 📱 PWA Service Worker Registration (optional)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
