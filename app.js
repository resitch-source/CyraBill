const API_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL'; // ⬅️ REPLACE
let TOKEN = localStorage.getItem('cyra_token') || ''; let ROLE = localStorage.getItem('cyra_role') || '';

document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); const btn = e.target.querySelector('button'); btn.classList.add('loading'); btn.textContent = 'Signing in...';
  const res = await fetch(`${API_URL}?action=login`, { method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ username: document.getElementById('username').value, pin: document.getElementById('pin').value })});
  const data = await res.json(); btn.classList.remove('loading'); btn.textContent = 'Sign In';
  if(data.token){ TOKEN=data.token; ROLE=data.role; localStorage.setItem('cyra_token',TOKEN); localStorage.setItem('cyra_role',ROLE);
    document.getElementById('loginModal').classList.add('hidden'); document.getElementById('mainApp').classList.remove('hidden'); loadTransactions(); loadAI();
  } else showToast('❌ '+ (data.error||'Failed'));
});

document.getElementById('addForm').addEventListener('submit', async e => {
  e.preventDefault(); const btn = e.target.querySelector('button'); btn.classList.add('loading'); btn.textContent='Adding...';
  const res = await fetch(`${API_URL}?action=add&token=${TOKEN}`, { method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ type: document.getElementById('type').value, amount: parseFloat(document.getElementById('amount').value), description: document.getElementById('desc').value })});
  const data = await res.json(); btn.classList.remove('loading'); btn.textContent='Add';
  if(data.success){ showToast('✅ Added'); e.target.reset(); loadTransactions(); } else showToast('❌ '+ (data.error||'Failed'));
});

async function loadTransactions(){ const res = await fetch(`${API_URL}?action=list&limit=50&token=${TOKEN}`); const { rows } = await res.json();
  document.querySelector('#txTable tbody').innerHTML = rows.map(r=>`<tr><td>${r.date}</td><td><span class="badge ${r.type==='IN'?'in':'out'}">${r.type}</span></td><td>₱${r.amount}</td><td>${r.category}</td><td>${r.status}</td></tr>`).join(''); }

async function loadAI(){ const res = await fetch(`${API_URL}?action=list&limit=10&token=${TOKEN}`); const { rows } = await res.json();
  let inSum=0, outSum=0; rows.forEach(r=>r.type==='IN'?inSum+=r.amount:outSum+=r.amount);
  document.getElementById('aiStats').innerHTML=`<p><strong>Balance:</strong> ₱${(inSum-outSum).toFixed(2)}</p><p><small>Last 10: IN ₱${inSum} | OUT ₱${outSum}</small></p>`; }

async function initCheckout(amt, src){ showToast('⏳ Redirecting to secure checkout...');
  const res = await fetch(`${API_URL}?action=create_checkout&token=${TOKEN}`, { method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ amount: amt, source: src, success_url: window.location.origin, cancel_url: window.location.href })});
  const data = await res.json(); if(data.data?.attributes?.checkout_url) window.location.href = data.data.attributes.checkout_url; else showToast('❌ '+ (data.error?.message||'Failed')); }

async function runSim(){ const btn=document.querySelector('#simPanel button'); btn.textContent='⏳ Running...'; btn.disabled=true;
  const res = await fetch(`${API_URL}?action=run_simulation&token=${TOKEN}`, { method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ days: document.getElementById('simDays').value, volume: document.getElementById('simVol').value, risk: document.getElementById('simRisk').value })});
  const data = await res.json(); btn.textContent='▶ Run'; btn.disabled=false;
  if(data.success){ const m=data.metrics; document.getElementById('simOutput').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-top:8px;">
    <div class="card" style="text-align:center;padding:8px;"><small>Total</small><div style="font-size:1.3rem;font-weight:700;">${m.total}</div></div>
    <div class="card" style="text-align:center;padding:8px;"><small>AI Acc</small><div style="font-size:1.3rem;font-weight:700;color:#10b981;">${data.aiAccuracy}%</div></div>
    <div class="card" style="text-align:center;padding:8px;"><small>Flags</small><div style="font-size:1.3rem;font-weight:700;color:${m.flags>0?'#ef4444':'#94a3b8'};">${m.flags}</div></div></div>`; }
}

async function exportData(type){ showToast('⏳ Generating...'); const res = await fetch(`${API_URL}?action=export_csv&token=${TOKEN}`); const data = await res.json();
  const blob=new Blob([data.csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=data.filename; a.click(); showToast('✅ Exported'); }

function showToast(m){ const t=document.getElementById('toast'); t.textContent=`CyraBill: ${m}`; t.style.display='block'; setTimeout(()=>t.style.display='none',3000); }
function logout(){ localStorage.clear(); location.reload(); }
if(TOKEN && ROLE){ document.getElementById('loginModal').classList.add('hidden'); document.getElementById('mainApp').classList.remove('hidden'); }