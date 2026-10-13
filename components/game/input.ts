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

export function useDriveInput(input: RefObject<Input>, enabled = true) {
  useEffect(() => {
    const state = input.current;
    if (!state) return;
    if (!enabled) {
      state.forward = false;
      state.back = false;
      state.left = false;
      state.right = false;
      state.pointer = false;
    }

    const typing = (event: Event) =>
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement;

    const setKey = (event: KeyboardEvent, down: boolean) => {
      const field = typing(event);
      switch (event.code) {
        case "ArrowUp":
          if (!field) event.preventDefault();
          state.forward = enabled && down && !field;
          break;
        case "ArrowDown":
          if (!field) event.preventDefault();
          state.back = enabled && down && !field;
          break;
        case "ArrowLeft":
          if (!field) event.preventDefault();
          state.left = enabled && down && !field;
          break;
        case "ArrowRight":
          if (!field) event.preventDefault();
          state.right = enabled && down && !field;
          break;
        default:
          break;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false);
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2 && enabled) state.pointer = true;
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
  }, [input, enabled]);
}
