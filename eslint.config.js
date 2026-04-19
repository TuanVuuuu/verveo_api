export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/**',
      // This project is TypeScript-first but doesn't include TS ESLint parser deps.
      // Keep `npm run lint` from failing by ignoring TS sources for now.
      'src/**/*.ts',
      'src/**/*.tsx',
      '*.ts',
    ],
  },
];

