"use client";

import { useEffect } from "react";

export function PrintActions() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <button onClick={() => window.print()} className="primary">
        🖨 打印
      </button>
      <button onClick={() => window.close()}>关闭窗口</button>
    </>
  );
}
