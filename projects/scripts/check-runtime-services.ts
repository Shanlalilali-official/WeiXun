import { createServerClient } from '../src/storage/database/supabase-client';

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('health_check')
    .select('id')
    .limit(1)
    .abortSignal(controller.signal);

  if (error) {
    console.error(`Database connectivity check failed (${error.code || 'SUPABASE_QUERY_FAILED'}).`);
    console.error('Check the network connection and SUPABASE_* values in projects\\.env.local.');
    process.exitCode = 1;
  } else {
    console.log('Database connectivity check passed.');
  }
} catch (error) {
  const code = error instanceof Error && error.name === 'AbortError'
    ? 'SUPABASE_CONNECT_TIMEOUT'
    : 'SUPABASE_CONNECT_FAILED';
  console.error(`Database connectivity check failed (${code}).`);
  console.error('Check the network connection and SUPABASE_* values in projects\\.env.local.');
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
