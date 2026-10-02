import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const dbPath = path.join(process.cwd(), 'data', 'library.db');
let server;

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch('http://localhost:3100/health');
      if (response.ok) return;
    } catch {
      // retry until server starts
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('API server did not start in time.');
}

test.before(async () => {
  await fs.rm(path.dirname(dbPath), { recursive: true, force: true });
  server = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '3100' },
    stdio: 'inherit',
  });
  await waitForServer();
});

test.after(() => {
  if (server) {
    server.kill('SIGINT');
  }
});

test('user can register and request a book, manager can approve and return it', async () => {
  const registration = await fetch('http://localhost:3100/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test Student',
      username: 'teststudent',
      password: '123456',
      role: 'user',
    }),
  });

  assert.equal(registration.status, 201);
  const registeredUser = await registration.json();
  assert.equal(registeredUser.user.role, 'user');

  const booksResponse = await fetch('http://localhost:3100/api/books');
  assert.equal(booksResponse.status, 200);
  const booksPayload = await booksResponse.json();
  assert.ok(booksPayload.books.length >= 1);
  const availableBook = booksPayload.books.find((book) => book.status === 'available');
  assert.ok(availableBook);

  const requestResponse = await fetch('http://localhost:3100/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: registeredUser.user.id,
      userName: registeredUser.user.name,
      bookId: availableBook.id,
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      note: 'Mượn để ôn tập',
    }),
  });

  assert.equal(requestResponse.status, 201, 'request creation should succeed');
  const requestPayload = await requestResponse.json();
  assert.equal(requestPayload.request.status, 'pending');

  const managerLogin = await fetch('http://localhost:3100/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'manager', password: '123456' }),
  });

  assert.equal(managerLogin.status, 200);

  const approveResponse = await fetch(`http://localhost:3100/api/requests/${requestPayload.request.id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  assert.equal(approveResponse.status, 200);
  const approvePayload = await approveResponse.json();
  assert.equal(approvePayload.status, 'approved');

  const returnResponse = await fetch(`http://localhost:3100/api/books/${availableBook.id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  assert.equal(returnResponse.status, 200);
  const returnPayload = await returnResponse.json();
  assert.equal(returnPayload.status, 'available');

  const statsResponse = await fetch('http://localhost:3100/api/stats');
  assert.equal(statsResponse.status, 200);
  const statsPayload = await statsResponse.json();
  assert.ok(statsPayload.totalBooks >= 1000);
});
