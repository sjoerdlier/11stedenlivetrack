"use client";

import { useState, type FormEvent } from "react";
import styles from "./invoer.module.css";

interface PinScreenProps {
  onSuccess: () => void;
}

export default function PinScreen({ onSuccess }: PinScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/invoer/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({ ok: false }));

      if (!res.ok || !data.ok) {
        setError(data.error ?? "Onjuiste PIN.");
        setPin("");
        return;
      }

      onSuccess();
    } catch {
      setError("Kon niet verbinden. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.pinWrap}>
      <form className={styles.pinCard} onSubmit={handleSubmit}>
        <div className={styles.pinTitle}>Basiscamp invoer</div>
        <p className={styles.pinHint}>Voer de 4-cijferige PIN in om door te gaan.</p>
        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          className={styles.pinInput}
          aria-label="PIN"
        />
        {error && <div className={styles.pinError}>{error}</div>}
        <button type="submit" className={styles.pinSubmit} disabled={pin.length !== 4 || submitting}>
          {submitting ? "Bezig…" : "Ontgrendelen"}
        </button>
      </form>
    </div>
  );
}
