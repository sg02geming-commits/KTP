// ===== STATE =====
let transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
let targets = JSON.parse(localStorage.getItem('targets') || '[]');
let modalMode = 'income';
let savingMode = 'in'; // 'in' | 'out'

const CATEGORIES = {
  income: ['Gaji', 'Bonus', 'Investasi', 'Hadiah', 'Lainnya'],
  expense: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya']
};

const ICONS = {
  income: '💵',
  expense: '💸',
  saving: '🏦',
  withdraw: '📤'
};

// ===== UTILITIES =====
const formatRupiah = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');
const today = () => new Date().toISOString().split('T')[0];

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== THEME =====
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#6366f1');
  setTimeout(() => {
    drawWeeklyChart();
    if (document.getElementById('riwayat').classList.contains('active')) drawCategoryChart();
  }, 50);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

document.getElementById('themeBtn').addEventListener('click', toggleTheme);

(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
})();

// ===== SALDO HELPERS =====
// Saldo Utama = income - expense - saving + withdraw
// (uang yang dipakai untuk transaksi sehari-hari, SUDAH dikurangi yang masuk tabungan)
function getMainBalance() {
  const income   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense  = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const saving   = transactions.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0);
  const withdraw = transactions.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
  return income - expense - saving + withdraw;
}

// Tabungan = saving - withdraw
function getSavingBalance() {
  const masuk  = transactions.filter(t => t.type === 'saving').reduce((s, t) => s + t.amount, 0);
  const keluar = transactions.filter(t => t.type === 'withdraw').reduce((s, t) => s + t.amount, 0);
  return masuk - keluar;
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'riwayat') renderStats();
    if (tab.dataset.tab === 'tabungan') renderSavingHistory();
  });
});

// ===== MODAL CLOSE UNIVERSAL =====
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ===== MODAL TRANSAKSI =====
function openModal(mode) {
  modalMode = mode;
  document.getElementById('modalTitle').textContent =
    mode === 'income' ? '➕ Tambah Pemasukan' : '➖ Tambah Pengeluaran';

  const catSelect = document.getElementById('category');
  catSelect.innerHTML = CATEGORIES[mode]
    .map(c => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('date').value = today();
  document.getElementById('amount').value = '';
  document.getElementById('note').value = '';

  document.getElementById('modal').classList.add('active');
}

document.getElementById('formTransaksi').addEventListener('submit', (e) => {
  e.preventDefault();
  const trx = {
    id: Date.now(),
    type: modalMode,
    amount: parseFloat(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    note: document.getElementById('note').value || document.getElementById('category').value,
    date: document.getElementById('date').value
  };

  if (trx.type === 'expense' && trx.amount > getMainBalance()) {
    showToast('⚠️ Saldo utama tidak cukup!');
    return;
  }

  transactions.unshift(trx);
  saveData();
  closeModal('modal');
  renderAll();
  showToast('✅ Transaksi berhasil disimpan');
});

// ===== MODAL TABUNGAN =====
function openSavingModal() {
  savingMode = 'in';
  document.getElementById('savingModalTitle').textContent = '🏦 Masuk ke Tabungan';
  document.getElementById('savingAmount').value = '';
  document.getElementById('savingNote').value = '';
  document.getElementById('savingDate').value = today();
  document.getElementById('savingModal').classList.add('active');
}

function openWithdrawModal() {
  if (getSavingBalance() <= 0) {
    showToast('⚠️ Belum ada saldo tabungan');
    return;
  }
  savingMode = 'out';
  document.getElementById('savingModalTitle').textContent = '📤 Keluar dari Tabungan';
  document.getElementById('savingAmount').value = '';
  document.getElementById('savingNote').value = '';
  document.getElementById('savingDate').value = today();
  document.getElementById('savingModal').classList.add('active');
}

document.getElementById('formSaving').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('savingAmount').value);
  const note = document.getElementById('savingNote').value ||
    (savingMode === 'in' ? 'Nabung' : 'Tarik tabungan');
  const date = document.getElementById('savingDate').value;

  if (savingMode === 'in' && amount > getMainBalance()) {
    showToast('⚠️ Saldo utama tidak cukup!');
    return;
  }
  if (savingMode === 'out' && amount > getSavingBalance()) {
    showToast('⚠️ Saldo tabungan tidak cukup!');
    return;
  }

  transactions.unshift({
    id: Date.now(),
    type: savingMode === 'in' ? 'saving' : 'withdraw',
    amount,
    category: 'Tabungan',
    note,
    date
  });

  saveData();
  closeModal('savingModal');
  renderAll();
  showToast(savingMode === 'in' ? '🏦 Berhasil masuk tabungan' : '📤 Berhasil tarik tabungan');
});

