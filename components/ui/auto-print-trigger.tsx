"use client";

import { useEffect, useRef } from "react";

export function AutoPrintTrigger() {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) {
      return;
    }

    printedRef.current = true;

    const timer = window.setTimeout(() => {
      window.print();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
