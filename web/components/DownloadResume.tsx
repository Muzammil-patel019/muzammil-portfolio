"use client";
import { useState } from "react";
import type { Resume } from "@/lib/resume";
import { resumeFilename } from "@/lib/resume-filename";

export function DownloadResume({ resume, label = "Download PDF", secondary = false }: { resume: Resume; label?: string; secondary?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function download() {
    setBusy(true); setMessage("");
    try {
      let blob: Blob;
      try {
        const response = await fetch("/api/pdf", { cache: "no-store", signal: AbortSignal.timeout(20000) });
        if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) throw new Error("Server export unavailable");
        blob = await response.blob();
        if ((await blob.slice(0, 5).text()) !== "%PDF-") throw new Error("Invalid PDF");
      } catch {
        setMessage("Preparing a PDF in your browser…");
        const [{ pdf }, { ResumePDF }] = await Promise.all([import("@react-pdf/renderer"), import("./ResumePDF")]);
        blob = await pdf(<ResumePDF resume={resume} />).toBlob();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = resumeFilename();
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage("PDF ready. Check your browser’s downloads.");
    } catch {
      setMessage("The PDF could not be prepared. Open the resume page and use Print / Save as PDF.");
    } finally { setBusy(false); }
  }
  return <span className="resume-download"><button type="button" className={`button${secondary ? " secondary" : ""}`} disabled={busy} onClick={download}>{busy ? "Preparing PDF…" : label}</button><span className="download-status" role="status">{message}</span></span>;
}
