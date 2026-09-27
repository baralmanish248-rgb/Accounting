/* ===========================
   GharKhata — App Logic with Auth
   =========================== */

// ─── State ────────────────────────────────────────────────────
const state = {
  transactions: [],
  members: [],
  viewMonth: new Date(),
  reportMonth: new Date(),
  selectedTxType: 'expense',
  pendingDeleteId: null,
  currentUser: null, // { email, name, householdId }
  households: {} // { householdId: { members: [], transactions: [] } }
};

// ─── Persistence ──────────────────────────────────────────────
function save() {
  if (!state.currentUser) return;
  // Sync current state arrays back to households map before saving
  state.households[state.currentUser.householdId] = {
    members: state.members,
    transactions: state.transactions
  };
  localStorage.setItem('ghk_households', JSON.stringify(state.households));
}

function load() {
  try {
    state.households = JSON.parse(localStorage.getItem('ghk_households') || '{}');
    state.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

    if (state.currentUser) {
      updateHouseholdState();
      document.getElementById('authContainer').classList.add('hidden');
      document.getElementById('appContainer').classList.remove('hidden');
    } else {
      document.getElementById('authContainer').classList.remove('hidden');
      document.getElementById('appContainer').classList.add('hidden');
    }
  } catch(e) { console.error(e); }
}

function updateHouseholdState() {
  if (!state.currentUser) return;
  const hh = state.households[state.currentUser.householdId];
  if (hh) {
    state.transactions = hh.transactions || [];
    state.members = hh.members || [];
  } else {
    // New household default seeding
    state.members = [
      { id: uid(), name: state.currentUser.name, role: 'Parent', color: '#3B5998' }
    ];
    state.transactions = [];

    // Seed some mock transactions to make it look full initially
    const today = new Date();
    const m = today.getMonth(), y = today.getFullYear();
    const me = state.members[0].id;
    state.transactions = [
      { id: uid(), type:'income',  category:'Salary',      amount:45000, note:'Monthly salary',    date:fmt(new Date(y,m,1)),  memberId:me },
      { id: uid(), type:'expense', category:'Rent',        amount:12000, note:'House rent',         date:fmt(new Date(y,m,2)),  memberId:me },
      { id: uid(), type:'expense', category:'Groceries',   amount:3200,  note:'Big Bazaar',         date:fmt(new Date(y,m,5)),  memberId:me },
      { id: uid(), type:'expense', category:'Utilities',   amount:1850,  note:'Electricity bill',   date:fmt(new Date(y,m,8)),  memberId:me }
    ];

    state.households[state.currentUser.householdId] = {
      members: state.members,
      transactions: state.transactions
    };
    save();
  }
}

// ─── Auth ────────────────────────────────────────────────────
function login(email, password) {
  const users = JSON.parse(localStorage.getItem('ghk_users') || '{}');
  if (users[email] && users[email].password === password) {
    state.currentUser = { email, name: users[email].name, householdId: users[email].householdId };
    localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
    load();
    navigate('dashboard');
    showToast(`Welcome back, ${state.currentUser.name}!`);
  } else {
    showToast('Invalid email or password', 'error');
  }
}

function signup(name, email, password) {
  const users = JSON.parse(localStorage.getItem('ghk_users') || '{}');
  if (users[email]) {
    showToast('User already exists', 'error');
    return;
  }
  const householdId = uid();
  users[email] = { name, password, householdId };
  localStorage.setItem('ghk_users', JSON.stringify(users));
  login(email, password);
}

function requestOTP(email) {
  const users = JSON.parse(localStorage.getItem('ghk_users') || '{}');
  if (!users[email]) {
    showToast('Email not found', 'error');
    return;
  }
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  sessionStorage.setItem('tempOTP', otp);
  sessionStorage.setItem('tempEmail', email);
  console.log('Simulated OTP sent to', email, ':', otp);
  showToast('OTP sent to ' + email);
  document.getElementById('forgotPasswordCard').classList.add('hidden');
  document.getElementById('otpCard').classList.remove('hidden');
}

