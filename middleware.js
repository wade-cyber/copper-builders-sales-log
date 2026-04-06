// Vercel Edge Middleware — rate limiting for /api/* routes
// Simple sliding window: 60 requests per minute per IP

const windowMs = 60 * 1000;
const maxRequests = 60;
const ipCounts = new Map();

// Clean up expired entries every 5 minutes
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [ip, entry] of ipCounts) {
    if (now - entry.windowStart > windowMs * 2) ipCounts.delete(ip);
  }
}

export default function middleware(request) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return;

  cleanup();

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  let entry = ipCounts.get(ip);

  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, count: 0 };
    ipCounts.set(ip, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again in a minute.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }
}

export const config = {
  matcher: '/api/:path*',
};
