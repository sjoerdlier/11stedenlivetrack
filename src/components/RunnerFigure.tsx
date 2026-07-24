import styles from "./RunnerFigure.module.css";

interface RunnerFigureProps {
  size?: number;
  color?: string;
  running?: boolean;
  bounce?: boolean;
  rotationDeg?: number;
  className?: string;
}

// A friendly runner built from independent SVG shapes (head, torso, two
// arms, two legs) so each limb can swing on its own around its joint — the
// joints (hip 28,54 and shoulder 29,30) stay fixed so the CSS transform-
// origins below keep lining up. The figure faces east (bearing 90) by
// default; rotationDeg rotates the whole figure to face the running
// direction on the map.
export default function RunnerFigure({
  size = 32,
  color = "#2a78d6",
  running = true,
  bounce = false,
  rotationDeg = 0,
  className,
}: RunnerFigureProps) {
  return (
    <div
      className={[styles.wrap, bounce ? styles.bounce : "", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size }}
    >
      <svg
        className={styles.figure}
        viewBox="0 0 60 100"
        width={size}
        height={size}
        style={{ transform: `rotate(${rotationDeg}deg)` }}
        aria-hidden
      >
        <ellipse cx="29" cy="94" rx="16" ry="4" fill="#000000" opacity="0.18" />
        <g stroke={color} fill={color} strokeLinecap="round">
          <g className={[styles.legBack, running ? styles.animated : ""].join(" ")}>
            <line x1="28" y1="54" x2="16" y2="88" strokeWidth="9" />
          </g>
          <g className={[styles.armBack, running ? styles.animated : ""].join(" ")}>
            <line x1="29" y1="30" x2="18" y2="46" strokeWidth="6" />
          </g>

          <line x1="30" y1="24" x2="28" y2="55" strokeWidth="9" />
          <circle cx="31" cy="13" r="10" />

          <g className={[styles.armFront, running ? styles.animated : ""].join(" ")}>
            <line x1="29" y1="30" x2="41" y2="44" strokeWidth="6" />
          </g>
          <g className={[styles.legFront, running ? styles.animated : ""].join(" ")}>
            <line x1="28" y1="54" x2="42" y2="86" strokeWidth="9" />
          </g>
        </g>
        <circle cx="27" cy="12" r="1.4" fill="#ffffff" stroke="none" />
        <circle cx="35" cy="12" r="1.4" fill="#ffffff" stroke="none" />
        <path d="M26,17 Q31,20 36,17" fill="none" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}
