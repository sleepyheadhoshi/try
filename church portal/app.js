// ===== 1. Fill these in (Supabase > Project Settings > API) =====
const SUPABASE_URL = 'https://zjmgfrgeeopqxcxvtljm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_U9LZ7mNy4v5I8w_IWYaTcQ_p89aK_WF';
const ADMIN_EMAIL = 'medelcabillion@gmail.com'; // the email of the admin user you create in Supabase Auth
// ================================================================
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let exporting = false, members = [], view = 'home', q = '', sort = 'az', sel = null, form = null, confirmDel = false, mode = 'login', authed = false;

const age = b => { if (!b) return ''; const d = new Date(b), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
const fmt = d => d ? new Date(d + 'T00:00').toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) : '—';
const ini = n => n.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const av = (m, c = '') => `<div class="av ${c}">${m.photo ? `<img src="${m.photo}" alt="">` : esc(ini(m.name))}</div>`;
const nextId = () => 'FGC-' + String(Math.max(0, ...members.map(m => parseInt(m.id.split('-')[1]) || 0)) + 1).padStart(3, '0');

// ---------- other records: Baby Dedication & Water Baptism ----------
const REC = {
  dedication: { table: 'baby_dedications', label: 'Baby Dedication', icon: '👶', nameKey: 'child_name', dateKey: 'dedication_date', prefix: 'BD', file: 'FGC-Baby-Dedications',
    fields: [['child_name', "Child's full name", 'text'], ['birthday', "Child's birthday", 'date'], ['gender', 'Gender', 'gender'], ['father', "Father's name", 'text'], ['mother', "Mother's name", 'text'],
      ['phone', 'Contact number', 'tel'], ['address', 'Address', 'text'], ['dedication_date', 'Date of dedication', 'date'], ['minister', 'Officiating pastor', 'text'], ['notes', 'Notes', 'text']] },
  baptism: { table: 'water_baptisms', label: 'Water Baptism', icon: '💧', nameKey: 'name', dateKey: 'baptism_date', prefix: 'WB', file: 'FGC-Water-Baptisms',
    fields: [['name', 'Full name', 'text'], ['birthday', 'Birthday', 'date'], ['gender', 'Gender', 'gender'], ['phone', 'Contact number', 'tel'], ['address', 'Address', 'text'],
      ['baptism_date', 'Date of baptism', 'date'], ['minister', 'Officiating pastor', 'text'], ['notes', 'Notes', 'text']] }
};
const recs = { dedication: [], baptism: [] }, rq = { dedication: '', baptism: '' }, rsort = { dedication: 'new', baptism: 'new' };
let rsel = null, rform = null, rconfirm = false, recErr = '';
async function loadRecs() {
  recErr = '';
  for (const k in REC) { const { data, error } = await sb.from(REC[k].table).select('*'); if (error) recErr = error.message + ' (run supabase-records.sql in Supabase first)'; else recs[k] = data; }
  if (authed && !form && !rform && !certM) render();
}
sb.channel('recs-live').on('postgres_changes', { event: '*', schema: 'public', table: 'baby_dedications' }, loadRecs)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'water_baptisms' }, loadRecs).subscribe();
const rNextId = k => REC[k].prefix + '-' + String(Math.max(0, ...recs[k].map(r => parseInt(r.id.split('-')[1]) || 0)) + 1).padStart(3, '0');
function rList(k) {
  const c = REC[k], n = c.nameKey, d = c.dateKey;
  const l = recs[k].filter(r => (r[n] || '').toLowerCase().includes(rq[k].toLowerCase()));
  const f = { az: (a, b) => a[n].localeCompare(b[n]), za: (a, b) => b[n].localeCompare(a[n]),
    new: (a, b) => (b[d] || '').localeCompare(a[d] || ''), old: (a, b) => (a[d] || '').localeCompare(b[d] || '') }[rsort[k]];
  return l.sort(f).map(r => `<div class="card m" data-rid="${esc(r.id)}"><div class="av">${esc(ini(String(r[n] || '')))}</div><div><h3>${esc(r[n])}</h3><small>${esc(r.id)} · ${fmt(r[d])}${r.minister ? ' · ' + esc(r.minister) : ''}</small></div></div>`).join('')
    || '<p class="c" style="color:var(--mut)">No records yet. Tap + to add one.</p>';
}
const recView = k => { const c = REC[k]; return `<h2>${c.label}</h2>${recErr ? `<p style="color:#e11d48;font-size:13px">${esc(recErr)}</p>` : ''}
  <input id="rq" placeholder="Search by name" value="${esc(rq[k])}"><label>Sort by</label>
  <select id="rsort"><option value="new">Newest first (date)</option><option value="old">Oldest first (date)</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select>
  <button class="btn alt" id="rword" style="width:100%;margin-top:10px">Export to Word (print)</button>
  <div style="height:12px"></div><div id="rlist">${rList(k)}</div><button class="btn fab" id="radd" aria-label="Add record">+</button>`; };
