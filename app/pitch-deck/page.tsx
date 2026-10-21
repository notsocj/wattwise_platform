import type { Metadata } from "next";
import PitchDeck from "@/components/pitch-deck/PitchDeck";
import "./pitch-deck.css";

export const metadata: Metadata = {
  title: "WattWise Pitch Deck | PSC XI",
  description: "WattWise presentation deck for Philippine Startup Challenge XI.",
};

export default function PitchDeckPage() {
  return <PitchDeck />;
}
