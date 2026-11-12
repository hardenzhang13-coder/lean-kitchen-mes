"use client";

import { useEffect } from "react";

export function PrintActions() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <button type="button" onClick={() => window.print()} className="primary">
        打印
      </button>
      <button type="button" onClick={() => window.close()}>
        关闭窗口
      </button>
    </>
  );
}