// ===== MODAL TARGET =====
function openTargetModal() {
  document.getElementById('targetModal').classList.add('active');
  document.getElementById('targetDeadline').value = today();
}

document.getElementById('formTarget').addEventListener('submit', (e) => {
  e.preventDefault();
  targets.push({
    id: Date.now(),
    name: document.getElementById('targetName').value,
    amount: parseFloat(document.getElementById('targetAmount').value),
    deadline: document.getElementById('targetDeadline').value
  });
  saveData();
  closeModal('targetModal');
  renderTargets();
  document.getElementById('formTarget').reset();
  showToast('🎯 Target berhasil ditambahkan');
});

// ===== SAVE =====
function saveData() {
  localStorage.setItem('transactions', JSON.stringify(transactions));
  localStorage.setItem('targets', JSON.stringify(targets));
}

// ===== RENDER BALANCE (dengan keterangan breakdown) =====
function renderBalance() {
  const main = getMainBalance();
  const saving = getSavingBalance();
  const total = main + saving;

  document.getElementById('mainBalance').textContent = formatRupiah(main);
  document.getElementById('savingBalance').textContent = formatRupiah(saving);
  document.getElementById('totalBalance').textContent = formatRupiah(total);
  document.getElementById('savingHeroAmount').textContent = formatRupiah(saving);

  // Keterangan breakdown
  const desc = document.getElementById('totalBreakdown');
  if (desc) {
    desc.textContent = `${formatRupiah(main)} (utama) + ${formatRupiah(saving)} (tabungan) = ${formatRupiah(total)}`;
  }
}

// ===== RENDER RECENT =====
function renderRecent() {
  const list = document.getElementById('recentList');
  const recent = transactions.slice(0, 5);

  if (recent.length === 0) {
    list.innerHTML = '<div class="empty-state">Belum ada transaksi. Yuk mulai menabung! 💰</div>';
    return;
  }

  list.innerHTML = recent.map(t => {
    let sign = '';
    let amountClass = t.type;
    if (t.type === 'income') sign = '+';
    else if (t.type === 'expense') sign = '-';
    else if (t.type === 'saving') { sign = ''; amountClass = 'saving'; }
    else if (t.type === 'withdraw') { sign = ''; amountClass = 'withdraw'; }

    return `
      <div class="trx-item">
        <div class="trx-icon ${t.type}">${ICONS[t.type]}</div>
        <div class="trx-info">
          <h4>${t.note}</h4>
          <p>${t.category} • ${new Date(t.date).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</p>
        </div>
        <div class="trx-amount ${amountClass}">
          ${sign} ${formatRupiah(t.amount)}
        </div>
      </div>
    `;
  }).join('');
}

// ===== RENDER TRANSAKSI LIST =====
function renderTransaksiList() {
  const list = document.getElementById('transaksiList');
  const filterType = document.getElementById('filterType').value;
  const filterCat = document.getElementById('filterCategory').value;
  const filterMonth = document.getElementById('filterMonth').value;

  let filtered = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCat !== 'all' && t.category !== filterCat) return false;
    if (filterMonth && !t.date.startsWith(filterMonth)) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">Tidak ada transaksi yang cocok 🔍</div>';
    return;
  }

  list.innerHTML = filtered.map(t => {
    let sign = '';
    let amountClass = t.type;
    if (t.type === 'income') sign = '+';
    else if (t.type === 'expense') sign = '-';

    return `
      <div class="trx-item-full">
        <div class="trx-icon ${t.type}">${ICONS[t.type]}</div>
        <div class="trx-info">
          <h4>${t.note}</h4>
          <p>${t.category} • ${new Date(t.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
        </div>
        <div class="trx-amount ${amountClass}">
          ${sign} ${formatRupiah(t.amount)}
        </div>
        <button class="delete-btn" onclick="deleteTrx(${t.id})">🗑️</button>
      </div>
    `;
  }).join('');
}

