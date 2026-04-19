export const jsonFetch = async (url, init = {}) => {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
};

export const assertOk = (label, payload) => {
  if (!payload || payload.status !== 0) {
    const pretty = JSON.stringify(payload, null, 2);
    throw new Error(`${label} failed:\n${pretty}`);
  }
};

