import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const DB_PATH = path.join(__dirname, 'data', 'library.db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

async function ensureDataDirectory() {
  const fs = await import('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

await ensureDataDirectory();

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log(`Connected to SQLite database at ${DB_PATH}`);
  }
});

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function onResult(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });

async function initializeDatabase() {
  await ensureDataDirectory();

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      book_id TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const managerExists = await get('SELECT id FROM users WHERE username = ?', ['manager']);
  if (!managerExists) {
    await run(
      'INSERT INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), 'Quản lý trường', 'manager', '123456', 'manager']
    );
  }

  const studentExists = await get('SELECT id FROM users WHERE username = ?', ['student01']);
  if (!studentExists) {
    await run(
      'INSERT INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), 'Nguyễn Văn A', 'student01', '123456', 'user']
    );
  }

  const countBooks = await get('SELECT COUNT(*) as total FROM books');
  if (!countBooks || countBooks.total === 0) {
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

    for (let i = 0; i < 1000; i += 1) {
      const category = categories[i % categories.length];
      const author = authors[i % authors.length];
      const title = `${category} ${String(i + 1).padStart(3, '0')}`;
      await run(
        'INSERT INTO books (id, title, author, category, status) VALUES (?, ?, ?, ?, ?)',
        [randomUUID(), title, author, category, i % 14 === 0 ? 'borrowed' : 'available']
      );
    }
  }
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, message: 'Library API is healthy.' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, username, password, role } = req.body || {};

  if (!name || !username || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ họ tên, username và mật khẩu.' });
  }

  const normalizedUsername = String(username).trim();
  const existing = await get('SELECT id FROM users WHERE username = ?', [normalizedUsername.toLowerCase()]);
  if (existing) {
    return res.status(409).json({ message: 'Username đã tồn tại.' });
  }

  const user = {
    id: randomUUID(),
    name: String(name).trim(),
    username: normalizedUsername,
    password: String(password),
    role: role === 'manager' ? 'manager' : 'user'
  };

  await run(
    'INSERT INTO users (id, name, username, password, role) VALUES (?, ?, ?, ?, ?)',
    [user.id, user.name, user.username, user.password, user.role]
  );

  res.status(201).json({ user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập username và mật khẩu.' });
  }

  const user = await get(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [String(username).trim(), String(password)]
  );

  if (!user) {
    return res.status(401).json({ message: 'Thông tin đăng nhập không đúng.' });
  }

  res.json({ user: sanitizeUser(user) });
});

app.get('/api/books', async (_req, res) => {
  const books = await all('SELECT * FROM books ORDER BY created_at DESC');
  res.json({ books });
});

app.post('/api/books', async (req, res) => {
  const { title, author, category, status } = req.body || {};

  if (!title || !author || !category) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tên sách, tác giả và thể loại.' });
  }

  const book = {
    id: randomUUID(),
    title: String(title).trim(),
    author: String(author).trim(),
    category: String(category).trim(),
    status: status === 'borrowed' ? 'borrowed' : 'available'
  };

  await run(
    'INSERT INTO books (id, title, author, category, status) VALUES (?, ?, ?, ?, ?)',
    [book.id, book.title, book.author, book.category, book.status]
  );

  res.status(201).json({ book });
});

app.get('/api/requests', async (_req, res) => {
  const requests = await all('SELECT * FROM requests ORDER BY created_at DESC');
  res.json({ requests });
});

app.post('/api/requests', async (req, res) => {
  const { userId, userName, bookId, startDate, endDate, note } = req.body || {};

  if (!userId || !userName || !bookId || !startDate || !endDate) {
    return res.status(400).json({ message: 'Thiếu thông tin yêu cầu mượn.' });
  }

  const book = await get('SELECT * FROM books WHERE id = ?', [bookId]);
  if (!book) {
    return res.status(404).json({ message: 'Sách không tồn tại.' });
  }

  if (book.status !== 'available') {
    return res.status(409).json({ message: 'Sách hiện không còn sẵn để mượn.' });
  }

  const request = {
    id: randomUUID(),
    userId,
    userName,
    bookId,
    startDate,
    endDate,
    note: note || '',
    status: 'pending'
  };

  await run(
    'INSERT INTO requests (id, user_id, user_name, book_id, start_date, end_date, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [request.id, request.userId, request.userName, request.bookId, request.startDate, request.endDate, request.note, request.status]
  );

  res.status(201).json({ request });
});

app.post('/api/requests/:id/approve', async (req, res) => {
  const request = await get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
  if (!request) {
    return res.status(404).json({ message: 'Yêu cầu không tồn tại.' });
  }

  await run('UPDATE requests SET status = ? WHERE id = ?', ['approved', request.id]);
  await run('UPDATE books SET status = ? WHERE id = ?', ['borrowed', request.book_id]);

  res.json({ success: true, status: 'approved' });
});

app.post('/api/requests/:id/reject', async (req, res) => {
  const request = await get('SELECT * FROM requests WHERE id = ?', [req.params.id]);
  if (!request) {
    return res.status(404).json({ message: 'Yêu cầu không tồn tại.' });
  }

  await run('UPDATE requests SET status = ? WHERE id = ?', ['rejected', request.id]);
  res.json({ success: true, status: 'rejected' });
});

app.post('/api/books/:id/return', async (req, res) => {
  const book = await get('SELECT * FROM books WHERE id = ?', [req.params.id]);
  if (!book) {
    return res.status(404).json({ message: 'Sách không tồn tại.' });
  }

  await run('UPDATE books SET status = ? WHERE id = ?', ['available', book.id]);

  const request = await get(
    'SELECT * FROM requests WHERE book_id = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1',
    [book.id, 'approved', 'borrowed']
  );

  if (request) {
    await run('UPDATE requests SET status = ? WHERE id = ?', ['returned', request.id]);
  }

  res.json({ success: true, bookId: book.id, status: 'available' });
});

app.get('/api/stats', async (_req, res) => {
  const totalBooks = await get('SELECT COUNT(*) as value FROM books');
  const available = await get('SELECT COUNT(*) as value FROM books WHERE status = ?', ['available']);
  const borrowed = await get('SELECT COUNT(*) as value FROM books WHERE status = ?', ['borrowed']);
  const pending = await get('SELECT COUNT(*) as value FROM requests WHERE status = ?', ['pending']);
  const users = await get('SELECT COUNT(*) as value FROM users');
  const categories = await all(
    'SELECT category, COUNT(*) as total FROM books GROUP BY category ORDER BY total DESC LIMIT 5'
  );

  res.json({
    totalBooks: totalBooks?.value || 0,
    available: available?.value || 0,
    borrowed: borrowed?.value || 0,
    pending: pending?.value || 0,
    users: users?.value || 0,
    categories
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function startServer() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Unable to start server:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
