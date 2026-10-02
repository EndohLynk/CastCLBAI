const API_BASE = '/api';
const state = {
  user: null,
  books: [],
  requests: [],
  stats: null,
};

function persistUser(user) {
  if (user) {
    localStorage.setItem('clb_library_user', JSON.stringify(user));
    return;
  }
  localStorage.removeItem('clb_library_user');
}

function restoreUser() {
  try {
    const raw = localStorage.getItem('clb_library_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || 'Yêu cầu không thành công.');
  }

  return payload;
}

function showAlert(message, isError = false) {
  const alertEl = document.getElementById('authAlert');
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.classList.add('show');
  alertEl.classList.toggle('error', isError);
}

function hideAlert() {
  const alertEl = document.getElementById('authAlert');
  if (!alertEl) return;
  alertEl.classList.remove('show', 'error');
}

function formatStatus(status) {
  const map = {
    available: 'Sẵn có',
    borrowed: 'Đang cho mượn',
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    returned: 'Đã trả',
  };
  return map[status] || status;
}

function setLoadingState(message) {
  const loginState = document.getElementById('loginState');
  if (!loginState) return;
  loginState.innerHTML = `<p class="empty-state">${message}</p>`;
}

function renderStatCards() {
  const stats = state.stats || {
    totalBooks: 0,
    available: 0,
    borrowed: 0,
    pending: 0,
    users: 0,
  };

  const ids = {
    total: 'statTotal',
    available: 'statAvailable',
    borrowed: 'statBorrowed',
    pending: 'statPending',
  };

  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = stats[key === 'total' ? 'totalBooks' : key] ?? 0;
    }
  }
}

function renderOverviewList() {
  const list = document.getElementById('categoryBreakdown');
  if (!list) return;

  const items = state.stats?.categories || [];
  if (!items.length) {
    list.innerHTML = '<div class="mini-empty">Chưa có dữ liệu danh mục.</div>';
    return;
  }

  list.innerHTML = items
    .map(
      (item) => `
        <div class="mini-row">
          <span>${item.category}</span>
          <strong>${item.total}</strong>
        </div>
      `
    )
    .join('');
}

