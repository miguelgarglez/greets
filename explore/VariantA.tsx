import { Stage, Crt } from './Stage.tsx';

// A — "sanity": the canonical fullscreen cracktro. the demo IS the page.
export default function VariantA({ name }: { name: string }) {
  return (
    <div className="ga">
      <div className="ga-room" />
      <div className="ga-vbar top" />
      <div className="ga-vbar bottom" />
      <div className="ga-tube">
        <Stage name={name} section="preboot" />
        <Crt />
      </div>
      <div className="ga-chrome">
        <span className="ga-mark">GREETS</span>
        <span className="ga-hint">greets.dev/{name.toLowerCase()}</span>
      </div>
    </div>
  );
}
