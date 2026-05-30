import { useEffect, useRef } from 'react';

export function useWebSocket(onMessage) {
  const wsRef       = useRef(null);
  const onMessageRef = useRef(onMessage);
  const timeoutRef  = useRef(null);
  const unmountedRef = useRef(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    unmountedRef.current = false;

    const connect = () => {
      if (unmountedRef.current) return;

      const ws = new WebSocket(`ws://${window.location.hostname}:4000`);
      wsRef.current = ws;

      ws.onopen = () => console.log('WS conectado');

      ws.onmessage = (e) => {
        try { onMessageRef.current(JSON.parse(e.data)); } catch {}
      };

      ws.onclose = () => {
        if (!unmountedRef.current) {
          timeoutRef.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      unmountedRef.current = true;
      clearTimeout(timeoutRef.current);
      wsRef.current?.close();
    };
  }, []);
}
