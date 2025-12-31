/**
 * TampermonkeyScriptHub - Cloudflare Worker 优化版
 */
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return handleCors();

    const url = new URL(request.url);
    
    // 建议在 Cloudflare 环境变量中设置 ADMIN_PASSWORD
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'example_password_123';
    const requestPassword = url.searchParams.get('password') || request.headers.get('X-Admin-Password');
    
    // 1. 直连下载路径（免密）
    if (url.pathname.startsWith('/raw/')) {
      return await serveScriptDirectly(url.pathname, env);
    }

    // 2. 权限校验
    if (!url.pathname.startsWith('/favicon.ico') && (!requestPassword || requestPassword !== ADMIN_PASSWORD)) {
      return new Response(JSON.stringify({ code: 401, message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
      });
    }

    // 3. 路由分发
    const host = request.headers.get('host');
    const baseUrl = `${url.protocol}//${host}`;

    if (request.method === 'GET' && url.pathname === '/api/scripts') {
      return await getScriptList(env, baseUrl);
    }
    
    if (request.method === 'POST' && url.pathname === '/api/scripts/upload') {
      return await uploadScript(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/api/scripts/import') {
      return await importScript(request, env);
    }

    if (request.method === 'DELETE' && url.pathname.startsWith('/api/scripts/')) {
      const id = url.pathname.split('/').pop();
      return await deleteScript(id, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

function handleCors() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
    }
  });
}

// 优化后的列表获取：按需加载
async function getScriptList(env, baseUrl) {
  const bucket = env.SCRIPTS_BUCKET;
  try {
    const objects = await bucket.list();
    const results = await Promise.all(objects.objects.map(async (obj) => {
      if (!obj.key.endsWith('.user.js')) return null;
      
      const file = await bucket.get(obj.key, { range: { offset: 0, length: 2048 } }); 
      const content = await file.text();
      const meta = parseScriptMeta(content);
      
      return {
        id: obj.key,
        name: meta.name || obj.key,
        version: meta.version || '0.0.1',
        author: meta.author || 'Unknown',
        content: content,
        uploadTime: obj.uploaded.toISOString(),
        size: obj.size,
        rawScriptUrl: `${baseUrl}/raw/${obj.key}`
      };
    }));

    return new Response(JSON.stringify({
      code: 200,
      data: results.filter(i => i !== null).sort((a,b) => b.uploadTime.localeCompare(a.uploadTime))
    }), { headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ code: 500, message: e.message }), { status: 500 });
  }
}

async function uploadScript(request, env) {
  try {
    const formData = await request.formData();
    const file = formData.get('scriptFile');
    if (!file) throw new Error('No file uploaded');
    
    await env.SCRIPTS_BUCKET.put(file.name, await file.arrayBuffer());
    return new Response(JSON.stringify({ code: 200, message: '上传成功' }), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ code: 500, message: e.message }), { status: 500 });
  }
}

async function importScript(request, env) {
  try {
    const { remoteUrl } = await request.json();
    const res = await fetch(remoteUrl);
    const content = await res.text();
    const fileName = remoteUrl.split('/').pop() || 'imported.user.js';
    
    await env.SCRIPTS_BUCKET.put(fileName, content);
    return new Response(JSON.stringify({ code: 200, message: '导入成功' }), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ code: 500, message: e.message }), { status: 500 });
  }
}

async function deleteScript(id, env) {
  try {
    await env.SCRIPTS_BUCKET.delete(decodeURIComponent(id));
    return new Response(JSON.stringify({ code: 200, message: '删除成功' }), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ code: 500, message: e.message }), { status: 500 });
  }
}

async function serveScriptDirectly(pathname, env) {
  const fileName = decodeURIComponent(pathname.replace('/raw/', ''));
  const file = await env.SCRIPTS_BUCKET.get(fileName);
  
  if (!file) return new Response('File Not Found', { status: 404 });

  return new Response(file.body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

function parseScriptMeta(content) {
  const meta = {};
  const lines = content.split('\n');
  let inMeta = false;
  for (const line of lines) {
    if (line.includes('==UserScript==')) inMeta = true;
    if (line.includes('==/UserScript==')) break;
    if (inMeta) {
      const match = line.match(/@(\w+)\s+(.+)/);
      if (match) meta[match[1]] = match[2].trim();
    }
  }
  return meta;
}