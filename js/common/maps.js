/* ── SHARED MAP/ROUTING HELPERS (Phase 5.3.6) ────────────────
   Moved from js/customer/index.js and js/worker/dashboard.js.
   These six functions were byte-identical in both files except for
   naming: index.js used the base names, dashboard.js used a "W"
   suffix on each (_fetchRoadRouteW, _fmtDistanceW, etc.) so the two
   files could load independently without colliding as globals.

   To move to a single shared module WITHOUT renaming any existing
   call site in either page-specific file, the canonical logic lives
   once under the original (non-W) name, and each "W" name is kept as
   a plain alias pointing at the same function. This is not a
   behavior change — it is the only way to satisfy "do not rename
   functions" while still sharing one implementation instead of two
   copies of the same code.

   Phase 6.1: no longer requires CONFIG.GEOAPIFY_API_KEY — the key was
   removed from the client and both Geoapify calls below now go through
   the geoapify-proxy Supabase Edge Function instead. Requires
   SUPABASE_URL (js/common/supabase.js) and window.sb to be loaded
   first, for the proxy URL and the caller's session token. No DOM ids,
   no _trkState/_trkStateW, no page-specific globals are referenced
   anywhere in this file. */

/* ── PHASE 4.7: GEOAPIFY REVERSE GEOCODING ───────────────────
   Resolves a lat/lng picked on the pin map to a human-readable
   building/society name. Field preference order per spec: building
   is always shown first if present, then amenity, name, housename,
   street, suburb, locality. Read-only lookup — never writes
   anything, never touches pendBk or Supabase. */
async function _geoapifyReverseGeocode(lat, lng){
  const { data: { session } } = await sb.auth.getSession();
  const url = `${SUPABASE_URL}/functions/v1/geoapify-proxy?type=reverse&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${session?.access_token}` }
  });
  if(!res.ok) throw new Error('Geoapify reverse geocode HTTP '+res.status);
  const data = await res.json();
  const p = data?.features?.[0]?.properties || {};
  return p.building || p.amenity || p.name || p.housename || p.street || p.suburb || p.locality || null;
}

/* Phase 4.7: Geoapify Routing API road route — replaces OSRM.
   Returns an array of [lat,lng] pairs following actual roads/turns/
   junctions, or null on any failure. distance (m) / duration (s) are
   attached as non-enumerable extra properties on the SAME array, so
   the return contract callers rely on (array of [lat,lng] pairs, or
   null) is unchanged. */
async function _fetchRoadRoute(from, to){
  try{
    const { data: { session } } = await sb.auth.getSession();
    const url = `${SUPABASE_URL}/functions/v1/geoapify-proxy?type=routing&from=${from.lat},${from.lng}&to=${to.lat},${to.lng}&mode=drive`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    if(!res.ok) throw new Error('Geoapify routing HTTP '+res.status);
    const data = await res.json();
    const feature = data?.features?.[0];
    const geom = feature?.geometry;
    const coordArrays = geom?.type === 'MultiLineString' ? geom.coordinates
      : geom?.type === 'LineString' ? [geom.coordinates]
      : null;
    if(!coordArrays || !coordArrays.length) throw new Error('Geoapify routing: empty route');
    const coords = coordArrays.flat();
    if(!coords.length) throw new Error('Geoapify routing: empty coordinates');
    const latlngs = coords.map(([lng,lat])=>[lat,lng]);
    Object.defineProperties(latlngs, {
      distance: { value: feature.properties?.distance ?? null, enumerable: false },
      duration: { value: feature.properties?.time ?? null, enumerable: false }
    });
    return latlngs;
  }catch(e){
    return null;
  }
}

/* Phase 4.5: formatting + panel update helpers. Pure functions, no
   network calls, no map/marker/polyline creation. */
function _fmtDistance(m){
  if(typeof m !== 'number' || !isFinite(m)) return '--';
  return m < 1000 ? Math.round(m)+' m' : (m/1000).toFixed(1)+' km';
}
function _fmtDuration(s){
  if(typeof s !== 'number' || !isFinite(s)) return '--';
  const mins = Math.round(s/60);
  return mins < 1 ? '<1 min' : mins+' min'+(mins===1?'':'s');
}

/* Requirement 8: only re-call Geoapify when the worker actually
   moved. ~10m threshold — smaller than normal GPS jitter would ever
   need to matter, large enough to ignore noise. */
function _metersBetween(a, b){
  if(!a || !b) return Infinity;
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const s1 = Math.sin(dLat/2)**2 +
    Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.min(1, Math.sqrt(s1)));
}

/* Requirement 5: glide the marker between GPS fixes instead of
   jumping. Pure requestAnimationFrame interpolation — no plugin, no
   marker recreation. Cancels any in-flight animation on the same
   marker first, so back-to-back GPS updates never fight each other
   or leak overlapping rAF loops. */
function _animateMarkerTo(marker, toLat, toLng, duration){
  if(!marker) return;
  if(marker._animFrame) cancelAnimationFrame(marker._animFrame);
  const from = marker.getLatLng();
  const fromLat = from.lat, fromLng = from.lng;
  if(fromLat === toLat && fromLng === toLng) return;
  const start = performance.now();
  function step(now){
    const t = Math.min(1, (now - start) / duration);
    const ease = t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; /* ease-in-out */
    marker.setLatLng([fromLat + (toLat-fromLat)*ease, fromLng + (toLng-fromLng)*ease]);
    marker._animFrame = (t < 1) ? requestAnimationFrame(step) : null;
  }
  marker._animFrame = requestAnimationFrame(step);
}

/* ── ALIASES for dashboard.js call sites ──────────────────────
   dashboard.js calls these six functions under their "W"-suffixed
   names. The aliases below point at the exact same function objects
   defined above, so behavior is unchanged and NOTHING in dashboard.js
   needs to be renamed. */
const _geoapifyReverseGeocodeW = _geoapifyReverseGeocode;
const _fetchRoadRouteW = _fetchRoadRoute;
const _fmtDistanceW = _fmtDistance;
const _fmtDurationW = _fmtDuration;
const _metersBetweenW = _metersBetween;
const _animateMarkerToW = _animateMarkerTo;