function deleteTrx(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  transactions = transactions.filter(t => t.id !== id);
  saveData();
  renderAll();
  showToast('🗑️ Transaksi dihapus');
}

// ===== SAVING HISTORY =====
function renderSavingHistory() {
  const list = document.getElementById('savingHistoryList');
  const savingTrx = transactions.filter(t => t.type === 'saving' || t.type === 'withdraw');

  if (savingTrx.length === 0) {
    list.innerHTML = '<div class="empty-state">Belum ada riwayat tabungan. Klik "Masuk" untuk mulai nabung! 🏦</div>';
    return;
  }

  list.innerHTML = savingTrx.map(t => `
    <div class="trx-item">
      <div class="trx-icon ${t.type}">${ICONS[t.type]}</div>
      <div class="trx-info">
        <h4>${t.note}</h4>
        <p>${new Date(t.date).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</p>
      </div>
      <div class="trx-amount ${t.type === 'saving' ? 'income' : 'expense'}">
        ${t.type === 'saving' ? '+' : '-'} ${formatRupiah(t.amount)}
      </div>
    </div>
  `).join('');
}

// ===== FILTER CATEGORY =====
function populateFilterCategories() {
  const sel = document.getElementById('filterCategory');
  const allCats = [...new Set([...CATEGORIES.income, ...CATEGORIES.expense, 'Tabungan'])];
  sel.innerHTML = '<option value="all">Semua Kategori</option>' +
    allCats.map(c => `<option value="${c}">${c}</option>`).join('');
}

['filterType', 'filterCategory', 'filterMonth'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderTransaksiList);
});

