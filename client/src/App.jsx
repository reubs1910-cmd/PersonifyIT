import { useState } from 'react';
import LanguageSelect from './components/LanguageSelect.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import VideoPanel from './components/VideoPanel.jsx';

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  header: {
    background: '#1a3a5c',
    color: '#fff',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  headerSub: {
    fontSize: '0.75rem',
    opacity: 0.7,
    marginTop: 2,
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    gap: 0,
  },
};

export default function App() {
  const [language, setLanguage] = useState(null);

  // CVI session state
  const [sessionStarted, setSessionStarted]           = useState(false);
  const [conversationUrl, setConversationUrl]         = useState(null);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError]     = useState(null);

  function handleLanguageSelect(lang) {
    setLanguage(lang);
    setSessionStarted(false);
    setConversationUrl(null);
    setConversationLoading(false);
    setConversationError(null);
  }

  function handleLanguageReset() {
    // ChatPanel's useEffect cleanup ends the Tavus session automatically
    setLanguage(null);
    setSessionStarted(false);
    setConversationUrl(null);
    setConversationLoading(false);
    setConversationError(null);
  }

  // Called when user clicks "Start Session" in VideoPanel
  function handleStartSession() {
    setSessionStarted(true);
  }

  if (!language) {
    return (
      <div style={styles.app}>
        <header style={styles.header}>
          <div>
            <div style={styles.headerTitle}>PersonifyIT</div>
            <div style={styles.headerSub}>Hartnell College IT Support</div>
          </div>
        </header>
        <LanguageSelect onSelect={handleLanguageSelect} />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.headerTitle}>PersonifyIT</div>
          <div style={styles.headerSub}>Hartnell College IT Support</div>
        </div>
        <button
          onClick={handleLanguageReset}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.8rem',
            padding: '4px 12px',
          }}
          title="Change language / Cambiar idioma"
        >
          {language === 'en' ? '🇺🇸 English' : '🇲🇽 Español'}
        </button>
      </header>

      <main style={styles.main}>
        <VideoPanel
          conversationUrl={conversationUrl}
          language={language}
          loading={conversationLoading}
          error={conversationError}
          onStart={handleStartSession}
        />
        <ChatPanel
          language={language}
          sessionStarted={sessionStarted}
          onConversationReady={(url) => {
            setConversationUrl(url);
            setConversationLoading(false);
            setConversationError(null);
          }}
          onConversationLoading={() => {
            setConversationUrl(null);
            setConversationLoading(true);
            setConversationError(null);
          }}
          onConversationError={(msg) => {
            setConversationUrl(null);
            setConversationLoading(false);
            setConversationError(msg);
          }}
        />
      </main>
    </div>
  );
}
