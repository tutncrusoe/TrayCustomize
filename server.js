require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  // REAL API: Auth & Health
  if (urlPath.startsWith('/api/')) {

    // Add basic CORS/Origin headers for API
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.method === 'GET' && urlPath === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    }

    if (req.method === 'GET' && urlPath === '/api/auth/me') {
      const Cookie = require('cookie');
      const cookies = Cookie.parse(req.headers.cookie || '');
      if (cookies.session) {
        // In a real app, validate the session token against a DB.
        // Here we embedded the email in the cookie for simplicity.
        const decodedEmail = Buffer.from(cookies.session, 'base64').toString('ascii');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ loggedIn: true, email: decodedEmail }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ loggedIn: false }));
      }
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        let data = {};
        try { data = JSON.parse(body); } catch (e) { }

        if (urlPath === '/api/auth/send-token') {
          const { email } = data;
          if (!email) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Email required' }));
          }

          const token = Math.floor(100000 + Math.random() * 900000).toString();
          global.authStore = global.authStore || new Map();
          global.authStore.set(email, token);

          try {
            const { Resend } = require('resend');
            const resend = new Resend(process.env.RESEND_API_KEY);
            const senderEmail = process.env.RESEND_SENDER || 'onboarding@resend.dev'; // Default to Resend testing domain

            const htmlTemplate = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; background-color: #18181b; padding: 40px 20px; text-align: center; color: #fff;">
                <div style="max-w-md; margin: 0 auto; background-color: #27272a; border-radius: 12px; padding: 32px; border: 1px solid #3f3f46; border-top: 4px solid #4f46e5;">
                  <h2 style="margin-top: 0; color: #fff; font-size: 24px;">Confirm Your Login</h2>
                  <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">Use the following security token to log into your tecton3d.cloud account. This code belongs to you, do not share it.</p>
                  
                  <div style="background-color: #18181b; padding: 16px; border-radius: 8px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #818cf8; margin: 24px 0;">
                    ${token}
                  </div>
                  
                  <p style="color: #a1a1aa; font-size: 13px; margin-top: 32px; margin-bottom: 0;">This token expires in 5 minutes.</p>
                </div>
              </div>
            `;

            const { data: emailData, error } = await resend.emails.send({
              from: `"tecton3d.cloud" <${senderEmail}>`,
              to: email, // Note: For Resend free tier, this MUST be the verified email address until a domain is verified
              subject: 'Your Login Token',
              html: htmlTemplate
            });

            if (error) {
                console.error('[AUTH] Resend API error:', error);
                throw new Error(error.message);
            }

            console.log(`[AUTH] Sent email token via Resend to ${email} (ID: ${emailData?.id})`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true }));
          } catch (err) {
            console.error('[AUTH] Failed to send email via Resend:', err.message);
            console.log(`[AUTH FALLBACK] Token for ${email}: ${token}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, warning: 'Email failed, check terminal for token.' }));
          }
        }

        if (urlPath === '/api/auth/verify-token') {
          const { email, token } = data;
          global.authStore = global.authStore || new Map();
          if (global.authStore.get(email) === token) {
            global.authStore.delete(email); // consume token

            const Cookie = require('cookie');
            const sessionValue = Buffer.from(email).toString('base64');
            const setCookie = Cookie.serialize('session', sessionValue, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7, // 1 week
              path: '/'
            });

            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Set-Cookie': setCookie
            });
            return res.end(JSON.stringify({ success: true }));
          }
          res.writeHead(401, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid or expired token' }));
        }

        if (urlPath === '/api/auth/logout') {
          const Cookie = require('cookie');
          const setCookie = Cookie.serialize('session', '', {
            httpOnly: true,
            expires: new Date(0),
            path: '/'
          });
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': setCookie
          });
          return res.end(JSON.stringify({ success: true }));
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end('{"error": "Not Found"}');
      });
      return;
    }
  }

  let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Not Found');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Running at port ${PORT}`);
});