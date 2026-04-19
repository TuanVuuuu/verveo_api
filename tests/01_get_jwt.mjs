import { jsonFetch, assertOk } from './_helpers.mjs';

// Hardcoded config (edit if needed)
const BASE_URL = 'http://localhost:8000';
const EMAIL = 'test@example.com';
const PASSWORD = 'test123456';

const main = async () => {
  const { body } = await jsonFetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  assertOk('auth/login', body);

  const token = body?.data?.token;
  if (!token) throw new Error('Login succeeded but token missing in response');

  // Print token only (so it can be captured)
  process.stdout.write(String(token));
};

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

