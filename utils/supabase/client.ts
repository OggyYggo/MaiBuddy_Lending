import { createBrowserClient } from "@supabase/ssr";

const diagnosticFetch: typeof fetch = async (input, init) => {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  try {
    const response = await fetch(input, init);
    const pathname = new URL(requestUrl).pathname;
    const isDashboardStatsRequest = pathname.startsWith('/rest/v1/v_');
    const isBorrowersRequest = pathname.endsWith('/rest/v1/borrowers');
    if (!response.ok && (isBorrowersRequest || isDashboardStatsRequest)) {
      console.error(isDashboardStatsRequest ? 'Supabase dashboard statistics request failed:' : 'Supabase borrowers request failed:', {
        endpoint: pathname,
        status: response.status,
        statusText: response.statusText,
        body: await response.clone().text(),
      });
    }
    return response;
  } catch (error) {
    const pathname = new URL(requestUrl).pathname;
    if (pathname.endsWith('/rest/v1/borrowers') || pathname.startsWith('/rest/v1/v_')) {
      console.error('Supabase network request failed:', { endpoint: pathname, error });
    }
    throw error;
  }
};

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    { global: { fetch: diagnosticFetch } },
  );
};
