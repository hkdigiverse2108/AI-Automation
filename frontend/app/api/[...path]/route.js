import { NextResponse } from 'next/server';

function resolveBackendBase() {
  let raw = process.env.BACKEND_INTERNAL_URL || process.env.BACKEND_URL;

  if (!raw && process.env.NEXT_PUBLIC_API_URL) {
    const pub = process.env.NEXT_PUBLIC_API_URL.trim();
    if (pub.startsWith('http://') || pub.startsWith('https://')) {
      raw = pub;
    }
  }

  if (!raw) {
    const port = process.env.PORT && process.env.PORT !== '3000' ? process.env.PORT : '5588';
    raw = `http://127.0.0.1:${port}`;
  }

  let base = raw.trim().replace(/\/$/, '');
  if (base.endsWith('/api')) {
    base = base.slice(0, -4);
  }
  return base;
}

async function handleProxy(req, { params }) {
  const pathParts = params.path || [];
  const path = pathParts.join('/');
  
  // Get search params
  const { search } = new URL(req.url);
  
  // Construct the target URL pointing to the live backend
  const targetBase = resolveBackendBase();
  const targetUrl = `${targetBase}/api/${path}${search}`;

  // Clone headers and remove CORS/Host headers that cause issues
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Skip Host, Origin, and Referer to prevent CORS rejection from live backend
    if (
      key.toLowerCase() !== 'host' &&
      key.toLowerCase() !== 'origin' &&
      key.toLowerCase() !== 'referer'
    ) {
      headers.set(key, value);
    }
  });
  
  // Set Host header for the target
  try {
    const targetHost = new URL(targetBase).host;
    headers.set('host', targetHost);
  } catch (e) {
    // URL parse fallback
  }

  const method = req.method;
  let body = undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await req.arrayBuffer();
    } catch (e) {
      // Body is empty or unreadable
    }
  }

  try {
    const res = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: 'manual',
    });

    const resHeaders = new Headers();
    res.headers.forEach((value, key) => {
      // Skip transfer-encoding, content-length, and content-encoding to prevent gateway/decompression mismatch issues
      if (
        key.toLowerCase() !== 'transfer-encoding' &&
        key.toLowerCase() !== 'content-length' &&
        key.toLowerCase() !== 'content-encoding'
      ) {
        resHeaders.set(key, value);
      }
    });

    const resData = await res.arrayBuffer();

    // Return the response
    return new Response(resData, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (error) {
    console.error('[API Proxy Error]:', error.message);
    return NextResponse.json({ success: false, error: 'Proxy error: ' + error.message }, { status: 502 });
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const OPTIONS = handleProxy;