function recSheet(k) {
  const c = REC[k];
  if (rform) return `<h2>${rform.isNew ? 'Add' : 'Edit'} ${c.label}</h2>` + c.fields.map(([key, label, type]) => type === 'gender'
    ? `<label>${label}</label><select id="r_${key}"><option>Female</option><option>Male</option></select>`
    : `<label>${label}</label><input id="r_${key}" type="${type}" value="${esc(rform[key])}">`).join('')
    + `<p id="err" style="color:#e11d48;font-size:13px"></p><div class="row"><button class="btn ghost" id="rcancel">Cancel</button><button class="btn" id="rsave">Save</button></div>`;
  const r = recs[k].find(x => x.id === rsel); if (!r) { rsel = null; return ''; }
  return `<div class="c"><div class="av lg">${esc(ini(String(r[c.nameKey] || '')))}</div><h2 style="margin:0">${esc(r[c.nameKey])}</h2><small style="color:var(--mut)">${esc(r.id)}</small></div><div style="height:8px"></div>`
    + c.fields.slice(1).map(([key, label, type]) => `<div class="kv"><span>${label}</span><b>${esc(type === 'date' ? fmt(r[key]) : (r[key] || '—'))}</b></div>`).join('')
    + `<button class="btn" id="rcert" style="width:100%;margin-top:14px">Certificate of ${k === 'baptism' ? 'Baptism' : 'Dedication'}</button><div class="row" style="margin-top:14px"><button class="btn ghost" id="rclose">Close</button><button class="btn alt" id="redit">Edit</button><button class="btn del" id="rdel">${rconfirm ? 'Tap to confirm' : 'Remove'}</button></div>`;
}
function wordDoc(title, head, rows, file) {
  const td = v => `<td style="border:1px solid #999;padding:4px">${esc(v ?? '')}</td>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:1.5cm}div.Section1{page:Section1}
body{font-family:Calibri,Arial,sans-serif}h1{color:#087E9B;margin-bottom:0}table{border-collapse:collapse;width:100%;font-size:9pt}th{background:#14B8A6;color:#fff;border:1px solid #999;padding:5px;text-align:left}</style></head>
<body><div class="Section1"><h1>${esc(title)}</h1><p>Foursquare Gospel Church - Davao City · Printed ${new Date().toLocaleDateString()} · Total records: ${rows.length}</p>
<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(td).join('')}</tr>`).join('')}</tbody></table></div></body></html>`;
  const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }));
  const a = document.createElement('a'); a.href = url; a.download = file + '.doc';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportRecs(k) {
  const c = REC[k], l = [...recs[k]].sort((a, b) => (b[c.dateKey] || '').localeCompare(a[c.dateKey] || ''));
  wordDoc(c.label + ' Records', ['ID', ...c.fields.map(f => f[1])], l.map(r => [r.id, ...c.fields.map(([key, , type]) => type === 'date' ? fmt(r[key]) : r[key])]), c.file);
}

// ---------- data (Supabase) ----------
async function load() {
  const { data, error } = await sb.from('members').select('*');
  if (!error) { members = data; if (authed && !form && !rform && !certM) render(); }
}
sb.channel('members-live').on('postgres_changes', {event:'*', schema:'public', table:'members'}, load).subscribe();
const saveMember = m => sb.from('members').upsert(m);
const bcHtml = m => m.birth_cert ? `<div class="bc"><img src="${m.birth_cert}" alt="Birth certificate"><button class="btn ghost" id="bcdel" type="button">Remove</button></div>` : '<div class="bc empty">No birth certificate uploaded yet</div>';
const removeMember = id => sb.from('members').delete().eq('id', id);

function sorted() {
  const l = members.filter(m => m.name.toLowerCase().includes(q.toLowerCase()));
  const f = {az:(a,b)=>a.name.localeCompare(b.name), za:(a,b)=>b.name.localeCompare(a.name),
    old:(a,b)=>a.joined.localeCompare(b.joined), young:(a,b)=>b.birthday.localeCompare(a.birthday)}[sort];
  return l.sort(f);
}
const card = m => `<div class="card m" data-id="${m.id}">${av(m)}<div><h3>${esc(m.name)}</h3><small>${esc(m.id)} · ${age(m.birthday)} yrs</small></div><span class="tag ${m.status}">${m.status}</span></div>`;
const listHtml = () => sorted().map(card).join('') || '<p class="c" style="color:var(--mut)">No members found.</p>';

// Set to true once docs.js (certificate & covenant designs) is uploaded next to index.html
const SHOW_DOCS = true;

// small confirmation message at the bottom of the screen
function toast(t, pos) { const top = pos === 'top', d = document.createElement('div'); d.className = 'toast' + (top ? ' top' : ''); d.textContent = '✓ ' + t; document.body.appendChild(d); setTimeout(() => d.remove(), top ? 3300 : 2300); }

// welcome animation shown right after the admin signs in
let welcomeNext = false;
function welcome() {
  const d = document.createElement('div'); d.className = 'welcome';
  d.innerHTML = '<div class="w-card"><svg class="w-check" viewBox="0 0 52 52" aria-hidden="true"><circle class="w-ring" cx="26" cy="26" r="23"/><path class="w-tick" d="M15 27l8 8 15-17"/></svg><div class="w-title">Welcome back, Admin</div><div class="w-sub">You are now signed in</div></div>';
  document.body.appendChild(d);
  setTimeout(() => { d.classList.add('out'); const a = $('#app'); a.classList.add('enter'); setTimeout(() => a.classList.remove('enter'), 600); toast('Signed in as Admin', 'top'); }, 1800);
  setTimeout(() => d.remove(), 2300);
}

// goodbye animation shown when the admin logs out
function farewell() {
  const d = document.createElement('div'); d.className = 'welcome bye';
  d.innerHTML = '<div class="w-card"><svg class="w-check" viewBox="0 0 52 52" aria-hidden="true"><circle class="w-ring" cx="26" cy="26" r="23"/><path class="w-tick" pathLength="40" d="M22 16h-6v20h6M22 26h17M33 19l7 7-7 7"/></svg><div class="w-title">Goodbye, Admin</div><div class="w-sub">You have been signed out</div></div>';
  document.body.appendChild(d);
  setTimeout(() => d.classList.add('out'), 1700);
  setTimeout(() => d.remove(), 2200);
}

// ---------- auth screens ----------
function renderAuth() {
  $('#nav').classList.add('hide'); $('#sub').textContent = 'Administrator access only';
  const err = '<p id="msg" style="color:#e11d48;font-size:13px;min-height:18px"></p>';
  const logo = `<img class="auth-logo" src="${window.LOGO_SRC}" alt="Davao City Foursquare Gospel Church">`;
  if (mode === 'login') $('#app').innerHTML = `<div class="card" style="margin-top:24px">${logo}<h2 class="c auth-title">Admin Login</h2>
    <label>Username</label><input id="lu" autocomplete="username"><label>Password</label><input id="lp" type="password" autocomplete="current-password">${err}
    <button class="btn" id="login" style="width:100%">Log in</button><button class="btn ghost" id="fgt" style="width:100%;margin-top:8px">Forgot password?</button></div>`;
  if (mode === 'forgot') $('#app').innerHTML = `<div class="card" style="margin-top:24px">${logo}<h2 class="c auth-title">Forgot password</h2>
    <p style="font-size:14px;color:var(--mut)">We will email a reset link to the admin email address.</p>${err}
    <button class="btn" id="sendreset" style="width:100%">Send reset link</button><button class="btn ghost" id="back" style="width:100%;margin-top:8px">Back to login</button></div>`;
  if (mode === 'recovery') $('#app').innerHTML = `<div class="card" style="margin-top:24px">${logo}<h2 class="c auth-title">Set a new password</h2>
    <label>New password (min 6)</label><input id="np" type="password">${err}<button class="btn" id="setnew" style="width:100%">Save password</button></div>`;
}
let msgTimer;
const msg = (t, ok) => {
  const m = $('#msg') || $('#cpm'); if (!m) return;
  clearTimeout(msgTimer);
  m.style.transition = 'none'; m.style.opacity = 1;
  m.style.color = ok ? 'var(--deep)' : '#e11d48'; m.textContent = t;
  msgTimer = setTimeout(() => { m.style.transition = 'opacity 1.2s ease'; m.style.opacity = 0; }, 3500); // stays 3.5s, then fades slowly
};

// ---------- main render ----------
function render() {
  document.body.classList.toggle('show-wm', !!authed && view === 'home' && !pubToken);
  if (pubToken) return renderPublicCert();
  if (!authed) return renderAuth();
  $('#sub').innerHTML = `Welcome, Admin · ${members.length} members · <span class="sync"><span class="cloud">☁️</span><i class="pulse"></i>Connected &amp; synced</span>`;
  $('#nav').classList.remove('hide');
  const NAV_ICON = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    members: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 13.7c2.7.2 4.5 2 4.5 4.8"/>',
    dedication: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
    baptism: '<path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5z"/>',
    profile: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'
  };
  $('#nav').innerHTML = [['home','Home'],['members','Membership'],['dedication','Dedication'],['baptism','Baptism'],['profile','Profile'],['settings','Settings']]
    .map(([k,l]) => `<button data-v="${k}" class="${view===k?'on':''}"><span class="ni"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAV_ICON[k]}</svg></span>${l}</button>`).join('');
  let h = '';
  if (view === 'home') {
    const a = members.filter(m => m.status === 'Active').length;
    const avg = members.length ? Math.round(members.reduce((s, m) => s + age(m.birthday), 0) / members.length) : 0;
    h = `<div class="stats"><div class="card stat"><b>${members.length}</b><span>Total members</span></div><div class="card stat"><b>${a}</b><span>Active</span></div>
      <div class="card stat"><b>${members.length - a}</b><span>Inactive / visitors</span></div><div class="card stat"><b>${avg}</b><span>Average age</span></div>
      <div class="card stat"><b>${recs.dedication.length}</b><span>Baby dedications</span></div><div class="card stat"><b>${recs.baptism.length}</b><span>Water baptisms</span></div></div>
      <h2>Newest members</h2>${[...members].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 3).map(card).join('')}`;
  }
  if (view === 'members') h = `<input id="q" placeholder="Search members by name" value="${esc(q)}"><label>Sort by</label>
    <select id="sort"><option value="az">Name A–Z</option><option value="za">Name Z–A</option><option value="old">Oldest to newest (date joined)</option><option value="young">Youngest to oldest (age)</option></select>
    <button class="btn alt" id="word" style="width:100%;margin-top:10px">Export to Word (print)</button><div style="height:12px"></div><div id="list">${listHtml()}</div><button class="btn fab" id="add" aria-label="Add member">+</button>`;
  if (view === 'profile') h = `<div class="card c"><div class="av lg">AD</div><h2>Admin</h2><small style="color:var(--mut)">${esc(ADMIN_EMAIL)}</small></div><button class="btn del" id="logout" style="width:100%">Log out</button>`;
  if (view === 'settings') h = `<div class="card"><h2>Change password</h2><label>Current password</label><input id="cp0" type="password">
    <label>New password (min 6)</label><input id="cp1" type="password"><label>Confirm new password</label><input id="cp2" type="password">
    <p id="cpm" style="font-size:13px;min-height:18px"></p><button class="btn" id="chg" style="width:100%">Update password</button></div>
    <div class="card"><button class="btn" id="word" style="width:100%">Export all members to Word (print)</button><div style="height:8px"></div><button class="btn alt" id="exp" style="width:100%">Download members (JSON)</button></div>`;
  if (REC[view]) h = recView(view);
  $('#app').innerHTML = h;
  if (view === 'members') $('#sort').value = sort;
  if (REC[view]) $('#rsort').value = rsort[view];
  renderSheet();
}

function renderSheet() {
  const old = $('#sheet'); if (old) old.remove(); let c = '';
  if (certM) c = certSheet();
  else if (REC[view] && (rform || rsel)) c = recSheet(view);
  else if (form) { const m = form;
    c = `<h2>${m.isNew ? 'Add member' : 'Edit member'}</h2><div class="c"><div id="ph">${av(m, 'lg')}</div><input type="file" id="photo" accept="image/*"></div>
    <label>Full name</label><input id="f_name" value="${esc(m.name)}">
    <div class="row"><div><label>Birthday</label><input type="date" id="f_birthday" value="${m.birthday}"></div><div><label>Gender</label><select id="f_gender"><option>Female</option><option>Male</option></select></div></div>
    <label>Contact number</label><input id="f_phone" type="tel" value="${esc(m.phone)}"><label>Address</label><input id="f_address" value="${esc(m.address)}">
    <div class="row"><div><label>Date joined</label><input type="date" id="f_joined" value="${m.joined}"></div><div><label>Status</label><select id="f_status"><option>Active</option><option>Inactive</option><option>Visitor</option></select></div></div>
    <label>Birth certificate (photo)</label><div id="bcp">${bcHtml(m)}</div><input type="file" id="birthcert" accept="image/*">
    <p id="err" style="color:#e11d48;font-size:13px"></p><div class="row"><button class="btn ghost" id="cancel">Cancel</button><button class="btn" id="saveb">Save</button></div>`;
  } else if (sel) { const m = members.find(x => x.id === sel); if (!m) { sel = null; return; }
    c = `<div class="c">${av(m, 'lg')}<h2 style="margin:0">${esc(m.name)}</h2><span class="tag ${m.status}" style="margin:6px 0 10px;display:inline-block">${m.status}</span></div>
    ${[['Member ID', m.id], ['Birthday', fmt(m.birthday) + ' (' + age(m.birthday) + ' yrs)'], ['Gender', m.gender], ['Contact', m.phone || '—'], ['Address', m.address || '—'], ['Date joined', fmt(m.joined)]]
      .map(r => `<div class="kv"><span>${r[0]}</span><b>${esc(r[1])}</b></div>`).join('')}
    ${m.birth_cert ? `<div class="kv"><span>Birth certificate</span><b><button class="btn ghost" id="bcview" type="button" style="padding:6px 12px">📄 View</button></b></div>` : ''}
    ${SHOW_DOCS ? `<div class="row" style="margin-top:14px"><button class="btn" id="cert">Certificate</button><button class="btn" id="cov">Covenant</button></div>` : ''}<div class="row" style="margin-top:14px"><button class="btn ghost" id="close">Close</button><button class="btn alt" id="edit">Edit</button><button class="btn del" id="del">${confirmDel ? 'Tap to confirm' : 'Remove'}</button></div>`; }
  if (!c) { if (old) { const g = old.cloneNode(true); g.removeAttribute('id'); g.classList.add('closing'); document.body.appendChild(g); setTimeout(() => g.remove(), 220); } return; }
  const d = document.createElement('div'); d.className = 'sheet' + (old ? ' still' : ''); d.id = 'sheet'; d.innerHTML = '<div>' + c + '</div>'; document.body.appendChild(d);
  if (form) { $('#f_gender').value = form.gender; $('#f_status').value = form.status; }
  if (certM) drawCert($('#certc'), { ...certM }, certKind);
  if (rform && REC[view]) REC[view].fields.forEach(([key, , type]) => { if (type === 'gender') $('#r_' + key).value = rform[key] || 'Female'; });
}

function exportWord() {
  const list = [...members].sort((a, b) => a.name.localeCompare(b.name));
  const td = v => `<td style="border:1px solid #999;padding:4px">${esc(v)}</td>`;
  const rows = list.map(m => `<tr>${[m.id, m.name, fmt(m.birthday), age(m.birthday), m.gender, m.phone, m.address, fmt(m.joined), m.status].map(td).join('')}</tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>FGC Members</title>
