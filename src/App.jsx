
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
  const now = Date.now();

  return {
    id: createId(),
    title: 'Nueva conversación',
    titleManuallySet: false,
    model: DEFAULT_MODEL,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function getConversationTitle(messages) {
  const text = (messages || [])
    .filter(
      (msg) =>
        msg.role === 'user' &&
        typeof msg.content === 'string' &&
        msg.content.trim(),
    )
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
              if (navigator.clipboard) {
                navigator.clipboard.writeText(part).catch(() => {});
              }
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

function getDateGroup(value) {
  const date = new Date(Number(value) || Date.now());
  const now = new Date();

  const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  if (dateKey === todayKey) return 'Hoy';
  if (dateKey === yesterdayKey) return 'Ayer';

  return 'Anteriores';
}

export default function App() {
  const [theme, setTheme] = useState(
    () => window.localStorage.getItem('solvexxa-theme') || 'dark',
  );

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
  const [historySearch, setHistorySearch] = useState('');

  const recognitionRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('solvexxa-theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const stored = await getAllConversations();
        if (cancelled) return;

        const next =
          stored && stored.length ? stored : [createDraftConversation()];

        next.sort(
          (a, b) =>
            (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
        );

        setConversations(next);
        setActiveId(next[0]?.id || null);
      } catch {
        if (cancelled) return;

        const fallback = [createDraftConversation()];
        setConversations(fallback);
        setActiveId(fallback[0].id);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
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

        const list =
          Array.isArray(data?.models) && data.models.length
            ? data.models
            : DEFAULT_MODELS;

        setModels(list);

        if (!list.some((option) => option.id === model)) {
          setModel(list[0].id);
        }
      } catch {
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
    () =>
      conversations.find((item) => item.id === activeId) ||
      conversations[0] ||
      null,
    [conversations, activeId],
  );

  const filteredConversations = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('es');

    return [...conversations]
      .filter((item) =>
        (item.title || 'Sin título')
          .toLocaleLowerCase('es')
          .includes(query),
      )
      .sort(
        (a, b) =>
          (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
      );
  }, [conversations, historySearch]);

  const groupedConversations = useMemo(() => {
    const labels = ['Hoy', 'Ayer', 'Anteriores'];
    const groups = labels.map((label) => ({ label, items: [] }));

    for (const item of filteredConversations) {
      const label = getDateGroup(item.updatedAt || item.createdAt);
      const group = groups.find((entry) => entry.label === label);

      if (group) group.items.push(item);
    }

    return groups.filter((group) => group.items.length > 0);
  }, [filteredConversations]);

  const syncConversation = (updated) => {
    const previous = conversations.find((item) => item.id === updated.id);

    const titleManuallySet =
      updated.titleManuallySet ?? previous?.titleManuallySet ?? false;

    const automaticTitle = getConversationTitle(updated.messages);

    const normalizedTitle = titleManuallySet
      ? updated.title?.trim() || 'Nueva conversación'
      : automaticTitle !== 'Nueva conversación'
        ? automaticTitle
        : previous?.title || 'Nueva conversación';

    const normalized = {
      ...updated,
      updatedAt: Date.now(),
      title: normalizedTitle,
      titleManuallySet,
    };

    setConversations((prev) => {
      const next = prev.some((item) => item.id === normalized.id)
        ? prev.map((item) =>
            item.id === normalized.id ? normalized : item,
          )
        : [normalized, ...prev];

      return next.sort(
        (a, b) =>
          (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt),
      );
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
    setIsMobileMenuOpen(false);
  };

  const renameConversation = () => {
    if (!activeConversation) return;

    const title = window.prompt(
      'Escribe el nuevo título',
      activeConversation.title || 'Nueva conversación',
    );

    if (title === null) return;

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setStatusMessage('El título no puede estar vacío.');
      return;
    }

    syncConversation({
      ...activeConversation,
      title: trimmedTitle,
      titleManuallySet: true,
    });

    setStatusMessage('Título actualizado.');
  };

  const removeConversation = async () => {
    if (!activeConversation) return;

    const deletedId = activeConversation.id;
    const deletedTitle = activeConversation.title || 'Sin título';

    const confirmed = window.confirm(
      `¿Eliminar "${deletedTitle}"? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) return;

    try {
      await deleteConversationById(deletedId);
    } catch {
      setError('No se pudo eliminar la conversación guardada.');
      return;
    }

    const remaining = conversations.filter((item) => item.id !== deletedId);

    setError('');
    setDraft('');
    setImagePreview(null);

    if (remaining.length === 0) {
      const freshConversation = createDraftConversation();

      setConversations([freshConversation]);
      setActiveId(freshConversation.id);
    } else {
      setConversations(remaining);

      if (deletedId === activeId) {
        setActiveId(remaining[0].id);
      }
    }

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

        setConversations((previous) => {
          const existingIds = new Set(previous.map((item) => item.id));

          const uniqueItems = items.filter(
            (item) => !existingIds.has(item.id),
          );

          return [...uniqueItems, ...previous].sort(
            (a, b) =>
              (b.updatedAt || b.createdAt) -
              (a.updatedAt || a.createdAt),
          );
        });

        const firstImported = items.find(
          (item) =>
            !conversations.some((existing) => existing.id === item.id),
        );

        if (firstImported) setActiveId(firstImported.id);

        setError('');
        setStatusMessage('Historial importado correctamente.');
      })
      .catch(() => setError('El archivo no pudo importarse.'))
      .finally(() => {
        event.target.value = '';
      });
  };

  const handleSend = async () => {
    if (!activeConversation || isLoading) return;

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
          messages: buildRequestMessages(
            nextConversation.messages,
            '',
            null,
          ),
          temperature: 0.7,
          max_tokens: 1200,
        }),
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error('La respuesta del servidor no era JSON válido.');
      }

      if (!response.ok) {
        throw new Error(
          data?.error || 'No se pudo obtener una respuesta válida.',
        );
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
      const message =
        err instanceof Error
          ? err.message
          : 'Ocurrió un error inesperado.';

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
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Máximo 5 MB.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setImagePreview(reader.result);
      setStatusMessage('Imagen lista para enviar.');
      setError('');
    };

    reader.onerror = () => setError('No se pudo leer la imagen.');

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const toggleVoiceInput = () => {
    if (
      !('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    ) {
      setStatusMessage('La voz no está disponible en este navegador.');
      return;
    }

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(' ');

        setDraft((previous) =>
          `${previous}${previous ? ' ' : ''}${transcript}`.trim(),
        );
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
        setStatusMessage('No se pudo reconocer la voz.');
      };

      recognitionRef.current.onend = () => setIsListening(false);
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setStatusMessage('No se pudo iniciar el reconocimiento de voz.');
    }
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

          <button
            type="button"
            className="primary"
            onClick={createNewConversation}
          >
            Nuevo
          </button>
        </div>

        <div className="history-search">
          <input
            type="search"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Buscar conversaciones..."
            aria-label="Buscar conversaciones"
          />
        </div>

        <div className="conversation-list">
          {groupedConversations.map((group) => (
            <div className="conversation-group" key={group.label}>
              <h3 className="conversation-group-title">{group.label}</h3>

              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`conversation-item ${
                    item.id === activeId ? 'selected' : ''
                  }`}
                  onClick={() => {
                    setActiveId(item.id);
                    setIsMobileMenuOpen(false);
                    setError('');
                    setStatusMessage('');
                  }}
                >
                  <span>{item.title || 'Sin título'}</span>
                  <small>
                    {formatDate(item.updatedAt || item.createdAt)}
                  </small>
                </button>
              ))}
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <p className="history-empty">
              {historySearch.trim()
                ? 'No se encontraron conversaciones.'
                : 'Tu historial aparecerá aquí.'}
            </p>
          )}
        </div>

        <div className="sidebar-actions">
          <button
            type="button"
            onClick={() =>
              setTheme((previous) =>
                previous === 'dark' ? 'light' : 'dark',
              )
            }
          >
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>

          <label className="file-import-label">
            Importar
            <input
              type="file"
              accept="application/json"
              onChange={handleFileImport}
              hidden
            />
          </label>
        </div>
      </aside>

      <main className="chat-panel">
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            onClick={() =>
              setIsMobileMenuOpen((previous) => !previous)
            }
            aria-label="Abrir historial"
          >
            ☰
          </button>

          <div className="topbar-title">
            <h2>{activeConversation?.title || 'Nueva conversación'}</h2>
            <span>
              {activeConversation
                ? formatDate(
                    activeConversation.updatedAt ||
                      activeConversation.createdAt,
                  )
                : ''}
            </span>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              onClick={renameConversation}
              disabled={!activeConversation}
            >
              Renombrar
            </button>

            <button
              type="button"
              onClick={exportCurrentConversation}
              disabled={!activeConversation}
            >
              Exportar
            </button>

            <button
              type="button"
              className="danger"
              onClick={removeConversation}
              disabled={!activeConversation}
            >
              Eliminar
            </button>
          </div>
        </header>

        <div className="
