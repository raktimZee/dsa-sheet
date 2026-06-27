// Minimal structured logger — no external dep, JSON lines so it's grep/CloudWatch friendly.
const at = () => new Date().toISOString();
const line = (level, svc, msg, extra) =>
  JSON.stringify({ t: at(), level, svc, msg, ...(extra || {}) });

export const logger = (svc) => ({
  info: (msg, extra) => console.log(line('info', svc, msg, extra)),
  warn: (msg, extra) => console.warn(line('warn', svc, msg, extra)),
  error: (msg, extra) => console.error(line('error', svc, msg, extra)),
});
