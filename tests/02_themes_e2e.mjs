import { jsonFetch, assertOk } from './_helpers.mjs';

// Hardcoded config (edit if needed)
const BASE_URL = 'http://localhost:8000';
// Theme id must exist in themes.json on GitHub
const THEME_ID = 'morning_track_glow';

const main = async () => {
  // 1) GET /app/themes
  let themesBody;
  {
    const { body } = await jsonFetch(`${BASE_URL}/app/themes`);
    assertOk('GET /app/themes', body);
    themesBody = body;
    console.log(`✅ GET /app/themes: version=${body.data?.version} count=${body.data?.themes?.length ?? 0}`);
  }

  // 2) GET /app/themes/:id
  {
    const id = themesBody?.data?.themes?.[0]?.id ?? THEME_ID;
    const { body } = await jsonFetch(`${BASE_URL}/app/themes/${encodeURIComponent(id)}`);
    assertOk('GET /app/themes/:id', body);
    console.log(`✅ GET /app/themes/:id: id=${body?.data?.theme?.id}`);
  }

  console.log('🎉 Themes GET tests passed');
};

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
