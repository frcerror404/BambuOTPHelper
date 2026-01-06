import React from 'react';

export default function App({ children }: { children: React.ReactNode }) {
  return <div className="app-shell">{children}</div>;
}
