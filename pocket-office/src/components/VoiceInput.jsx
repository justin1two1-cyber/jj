import { useState, useRef, useCallback } from 'react';

const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export default function VoiceInput({ onTranscript, placeholder = 'Tap mic to speak...', value = '', onChange }) {
  const [isListening, setIsListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recognitionRef = useRef(null);

  const supported = !!SpeechRecognition;

  const startListening = useCallback(() => {
    if (!SpeechRecognition || isListening) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-AU';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setInterim(interimTranscript);

      if (finalTranscript) {
        const newValue = value ? `${value} ${finalTranscript}` : finalTranscript;
        onTranscript(newValue);
        setInterim('');
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterim('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, value, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterim('');
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={interim ? `${value} ${interim}` : value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          resize: 'vertical',
          paddingRight: supported ? 50 : 16,
          fontSize: 16,
          color: 'var(--color-text)',
          background: 'var(--color-surface)',
          border: `1px solid ${isListening ? 'var(--color-danger)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          fontFamily: 'inherit',
        }}
      />
      {supported && (
        <button
          type="button"
          onClick={isListening ? stopListening : startListening}
          style={{
            position: 'absolute',
            right: 8,
            top: 8,
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: isListening ? 'var(--color-danger)' : 'var(--color-surface-hover)',
            color: isListening ? 'white' : 'var(--color-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            transition: 'background 0.2s',
          }}
          title={isListening ? 'Stop recording' : 'Start voice input'}
        >
          {isListening ? '⏹' : '🎙'}
        </button>
      )}
      {isListening && (
        <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)', animation: 'pulse 1s infinite' }} />
          Listening...
        </div>
      )}
    </div>
  );
}
