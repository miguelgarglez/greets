import { Stage, Crt } from './Stage.tsx';

// A — "sanity": the canonical fullscreen cracktro. the demo IS the page.
export default function VariantA({ name }: { name: string }) {
  return (
    <div className="ga">
      <div className="ga-room" />
      <div className="ga-tube">
        <Stage name={name} section="classic" />
        <Crt />
      </div>
      <div className="ga-chrome">
        <span className="ga-mark">GREETS</span>
        <span className="ga-hint">greets.dev/{name.toLowerCase()} — press any key to boot</span>
      </div>
    </div>
  );
}
