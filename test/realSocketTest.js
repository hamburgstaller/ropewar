/**
 * Socket.io test that mimics a browser:
 * 1. Login over HTTP, obtain cookie
 * 2. Issue engine.io polling request with the cookie
 * 3. Verify results
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { io } = require('socket.io-client');

const BASE = 'http://localhost:3000';
const COOKIE_FILE = path.join(os.tmpdir(), 'halatcekme_cookie.txt');

function readCookie(file) {
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split('\n')) {
    if (line.includes('connect.sid')) {
      const parts = line.split('\t');
      return `connect.sid=${parts[parts.length - 1].trim()}`;
    }
  }
  return null;
}

(async () => {
  const cookie = readCookie('/tmp/testcookie.txt');
  if (!cookie) {
    console.log('No cookie found, logging in first...');
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `sockettest_${Date.now()}@x.com`,
        username: `SocketTester${Math.floor(Math.random() * 1000)}`,
        password: '123456'
      })
    });
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) {
      console.error('Register failed');
      process.exit(1);
    }
    const sid = setCookie.split(';')[0];
    fs.writeFileSync(COOKIE_FILE,
      `# Netscape HTTP Cookie File\nlocalhost\tFALSE\t/\tFALSE\t9999999999\t${sid.split('=')[0]}\t${sid.split('=')[1]}\n`);
    console.log('New cookie:', sid);
  } else {
    console.log('Existing cookie:', cookie);
  }

  // Now try the socket connection
  const sid = readCookie(COOKIE_FILE) || cookie;
  console.log('\n=== Trying socket connection (polling) ===');
  console.log('With cookie:', sid);

  const socket = io(BASE, {
    transports: ['polling'],
    extraHeaders: { Cookie: sid },
    withCredentials: true,
    forceNew: true,
    reconnection: false
  });

  socket.on('connect', () => {
    console.log('SOCKET CONNECTED:', socket.id);

    // Create a pending match
    fetch(`${BASE}/api/match/bot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: sid },
      body: JSON.stringify({ mode: '1v1' })
    })
      .then(r => r.json())
      .then(data => {
        console.log('Bot match:', data);
        socket.disconnect();
        process.exit(0);
      });
  });

  socket.on('connect_error', (err) => {
    console.error('Connect error:', err.message);
    process.exit(1);
  });

  socket.on('server:match_found', (data) => {
    console.log('Match found:', data.matchId);
  });

  setTimeout(() => {
    console.error('TIMEOUT');
    process.exit(1);
  }, 8000);
})();
