import { colorForBuddy, readableTextColor } from "@/lib/buddies";
import styles from "./BuddyBadge.module.css";

interface BuddyBadgeProps {
  name: string;
}

export default function BuddyBadge({ name }: BuddyBadgeProps) {
  const background = colorForBuddy(name);
  return (
    <span className={styles.badge} style={{ background, color: readableTextColor(background) }}>
      {name}
    </span>
  );
}
