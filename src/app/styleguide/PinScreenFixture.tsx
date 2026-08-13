"use client";

// Thin client wrapper so the (server-rendered) styleguide page can show the
// real PinScreen component — it needs an onSuccess callback, and function
// props can't cross the server->client boundary directly from a Server
// Component.
import PinScreen from "../invoer/PinScreen";

export default function PinScreenFixture() {
  return <PinScreen title="Check-in invoer" onSuccess={() => {}} />;
}