function verifyOTP(code) {
  const storedOTP = sessionStorage.getItem('tempOTP');
  if (code === storedOTP) {
    showToast('OTP Verified!');
    document.getElementById('otpCard').classList.add('hidden');
    document.getElementById('resetPasswordCard').classList.remove('hidden');
  } else {
    showToast('Invalid OTP', 'error');
  }
}

function resetPassword(email, newPassword) {
  const users = JSON.parse(localStorage.getItem('ghk_users') || '{}');
  if (users[email]) {
    users[email].password = newPassword;
    localStorage.setItem('ghk_users', JSON.stringify(users));
    showToast('Password reset successful');
    document.getElementById('resetPasswordCard').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
  }
}

function logout() {
  localStorage.removeItem('currentUser');
  location.reload();
}

function joinHousehold(code) {
  state.households = JSON.parse(localStorage.getItem('ghk_households') || '{}');
  if (!state.households[code]) {
    showToast('Invalid invite code', 'error');
    return;
  }
  state.currentUser.householdId = code;
  localStorage.setItem('currentUser', JSON.stringify(state.currentUser));
  const users = JSON.parse(localStorage.getItem('ghk_users') || '{}');
  if (users[state.currentUser.email]) {
    users[state.currentUser.email].householdId = code;
    localStorage.setItem('ghk_users', JSON.stringify(users));
  }
  updateHouseholdState();
  renderFamily();
  showToast('Joined household successfully!');
}

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function fmt(d) { return d.toISOString().slice(0,10); }

// ─── Formatters & Utilities ───────────────────────────────────
function formatINR(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function monthLabel(date) { return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }); }
function sameMonth(date, ref) {
  const d = new Date(date + 'T00:00:00');
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}
function groupByDate(txs) {
  const groups = {};
  txs.forEach(tx => {
    const d = new Date(tx.date + 'T00:00:00');
    const label = d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });
    if (!groups[tx.date]) groups[tx.date] = { label, items: [] };
    groups[tx.date].items.push(tx);
  });
  return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
}
function memberById(id) { return state.members.find(m => m.id === id); }

const categoryEmoji = {
  Groceries:'🛒', Rent:'🏠', Utilities:'💡', Transport:'🚗',
  'Food & Dining':'🍽️', Shopping:'🛍️', Healthcare:'💊', Education:'📚',
  Entertainment:'🎬', Bills:'📄', 'Other Expense':'📦',
  Salary:'💼', Freelance:'💻', Business:'📊', Investment:'📈',
  Gift:'🎁', 'Other Income':'💰'
};
function txEmoji(cat) { return categoryEmoji[cat] || '💰'; }