<style>@page Section1{size:841.9pt 595.3pt;mso-page-orientation:landscape;margin:1.5cm}div.Section1{page:Section1}
body{font-family:Calibri,Arial,sans-serif}h1{color:#087E9B}table{border-collapse:collapse;width:100%;font-size:10pt}th{background:#14B8A6;color:#fff;border:1px solid #999;padding:5px;text-align:left}</style></head>
<body><div class="Section1"><h1>FGC Membership List</h1><p>Printed ${new Date().toLocaleDateString()} · Total members: ${list.length}</p>
<table><thead><tr><th>ID</th><th>Name</th><th>Birthday</th><th>Age</th><th>Gender</th><th>Contact</th><th>Address</th><th>Date joined</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
  const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/msword' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'FGC-Members.doc';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// ---------- membership certificate & covenant ----------
// The two designs are copied from the church's Word files and live in docs.js (pictures in assets/, fonts in fonts/).
// Both are drawn from the same member data (name + date joined) and share one share-link token:
//   certificate link: ?cert=TOKEN        covenant link: ?cert=TOKEN&doc=cov
let certM = null, certKind = 'cert';
const DOCS = { ded: { title: 'Certificate of Dedication', file: 'Dedication-Certificate' }, bapt: { title: 'Certificate of Baptism', file: 'Baptism-Certificate' }, cert: { title: 'Membership Certificate', file: 'Membership-Certificate' }, cov: { title: 'Membership Covenant', file: 'Membership-Covenant' } };
const pubToken = new URLSearchParams(location.search).get('cert');
const pubKind = new URLSearchParams(location.search).get('doc') === 'cov' ? 'cov' : 'cert';
let pubCert = pubToken ? 'loading' : null;
if (pubToken) sb.rpc('get_certificate', { p_token: pubToken }).then(({ data }) => {
  const r = data && data[0]; pubCert = r ? { name: r.out_name, id: r.out_member_id, joined: r.out_joined } : null; render(); });
const drawCert = (cv, d, kind) => {
  const fail = e => { if (cv) cv.insertAdjacentHTML('afterend', '<p style="color:#e11d48;font-size:13px">Could not draw: ' + esc(e.message) + '</p>'); };
  // docs.js is big, so it loads in the background: wait for it (up to 20 s) instead of failing right away
  return new Promise(res => { const t0 = Date.now(); (function w() { if (window.FGCDocs || Date.now() - t0 > 20000) res(); else setTimeout(w, 100); })(); })
    .then(() => { if (!window.FGCDocs) throw new Error('docs.js was not loaded (check that docs.js is next to index.html)'); return FGCDocs.draw(cv, kind || 'cert', d); })
    .catch(fail);
};
const curCert = () => certM ? { ...certM } : pubCert;
const curKind = () => certM ? certKind : pubKind;
function downloadCert() { const d = curCert(); $('#certc').toBlob(b => { const u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = DOCS[curKind()].file + '-' + d.name.replace(/\s+/g, '-') + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); }); }
function printCert() { const w = window.open('', '_blank'); if (!w) return;
  w.document.write(`<html><head><title>${DOCS[curKind()].title}</title><style>@page{size:11in 8.5in;margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${$('#certc').toDataURL('image/png')}"></body></html>`);
  w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 500); }
