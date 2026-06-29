import { NextResponse } from 'next/server';

async function handleProxy(req, { params }) {
  const pathParts = params.path || [];
  const path = pathParts.join('/');
  
  // Get search params
  const { search } = new URL(req.url);
  
  // Construct the target URL pointing to the live backend
  const targetBase = (process.env.NEXT_PUBLIC_API_URL || 'https://api-automation.hkdigiverse.com').replace(/\/$/, '');
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
  const targetHost = new URL(targetBase).host;
  headers.set('host', targetHost);

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
      // Skip transfer-encoding and content-length to prevent gateway mismatch issues
      if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-length') {
        resHeaders.set(key, value);
      }
    });

    // Return the response
    return new Response(res.body, {
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
