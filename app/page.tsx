"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/components/game/Game"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center bg-[#cfe8b8] text-stone-700">
      Загрузка сцены…
    </div>
  ),
});

export default function Home() {
  return <Game />;
}