const certSheet = () => `<h2>${DOCS[certKind].title}</h2><canvas id="certc" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff"></canvas>
  <div class="row" style="margin-top:12px"><button class="btn" id="certdl">Download</button><button class="btn alt" id="certpr">Print</button></div>
  ${certKind === 'bapt' || certKind === 'ded' ? '' : '<button class="btn alt" id="certsh" style="width:100%;margin-top:8px">Create share link</button>'}
  <div id="certmsg" style="font-size:13px;color:var(--mut);margin:8px 0"></div><button class="btn ghost" id="certx" style="width:100%">Back</button>`;
function renderPublicCert() {
  $('#nav').classList.add('hide'); $('#sub').textContent = DOCS[pubKind].title;
  if (pubCert === 'loading') $('#app').innerHTML = '<p class="c" style="color:var(--mut)">Loading certificate…</p>';
  else if (!pubCert) $('#app').innerHTML = '<div class="card c"><h2>Certificate not found</h2><p style="color:var(--mut)">This link is invalid or is no longer available.</p></div>';
  else { $('#app').innerHTML = `<canvas id="certc" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff"></canvas>
    <div class="row" style="margin-top:12px"><button class="btn" id="certdl">Download</button><button class="btn alt" id="certpr">Print</button></div>`; drawCert($('#certc'), pubCert, pubKind); }
}
document.addEventListener('click', async e => {
  const t = e.target, id = t.id;
  if (id === 'cert' || id === 'cov') { certM = members.find(x => x.id === sel); certKind = id; renderSheet(); }
  if (id === 'rcert') { const k = view, c = REC[k], r = recs[k] && recs[k].find(x => x.id === rsel); if (r) { certM = { name: r[c.nameKey], id: r.id, joined: r[c.dateKey], birthday: r.birthday, minister: r.minister }; certKind = k === 'baptism' ? 'bapt' : 'ded'; renderSheet(); } }
  if (id === 'certx') { certM = null; renderSheet(); }
  if (id === 'certdl') downloadCert();
  if (id === 'certpr') printCert();
  if (id === 'certsh') { const out = $('#certmsg'); t.disabled = true; out.textContent = 'Creating link…';
    const row = { member_id: certM.id, name: certM.name, date_joined: certM.joined };
    const old = await sb.from('certificates').select('token').eq('member_id', certM.id).order('created_at', { ascending: false }).limit(1);
    let token = old.data && old.data[0] && old.data[0].token, err = old.error;
    if (token) { const u = await sb.from('certificates').update({ name: row.name, date_joined: row.date_joined }).eq('token', token); err = u.error; }
    else if (!err) { const r = await sb.from('certificates').insert(row).select('token').single(); err = r.error; token = r.data && r.data.token; }
    t.disabled = false;
    if (err || !token) { out.style.color = '#e11d48'; out.textContent = (err && err.message) || 'Could not create the link.'; return; }
    const link = location.origin + location.pathname + '?cert=' + token + (certKind === 'cov' ? '&doc=cov' : '');
    try { await navigator.clipboard.writeText(link); } catch (x) {}
    out.style.color = 'var(--deep)'; out.innerHTML = 'Link copied. Send it to the member:<input readonly value="' + link + '" onclick="this.select()" style="margin-top:6px;font-size:13px">'; }
});

