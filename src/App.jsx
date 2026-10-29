import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllConversations,
  saveConversation,
  deleteConversationById,
  exportConversations,
  importConversationsFromFile,
} from './lib/storage';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';
const DEFAULT_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', vision: false },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', vision: true },
  { id: 'google/gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', vision: true },
];

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftConversation() {
  return {
    id: createId(),
    title: 'Nueva conversación',
    model: DEFAULT_MODEL,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function getConversationTitle(messages) {
  const text = (messages || [])
    .filter((msg) => msg.role === 'user' && typeof msg.content === 'string' && msg.content.trim())
    .map((msg) => msg.content.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text ? text.slice(0, 36) : 'Nueva conversación';
}

function formatDate(value) {
  const timestamp = Number(value) || Date.now();
  return new Date(timestamp).toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseMessageContent(content) {
  const safe = typeof content === 'string' ? content : String(content || '');
  const parts = safe.split(/```([\s\S]*?)```/g);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <pre className="code-block" key={`${index}-code`}>
          <code>{part}</code>
          <button
            type="button"
            className="copy-button"
            onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(part);
            }}
          >
            Copiar
          </button>
        </pre>
      );
    }

    if (!part) return null;
    return <p key={`${index}-text`}>{part}</p>;
  });
}

function buildRequestMessages(messages, draft, imagePreview) {
  const output = (messages || []).map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.image ? { image: message.image } : {}),
  }));

  if (draft && draft.trim()) {
    output.push({
      role: 'user',
      content: draft.trim(),
      ...(imagePreview ? { image: imagePreview } : {}),
    });
  }

  return output;
}

