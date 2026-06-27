// Tiny env helper — reads process.env with a default, throws if a required var is missing.
export const env = (key, fallback) => {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};
