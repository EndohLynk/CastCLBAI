const STORAGE_KEYS = {
  users: 'clbai_users',
  books: 'clbai_books',
  requests: 'clbai_requests',
  currentUser: 'clbai_currentUser'
};

const defaultUsers = [
  { id: crypto.randomUUID(), name: 'Quản lý trường', username: 'manager', password: '123456', role: 'manager' },
  { id: crypto.randomUUID(), name: 'Nguyễn Văn A', username: 'student01', password: '123456', role: 'user' }
];

function buildBookLibrary(count = 1000) {
  const categories = [
    'Toán học', 'Ngữ văn', 'Vật lý', 'Hóa học', 'Sinh học', 'Lịch sử', 'Địa lý',
    'Tiếng Anh', 'Tin học', 'Âm nhạc', 'Mỹ thuật', 'Giáo dục công dân', 'Kỹ thuật',
    'Khoa học tự nhiên', 'Khoa học xã hội', 'Tâm lý học', 'Tài chính', 'Marketing',
    'Nông nghiệp', 'Y tế', 'Thể thao', 'Triết học', 'Văn học', 'Kinh doanh'
  ];

  const authors = [
    'Bộ Giáo dục', 'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Cường', 'Phạm Thu Duyên',
    'Hoàng Quốc Hải', 'Vũ Thị Lan', 'Đặng Gia Mạnh', 'Ngô Huyền My', 'Tô Quốc Nam',
    'Mai Anh Phương', 'Lý Quốc Sơn', 'Đỗ Thị Thanh', 'Cao Hoài Thương', 'Bùi Anh Tuấn',
    'Hồ Văn Uý', 'Phan Kim Vân', 'Trương Xuân Yến', 'Đinh Nhật Tân', 'Nguyễn Hồng Yến'
  ];

  const books = [];
  for (let i = 0; i < count; i += 1) {
    const category = categories[i % categories.length];
    const author = authors[i % authors.length];
    const titleNumber = String(i + 1).padStart(3, '0');
    books.push({
      id: crypto.randomUUID(),
      title: `${category} ${titleNumber}`,
      author,
      category,
      status: i % 15 === 0 ? 'borrowed' : 'available',
      createdAt: new Date(Date.now() - i * 86400000).toISOString()
    });
  }
  return books;
}

const defaultBooks = buildBookLibrary(1000);
const defaultRequests = [];

function safeParse(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function ensureLibraryHasEnoughBooks() {
  const existingBooks = getBooks();
  if (existingBooks.length >= 1000) {
    return;
  }

  const seedBooks = buildBookLibrary(1000);
  const mergedBooks = [...existingBooks.filter(Boolean)];
  const seenTitles = new Set(mergedBooks.map((book) => String(book.title).trim().toLowerCase()));

  for (const book of seedBooks) {
    if (mergedBooks.length >= 1000) break;
    const key = String(book.title).trim().toLowerCase();
    if (!seenTitles.has(key)) {
      mergedBooks.push(book);
      seenTitles.add(key);
    }
  }

  localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(mergedBooks));
}

function boot() {
  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(defaultUsers));
  }
  if (!localStorage.getItem(STORAGE_KEYS.books)) {
    localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(defaultBooks));
  }
  ensureLibraryHasEnoughBooks();
  if (!localStorage.getItem(STORAGE_KEYS.requests)) {
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(defaultRequests));
  }
  if (!localStorage.getItem(STORAGE_KEYS.currentUser)) {
    localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(null));
  }
  syncUI();
}

function getUsers() {
  return safeParse(STORAGE_KEYS.users, []);
}

function getBooks() {
  return safeParse(STORAGE_KEYS.books, []);
}

function getRequests() {
  return safeParse(STORAGE_KEYS.requests, []);
}

function getCurrentUser() {
  return safeParse(STORAGE_KEYS.currentUser, null);
}

function setCurrentUser(user) {
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
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
  switch (status) {
    case 'available': return 'Sẵn có';
    case 'borrowed': return 'Đang cho mượn';
    case 'pending': return 'Chờ duyệt';
    case 'approved': return 'Đã duyệt';
    case 'rejected': return 'Từ chối';
    case 'returned': return 'Đã trả';
    default: return status;
  }
}

function renderStats() {
  const books = getBooks();
  const requests = getRequests();
  const sets = {
    total: document.getElementById('statTotal'),
    available: document.getElementById('statAvailable'),
    borrowed: document.getElementById('statBorrowed'),
    pending: document.getElementById('statPending')
  };

  if (sets.total) sets.total.textContent = books.length;
  if (sets.available) sets.available.textContent = books.filter((book) => book.status === 'available').length;
  if (sets.borrowed) sets.borrowed.textContent = books.filter((book) => book.status === 'borrowed').length;
  if (sets.pending) sets.pending.textContent = requests.filter((request) => request.status === 'pending').length;
}

