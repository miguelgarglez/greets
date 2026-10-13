import { Stage, Crt } from './Stage.tsx';

// C — "the set": the demo playing inside a chunky CRT monitor on a dark desk.
export default function VariantC({ name }: { name: string }) {
  return (
    <div className="gc">
      <div className="gc-back" />
      <div className="gc-set">
        <div className="gc-bezel">
          <div className="gc-screen">
            <Stage name={name} section="classic" />
            <Crt />
            <div className="gc-glare" />
          </div>
          <div className="gc-chin">
            <span className="gc-brand">GREETS 9000</span>
            <span className="gc-led" />
          </div>
        </div>
        <div className="gc-neck" />
        <div className="gc-foot" />
      </div>
      <div className="gc-floor" />
      <div className="gc-tag">
        <span>greets.dev/{name.toLowerCase()}</span>
      </div>
    </div>
  );
}