// ---------- smooth page switch ----------
let goTimer;
function go(v) {
  if (v === view && !sel && !form) return;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  const app = $('#app'); clearTimeout(goTimer);
  app.classList.remove('enter'); app.classList.add('leave');
  goTimer = setTimeout(() => {
    view = v; sel = form = rsel = rform = certM = null; render(); scrollTo(0, 0);
    app.classList.remove('leave'); app.classList.add('enter');
    goTimer = setTimeout(() => app.classList.remove('enter'), 400);
  }, 160);
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const t = e.target, id = t.id;
  const nv = t.closest('[data-v]'); if (nv) { go(nv.dataset.v); return; }
  const cd = t.closest('.m[data-id]'); if (cd) { sel = cd.dataset.id; confirmDel = false; renderSheet(); return; }
  if (id === 'sheet' || id === 'close' || id === 'rclose') { sel = form = rsel = rform = certM = null; rconfirm = false; confirmDel = false; renderSheet(); }
  if (id === 'login') {
    if ($('#lu').value.trim() !== 'Admin') return msg('Incorrect username or password.');
    welcomeNext = true;
    const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: $('#lp').value });
    if (error) { welcomeNext = false; msg(error.message === 'Invalid login credentials' ? 'Incorrect username or password.' : error.message); }
  }
  if (id === 'fgt') { mode = 'forgot'; render(); }
  if (id === 'back') { mode = 'login'; render(); }
  if (id === 'sendreset') { const { error } = await sb.auth.resetPasswordForEmail(ADMIN_EMAIL, { redirectTo: location.href.split('#')[0] }); msg(error ? error.message : 'Reset link sent. Check the admin email.', !error); }
  if (id === 'setnew') { const p = $('#np').value; if (p.length < 6) return msg('Password must be at least 6 characters.');
    const { error } = await sb.auth.updateUser({ password: p }); if (error) return msg(error.message); mode = 'login'; authed = true; await load(); render(); }
  if (id === 'logout') { farewell(); authed = false; mode = 'login'; members = []; view = 'home'; history.replaceState(null, '', location.pathname); render(); sb.auth.signOut(); }
  if (id === 'chg') { const n = $('#cp1').value;
    if (n.length < 6) return msg('New password must be at least 6 characters.');
    if (n !== $('#cp2').value) return msg('New passwords do not match.');
    const ok = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: $('#cp0').value });
    if (ok.error) return msg('Current password is incorrect.');
    const { error } = await sb.auth.updateUser({ password: n });
    if (error) return msg(error.message);
    ['cp0', 'cp1', 'cp2'].forEach(i => $('#' + i).value = ''); msg('Password updated.', true); }
  if (id === 'add') form = { isNew: true, id: nextId(), name: '', birthday: '', gender: 'Female', phone: '', address: '', joined: new Date().toISOString().slice(0, 10), status: 'Active', photo: '' }, renderSheet();
  if (id === 'edit') { form = { ...members.find(x => x.id === sel) }; sel = null; renderSheet(); }
  if (id === 'cancel') { form = null; renderSheet(); }
  if (id === 'del') { if (!confirmDel) { confirmDel = true; t.textContent = 'Tap to confirm'; return; } await removeMember(sel); sel = null; confirmDel = false; await load(); render(); toast('Member removed'); }
  if (id === 'saveb') { const g = i => $('#f_' + i).value.trim(), er = $('#err');
    if (!g('name')) return er.textContent = 'Please enter a name.'; if (!g('birthday')) return er.textContent = 'Please enter a birthday.';
    const m = { ...form, name: g('name'), birthday: g('birthday'), gender: g('gender'), phone: g('phone'), address: g('address'), joined: g('joined'), status: g('status') }; delete m.isNew;
    if (!m.birth_cert && !('birth_cert' in (members.find(x => x.id === m.id) || {}))) delete m.birth_cert;
    const { error } = await saveMember(m); if (error) return er.textContent = /birth_cert/.test(error.message) ? 'Birth certificate column is missing in Supabase. Run the SQL: alter table public.members add column birth_cert text;' : error.message; form = null; await load(); render(); toast('Member saved'); }
  if (id === 'word' && !exporting) { exporting = true; exportWord(); setTimeout(() => exporting = false, 1500); }
  if (id === 'exp') { const a = document.createElement('a'); a.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(members.map(({ birth_cert, ...r }) => r), null, 2)); a.download = 'fgc-members.json'; a.click(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && $('#login')) $('#login').click(); });
