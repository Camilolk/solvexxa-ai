
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getAllConversations,
  saveConversation,
  deleteConversationById,
  exportConversations,
  importConversationsFromFile,
} from './lib/storage';

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

const PERSONALITIES = {
  friendly: { label: 'Cercano y divertido', prompt: 'Tu nombre es Solvexxa. Eres un asistente cercano, amable, expresivo y con humor ligero cuando encaja. Habla en el idioma del usuario, explica con claridad y puedes usar emojis con moderación. Sé útil y honesto; no inventes capacidades.' },
  professional: { label: 'Profesional', prompt: 'Tu nombre es Solvexxa. Mantén un tono profesional, claro, respetuoso y directo. Organiza respuestas complejas y prioriza precisión y utilidad.' },
  creative: { label: 'Creativo', prompt: 'Tu nombre es Solvexxa. Sé imaginativo, curioso y propositivo sin sacrificar precisión. Ofrece ideas originales y desarrolla alternativas prácticas.' },
  developer: { label: 'Programador', prompt: 'Tu nombre es Solvexxa. Actúa como un ingeniero de software senior y mentor. Prioriza soluciones seguras, mantenibles y probables; explica decisiones y entrega código completo cuando sea útil.' },
  custom: { label: 'Personalizada', prompt: '' },
};

const DEFAULT_MODELS = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', vision: true },
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

