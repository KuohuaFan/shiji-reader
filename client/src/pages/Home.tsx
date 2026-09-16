import { useState } from "react";
import Reader from "@/components/Reader";
import ShijiWorkbench from "@/components/ShijiWorkbench";
import { appHref } from "@/lib/site";

function initialChapter(): number | null {
  const value = Number(new URLSearchParams(window.location.search).get("chapter"));
  if (Number.isInteger(value) && value >= 1 && value <= 130) return value;
  return null;
}

export default function Home() {
  const [chapter, setChapter] = useState<number | null>(() => initialChapter());

  const openChapter = (volume: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("chapter", String(volume));
    window.history.pushState({}, "", url);
    setChapter(volume);
  };

  const returnToWorkbench = () => {
    window.history.pushState({}, "", appHref());
    setChapter(null);
  };

  if (chapter !== null) {
    return <Reader initialVolume={chapter} onHome={returnToWorkbench} />;
  }

  return <ShijiWorkbench onOpenChapter={openChapter} />;
}