document.addEventListener('input', e => { if (e.target.id === 'q') { q = e.target.value; $('#list').innerHTML = listHtml(); } });
document.addEventListener('change', e => { const t = e.target;
  if (t.id === 'sort') { sort = t.value; $('#list').innerHTML = listHtml(); }
  if (t.id === 'photo' && t.files[0]) { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'), s = Math.min(1, 160 / Math.max(im.width, im.height)); c.width = im.width * s; c.height = im.height * s;
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); form.photo = c.toDataURL('image/jpeg', .8); $('#ph').innerHTML = av(form, 'lg'); }; im.src = r.result; }; r.readAsDataURL(t.files[0]); }
  if (t.id === 'birthcert' && t.files[0]) { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'), k = Math.min(1, 900 / Math.max(im.width, im.height)); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    form.birth_cert = c.toDataURL('image/jpeg', .65); $('#bcp').innerHTML = bcHtml(form); };
    im.onerror = () => { $('#err').textContent = 'That file is not a picture. Please choose a photo (JPG or PNG).'; }; im.src = r.result; }; r.readAsDataURL(t.files[0]); } });

// ---------- birth certificate view / remove ----------
document.addEventListener('click', e => { const t = e.target;
  if (t.id === 'bcdel' && form) { form.birth_cert = ''; $('#bcp').innerHTML = bcHtml(form); }
  if (t.id === 'bcview') { const m = members.find(x => x.id === sel); if (m && m.birth_cert) { const d = document.createElement('div'); d.className = 'sheet bcview'; d.style.alignItems = 'center';
    d.innerHTML = `<div style="border-radius:16px;max-width:92%;width:auto;padding:10px"><img src="${m.birth_cert}" alt="Birth certificate" style="width:100%;max-height:75vh;object-fit:contain;border-radius:10px;display:block;background:#fff"><button class="btn" id="bcclose" style="width:100%;margin-top:10px">Close</button></div>`; document.body.appendChild(d); } }
  if (t.id === 'bcclose') document.querySelector('.bcview')?.remove();
});