// ─── Render tx rows ───────────────────────────────────────────
function renderTxList(container, txs, limit) {
  container.innerHTML = '';
  const sorted = [...txs].sort((a,b) => b.date.localeCompare(a.date));
  const shown = limit ? sorted.slice(0, limit) : sorted;

  if (!shown.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No transactions yet</p></div>`;
    return;
  }

  const groups = groupByDate(shown);
  groups.forEach(([, group]) => {
    const label = document.createElement('div');
    label.className = 'tx-group-date';
    label.textContent = group.label;
    container.appendChild(label);

    group.items.forEach(tx => {
      const member = memberById(tx.memberId);
      const row = document.createElement('div');
      row.className = 'tx-row';
      row.innerHTML = `
        <div class="tx-icon ${tx.type === 'income' ? 'income-icon' : 'expense-icon'}">${txEmoji(tx.category)}</div>
        <div class="tx-info">
          <div class="tx-category">${tx.category}</div>
          ${tx.note ? `<div class="tx-note">${tx.note}</div>` : ''}
        </div>
        ${member ? `<span class="tx-member-chip" style="background:${member.color}">${member.name[0]}</span>` : ''}
        <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatINR(tx.amount)}</span>
        <button class="tx-delete" data-id="${tx.id}" aria-label="Delete transaction">×</button>
      `;
      container.appendChild(row);
    });
  });

  container.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

function calcSummary(txs) {
  const income = txs.filter(t => t.type === 'income').reduce((s,t) => s + +t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s,t) => s + +t.amount, 0);
  return { income, expense, balance: income - expense };
}

function categorySummary(txs, type) {
  const map = {};
  txs.filter(t => t.type === type).forEach(t => {
    map[t.category] = (map[t.category] || 0) + +t.amount;
  });
  return Object.entries(map).sort((a,b) => b[1] - a[1]);
}

function renderCategorySummary(container, cats, total) {
  container.innerHTML = '';
  if (!cats.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data yet</p></div>';
    return;
  }
  cats.slice(0,6).forEach(([name, val]) => {
    const pct = total ? Math.round(val / total * 100) : 0;
    const row = document.createElement('div');
    row.className = 'cat-row';
    row.innerHTML = `
      <div class="cat-label-row">
        <span class="cat-label">${txEmoji(name)} ${name}</span>
        <span class="cat-value">${formatINR(val)} <small>${pct}%</small></span>
      </div>
      <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%"></div></div>
    `;
    container.appendChild(row);
  });
}

// ─── Navigation ────────────────────────────────────────────────
function navigate(page) {
  if (!state.currentUser) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mob-nav-btn').forEach(n => n.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  document.querySelectorAll(`[data-page="${page}"]`).forEach(el => el.classList.add('active'));

  switch(page) {
    case 'dashboard':   renderDashboard(); break;
    case 'transactions': renderTransactions(); break;
    case 'family':      renderFamily(); break;
    case 'add':         setupAddForm(); break;
    case 'scan':        setupScanPage(); break;
    case 'reports':     renderReports(); break;
  }
  window.scrollTo(0, 0);
}

// ─── Dashboard ─────────────────────────────────────────────────
function renderDashboard() {
  const monthTxs = state.transactions.filter(tx => sameMonth(tx.date, state.viewMonth));
  const { income, expense, balance } = calcSummary(monthTxs);

  document.getElementById('currentMonth').textContent = monthLabel(state.viewMonth);
  document.getElementById('totalIncome').textContent = formatINR(income);
  document.getElementById('totalExpense').textContent = formatINR(expense);
  document.getElementById('totalBalance').textContent = formatINR(balance);
  document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--teal)' : 'var(--red)';

  renderTxList(document.getElementById('recentTransactions'), monthTxs, 8);
  const cats = categorySummary(monthTxs, 'expense');
  renderCategorySummary(document.getElementById('categoryBreakdown'), cats, expense);
}

// ─── Transactions page ─────────────────────────────────────────
function renderTransactions() {
  const type = document.getElementById('filterType').value;
  const memberId = document.getElementById('filterMember').value;
  const search = document.getElementById('searchTx').value.toLowerCase();

  let txs = state.transactions;
  if (type !== 'all') txs = txs.filter(t => t.type === type);
  if (memberId !== 'all') txs = txs.filter(t => t.memberId === memberId);
  if (search) txs = txs.filter(t => t.category.toLowerCase().includes(search) || (t.note || '').toLowerCase().includes(search));

  renderTxList(document.getElementById('allTransactions'), txs);
  updateMemberSelects();
}

// ─── Family page ───────────────────────────────────────────────
function renderFamily() {
  document.getElementById('inviteCode').textContent = state.currentUser.householdId;
  const grid = document.getElementById('familyGrid');
  grid.innerHTML = '';
  state.members.forEach(m => {
    const txs = state.transactions.filter(t => t.memberId === m.id);
    const total = txs.filter(t => t.type === 'expense').reduce((s,t) => s + +t.amount, 0);
    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
      <div class="member-avatar" style="background:${m.color}">${m.name[0].toUpperCase()}</div>
      <div class="member-name">${m.name}</div>
      <div class="member-role">${m.role}</div>
      <div class="member-stats">${txs.length} transactions<br>${formatINR(total)} spent</div>
      <button class="member-remove" data-id="${m.id}" aria-label="Remove ${m.name}">×</button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.member-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (state.members.length <= 1) { showToast('Need at least one member', 'error'); return; }
      if (!confirm(`Remove ${memberById(id)?.name}?`)) return;
      state.members = state.members.filter(m => m.id !== id);
      save(); renderFamily();
    });
  });
}

function copyInviteCode() {
  navigator.clipboard.writeText(state.currentUser.householdId);
  showToast('Invite code copied!');
}

// ─── Add/Scan Forms & Utils ───────────────────────────────────
function setupAddForm() {
  const sel = document.getElementById('txMember');
  sel.innerHTML = '<option value="">Select member</option>';
  state.members.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.name;
    sel.appendChild(o);
  });
  document.getElementById('txDate').value = fmt(new Date());
}

function setupScanPage() {
  const sel = document.getElementById('scanMember');
  sel.innerHTML = '';
  state.members.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.name;
    sel.appendChild(o);
  });
  document.getElementById('scanDate').value = fmt(new Date());

  document.getElementById('dropZone').classList.remove('hidden');
  document.getElementById('scanPreview').classList.add('hidden');
}

// ─── Reports ───────────────────────────────────────────────────
function renderReports() {
  const monthTxs = state.transactions.filter(tx => sameMonth(tx.date, state.reportMonth));
  const { income, expense, balance } = calcSummary(monthTxs);

  document.getElementById('reportCurrentMonth').textContent = monthLabel(state.reportMonth);
  document.getElementById('reportIncome').textContent = formatINR(income);
  document.getElementById('reportExpense').textContent = formatINR(expense);
  document.getElementById('reportSavings').textContent = formatINR(balance);

  const total = income + expense;
  const incomeBar = document.getElementById('incomeBar');
  const expenseBar = document.getElementById('expenseBar');
  incomeBar.style.width = total ? (income/total*100)+'%' : '50%';
  expenseBar.style.width = total ? (expense/total*100)+'%' : '50%';

  const cats = categorySummary(monthTxs, 'expense');
  renderCategorySummary(document.getElementById('topCategories'), cats, expense);

  const memberContainer = document.getElementById('memberSpending');
  memberContainer.innerHTML = '';
  const memberMap = {};
  monthTxs.filter(t => t.type==='expense').forEach(t => {
    memberMap[t.memberId] = (memberMap[t.memberId] || 0) + +t.amount;
  });
  const memberEntries = Object.entries(memberMap).sort((a,b) => b[1]-a[1]);
  if (!memberEntries.length) {
    memberContainer.innerHTML = '<div class="empty-state" style="padding:20px"><p>No data yet</p></div>';
  } else {
    memberEntries.forEach(([mid, val]) => {
      const m = memberById(mid);
      if (!m) return;
      const pct = expense ? Math.round(val/expense*100) : 0;
      const row = document.createElement('div');
      row.className = 'cat-row';
      row.innerHTML = `
        <div class="cat-label-row">
          <span class="cat-label"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${m.color};margin-right:6px;"></span>${m.name}</span>
          <span class="cat-value">${formatINR(val)} <small>${pct}%</small></span>
        </div>
        <div class="cat-bar-bg"><div class="cat-bar-fill" style="width:${pct}%;background:${m.color}"></div></div>
      `;
      memberContainer.appendChild(row);
    });
  }

  renderDailyChart(monthTxs);
}

function renderDailyChart(monthTxs) {
  const container = document.getElementById('dailyChart');
  container.innerHTML = '';

  const daysInMonth = new Date(state.reportMonth.getFullYear(), state.reportMonth.getMonth()+1, 0).getDate();
  const dailyMap = {};
  monthTxs.filter(t => t.type==='expense').forEach(t => {
    const day = parseInt(t.date.slice(8));
    dailyMap[day] = (dailyMap[day] || 0) + +t.amount;
  });

  const maxVal = Math.max(...Object.values(dailyMap), 1);
  const MAX_H = 120;

  for (let d = 1; d <= daysInMonth; d++) {
    const val = dailyMap[d] || 0;
    const h = Math.round((val / maxVal) * MAX_H);
    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    wrap.title = `Day ${d}: ${formatINR(val)}`;
    wrap.innerHTML = `
      <div class="chart-bar" style="height:${h}px;opacity:${val ? 1 : 0.15}"></div>
      <div class="chart-bar-label">${d}</div>
    `;
    container.appendChild(wrap);
  }
}

// ─── Delete Modal ──────────────────────────────────────────────
function openDeleteModal(id) {
  state.pendingDeleteId = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  state.pendingDeleteId = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

// ─── Toast Alerts ──────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.remove(); }, 3000);
}

// ─── Member Dropdowns Sync ─────────────────────────────────────
function updateMemberSelects() {
  ['txMember','scanMember','filterMember'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    if (id === 'filterMember') {
      el.innerHTML = '<option value="all">All members</option>';
    } else {
      el.innerHTML = '<option value="">Select member</option>';
    }
    state.members.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.name;
      if (m.id === cur) o.selected = true;
      el.appendChild(o);
    });
  });
}

// ─── OCR Scanning Simulation ───────────────────────────────────
function handleBillFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please upload an image file', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('scanImage').src = e.target.result;
    document.getElementById('dropZone').classList.add('hidden');
    document.getElementById('scanPreview').classList.remove('hidden');
    simulateOCR(file.name);
  };
  reader.readAsDataURL(file);
}

function simulateOCR(filename) {
  const base = Math.floor(Math.random() * 3 + 1) * 100 + Math.floor(Math.random() * 99);
  document.getElementById('scanAmount').value = base;

  const name = filename.toLowerCase();
  let guessedCat = 'Other Expense';
  if (name.includes('grocery') || name.includes('big') || name.includes('mart')) guessedCat = 'Groceries';
  else if (name.includes('electric') || name.includes('power') || name.includes('gas')) guessedCat = 'Utilities';
  else if (name.includes('restaurant') || name.includes('food') || name.includes('swiggy') || name.includes('zomato')) guessedCat = 'Food & Dining';
  else if (name.includes('medical') || name.includes('pharma') || name.includes('health')) guessedCat = 'Healthcare';
  else if (name.includes('shop') || name.includes('amazon') || name.includes('flipkart')) guessedCat = 'Shopping';

  document.getElementById('scanCategory').value = guessedCat;
  showToast('Bill processed — please confirm details', 'success');
}

// ─── Initialize ────────────────────────────────────────────────
function init() {
  // Navigation: sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    if (!item.classList.contains('logout-item')) {
      item.addEventListener('click', () => navigate(item.dataset.page));
    }
  });

  // Navigation: mobile
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Link buttons inside pages
  document.querySelectorAll('.link-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Month navigation - dashboard
  document.getElementById('prevMonth').addEventListener('click', () => {
    state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() - 1, 1);
    renderDashboard();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    const next = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth() + 1, 1);
    if (next <= new Date()) { state.viewMonth = next; renderDashboard(); }
  });

  // Month navigation - reports
  document.getElementById('reportPrevMonth').addEventListener('click', () => {
    state.reportMonth = new Date(state.reportMonth.getFullYear(), state.reportMonth.getMonth() - 1, 1);
    renderReports();
  });
  document.getElementById('reportNextMonth').addEventListener('click', () => {
    const next = new Date(state.reportMonth.getFullYear(), state.reportMonth.getMonth() + 1, 1);
    if (next <= new Date()) { state.reportMonth = next; renderReports(); }
  });

  // Transaction type toggle
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedTxType = btn.dataset.type;
    });
  });

  // Add transaction form
  document.getElementById('addTransactionForm').addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('txAmount').value);
    const category = document.getElementById('txCategory').value;
    const date = document.getElementById('txDate').value;
    const memberId = document.getElementById('txMember').value;
    const note = document.getElementById('txNote').value.trim();

    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    if (!memberId) { showToast('Select a family member', 'error'); return; }

    state.transactions.push({ id: uid(), type: state.selectedTxType, category, amount, date, memberId, note });
    save();
    showToast('Transaction saved');
    e.target.reset();
    document.getElementById('txDate').value = fmt(new Date());
    document.getElementById('txAmount').value = '';
  });

  // Add member form
  document.getElementById('addMemberForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('memberName').value.trim();
    const role = document.getElementById('memberRole').value;
    const color = document.getElementById('memberColor').value;
    if (!name) return;
    state.members.push({ id: uid(), name, role, color });
    save();
    e.target.reset();
    document.getElementById('memberColor').value = '#3B5998';
    showToast(`${name} added`);
    renderFamily();
    updateMemberSelects();
  });

  // Filters on transactions page
  ['filterType','filterMember'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTransactions);
  });
  document.getElementById('searchTx').addEventListener('input', renderTransactions);

  // Camera functionality
  let videoStream;
  const video = document.getElementById('cameraPreview');

  document.querySelectorAll('.scan-mode-toggle .type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scan-mode-toggle .type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      document.getElementById('dropZone').classList.toggle('hidden', mode !== 'upload');
      document.getElementById('cameraZone').classList.toggle('hidden', mode !== 'camera');
      if (mode === 'camera') startCamera(); else stopCamera();
    });
  });

  async function startCamera() {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = videoStream;
    } catch (e) { showToast('Camera access denied', 'error'); }
  }

  function stopCamera() {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
  }

  document.getElementById('captureBtn').addEventListener('click', () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    document.getElementById('scanImage').src = dataUrl;
    document.getElementById('cameraZone').classList.add('hidden');
    document.getElementById('scanPreview').classList.remove('hidden');
    simulateOCR('scanned_bill.png');
    stopCamera();
  });


  // Scan form submit
  document.getElementById('scanForm').addEventListener('submit', e => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('scanAmount').value);
    const category = document.getElementById('scanCategory').value;
    const memberId = document.getElementById('scanMember').value;
    const note = document.getElementById('scanNote').value.trim() || 'Scanned bill';
    const date = document.getElementById('scanDate').value;

    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    state.transactions.push({ id: uid(), type: 'expense', category, amount, date, memberId, note });
    save();
    showToast('Bill saved as expense');
    setupScanPage();
  });

  // Delete modal
  document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDelete').addEventListener('click', () => {
    const id = state.pendingDeleteId;
    state.transactions = state.transactions.filter(t => t.id !== id);
    save();
    closeDeleteModal();
    showToast('Transaction deleted');
    const activePage = document.querySelector('.page.active')?.id?.replace('page-','');
    if (activePage) navigate(activePage);
  });

  document.getElementById('deleteModal').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
  });

  // Keyboard: Esc closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDeleteModal();
  });

  // Auth Listeners
  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
  });
  document.getElementById('signupForm').addEventListener('submit', e => {
    e.preventDefault();
    signup(document.getElementById('signupName').value, document.getElementById('signupEmail').value, document.getElementById('signupPassword').value);
  });
  document.getElementById('showSignup').addEventListener('click', () => {
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('signupCard').classList.remove('hidden');
  });
  document.getElementById('showLogin').addEventListener('click', () => {
    document.getElementById('signupCard').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.getElementById('joinHouseholdForm').addEventListener('submit', e => {
    e.preventDefault();
    joinHousehold(document.getElementById('joinCode').value.trim());
  });

  // Forgot Password listeners
  document.getElementById('showLoginFromForgot').addEventListener('click', () => {
    document.getElementById('forgotPasswordCard').classList.add('hidden');
    document.getElementById('loginCard').classList.remove('hidden');
  });
  document.getElementById('showForgotPassword').addEventListener('click', () => {
    document.getElementById('loginCard').classList.add('hidden');
    document.getElementById('forgotPasswordCard').classList.remove('hidden');
  });
  document.getElementById('forgotPasswordForm').addEventListener('submit', e => {
    e.preventDefault();
    requestOTP(document.getElementById('forgotEmail').value);
  });
  document.getElementById('resetPasswordForm').addEventListener('submit', e => {
    e.preventDefault();
    resetPassword(sessionStorage.getItem('tempEmail'), document.getElementById('newPassword').value);
  });

  load();
  if (state.currentUser) navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