function renderBookCatalog() {
  const catalog = document.getElementById('bookCatalog');
  if (!catalog) return;

  const term = document.getElementById('bookSearch')?.value.trim().toLowerCase() || '';
  const books = getBooks().filter((book) => !term || book.title.toLowerCase().includes(term) || book.category.toLowerCase().includes(term));
  catalog.innerHTML = '';

  if (!books.length) {
    catalog.innerHTML = '<div class="empty-state">Không tìm thấy sách nào phù hợp.</div>';
    return;
  }

  books.forEach((book) => {
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
        ${book.status === 'borrowed' ? '<button class="small-button button-secondary" data-return-book="' + book.id + '" type="button">Trả sách</button>' : ''}
      </div>
    `;
    catalog.appendChild(item);
  });

  catalog.querySelectorAll('[data-return-book]').forEach((button) => {
    button.addEventListener('click', () => returnBook(button.dataset.returnBook));
  });
}

function renderBooks() {
  const books = getBooks();
  const select = document.getElementById('bookSelect');
  if (select) {
    select.innerHTML = books
      .filter((book) => book.status === 'available')
      .map((book) => `<option value="${book.id}">${book.title} · ${book.category}</option>`)
      .join('') || '<option value="">Không có sách sẵn có</option>';
  }

  const requestForm = document.getElementById('requestForm');
  if (requestForm) {
    const submitButton = requestForm.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = !books.some((book) => book.status === 'available');
    }
  }

  renderBookCatalog();
  renderStats();
}

function buildRequestListForUser(userId) {
  const requests = getRequests().filter((request) => request.userId === userId);
  const list = document.getElementById('requestListUser');
  if (!list) return;

  list.innerHTML = '';
  if (!requests.length) {
    list.innerHTML = '<p class="empty-state">Chưa có yêu cầu mượn nào.</p>';
  } else {
    requests.forEach((request) => {
      const book = getBooks().find((item) => item.id === request.bookId);
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
      list.appendChild(item);
    });
  }

  const historyList = document.getElementById('historyListUser');
  if (!historyList) return;

  historyList.innerHTML = '';
  const history = requests.filter((request) => ['approved', 'returned', 'rejected'].includes(request.status));
  if (!history.length) {
    historyList.innerHTML = '<p class="empty-state">Chưa có lịch sử mượn.</p>';
    return;
  }

  history.forEach((request) => {
    const book = getBooks().find((item) => item.id === request.bookId);
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
    historyList.appendChild(item);
  });
}

function buildRequestListForManager() {
  const requests = getRequests();
  const list = document.getElementById('requestListManager');
  if (!list) return;

  list.innerHTML = '';
  if (!requests.length) {
    list.innerHTML = '<p class="empty-state">Chưa có yêu cầu mượn nào.</p>';
    return;
  }

  requests.forEach((request) => {
    const item = document.createElement('div');
    item.className = 'request-item';
    const book = getBooks().find((entry) => entry.id === request.bookId);
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
    button.addEventListener('click', () => approveRequest(button.dataset.approve));
  });
  list.querySelectorAll('[data-reject]').forEach((button) => {
    button.addEventListener('click', () => rejectRequest(button.dataset.reject));
  });
}

function renderDashboard() {
  const currentUser = getCurrentUser();
  const guestState = document.getElementById('guestState');
  const dashboard = document.getElementById('dashboard');
  const loginState = document.getElementById('loginState');

  if (!currentUser) {
    if (guestState) guestState.style.display = 'grid';
    if (dashboard) dashboard.style.display = 'none';
    if (loginState) loginState.innerHTML = '<p class="empty-state">Chưa có tài khoản nào đăng nhập.</p>';
    return;
  }

  if (guestState) guestState.style.display = 'none';
  if (dashboard) dashboard.style.display = 'grid';

  const managerPanel = document.getElementById('managerPanel');
  const userPanel = document.getElementById('userPanel');

  if (currentUser.role === 'manager') {
    if (managerPanel) managerPanel.style.display = 'block';
    if (userPanel) userPanel.style.display = 'none';
  } else {
    if (managerPanel) managerPanel.style.display = 'none';
    if (userPanel) userPanel.style.display = 'block';
  }

  if (loginState) {
    loginState.innerHTML = `
      <div class="user-pill">👤 ${currentUser.name} · ${currentUser.role === 'manager' ? 'Quản lý' : 'Người dùng'}</div>
      <button class="btn btn-secondary" type="button" id="logoutBtn">Đăng xuất</button>
    `;
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        setCurrentUser(null);
        syncUI();
      });
    }
  }

  renderBooks();
  buildRequestListForUser(currentUser.id);
  buildRequestListForManager();
}

function syncUI() {
  renderDashboard();
}

function registerUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const users = getUsers();

  if (!data.name || !data.username || !data.password) {
    showAlert('Vui lòng điền đầy đủ thông tin.', true);
    return;
  }

  if (users.some((user) => user.username.toLowerCase() === String(data.username).trim().toLowerCase())) {
    showAlert('Username đã tồn tại. Vui lòng chọn tên khác.', true);
    return;
  }

  const newUser = {
    id: crypto.randomUUID(),
    name: data.name.trim(),
    username: data.username.trim(),
    password: data.password,
    role: data.role || 'user'
  };

  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  form.reset();
  showAlert('Tạo tài khoản thành công. Bạn có thể đăng nhập ngay.', false);
  setCurrentUser(newUser);
  syncUI();
}

function loginUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const users = getUsers();
  const found = users.find((user) => user.username.toLowerCase() === String(data.username || '').trim().toLowerCase() && user.password === String(data.password || ''));

  if (!found) {
    showAlert('Thông tin đăng nhập không đúng.', true);
    return;
  }

  setCurrentUser(found);
  hideAlert();
  form.reset();
  syncUI();
}

function addBook(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const books = getBooks();

  if (!data.title || !data.author || !data.category) {
    showAlert('Vui lòng nhập đầy đủ tên sách, tác giả và thể loại.', true);
    return;
  }

  books.push({
    id: crypto.randomUUID(),
    title: data.title.trim(),
    author: data.author.trim(),
    category: data.category.trim(),
    status: data.status || 'available',
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));
  form.reset();
  renderBooks();
  buildRequestListForManager();
  showAlert('Đăng sách thành công.', false);
}

function submitRequest(event) {
  event.preventDefault();
  const currentUser = getCurrentUser();
  if (!currentUser || currentUser.role !== 'user') {
    showAlert('Chỉ người dùng mới được gửi yêu cầu mượn.', true);
    return;
  }

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.bookId || !data.startDate || !data.endDate) {
    showAlert('Vui lòng chọn sách và chọn ngày mượn, ngày trả.', true);
    return;
  }

  const books = getBooks();
  const selectedBook = books.find((book) => book.id === data.bookId);
  if (!selectedBook || selectedBook.status !== 'available') {
    showAlert('Sách này hiện không còn sẵn, vui lòng chọn cuốn khác.', true);
    return;
  }

  const requestData = {
    id: crypto.randomUUID(),
    userId: currentUser.id,
    userName: currentUser.name,
    bookId: selectedBook.id,
    startDate: data.startDate,
    endDate: data.endDate,
    note: data.note || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  const requests = getRequests();
  requests.push(requestData);
  localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
  form.reset();
  renderBooks();
  buildRequestListForUser(currentUser.id);
  buildRequestListForManager();
  showAlert('Yêu cầu mượn đã được gửi thành công. Quản lý sẽ duyệt trong thời gian sớm nhất.', false);
}

function approveRequest(requestId) {
  const requests = getRequests();
  const request = requests.find((item) => item.id === requestId);
  if (!request) return;

  request.status = 'approved';
  const books = getBooks();
  const targetBook = books.find((book) => book.id === request.bookId);
  if (targetBook) targetBook.status = 'borrowed';

  localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
  localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));
  renderBooks();
  buildRequestListForManager();
  const currentUser = getCurrentUser();
  if (currentUser) buildRequestListForUser(currentUser.id);
}

function rejectRequest(requestId) {
  const requests = getRequests();
  const request = requests.find((item) => item.id === requestId);
  if (!request) return;

  request.status = 'rejected';
  localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
  buildRequestListForManager();
  const currentUser = getCurrentUser();
  if (currentUser) buildRequestListForUser(currentUser.id);
}

function returnBook(bookId) {
  const books = getBooks();
  const targetBook = books.find((book) => book.id === bookId);
  if (!targetBook) return;

  targetBook.status = 'available';
  localStorage.setItem(STORAGE_KEYS.books, JSON.stringify(books));

  const requests = getRequests();
  const activeRequest = requests
    .filter((request) => request.bookId === bookId && ['approved', 'borrowed'].includes(request.status))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (activeRequest) {
    activeRequest.status = 'returned';
    localStorage.setItem(STORAGE_KEYS.requests, JSON.stringify(requests));
  }

  renderBooks();
  buildRequestListForManager();
  const currentUser = getCurrentUser();
  if (currentUser) buildRequestListForUser(currentUser.id);
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const bookForm = document.getElementById('bookForm');
  const requestForm = document.getElementById('requestForm');
  const bookSearch = document.getElementById('bookSearch');

  if (loginForm) loginForm.addEventListener('submit', loginUser);
  if (registerForm) registerForm.addEventListener('submit', registerUser);
  if (bookForm) bookForm.addEventListener('submit', addBook);
  if (requestForm) requestForm.addEventListener('submit', submitRequest);
  if (bookSearch) bookSearch.addEventListener('input', renderBookCatalog);

  boot();
});