function renderInline(text, keyPrefix) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-inline-${index}`;
    if (token.startsWith('`') && token.endsWith('`')) {
      return <code className="inline-code" key={key}>{token.slice(1, -1)}</code>;
    }
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

function parseMessageContent(content) {
  const safe = typeof content === 'string' ? content : String(content || '');
  const blocks = safe.split(/```([\s\S]*?)```/g);

  return blocks.map((block, blockIndex) => {
    if (blockIndex % 2 === 1) {
      const firstNewline = block.indexOf('\n');
      const language = firstNewline >= 0 ? block.slice(0, firstNewline).trim() : '';
      const code = firstNewline >= 0 ? block.slice(firstNewline + 1) : block;
      return (
        <div className="code-block-wrap" key={`code-${blockIndex}`}>
          <div className="code-block-header">
            <span>{language || 'Código'}</span>
            <button type="button" className="copy-button" onClick={() => {
              if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
            }}>Copiar código</button>
          </div>
          <pre className="code-block"><code>{code}</code></pre>
        </div>
      );
    }

    if (!block) return null;
    const lines = block.replace(/\r\n/g, '\n').split('\n');
    const output = [];
    let paragraph = [];
    let listItems = [];
    const flushParagraph = () => {
      if (paragraph.length) {
        output.push(<p key={`p-${blockIndex}-${output.length}`}>{renderInline(paragraph.join(' '), `p-${blockIndex}-${output.length}`)}</p>);
        paragraph = [];
      }
    };
    const flushList = () => {
      if (listItems.length) {
        output.push(<ul key={`ul-${blockIndex}-${output.length}`}>{listItems.map((item, i) => <li key={i}>{renderInline(item, `li-${blockIndex}-${i}`)}</li>)}</ul>);
        listItems = [];
      }
    };

    lines.forEach((line) => {
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      const list = line.match(/^\s*[-*+]\s+(.+)$/);
      if (heading) {
        flushParagraph(); flushList();
        const Tag = `h${heading[1].length}`;
        output.push(<Tag key={`h-${blockIndex}-${output.length}`}>{renderInline(heading[2], `h-${blockIndex}-${output.length}`)}</Tag>);
      } else if (list) {
        flushParagraph();
        listItems.push(list[1]);
      } else if (!line.trim()) {
        flushParagraph(); flushList();
      } else {
        flushList();
        paragraph.push(line);
      }
    });
    flushParagraph(); flushList();
    return <div className="markdown-block" key={`text-${blockIndex}`}>{output}</div>;
  });
}

function buildRequestMessages(messages, draft, imagePreviews) {
  const output = (messages || []).map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.images?.length ? { images: message.images } : message.image ? { image: message.image } : {}),
    ...(message.attachment?.content ? { content: `${message.content}\\n\\n[Contenido del archivo: ${message.attachment.name}]\\n${message.attachment.content}` } : {}),
  }));

  if (draft && draft.trim()) {
    output.push({
      role: 'user',
      content: draft.trim(),
      ...(imagePreviews?.length ? { images: imagePreviews } : {}),
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
  const [imagePreviews, setImagePreviews] = useState([]);
  const [fileAttachment, setFileAttachment] = useState(null);
  const [personality, setPersonality] = useState(() => window.localStorage.getItem('solvexxa-personality') || 'friendly');
  const [customInstructions, setCustomInstructions] = useState(() => window.localStorage.getItem('solvexxa-custom-instructions') || '');
  const [memoryEnabled, setMemoryEnabled] = useState(() => window.localStorage.getItem('solvexxa-memory-enabled') === 'true');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const recognitionRef = useRef(null);
  const menuTouchStartX = useRef(null);

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
    setImagePreviews([]);
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
    setImagePreviews([]);

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
    if (!trimmed && !imagePreviews.length && !fileAttachment) return;

    const userMessage = {
      id: createId(),
      role: 'user',
      content: trimmed || (imagePreviews.length ? 'Imágenes adjuntas' : fileAttachment ? `Archivo adjunto: ${fileAttachment.name}` : ''),
      createdAt: Date.now(),
      images: imagePreviews,
      attachment: fileAttachment ? { name: fileAttachment.name, type: fileAttachment.type, content: fileAttachment.content } : null,
    };
    const nextConversation = {
      ...activeConversation,
      model,
      messages: [...activeConversation.messages, userMessage],
    };

    syncConversation(nextConversation);
    setActiveId(nextConversation.id);
    setDraft('');
    setImagePreviews([]);
    setIsLoading(true);
    setError('');
    setStatusMessage('Conectando con Solvexxa AI...');

    const assistantMessage = {
      id: createId(),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: nextConversation.model,
          messages: [
            { role: 'system', content: [PERSONALITIES[personality]?.prompt || PERSONALITIES.friendly.prompt, personality === 'custom' ? customInstructions : '', memoryEnabled ? 'Usa el contexto de mensajes anteriores de esta conversación para mantener continuidad. No afirmes recordar datos fuera de este historial.' : 'No asumas que tienes memoria persistente fuera de esta conversación.'].filter(Boolean).join('\n\n') },
            ...buildRequestMessages(nextConversation.messages, '', null),
          ],
          temperature: 0.7,
          max_tokens: 1200,
          stream: true,
        }),
      });

      if (!response.ok) {
        let detail = 'No se pudo obtener una respuesta válida.';
        try {
          const data = await response.json();
          detail = data?.error || detail;
        } catch {}
        throw new Error(detail);
      }

      if (!response.body) {
        throw new Error('Este navegador no permite recibir respuestas en streaming.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let content = '';
      let hasSavedAssistant = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        content += decoder.decode(value, { stream: true });
        const partialMessage = { ...assistantMessage, content };
        const updated = {
          ...nextConversation,
          messages: [...nextConversation.messages, partialMessage],
        };
        syncConversation(updated);
        hasSavedAssistant = true;
      }

      content += decoder.decode();
      if (!content && !hasSavedAssistant) {
        throw new Error('La IA terminó sin enviar contenido.');
      }

      const finalMessage = { ...assistantMessage, content: content || 'No se recibió contenido de la respuesta.' };
      syncConversation({
        ...nextConversation,
        messages: [...nextConversation.messages, finalMessage],
      });
      setActiveId(nextConversation.id);
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
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (files.some((file) => !file.type.startsWith('image/'))) {
      setError('Solo se permiten imágenes.');
      event.target.value = '';
      return;
    }

    if (files.some((file) => file.size > 5 * 1024 * 1024)) {
      setError('La imagen es demasiado grande. Máximo 5 MB.');
      event.target.value = '';
      return;
    }

    Promise.all(files.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('No se pudo leer una imagen.'));
      reader.readAsDataURL(file);
    }))).then((images) => {
      setImagePreviews((previous) => [...previous, ...images].slice(0, 4));
      setStatusMessage('Imágenes listas para enviar (máximo 4).');
      setError('');
    }).catch(() => setError('No se pudieron leer las imágenes.'));
    event.target.value = '';
  };

  const handleDocumentPick = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = /\.(txt|md|csv|json|xml|html|js|jsx|ts|tsx|css|py|java|log)$/i.test(file.name);
    if (!allowed) {
      setError('Formato no compatible todavía. Por ahora puedes adjuntar TXT, MD, CSV, JSON, código o LOG. PDF y Word requieren extracción de texto.');
      event.target.value = '';
      return;
    }
    if (file.size > 350 * 1024) {
      setError('El archivo supera el límite de 350 KB para poder enviarlo de forma segura.');
      event.target.value = '';
      return;
    }
    try {
      const content = await file.text();
      setFileAttachment({ name: file.name, type: file.type || 'text/plain', content });
      setError('');
      setStatusMessage(`Archivo ${file.name} listo para enviar.`);
    } catch {
      setError('No se pudo leer el archivo.');
    }
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
      {isMobileMenuOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${isMobileMenuOpen ? 'open' : ''}`}
        onTouchStart={(event) => {
          menuTouchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const startX = menuTouchStartX.current;
          const endX = event.changedTouches[0]?.clientX;
          if (startX !== null && typeof endX === 'number' && startX - endX > 60) {
            setIsMobileMenuOpen(false);
          }
          menuTouchStartX.current = null;
        }}
      >
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
            aria-label={isMobileMenuOpen ? 'Cerrar historial' : 'Abrir historial'}
            aria-expanded={isMobileMenuOpen}
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
            <label className="personality-control" title="Personalidad de Solvexxa">
              <span>Personalidad</span>
              <select value={personality} onChange={(event) => setPersonality(event.target.value)} aria-label="Personalidad de Solvexxa">
                {Object.entries(PERSONALITIES).map(([key, item]) => <option value={key} key={key}>{item.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { const next = window.prompt('Instrucciones para la personalidad personalizada', customInstructions); if (next !== null) { setCustomInstructions(next.slice(0, 2000)); setPersonality('custom'); setStatusMessage('Personalidad personalizada guardada.'); } }}>Configurar personalidad</button>
            <button type="button" className={memoryEnabled ? 'primary' : ''} onClick={() => setMemoryEnabled((value) => !value)} title="Usa el contexto del chat actual">Memoria {memoryEnabled ? 'activada' : 'desactivada'}</button>
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

        <div className="message-list" aria-live="polite">
          {messages.length === 0 ? (
            <section className="welcome-screen">
              <p className="eyebrow">Tu asistente inteligente</p>
              <h1>¿En qué puedo ayudarte hoy?</h1>
              <p>Pregunta, explora ideas o trabaja en un proyecto.</p>
              <div className="suggestion-grid">
                {['Ayúdame a programar algo','Explícame un tema difícil','Dame ideas para un proyecto','Ayúdame a resolver un problema'].map((suggestion) => (
                  <button type="button" className="suggestion-card" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}</button>
                ))}
              </div>
            </section>
          ) : messages.map((message, index) => (
            <article className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`} key={message.id || `${message.role}-${index}`}>
              <div className="message-role">{message.role === 'user' ? 'Tú' : 'Solvexxa AI'}</div>
              {(message.images || (message.image ? [message.image] : [])).map((image, imageIndex) => <img className="message-image" src={image} alt={`Imagen adjunta ${imageIndex + 1}`} key={imageIndex} />)}
              {message.attachment && <div className="file-attachment-card"><span className="file-attachment-icon">📄</span><span><strong>{message.attachment.name}</strong><small>Archivo adjunto</small></span></div>}
              <div className="message-content">{parseMessageContent(message.content)}</div>
              {message.role === 'assistant' && <button type="button" className="speak-button" onClick={() => speakResponse(message.content)}>Leer en voz alta</button>}
            </article>
          ))}
          {isLoading && <div className="loading-indicator">Solvexxa está pensando...</div>}
          {error && <p className="error-message" role="alert">{error}</p>}
          {statusMessage && <p className="status-message" role="status">{statusMessage}</p>}
        </div>
        <form className="composer" onSubmit={(event) => { event.preventDefault(); handleSend(); }}>
          {imagePreviews.length > 0 && <div className="image-preview">{imagePreviews.map((image, index) => <div className="image-preview-item" key={`${index}-${image.slice(0, 24)}`}><img src={image} alt={`Vista previa ${index + 1}`} /><button type="button" onClick={() => setImagePreviews((previous) => previous.filter((_, i) => i !== index))} aria-label={`Quitar imagen ${index + 1}`}>×</button></div>)}</div>}
          {fileAttachment && <div className="file-pending"><span>📄 {fileAttachment.name}</span><button type="button" onClick={() => setFileAttachment(null)} aria-label="Quitar archivo">×</button></div>}
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Escribe tu mensaje..." aria-label="Escribe tu mensaje" rows={2} disabled={isLoading} />
          <div className="composer-actions">
            <label className="attach-button">Adjuntar imagen<input type="file" accept="image/*" multiple hidden onChange={handleImagePick} /></label>
            <label className="attach-button">Adjuntar archivo<input type="file" accept=".txt,.md,.csv,.json,.xml,.html,.js,.jsx,.ts,.tsx,.css,.py,.java,.log" hidden onChange={handleDocumentPick} /></label>
            <button type="button" onClick={toggleVoiceInput}>{isListening ? 'Detener voz' : 'Hablar'}</button>
            <button type="submit" className="primary" disabled={isLoading || (!draft.trim() && !imagePreviews.length && !fileAttachment)}>Enviar</button>
          </div>
        </form>
      </main>
    </div>
  );
}
