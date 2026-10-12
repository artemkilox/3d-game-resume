"use client";

import { useEffect, type RefObject } from "react";

export type Input = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  pointer: boolean;
  clientX: number;
  clientY: number;
};

export function useDriveInput(input: RefObject<Input>) {
  useEffect(() => {
    const state = input.current;
    if (!state) return;

    const setKey = (event: KeyboardEvent, down: boolean) => {
      switch (event.code) {
        case "ArrowUp":
          state.forward = down;
          event.preventDefault();
          break;
        case "ArrowDown":
          state.back = down;
          event.preventDefault();
          break;
        case "ArrowLeft":
          state.left = down;
          event.preventDefault();
          break;
        case "ArrowRight":
          state.right = down;
          event.preventDefault();
          break;
        default:
          break;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false);
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2) state.pointer = true;
      state.clientX = event.clientX;
      state.clientY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.button === 2) state.pointer = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      state.clientX = event.clientX;
      state.clientY = event.clientY;
    };
    const onContextMenu = (event: Event) => event.preventDefault();
    const clear = () => {
      state.forward = false;
      state.back = false;
      state.left = false;
      state.right = false;
      state.pointer = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("blur", clear);
    };
  }, [input]);
}
