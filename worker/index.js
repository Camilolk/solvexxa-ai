const DEFAULT_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', vision: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', vision: true },
  { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', vision: true },
];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });

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
    return message.content.map((part) => {
      if (part?.type === 'image_url') {
        return { type: 'image_url', image_url: { url: part.image_url?.url } };
      }
      if (part?.type === 'text') {
        return { type: 'text', text: part.text || '' };
      }
      return null;
    }).filter(Boolean);
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

  return messages
    .map((message) => normalizeMessageContent(message))
    .filter(Boolean);
}

async function callOpenRouter({ model, messages, temperature, max_tokens }, env) {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('Falta OPENROUTER_API_KEY. Configúralo en tus variables secretas del worker.');
  }

  const payload = {
    model,
    messages: ensureMessageFormat(messages).map((msg) => ({
      role: msg.role,
      content: msg.image ? buildOpenRouterContent(msg) : msg.content,
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

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data?.error?.message || 'OpenRouter respondió con un error.';
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
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/models') {
      return json({ models: DEFAULT_MODELS });
    }

    if (request.method === 'GET' && url.pathname === '/healthz') {
      return json({ ok: true, service: 'solvexxa-ai-worker' });
    }

    if (request.method === 'GET' && env.ASSETS) {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        return asset;
      }
    }

    if (request.method !== 'POST') {
      return json({ error: 'Método no permitido.' }, 405);
    }

    if (url.pathname === '/api/chat') {
      try {
        const body = await request.json();
        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const model = body?.model || env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
        const temperature = typeof body?.temperature === 'number' ? body.temperature : 0.7;
        const max_tokens = typeof body?.max_tokens === 'number' ? body.max_tokens : 1200;

        if (!messages.length) {
          return json({ error: 'No se recibieron mensajes válidos.' }, 400);
        }

        if (JSON.stringify(body).length > 500000) {
          return json({ error: 'La solicitud es demasiado grande.' }, 413);
        }

        const content = await callOpenRouter({ model, messages, temperature, max_tokens }, env);
        return json({ content });
      } catch (error) {
        return json(
          {
            error: error instanceof Error ? error.message : 'Error inesperado al contactar a OpenRouter.',
          },
          500,
        );
      }
    }

    return json({ error: 'Ruta no encontrada.' }, 404);
  },
};
