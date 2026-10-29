const DEFAULT_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', vision: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', vision: true },
  { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', vision: true },
];

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });

function parseAllowedModels(raw) {
  return (raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCorsHeaders(origin, env) {
  const configured = parseAllowedModels(env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173');
  const normalizedOrigin = origin || '';
  const allowed = configured.some((candidate) => normalizedOrigin === candidate)
    || normalizedOrigin.startsWith('http://localhost:')
    || normalizedOrigin.startsWith('http://127.0.0.1:')
    || normalizedOrigin.endsWith('.pages.dev');

  if (!allowed) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': normalizedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

function buildOpenRouterContent(message) {
  const text = typeof message?.content === 'string' ? message.content : '';

  if (message?.image) {
    return [
      { type: 'text', text: text || 'Imagen adjunta' },
      { type: 'image_url', image_url: { url: message.image } },
    ];
  }

  if (typeof message?.content === 'string') {
    return [{ type: 'text', text: message.content }];
  }

  if (Array.isArray(message?.content)) {
    return message.content
      .map((part) => {
        if (part?.type === 'image_url') {
          return { type: 'image_url', image_url: { url: part.image_url?.url } };
        }
        if (part?.type === 'text') {
          return { type: 'text', text: part.text || '' };
        }
        return null;
      })
      .filter(Boolean);
  }

  return [{ type: 'text', text: 'Mensaje recibido' }];
}

function normalizeMessageContent(message) {
  if (!message || typeof message !== 'object') return null;

  const content = message.content ?? '';

  if (typeof content === 'string') {
    return { role: message.role || 'user', content };
  }

  if (Array.isArray(content)) {
    const text = content
      .filter((item) => item?.type === 'text')
      .map((item) => item.text)
      .join('\n');

    const image = content.find((item) => item?.type === 'image_url')?.image_url?.url;
    return { role: message.role || 'user', content: text || 'Imagen recibida', ...(image ? { image } : {}) };
  }

  return { role: message.role || 'user', content: String(content || '') };
}

function ensureMessageFormat(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map((message) => normalizeMessageContent(message)).filter(Boolean);
}

function isAllowedModel(model, env) {
  const configured = new Set([
    ...DEFAULT_MODELS.map((entry) => entry.id),
    ...parseAllowedModels(env.ALLOWED_MODELS || ''),
    ...(env.OPENROUTER_MODEL ? [env.OPENROUTER_MODEL] : []),
  ]);
  return configured.has(model);
}

async function callOpenRouter({ model, messages, temperature, max_tokens }, env) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Falta OPENROUTER_API_KEY. Configúralo en el entorno seguro del worker.');
  }

  if (!isAllowedModel(model, env)) {
    throw new Error('Modelo no autorizado.');
  }

  const payload = {
    model,
    messages: ensureMessageFormat(messages).map((message) => ({
      role: message.role,
      content: message.image ? buildOpenRouterContent(message) : message.content,
    })),
    temperature,
    max_tokens,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.OPENROUTER_SITE_URL || 'https://example.com',
      'X-Title': env.OPENROUTER_SITE_NAME || 'Solvexxa AI',
    },
    body: JSON.stringify(payload),
  });

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error('OpenRouter respondió con un cuerpo no JSON válido.');
  }

  if (!response.ok) {
    const errorMessage = data?.error?.message || `OpenRouter devolvió HTTP ${response.status}.`;
    throw new Error(errorMessage);
  }

  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer === 'string') return answer;
  if (Array.isArray(answer)) {
    return answer.filter((part) => part?.type === 'text').map((part) => part.text).join('\n');
  }

  return 'No se pudo extraer contenido válido de la respuesta.';
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      if (!Object.keys(corsHeaders).length) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/models') {
      return json({ models: DEFAULT_MODELS }, 200, corsHeaders);
    }

    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json({ ok: true, service: 'solvexxa-ai-worker' }, 200, corsHeaders);
    }

    if (request.method !== 'POST') {
      return json({ error: 'Método no permitido.' }, 405, corsHeaders);
    }

    if (url.pathname === '/api/chat') {
      try {
        const body = await request.json();
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const model = body?.model || env.OPENROUTER_MODEL || DEFAULT_MODELS[0].id;
        const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.7;
        const max_tokens = typeof body?.max_tokens === 'number' ? body.max_tokens : 1200;

        if (!messages.length) {
          return json({ error: 'No se recibieron mensajes válidos.' }, 400, corsHeaders);
        }

        if (JSON.stringify(body).length > 500000) {
          return json({ error: 'La solicitud es demasiado grande.' }, 413, corsHeaders);
        }

        const content = await callOpenRouter({ model, messages, temperature, max_tokens }, env);
        return json({ content }, 200, corsHeaders);
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : 'Error inesperado al contactar a OpenRouter.',
          },
          500,
          corsHeaders,
        );
      }
    }

    if (env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        return asset;
      }
    }

    return json({ error: 'Ruta no encontrada.' }, 404, corsHeaders);
  },
};
