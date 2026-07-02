import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

export type ThemePayload = Record<string, unknown>;

type ThemeCatalog = {
  version: string;
  themes: ThemePayload[];
};

let cache: { at: number; catalog: ThemeCatalog } | null = null;
const CACHE_TTL_MS = 60_000;

const getCatalogUrl = (): string => {
  const url = process.env.THEME_CATALOG_JSON_URL?.trim();
  if (!url) {
    throw new AppError(ErrorKey.Internal, 'THEME_CATALOG_JSON_URL is not configured');
  }
  return url;
};

const fetchCatalog = async (): Promise<ThemeCatalog> => {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.catalog;
  }

  const url = getCatalogUrl();
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new AppError(ErrorKey.Internal, 'Failed to fetch theme catalog from remote JSON');
  }

  if (!res.ok) {
    throw new AppError(ErrorKey.Internal, `Failed to fetch theme catalog (status ${res.status})`);
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new AppError(ErrorKey.Internal, 'Theme catalog JSON is not valid');
  }

  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as ThemeCatalog).themes)) {
    throw new AppError(ErrorKey.Internal, 'Theme catalog JSON must contain themes[]');
  }

  const catalog: ThemeCatalog = {
    version: String((raw as ThemeCatalog).version ?? new Date().toISOString()),
    themes: (raw as ThemeCatalog).themes,
  };

  cache = { at: now, catalog };
  return catalog;
};

export const listThemes = async (): Promise<{ version: string; themes: ThemePayload[] }> => {
  const catalog = await fetchCatalog();
  return { version: catalog.version, themes: catalog.themes };
};

export const getThemeById = async (id: string): Promise<{ version: string; theme: ThemePayload }> => {
  const catalog = await fetchCatalog();
  const theme = catalog.themes.find((t) => String((t as { id?: string })?.id) === id);
  if (!theme) {
    throw new AppError(ErrorKey.ThemeNotFound, getErrorMessage(ErrorKey.ThemeNotFound));
  }
  return { version: catalog.version, theme };
};
