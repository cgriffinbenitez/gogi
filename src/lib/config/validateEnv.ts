const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'ANTHROPIC_API_KEY',
];

export function validateEnv() {
  const missing = REQUIRED.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `GOGI: Missing required env vars: ${missing.join(', ')}\nCheck .env.local`,
    );
  }
}
