import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from '../config/database.js';
import { AppError } from '../utils/errors.js';
import { ErrorKey, getErrorMessage } from '../constants/errorCatalog.js';

export type ThemePayload = Record<string, any>;

export type ThemeRow = {
  id: string;
  name: string;
  calendar_category: string;
  calendar_category_display: string;
  payload_json: any;
  is_deleted: 0 | 1;
  created_at: Date;
  updated_at: Date;
};

type CatalogMetaRow = {
  id: number;
  version: string;
};

const nowVersion = () => new Date().toISOString();

const getCatalogVersion = async (): Promise<string> => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT version FROM app_theme_catalog_meta WHERE id = 1 LIMIT 1'
  );
  const v = (rows as any[])[0]?.version as string | undefined;
  return v || '1970-01-01T00:00:00.000Z';
};

const bumpCatalogVersion = async (): Promise<string> => {
  const v = nowVersion();
  await pool.query<ResultSetHeader>(
    'UPDATE app_theme_catalog_meta SET version = ? WHERE id = 1',
    [v]
  );
  return v;
};

export const listThemes = async (): Promise<{ version: string; themes: ThemePayload[] }> => {
  const version = await getCatalogVersion();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT payload_json FROM app_themes WHERE is_deleted = FALSE ORDER BY created_at DESC'
  );
  const themes = (rows as any[]).map((r) => r.payload_json);
  return { version, themes };
};

export const getThemeById = async (id: string): Promise<{ version: string; theme: ThemePayload }> => {
  const version = await getCatalogVersion();
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT payload_json FROM app_themes WHERE id = ? AND is_deleted = FALSE LIMIT 1',
    [id]
  );
  if ((rows as any[]).length === 0) {
    throw new AppError(ErrorKey.ThemeNotFound, getErrorMessage(ErrorKey.ThemeNotFound));
  }
  return { version, theme: (rows as any[])[0].payload_json };
};

export const createTheme = async (theme: ThemePayload): Promise<{ version: string; theme: ThemePayload }> => {
  const id = String(theme.id || '').trim();
  if (!id) {
    throw new AppError(ErrorKey.RequestInvalid, getErrorMessage(ErrorKey.RequestInvalid));
  }

  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO app_themes (id, name, calendar_category, calendar_category_display, payload_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        theme.id,
        theme.name,
        theme.calendarCategory,
        theme.calendarCategoryDisplay,
        JSON.stringify(theme),
      ]
    );
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      throw new AppError(ErrorKey.ThemeAlreadyExists, getErrorMessage(ErrorKey.ThemeAlreadyExists));
    }
    throw err;
  }

  const version = await bumpCatalogVersion();
  return { version, theme };
};

export const deleteTheme = async (id: string): Promise<{ version: string; deletedId: string }> => {
  const [result] = await pool.query<ResultSetHeader>(
    'UPDATE app_themes SET is_deleted = TRUE WHERE id = ? AND is_deleted = FALSE',
    [id]
  );
  if ((result as ResultSetHeader).affectedRows === 0) {
    throw new AppError(ErrorKey.ThemeNotFound, getErrorMessage(ErrorKey.ThemeNotFound));
  }
  const version = await bumpCatalogVersion();
  return { version, deletedId: id };
};

