#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const excludedServices = ['studio', 'mailpit', 'imgproxy', 'edge-runtime', 'realtime', 'postgres-meta'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: options.env || process.env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const commandLabel = [command, ...args].join(' ');
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : '';
    throw new Error(`Command failed: ${commandLabel}${stderr}`);
  }

  return result.stdout || '';
}

function hasCommand(command) {
  const check = spawnSync('zsh', ['-lc', `command -v ${command}`], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return check.status === 0;
}

function parseEnvOutput(output) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce((env, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) return env;
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value =
        rawValue.startsWith('"') && rawValue.endsWith('"')
          ? rawValue.slice(1, -1)
          : rawValue.startsWith("'") && rawValue.endsWith("'")
            ? rawValue.slice(1, -1)
            : rawValue;
      env[key] = value;
      return env;
    }, {});
}

function main() {
  if (!hasCommand('docker')) {
    console.error('Missing `docker`. Start a local container runtime before running managed Supabase local tests.');
    process.exit(1);
  }

  console.log('Stopping existing local Supabase stack ...');
  spawnSync('npx', ['supabase', 'stop'], {
    cwd: projectRoot,
    stdio: 'inherit',
    encoding: 'utf8',
    env: process.env,
  });

  console.log('Starting local Supabase stack ...');
  run('npx', [
    'supabase',
    'start',
    ...excludedServices.flatMap((service) => ['-x', service]),
  ]);

  console.log('Resetting local database with migrations and dev seed ...');
  run('npx', ['supabase', 'db', 'reset', '--yes']);

  console.log('Reading local Supabase connection env ...');
  const statusEnvOutput = run('npx', ['supabase', 'status', '-o', 'env'], { capture: true });
  const supabaseEnv = parseEnvOutput(statusEnvOutput);
  const requiredKeys = ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];
  const missingKeys = requiredKeys.filter((key) => !supabaseEnv[key]);
  if (missingKeys.length) {
    console.error(`Missing expected Supabase status keys: ${missingKeys.join(', ')}`);
    process.exit(1);
  }

  console.log('Running local Supabase integration suite ...');
  run('npx', ['playwright', 'test', '--config', 'tests/supabase/local.playwright.config.js'], {
    env: {
      ...process.env,
      ...supabaseEnv,
      SUPABASE_URL: process.env.SUPABASE_URL || supabaseEnv.API_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || supabaseEnv.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseEnv.SERVICE_ROLE_KEY,
    },
  });
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
