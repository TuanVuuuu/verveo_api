import { jsonFetch, assertOk } from './_helpers.mjs';

// Hardcoded config (edit if needed)
const BASE_URL = 'http://localhost:8000';
const EMAIL = 'test@example.com';
const PASSWORD = 'test123456';
const SERVICE_TOKEN = 'localtest'; // required for POST/DELETE
const IMG_URL =
  'https://firebasestorage.googleapis.com/v0/b/verveo-5a802.firebasestorage.app/o/backgrounds%2Fimg_morning_track_glow.png?alt=media&token=c8e8c0f0-f812-4a75-8dda-e9acc21f8255';

const getJwt = async () => {
  const { body } = await jsonFetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assertOk('auth/login', body);
  const token = body?.data?.token;
  if (!token) throw new Error('JWT missing from login response');
  return token;
};

const main = async () => {
  const jwt = await getJwt();

  // 1) GET /app/themes
  {
    const { body } = await jsonFetch(`${BASE_URL}/app/themes`);
    assertOk('GET /app/themes', body);
    console.log(`✅ GET /app/themes: version=${body.data?.version} count=${body.data?.themes?.length ?? 0}`);
  }

  // 2) POST /app/themes (auto blurHash)
  const themeId = `theme_e2e_${Date.now()}`;
  {
    const payload = {
      id: themeId,
      name: `Theme E2E ${themeId}`,
      calendarCategory: 'backgrounds',
      calendarCategoryDisplay: 'Backgrounds',
      imgUrl: IMG_URL,
      calendarMonthlyView: {
        monthTitleColor: 4294967295,
        dayOfWeekColor: 4294967295,
        dayNumberColor: 4294967295,
        dayLunarNumberColor: 4294967295,
        isStatusDark: false,
      },
      calendarWeeklyView: {
        weekTitleColor: 4294967295,
        dayLabelColor: 4294967295,
        timelineHourColor: 4294967295,
        eventTitleColor: 4294967295,
        eventTimeColor: 4294967295,
      },
      homeView: {
        headerText: 4294967295,
        isStatusDark: false,
      },
    };

    const { body } = await jsonFetch(`${BASE_URL}/app/themes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        'X-SERVICE-TOKEN': SERVICE_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    assertOk('POST /app/themes', body);
    const blurHash = body?.data?.theme?.blurHash;
    if (!blurHash) throw new Error('POST theme succeeded but blurHash missing (expected auto-generate)');
    console.log(`✅ POST /app/themes: id=${themeId} blurHashLen=${String(blurHash).length}`);
  }

  // 3) GET /app/themes/:id
  {
    const { body } = await jsonFetch(`${BASE_URL}/app/themes/${encodeURIComponent(themeId)}`);
    assertOk('GET /app/themes/:id', body);
    console.log(`✅ GET /app/themes/:id: id=${body?.data?.theme?.id}`);
  }

  // 4) DELETE /app/themes/:id
  {
    const { body } = await jsonFetch(`${BASE_URL}/app/themes/${encodeURIComponent(themeId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-SERVICE-TOKEN': SERVICE_TOKEN,
      },
    });
    assertOk('DELETE /app/themes/:id', body);
    console.log(`✅ DELETE /app/themes/:id: deletedId=${body?.data?.deletedId}`);
  }

  // 5) Negative: POST missing imgUrl should fail with explicit message
  {
    const payload = {
      id: `missing_img_${Date.now()}`,
      name: 'Missing Img',
      calendarCategory: 'x',
      calendarCategoryDisplay: 'x',
      calendarMonthlyView: {},
      calendarWeeklyView: {},
      homeView: {},
    };
    const { body } = await jsonFetch(`${BASE_URL}/app/themes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        'X-SERVICE-TOKEN': SERVICE_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    if (body?.status !== 1 || body?.message !== 'imgUrl is required') {
      throw new Error(`Expected imgUrl required error, got:\n${JSON.stringify(body, null, 2)}`);
    }
    console.log(`✅ POST missing imgUrl: message="${body.message}"`);
  }

  console.log('🎉 Themes E2E tests passed');
};

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

