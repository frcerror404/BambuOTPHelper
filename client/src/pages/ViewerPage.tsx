import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, FIVE_MINUTES_MS, SOCKET_URL } from '../config';
import { useAuth } from '../state/AuthContext';

type WakeLockSentinel = any;

interface OtpPayload {
  code?: string;
  receivedAt?: string;
  expiresAt?: string;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export default function ViewerPage() {
  const { token } = useAuth();
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [payload, setPayload] = useState<OtpPayload>();
  const [progress, setProgress] = useState(0);
  const countdownRef = useRef<number>();
  const socketRef = useRef<Socket>();

  const isActive = Boolean(payload?.code);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | undefined;

    const enableWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        } catch (error) {
          console.warn('Wake lock not available', error);
        }
      }
    };

    enableWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/otp`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (resp) => {
        if (!resp.ok) return;
        const data = (await resp.json()) as OtpPayload;
        if (data && Object.keys(data).length) {
          setPayload(data);
        }
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });

    socketRef.current = socket;
    setConnection('connecting');

    socket.on('connect', () => setConnection('connected'));
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.on('connect_error', () => setConnection('disconnected'));
    socket.on('otp', (data: OtpPayload) => setPayload(data));

    return () => {
      socket.disconnect();
      socketRef.current = undefined;
    };
  }, [token]);

  useEffect(() => {
    window.clearInterval(countdownRef.current);

    if (!payload?.code) {
      setProgress(0);
      return;
    }

    const start = payload.receivedAt ? new Date(payload.receivedAt).getTime() : Date.now();
    const end = payload.expiresAt
      ? new Date(payload.expiresAt).getTime()
      : start + FIVE_MINUTES_MS;
    const total = end - start;

    const tick = () => {
      const remaining = Math.max(0, end - Date.now());
      const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
      setProgress(pct);

      if (remaining <= 0) {
        window.clearInterval(countdownRef.current);
        setPayload({});
      }
    };

    tick();
    countdownRef.current = window.setInterval(tick, 200);

    return () => window.clearInterval(countdownRef.current);
  }, [payload?.code, payload?.receivedAt, payload?.expiresAt]);

  const statusDescriptor = useMemo(() => {
    switch (connection) {
      case 'connected':
        return { label: 'CONNECTED', color: 'var(--success)' };
      case 'disconnected':
        return { label: 'DISCONNECTED', color: 'var(--danger)' };
      default:
        return { label: 'CONNECTING', color: 'var(--warn)' };
    }
  }, [connection]);

  const displayCode = isActive ? payload?.code : '- - - - - -';

  return (
    <div className="page viewer-page">
      <div className="status-pill" style={{ color: statusDescriptor.color }}>
        <span
          className="status-dot"
          style={{ background: statusDescriptor.color, boxShadow: `0 0 14px ${statusDescriptor.color}` }}
        />
        <span className="status-text">{statusDescriptor.label}</span>
      </div>

      <div className="code-card">
        <div className={`code-display ${isActive ? 'active' : 'inactive'}`}>{displayCode}</div>
        <div className="subtitle">{isActive ? 'Active code received' : 'Code expired or pending'}</div>
      </div>

      <div className="progress-wrap">
        <div className="progress-bar" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
