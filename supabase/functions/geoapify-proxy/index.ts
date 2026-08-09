import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEOAPIFY_API_KEY = Deno.env.get('GEOAPIFY_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get('type');
  let geoapifyUrl;

  if (type === 'reverse') {
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'Missing lat/lon' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    geoapifyUrl = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lon}&apiKey=${GEOAPIFY_API_KEY}`;

  } else if (type === 'routing') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const mode = url.searchParams.get('mode') || 'drive';
    if (!from || !to) {
      return new Response(JSON.stringify({ error: 'Missing from/to' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    geoapifyUrl = `https://api.geoapify.com/v1/routing?waypoints=${from}|${to}&mode=${mode}&apiKey=${GEOAPIFY_API_KEY}`;

  } else {
    return new Response(JSON.stringify({ error: 'Invalid or missing type param (expected reverse|routing)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const geoRes = await fetch(geoapifyUrl);
  const body = await geoRes.text();

  return new Response(body, {
    status: geoRes.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});