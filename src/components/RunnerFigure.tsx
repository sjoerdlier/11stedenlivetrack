import styles from "./RunnerFigure.module.css";

interface RunnerFigureProps {
  size?: number;
  color?: string;
  running?: boolean;
  bounce?: boolean;
  rotationDeg?: number;
  className?: string;
}

// A simple stick-figure runner built from independent SVG shapes (head,
// torso, two arms, two legs) so each limb can swing on its own around its
// joint. The figure faces east (bearing 90) by default; rotationDeg rotates
// the whole figure to face the running direction on the map.
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
        <g stroke={color} fill={color} strokeLinecap="round">
          <g className={[styles.legBack, running ? styles.animated : ""].join(" ")}>
            <line x1="28" y1="54" x2="16" y2="88" strokeWidth="7" />
          </g>
          <g className={[styles.armBack, running ? styles.animated : ""].join(" ")}>
            <line x1="29" y1="30" x2="18" y2="46" strokeWidth="5" />
          </g>

          <line x1="30" y1="24" x2="28" y2="55" strokeWidth="7" />
          <circle cx="31" cy="13" r="9" />

          <g className={[styles.armFront, running ? styles.animated : ""].join(" ")}>
            <line x1="29" y1="30" x2="41" y2="44" strokeWidth="5" />
          </g>
          <g className={[styles.legFront, running ? styles.animated : ""].join(" ")}>
            <line x1="28" y1="54" x2="42" y2="86" strokeWidth="7" />
          </g>
        </g>
      </svg>
    </div>
  );
}