function renderCategoryChart() {
  const chart = document.getElementById('categoryChart');
  if (!chart) return;

  const items = state.stats?.categories || [];
  if (!items.length) {
    chart.innerHTML = '<div class="empty-state">Chưa có dữ liệu biểu đồ.</div>';
    return;
  }

  const maxValue = Math.max(...items.map((item) => Number(item.total || 0)), 1);

  chart.innerHTML = items
    .map((item) => {
      const value = Number(item.total || 0);
      const width = Math.max((value / maxValue) * 100, 6);
      return `
        <div class="chart-row">
          <div class="chart-label-row">
            <span>${item.category}</span>
            <strong>${value}</strong>
          </div>
          <div class="chart-track">
            <div class="chart-bar" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAdminInsights() {
  const insights = document.getElementById('adminInsights');
  if (!insights) return;

  const total = Number(state.stats?.totalBooks || 0);
  const available = Number(state.stats?.available || 0);
  const borrowed = Number(state.stats?.borrowed || 0);
  const pending = Number(state.stats?.pending || 0);
  const users = Number(state.stats?.users || 0);
  const utilization = total ? Math.round((borrowed / total) * 100) : 0;

  const items = [
    { label: 'Sách sẵn có', value: `${available} cuốn` },
    { label: 'Đang cho mượn', value: `${borrowed} cuốn` },
    { label: 'Yêu cầu chờ duyệt', value: `${pending} yêu cầu` },
    { label: 'Tỷ lệ sử dụng', value: `${utilization}%` },
    { label: 'Người dùng', value: `${users} tài khoản` },
  ];

  insights.innerHTML = items
    .map(
      (item) => `
        <li class="insight-item">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </li>
      `
    )
    .join('');
}

function renderBooks() {
  const catalog = document.getElementById('bookCatalog');
  const bookSearch = document.getElementById('bookSearch');
  const select = document.getElementById('bookSelect');

  if (!catalog) return;

  const filter = (bookSearch?.value || '').trim().toLowerCase();
  const visibleBooks = state.books.filter((book) => {
    if (!filter) return true;
    return (
      book.title.toLowerCase().includes(filter) ||
      book.category.toLowerCase().includes(filter) ||
      book.author.toLowerCase().includes(filter)
    );
  });

  catalog.innerHTML = '';

  if (!visibleBooks.length) {
    catalog.innerHTML = '<div class="empty-state">Không tìm thấy sách phù hợp.</div>';
  } else {
    visibleBooks.forEach((book) => {
      const item = document.createElement('div');
      item.className = 'book-item';
      item.innerHTML = `
        <div class="book-meta">
          <strong>${book.title}</strong>
          <span>${book.author} · ${book.category}</span>
          <span>Trạng thái: ${formatStatus(book.status)}</span>
        </div>
        <div class="button-row">
          <span class="badge ${book.status}">${formatStatus(book.status)}</span>
          ${book.status === 'borrowed' ? `<button class="small-button button-secondary" data-return-book="${book.id}" type="button">Trả sách</button>` : ''}
        </div>
      `;
      catalog.appendChild(item);
    });
  }

  if (select) {
    const availableBooks = state.books.filter((book) => book.status === 'available');
    select.innerHTML = availableBooks.length
      ? availableBooks
          .map((book) => `<option value="${book.id}">${book.title} · ${book.category}</option>`)
          .join('')
      : '<option value="">Không có sách sẵn có</option>';
  }

  const submitBtn = document.querySelector('#requestForm button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = !state.books.some((book) => book.status === 'available');
  }

  catalog.querySelectorAll('[data-return-book]').forEach((button) => {
    button.addEventListener('click', () => handleReturnBook(button.dataset.returnBook));
  });
}

function renderUserRequests() {
  const requestListUser = document.getElementById('requestListUser');
  const historyListUser = document.getElementById('historyListUser');

  if (!requestListUser || !historyListUser) return;

  const mine = state.requests.filter((request) => request.userId === state.user?.id);

  requestListUser.innerHTML = ''; 
  if (!mine.length) {
    requestListUser.innerHTML = '<p class="empty-state">Chưa có yêu cầu mượn nào.</p>';
  } else {
    mine.forEach((request) => {
      const book = state.books.find((item) => item.id === request.bookId);
      const item = document.createElement('div');
      item.className = 'request-item';
      item.innerHTML = `
        <div class="request-meta">
          <strong>${book ? book.title : 'Sách'}</strong>
          <span>${request.startDate} → ${request.endDate}</span>
          <span>${request.note || 'Không có ghi chú'}</span>
        </div>
        <span class="badge ${request.status}">${formatStatus(request.status)}</span>
      `;
      requestListUser.appendChild(item);
    });
  }

  historyListUser.innerHTML = '';
  const history = mine.filter((request) => ['approved', 'returned', 'rejected'].includes(request.status));
  if (!history.length) {
    historyListUser.innerHTML = '<p class="empty-state">Chưa có lịch sử mượn.</p>';
    return;
  }

  history.forEach((request) => {
    const book = state.books.find((item) => item.id === request.bookId);
    const item = document.createElement('div');
    item.className = 'request-item';
    item.innerHTML = `
      <div class="request-meta">
        <strong>${book ? book.title : 'Sách'}</strong>
        <span>${request.startDate} → ${request.endDate}</span>
        <span>${request.status === 'approved' ? 'Đã được quản lý duyệt' : request.status === 'returned' ? 'Đã trả sách' : 'Đã từ chối yêu cầu'}</span>
      </div>
      <span class="badge ${request.status}">${formatStatus(request.status)}</span>
    `;
    historyListUser.appendChild(item);
  });
}

function renderManagerRequests() {
  const list = document.getElementById('requestListManager');
  if (!list) return;

  list.innerHTML = '';

  if (!state.requests.length) {
    list.innerHTML = '<p class="empty-state">Chưa có yêu cầu mượn nào.</p>';
    return;
  }

  state.requests.forEach((request) => {
    const item = document.createElement('div');
    const book = state.books.find((entry) => entry.id === request.bookId);
    item.className = 'request-item';
    item.innerHTML = `
      <div class="request-meta">
        <strong>${request.userName}</strong>
        <span>Mượn: ${book ? book.title : 'Sách'} · ${request.startDate} → ${request.endDate}</span>
        <span>${request.note || 'Không có ghi chú'}</span>
      </div>
      <div class="button-row">
        <button class="small-button button-success" data-approve="${request.id}" type="button">Duyệt</button>
        <button class="small-button button-danger" data-reject="${request.id}" type="button">Từ chối</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('[data-approve]').forEach((button) => {
    button.addEventListener('click', () => handleApproveRequest(button.dataset.approve));
  });
  list.querySelectorAll('[data-reject]').forEach((button) => {
    button.addEventListener('click', () => handleRejectRequest(button.dataset.reject));
  });
}

function renderDashboard() {
  const dashboard = document.getElementById('dashboard');
  const guestState = document.getElementById('guestState');
  const loginState = document.getElementById('loginState');
  const managerPanel = document.getElementById('managerPanel');
  const userPanel = document.getElementById('userPanel');

  if (!state.user) {
    if (dashboard) dashboard.style.display = 'none';
    if (guestState) guestState.style.display = 'grid';
    if (loginState) loginState.innerHTML = '<p class="empty-state">Chưa có tài khoản nào đăng nhập.</p>';
    return;
  }

  if (guestState) guestState.style.display = 'none';
  if (dashboard) dashboard.style.display = 'grid';

  if (state.user.role === 'manager') {
    if (managerPanel) managerPanel.style.display = 'block';
    if (userPanel) userPanel.style.display = 'none';
  } else {
    if (managerPanel) managerPanel.style.display = 'none';
    if (userPanel) userPanel.style.display = 'block';
  }

  if (loginState) {
    loginState.innerHTML = `
      <div class="user-pill">👤 ${state.user.name} · ${state.user.role === 'manager' ? 'Quản lý' : 'Người dùng'}</div>
      <button class="btn btn-secondary" type="button" id="logoutBtn">Đăng xuất</button>
    `;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  }

  renderStats();
  renderBooks();
  renderUserRequests();
  renderManagerRequests();
}

function renderStats() {
  renderStatCards();
  renderOverviewList();
  renderCategoryChart();
  renderAdminInsights();
}

async function refreshData() {
  try {
    const [booksRes, requestsRes, statsRes] = await Promise.all([
      apiRequest('/books'),
      apiRequest('/requests'),
      apiRequest('/stats'),
    ]);

    state.books = booksRes.books || [];
    state.requests = requestsRes.requests || [];
    state.stats = statsRes || {};
    renderStats();
    renderBooks();
    renderUserRequests();
    renderManagerRequests();
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const result = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.user = result.user;
    persistUser(result.user);
    hideAlert();
    form.reset();
    renderDashboard();
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    state.user = result.user;
    persistUser(result.user);
    hideAlert();
    form.reset();
    renderDashboard();
  } catch (error) {
    showAlert(error.message, true);
  }
}

function handleLogout() {
  state.user = null;
  persistUser(null);
  hideAlert();
  renderDashboard();
}

async function handleAddBook(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    await apiRequest('/books', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    form.reset();
    await refreshData();
    showAlert('Đăng sách thành công.', false);
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleSubmitRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    await apiRequest('/requests', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        userId: state.user.id,
        userName: state.user.name,
      }),
    });
    form.reset();
    await refreshData();
    showAlert('Yêu cầu mượn đã được gửi thành công.', false);
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleApproveRequest(requestId) {
  try {
    await apiRequest(`/requests/${requestId}/approve`, { method: 'POST' });
    await refreshData();
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleRejectRequest(requestId) {
  try {
    await apiRequest(`/requests/${requestId}/reject`, { method: 'POST' });
    await refreshData();
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleReturnBook(bookId) {
  try {
    await apiRequest(`/books/${bookId}/return`, { method: 'POST' });
    await refreshData();
  } catch (error) {
    showAlert(error.message, true);
  }
}

function bindEvents() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const bookForm = document.getElementById('bookForm');
  const requestForm = document.getElementById('requestForm');
  const bookSearch = document.getElementById('bookSearch');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  if (bookForm) bookForm.addEventListener('submit', handleAddBook);
  if (requestForm) requestForm.addEventListener('submit', handleSubmitRequest);
  if (bookSearch) bookSearch.addEventListener('input', renderBooks);

  document.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => window.print());
  });
}

async function boot() {
  state.user = restoreUser();
  bindEvents();
  await refreshData();
  renderDashboard();
}

document.addEventListener('DOMContentLoaded', boot);
