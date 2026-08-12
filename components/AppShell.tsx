"use client";

import { useTimer } from "@/lib/client/useTimer";
import { Header } from "./Header";
import { Panels } from "./Panels";

/** Owns the ONE timer client for the whole page. With the write-ahead log
 *  in localStorage, multiple clients would mean multiple in-memory WAL
 *  copies clobbering each other's persists — every consumer must share
 *  this instance via props. */
export function AppShell() {
  const timerState = useTimer();
  return (
    <>
      <Header timerState={timerState} />
      <Panels timerState={timerState} />
    </>
  );
}
