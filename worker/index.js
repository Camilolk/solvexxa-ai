* {
  box-sizing: border-box;
}

:root {
  color-scheme: dark;
  --bg: #090d17;
  --bg-soft: #111827;
  --panel: rgba(17, 24, 39, 0.82);
  --panel-strong: #161f2e;
  --panel-alt: #0f172a;
  --text: #e5eefc;
  --muted: #a7b8d6;
  --primary: #8b5cf6;
  --primary-2: #22d3ee;
  --success: #34d399;
  --danger: #f87171;
  --border: rgba(148, 163, 184, 0.18);
  --shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
}

:root[data-theme='light'] {
  color-scheme: light;
  --bg: #edf3ff;
  --bg-soft: #f7f9ff;
  --panel: rgba(255, 255, 255, 0.9);
  --panel-strong: #ffffff;
  --panel-alt: #eef4ff;
  --text: #1a2332;
  --muted: #53627d;
  --primary: #7c3aed;
  --primary-2: #0ea5e9;
  --success: #10b981;
  --danger: #ef4444;
  --border: rgba(15, 23, 42, 0.1);
  --shadow: 0 18px 40px rgba(59, 130, 246, 0.15);
}

html, body, #root {
  margin: 0;
  min-height: 100%;
  height: 100%;
  font-family: Inter, 'Segoe UI', sans-serif;
  background: radial-gradient(circle at top, rgba(124, 58, 237, 0.18), transparent 25%), var(--bg);
  color: var(--text);
}

body {
  min-height: 100vh;
}

button, input, textarea, select {
  font: inherit;
}

button {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: 12px;
  cursor: pointer;
  transition: 160ms ease;
}

button:hover {
  transform: translateY(-1px);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.primary {
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  border: none;
  color: white;
  font-weight: 700;
}

.app-shell {
  display: flex;
  gap: 16px;
  min-height: 100vh;
  padding: 16px;
}

.sidebar {
  flex: 0 0 290px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0;
  color: var(--primary-2);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.sidebar-header h1 {
  margin: 4px 0 0;
  font-size: 1.5rem;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
  padding-right: 6px;
}

.conversation-item {
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border-radius: 14px;
  background: transparent;
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.conversation-item.selected {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(34, 211, 238, 0.12));
  border-color: rgba(123, 92, 246, 0.5);
}

.conversation-item span {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-item small {
  color: var(--muted);
}

.sidebar-actions {
  margin-top: auto;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.sidebar-actions button,
.file-import-label {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--panel-alt);
}

.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}

.topbar-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.topbar-title h2 {
  margin: 0;
  font-size: 1.1rem;
}

.topbar-title span {
  color: var(--muted);
  font-size: 0.8rem;
}

.menu-button {
  display: none;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-actions button {
  min-height: 40px;
  padding: 0 12px;
}

.danger {
  color: #ffd5d5;
  border-color: rgba(248, 113, 113, 0.4);
}

.model-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 20px 0;
}

.model-bar label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
}

.model-bar select,
textarea,
input {
  background: var(--panel-alt);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 12px;
}

.model-bar select {
  min-height: 42px;
  padding: 0 12px;
}

.messages {
  flex: 1;
  padding: 18px 20px 10px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  margin: auto;
  text-align: center;
  max-width: 520px;
  color: var(--muted);
}

.empty-state h3 {
  color: var(--text);
  margin-bottom: 8px;
}

.message {
  width: min(100%, 760px);
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.28);
  padding: 14px 14px 12px;
}

.message.user {
  margin-left: auto;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.24), rgba(34, 211, 238, 0.12));
}

.message.assistant {
  margin-right: auto;
}

.message-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 0.78rem;
  margin-bottom: 8px;
}

.message-body {
  white-space: pre-wrap;
  line-height: 1.55;
}

.message-body p {
  margin: 0 0 0.75rem;
}

.message-body p:last-child {
  margin-bottom: 0;
}

.code-block {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 12px 42px 12px 14px;
  position: relative;
  overflow: auto;
  margin: 12px 0;
}

.copy-button {
  position: absolute;
  right: 10px;
  top: 10px;
  padding: 6px 10px;
  font-size: 0.76rem;
}

.message-image {
  max-width: 240px;
  border-radius: 16px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
}

.read-button {
  margin-top: 10px;
  padding: 8px 10px;
}

.alert {
  margin: 0 20px 14px;
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 0.9rem;
}

.alert.error {
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.35);
  color: #fecaca;
}

.alert.info {
  background: rgba(34, 211, 238, 0.09);
  border: 1px solid rgba(34, 211, 238, 0.3);
  color: #b7ebff;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 12px 14px;
}

.typing-indicator span {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--primary-2);
  animation: pulse 1.2s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.3s; }

@keyframes pulse {
  0%, 100% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1); opacity: 1; }
}

.composer {
  padding: 14px 20px 20px;
  border-top: 1px solid var(--border);
  background: rgba(15, 23, 42, 0.15);
}

.image-preview-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.image-preview-wrap img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.remove-image {
  padding: 9px 10px;
}

.composer-row {
  display: flex;
  gap: 12px;
  align-items: end;
}

textarea {
  flex: 1;
  min-height: 56px;
  max-height: 180px;
  resize: vertical;
  padding: 14px 16px;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-button,
.voice,
.send-button {
  min-height: 46px;
  min-width: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
}

.voice.active {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.5);
}

.send-button {
  padding: 0 18px;
}

@media (max-width: 900px) {
  .app-shell {
    padding: 12px;
  }

  .sidebar {
    position: fixed;
    left: 12px;
    top: 12px;
    bottom: 12px;
    width: min(82vw, 320px);
    transform: translateX(-120%);
    z-index: 40;
    transition: transform 180ms ease;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .menu-button {
    display: inline-flex;
    width: 42px;
    height: 42px;
  }

  .topbar {
    padding: 14px 16px;
  }

  .toolbar-actions {
    display: none;
  }

  .model-bar {
    padding: 12px 16px 0;
    justify-content: flex-start;
  }

  .messages,
  .composer {
    padding-left: 16px;
    padding-right: 16px;
  }

  .composer-row {
    flex-direction: column;
    align-items: stretch;
  }

  .composer-actions {
    justify-content: flex-end;
  }
}
