// Crea y elimina únicamente una BD de prueba con nombre aleatorio propio.
require('dotenv').config();
const { randomBytes } = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const path = require('node:path');
const database = `real_ejecutivo_test_${randomBytes(5).toString('hex')}`;
const url = new URL(process.env.DATABASE_URL);
url.pathname = `/${database}`;
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  RUN_DATABASE_TESTS: '1',
};
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error || result.status !== 0)
    throw new Error(`Falló el proceso de prueba: ${command}`);
}
let created = false;
const children = [];
try {
  run('docker', [
    'compose',
    'exec',
    '-T',
    'postgres',
    'createdb',
    '-U',
    process.env.POSTGRES_USER,
    database,
  ]);
  created = true;
  run(
    process.execPath,
    [
      path.join('node_modules', 'prisma', 'build', 'index.js'),
      'migrate',
      'deploy',
    ],
    { env },
  );
  run(
    process.execPath,
    [
      path.join('node_modules', 'jest', 'bin', 'jest.js'),
      '--config',
      './test/jest-e2e.json',
      '--runInBand',
    ],
    { env },
  );
  if (process.env.OPERATIONS_BROWSER_REVIEW) {
    const backendPort = 23000 + Math.floor(Math.random() * 1000);
    const frontendPort = backendPort + 1000;
    children.push(
      spawn(process.execPath, ['dist/main.js'], {
        env: {
          ...env,
          PORT: String(backendPort),
          FRONTEND_ORIGINS: `http://127.0.0.1:${frontendPort}`,
        },
        stdio: 'inherit',
      }),
    );
    children.push(
      spawn(
        process.execPath,
        [
          path.resolve('../frontend/node_modules/vite/bin/vite.js'),
          '--host',
          '127.0.0.1',
          '--port',
          String(frontendPort),
        ],
        {
          cwd: path.resolve('../frontend'),
          env: { ...env, API_PROXY_TARGET: `http://127.0.0.1:${backendPort}` },
          stdio: 'inherit',
        },
      ),
    );
    run(process.execPath, [process.env.OPERATIONS_BROWSER_REVIEW], {
      env: { ...env, REVIEW_URL: `http://127.0.0.1:${frontendPort}` },
    });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  children.forEach((child) => child.kill());
  if (created) {
    try {
      run('docker', [
        'compose',
        'exec',
        '-T',
        'postgres',
        'dropdb',
        '-U',
        process.env.POSTGRES_USER,
        '--force',
        database,
      ]);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