// ---------- records events ----------
document.addEventListener('click', async e => {
  const t = e.target, id = t.id, k = view, c = REC[k];
  const cd = t.closest('.m[data-rid]'); if (cd) { rsel = cd.dataset.rid; rconfirm = false; renderSheet(); return; }
  if (!c) return;
  if (id === 'radd') { rform = { isNew: true, id: rNextId(k), [c.dateKey]: new Date().toISOString().slice(0, 10) }; renderSheet(); }
  if (id === 'redit') { rform = { ...recs[k].find(r => r.id === rsel) }; rsel = null; renderSheet(); }
  if (id === 'rcancel') { rform = null; renderSheet(); }
  if (id === 'rdel') { if (!rconfirm) { rconfirm = true; t.textContent = 'Tap to confirm'; return; }
    await sb.from(c.table).delete().eq('id', rsel); rsel = null; rconfirm = false; await loadRecs(); render(); toast('Record removed'); }
  if (id === 'rsave') { const r = { ...rform }, er = $('#err'); delete r.isNew;
    c.fields.forEach(([key, , type]) => { const v = $('#r_' + key).value.trim(); r[key] = type === 'date' ? (v || null) : v; });
    if (!r[c.nameKey]) return er.textContent = 'Please enter a name.';
    if (!r[c.dateKey]) return er.textContent = 'Please enter the date.';
    const { error } = await sb.from(c.table).upsert(r); if (error) return er.textContent = error.message;
    rform = null; await loadRecs(); render(); toast('Record saved'); }
  if (id === 'rword' && !exporting) { exporting = true; exportRecs(k); setTimeout(() => exporting = false, 1500); }
});
document.addEventListener('input', e => { if (e.target.id === 'rq') { rq[view] = e.target.value; $('#rlist').innerHTML = rList(view); } });
document.addEventListener('change', e => { if (e.target.id === 'rsort') { rsort[view] = e.target.value; $('#rlist').innerHTML = rList(view); } });

// ---------- start ----------
sb.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') { authed = false; mode = 'recovery'; render(); return; }
  const was = authed;
  authed = !!session && mode !== 'recovery';
  if (authed) { if (!was) view = 'home'; setTimeout(() => { load(); loadRecs(); }, 0); }
  else { members = []; if (event === 'SIGNED_OUT') mode = 'login'; }
  render();
  if (authed && !was) { if (welcomeNext) { welcomeNext = false; welcome(); } else toast("You're already signed in", 'top'); }
});
render();

// ---------- press ripple ----------
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest('.btn, nav button, .m'); if (!el || el.disabled) return;
  const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2, s = document.createElement('span'); s.className = 'rip';
  s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  el.appendChild(s); s.addEventListener('animationend', () => s.remove());
});