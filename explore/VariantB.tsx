import { Stage, Crt } from './Stage.tsx';

// B — "plasma": maximalist. raster marquee header + fullscreen carved plasma.
export default function VariantB({ name }: { name: string }) {
  return (
    <div className="gb">
      <div className="gb-room" />
      <div className="gb-strip">
        <span className="gb-title">GREETS TO {name.toUpperCase()}</span>
      </div>
      <div className="gb-tube">
        <Stage name={name} section="plasma" />
        <Crt />
      </div>
      <div className="gb-chrome">
        <span className="gb-hash">#{name.length * 137 % 65536 | 0}</span>
        <span className="gb-hint">another production by greets.dev</span>
      </div>
    </div>
  );
}
