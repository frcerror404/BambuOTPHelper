const defaultBase = window.location.origin.replace(/:\d+$/, ':3000');

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || defaultBase;
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || defaultBase;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
