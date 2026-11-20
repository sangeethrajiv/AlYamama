/** Saves text as a file in the browser (client-side export; no server round trip in the prototype). */
export function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
