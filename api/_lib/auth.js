// API authentication — checks x-api-key header against API_SECRET env var.
// For cron endpoints, checks the Authorization header with CRON_SECRET.

export function requireAuth(req) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_SECRET) {
    return { authorized: false, status: 401, error: 'Unauthorized' };
  }
  return { authorized: true };
}

export function requireCronAuth(req) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) {
    return { authorized: true };
  }
  // Also allow API key for manual triggers from admin dashboard
  return requireAuth(req);
}
