import React from 'react';
import { createRoot } from 'react-dom/client';
import './explore.css';
import VariantA from './VariantA.tsx';
import VariantB from './VariantB.tsx';
import VariantC from './VariantC.tsx';

const q = new URLSearchParams(location.search);
const v = q.get('v') ?? 'a';
const name = (q.get('n') ?? 'MIGUEL').slice(0, 14);

const V = { a: VariantA, b: VariantB, c: VariantC }[v] ?? VariantA;
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <V name={name} />
  </React.StrictMode>,
);