// ===== RENDER TARGETS (pakai saldo TABUNGAN saja) =====
function renderTargets() {
  const list = document.getElementById('targetList');

  if (targets.length === 0) {
    list.innerHTML = '<div class="empty-state">Belum ada target. Buat target pertamamu! 🎯</div>';
    return;
  }

  const savingBalance = getSavingBalance(); // HANYA dari tabungan

  list.innerHTML = targets.map(t => {
    const percent = Math.min(100, (savingBalance / t.amount) * 100);
    const days = Math.ceil((new Date(t.deadline) - new Date()) / (1000*60*60*24));
    const done = percent >= 100;
    return `
      <div class="target-card">
        <div class="target-top">
          <div>
            <h4>${t.name} ${done ? '✅' : ''}</h4>
            <p>Deadline: ${new Date(t.deadline).toLocaleDateString('id-ID')} • ${days > 0 ? days + ' hari lagi' : 'Terlewat'}</p>
          </div>
          <button class="delete-btn" onclick="deleteTarget(${t.id})">🗑️</button>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percent}%"></div>
        </div>
        <div class="progress-info">
          <span>${formatRupiah(savingBalance)} / ${formatRupiah(t.amount)}</span>
          <span>${percent.toFixed(1)}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function deleteTarget(id) {
  if (!confirm('Hapus target ini?')) return;
  targets = targets.filter(t => t.id !== id);
  saveData();
  renderTargets();
  showToast('🗑️ Target dihapus');
}

// ===== STATS =====
function renderStats() {
  const todayStr = today();
  const monthStr = todayStr.slice(0, 7);

  const todaySum = transactions
    .filter(t => t.date === todayStr && (t.type === 'income' || t.type === 'expense'))
    .reduce((s,t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

  const monthSum = transactions
    .filter(t => t.date.startsWith(monthStr) && (t.type === 'income' || t.type === 'expense'))
    .reduce((s,t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);

  document.getElementById('statTotalTrx').textContent = transactions.length;
  document.getElementById('statToday').textContent = formatRupiah(todaySum);
  document.getElementById('statMonth').textContent = formatRupiah(monthSum);
  document.getElementById('statSaving').textContent = formatRupiah(getSavingBalance());

  drawCategoryChart();
}

// ===== CHARTS =====
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function drawWeeklyChart() {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 200;

  const days = [], incomes = [], expenses = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    days.push(d.toLocaleDateString('id-ID', { weekday: 'short' }));
    incomes.push(transactions.filter(t => t.date === key && t.type === 'income').reduce((s,t)=>s+t.amount,0));
    expenses.push(transactions.filter(t => t.date === key && t.type === 'expense').reduce((s,t)=>s+t.amount,0));
  }

  const maxVal = Math.max(...incomes, ...expenses, 1);
  const w = canvas.width, h = canvas.height;
  const pad = 30, chartW = w - pad*2, chartH = h - pad*2;
  const barW = chartW / 7 / 3;

  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = getCSSVar('--border') || '#e2e8f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w - pad, y);
    ctx.stroke();
  }

  days.forEach((day, i) => {
    const x = pad + (chartW / 7) * i + chartW / 14;

    const ih = (incomes[i] / maxVal) * chartH;
    ctx.fillStyle = getCSSVar('--income') || '#10b981';
    ctx.beginPath();
    roundRect(ctx, x - barW - 2, pad + chartH - ih, barW, ih, 4);
    ctx.fill();

    const eh = (expenses[i] / maxVal) * chartH;
    ctx.fillStyle = getCSSVar('--expense') || '#ef4444';
    ctx.beginPath();
    roundRect(ctx, x + 2, pad + chartH - eh, barW, eh, 4);
    ctx.fill();

    ctx.fillStyle = getCSSVar('--text-muted') || '#64748b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(day, x, h - 8);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  if (h < 2) h = 2;
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 220;

  const cats = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    cats[t.category] = (cats[t.category] || 0) + t.amount;
  });

  const entries = Object.entries(cats).sort((a,b) => b[1]-a[1]);
  ctx.clearRect(0,0,canvas.width,canvas.height);

  if (entries.length === 0) {
    ctx.fillStyle = getCSSVar('--text-muted') || '#64748b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Belum ada data pengeluaran', canvas.width/2, canvas.height/2);
    return;
  }

  const total = entries.reduce((s,[,v]) => s+v, 0);
  const colors = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#ef4444','#84cc16'];
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = Math.min(cx, cy) - 10;
  let startAngle = -Math.PI / 2;

  entries.forEach(([cat, val], i) => {
    const angle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    if (val/total > 0.05) {
      const midAngle = startAngle + angle / 2;
      const lx = cx + Math.cos(midAngle) * radius * 0.65;
      const ly = cy + Math.sin(midAngle) * radius * 0.65;
      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cat.slice(0,5), lx, ly);
    }

    startAngle += angle;
  });
}

// ===== EXPORT / RESET =====
function exportData() {
  const data = { transactions, targets, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tabungan-backup-${today()}.json`;
  a.click();
  showToast('📤 Data berhasil diexport');
}

function resetData() {
  if (!confirm('⚠️ Yakin reset semua data? Tindakan ini tidak bisa dibatalkan!')) return;
  localStorage.removeItem('transactions');
  localStorage.removeItem('targets');
  transactions = [];
  targets = [];
  renderAll();
  showToast('🗑️ Data berhasil direset');
}

// ===== GREETING =====
function setGreeting() {
  const h = new Date().getHours();
  let g = 'Selamat pagi';
  if (h >= 11 && h < 15) g = 'Selamat siang';
  else if (h >= 15 && h < 18) g = 'Selamat sore';
  else if (h >= 18) g = 'Selamat malam';
  document.getElementById('greeting').textContent = `${g} 👋`;
}

// ===== RENDER ALL =====
function renderAll() {
  renderBalance();
  renderRecent();
  renderTransaksiList();
  renderTargets();
  renderSavingHistory();
  drawWeeklyChart();
  if (document.getElementById('riwayat').classList.contains('active')) renderStats();
}

// ===== PWA INSTALL =====
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});

document.getElementById('installBtn').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') showToast('✅ Aplikasi berhasil diinstall');
  deferredPrompt = null;
  document.getElementById('installBtn').style.display = 'none';
});

// ===== INIT =====
setGreeting();
populateFilterCategories();
renderAll();

window.addEventListener('resize', () => {
  drawWeeklyChart();
  if (document.getElementById('riwayat').classList.contains('active')) drawCategoryChart();
});