export default function App() {
  const [theme, setTheme] = useState(() => window.localStorage.getItem('solvexxa-theme') || 'dark');
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState(DEFAULT_MODELS);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('solvexxa-theme', theme);
  }, [theme]);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await getAllConversations();
        const next = stored && stored.length ? stored : [createDraftConversation()];
        next.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        setConversations(next);
        setActiveId(next[0]?.id || null);
      } catch (err) {
        const fallback = [createDraftConversation()];
        setConversations(fallback);
        setActiveId(fallback[0].id);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (!activeId || !conversations.length) return;
    const active = conversations.find((item) => item.id === activeId);
    if (active) {
      saveConversation(active).catch(() => {});
    }
  }, [conversations, activeId]);

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error('No se pudo cargar la lista de modelos.');
        }

        const data = await response.json();
        if (cancelled) return;

        const list = Array.isArray(data?.models) && data.models.length ? data.models : DEFAULT_MODELS;
        setModels(list);
        if (!list.some((option) => option.id === model)) {
          setModel(list[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setModels(DEFAULT_MODELS);
          setStatusMessage('Usando modelos por defecto.');
        }
      }
    };

    loadModels();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId) || conversations[0] || null,
    [conversations, activeId],
  );

  const syncConversation = (updated) => {
    const previous = conversations.find((item) => item.id === updated.id);
    const normalizedTitle =
      typeof updated.title === 'string' && updated.title.trim()
        ? updated.title.trim()
        : previous?.title && previous.title.trim()
          ? previous.title.trim()
          : getConversationTitle(updated.messages);

    const normalized = {
      ...updated,
      updatedAt: Date.now(),
      title: normalizedTitle,
    };

    setConversations((prev) => {
      const next = prev.some((item) => item.id === normalized.id)
        ? prev.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...prev];

      return next.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    });
  };

  const createNewConversation = () => {
    const convo = createDraftConversation();
    setConversations((prev) => [convo, ...prev]);
    setActiveId(convo.id);
    setDraft('');
    setImagePreview(null);
    setError('');
    setStatusMessage('Nueva conversación creada.');
  };

  const renameConversation = () => {
    if (!activeConversation) return;
    const title = window.prompt('Escribe el nuevo título', activeConversation.title || 'Nueva conversación');
    if (!title) return;

    const updated = {
      ...activeConversation,
      title: title.trim() || 'Nueva conversación',
    };
    syncConversation(updated);
    setStatusMessage('Título actualizado.');
  };

  const removeConversation = async () => {
    if (!activeConversation) return;
    const confirmed = window.confirm('¿Eliminar esta conversación?');
    if (!confirmed) return;

    const remaining = conversations.filter((item) => item.id !== activeConversation.id);
    setConversations(remaining);
    setActiveId(remaining[0]?.id || null);
    await deleteConversationById(activeConversation.id).catch(() => {});
    setStatusMessage('Conversación eliminada.');
  };

  const exportCurrentConversation = () => {
    if (!activeConversation) return;
    exportConversations([activeConversation]);
    setStatusMessage('Conversación exportada.');
  };

  const handleFileImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    importConversationsFromFile(file)
      .then((items) => {
        if (!items.length) {
          setError('No se encontraron conversaciones válidas en el archivo.');
          return;
        }

        const next = [...items, ...conversations];
        next.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
        setConversations(next);
        setActiveId(items[0].id);
        setStatusMessage('Historial importado correctamente.');
      })
      .catch(() => setError('El archivo no pudo importarse.'))
      .finally(() => {
        event.target.value = '';
      });
  };

  const handleSend = async () => {
    if (!activeConversation) return;
    const trimmed = draft.trim();
    if (!trimmed && !imagePreview) return;

    const userMessage = {
      id: createId(),
      role: 'user',
      content: trimmed || 'Imagen adjunta',
      createdAt: Date.now(),
      image: imagePreview || null,
    };

    const nextConversation = {
      ...activeConversation,
      model,
      messages: [...activeConversation.messages, userMessage],
    };

    syncConversation(nextConversation);
    setActiveId(nextConversation.id);
    setDraft('');
    setImagePreview(null);
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: nextConversation.model,
          messages: buildRequestMessages(nextConversation.messages, '', imagePreview),
          temperature: 0.7,
          max_tokens: 1200,
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error('La respuesta del servidor no era JSON válido.');
      }

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo obtener una respuesta válida.');
      }

      const assistantMessage = {
        id: createId(),
        role: 'assistant',
        content: data?.content || 'No se recibió contenido de la respuesta.',
        createdAt: Date.now(),
      };

      const updated = {
        ...nextConversation,
        messages: [...nextConversation.messages, assistantMessage],
      };
      syncConversation(updated);
      setActiveId(updated.id);
      setStatusMessage('Respuesta recibida.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
      setError(message);
      setStatusMessage('El mensaje se guardó localmente, pero la IA no respondió.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten imágenes.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Máximo 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result);
      setStatusMessage('Imagen lista para enviar.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const toggleVoiceInput = () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setStatusMessage('La voz no está disponible en este navegador.');
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.interimResults = false;
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(' ');
        setDraft((previous) => `${previous}${previous ? ' ' : ''}${transcript}`.trim());
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  const speakResponse = (text) => {
    if (!('speechSynthesis' in window) || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const messages = activeConversation?.messages || [];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Solvexxa AI</p>
            <h1>Chats</h1>
          </div>
          <button type="button" className="primary" onClick={createNewConversation}>Nuevo</button>
        </div>

        <div className="conversation-list">
          {conversations.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`conversation-item ${item.id === activeId ? 'selected' : ''}`}
              onClick={() => {
                setActiveId(item.id);
                setIsMobileMenuOpen(false);
              }}
            >
              <span>{item.title || 'Sin título'}</span>
              <small>{formatDate(item.updatedAt || item.createdAt)}</small>
            </button>
          ))}
        </div>

        <div className="sidebar-actions">
          <button type="button" onClick={() => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <label className="file-import-label">
            Importar
            <input type="file" accept="application/json" onChange={handleFileImport} hidden />
          </label>
        </div>
      </aside>

      <main className="chat-panel">
        <header className="topbar">
          <button type="button" className="menu-button" onClick={() => setIsMobileMenuOpen((previous) => !previous)}>
            ☰
          </button>

          <div className="topbar-title">
            <h2>{activeConversation?.title || 'Nueva conversación'}</h2>
            <span>{activeConversation ? formatDate(activeConversation.updatedAt || activeConversation.createdAt) : ''}</span>
          </div>

          <div className="toolbar-actions">
            <button type="button" onClick={renameConversation}>Renombrar</button>
            <button type="button" onClick={exportCurrentConversation}>Exportar</button>
            <button type="button" className="danger" onClick={removeConversation}>Eliminar</button>
          </div>
        </header>

        <div className="model-bar">
          <label>
            Modelo
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              {models.map((option) => (
                <option key={option.id} value={option.id}>{option.name || option.id}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <div className="alert error">{error}</div>}
        {statusMessage && !error && <div className="alert info">{statusMessage}</div>}

        <section className="messages">
          
{messages.length === 0 ? (
  <div className="empty-state">
    <div className="welcome-icon">
      <span>✦</span>
    </div>

    <p className="welcome-eyebrow">TU ESPACIO DE IA</p>

    <h3>
      ¿Qué vamos a crear
      <span className="gradient-text"> hoy?</span>
    </h3>

    <p className="welcome-description">
      Pregunta, programa, aprende y convierte tus ideas en algo extraordinario.
    </p>

    <div className="suggestion-grid">
      <button
        type="button"
        className="suggestion-card"
        onClick={() => setDraft('Ayúdame a programar un proyecto en JavaScript desde cero.')}
      >
        <span className="suggestion-icon purple">⌘</span>
        <span className="suggestion-title">Programación</span>
        <span className="suggestion-description">Crea y mejora tu código</span>
      </button>

      <button
        type="button"
        className="suggestion-card"
        onClick={() => setDraft('Dame ideas creativas para un proyecto innovador.')}
      >
        <span className="suggestion-icon cyan">✧</span>
        <span className="suggestion-title">Ideas creativas</span>
        <span className="suggestion-description">Explora nuevas posibilidades</span>
      </button>

      <button
        type="button"
        className="suggestion-card"
        onClick={() => setDraft('Explícame un tema difícil paso a paso con ejemplos sencillos.')}
      >
        <span className="suggestion-icon cyan">◈</span>
        <span className="suggestion-title">Aprender</span>
        <span className="suggestion-description">Comprende algo nuevo</span>
      </button>

      <button
        type="button"
        className="suggestion-card"
        onClick={() => setDraft('Ayúdame a redactar un texto claro y profesional.')}
      >
        <span className="suggestion-icon purple">✎</span>
        <span className="suggestion-title">Escritura</span>
        <span className="suggestion-description">Organiza tus ideas</span>
      </button>
    </div>
  </div>
) : (

            messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <div className="message-meta">
                  <strong>{message.role === 'user' ? 'Tú' : 'Solvexxa'}</strong>
                  <span>{formatDate(message.createdAt)}</span>
                </div>

                {message.image && (
                  <img className="message-image" src={message.image} alt="Adjunto del usuario" />
                )}

                <div className="message-body">{parseMessageContent(message.content)}</div>
                {message.role === 'assistant' && (
                  <button type="button" className="read-button" onClick={() => speakResponse(message.content)}>
                    Leer voz
                  </button>
                )}
              </article>
            ))
          )}

          {isLoading && (
            <div className="typing-indicator">
              <span />
              <span />
              <span />
            </div>
          )}
        </section>

        <div className="composer">
          {imagePreview && (
            <div className="image-preview-wrap">
              <img src={imagePreview} alt="Vista previa" />
              <button type="button" className="remove-image" onClick={() => setImagePreview(null)}>Eliminar</button>
            </div>
          )}

          <div className="composer-row">
            <textarea
              rows={3}
              value={draft}
              placeholder="Escribe tu mensaje..."
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />

            <div className="composer-actions">
              <label className="upload-button">
                🖼️
                <input type="file" accept="image/*" onChange={handleImagePick} hidden />
              </label>
              <button type="button" className={isListening ? 'voice active' : 'voice'} onClick={toggleVoiceInput}>
                {isListening ? 'Detener' : '🎙️'}
              </button>
              <button type="button" className="primary send-button" onClick={handleSend} disabled={isLoading || (!draft.trim() && !imagePreview)}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
