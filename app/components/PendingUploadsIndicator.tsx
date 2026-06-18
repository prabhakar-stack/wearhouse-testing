"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  Upload,
  FileImage,
  FileVideo,
} from "lucide-react";
import {
  getPendingUploads,
  deletePendingUpload,
  updatePendingUploadStatus,
  PendingUpload,
} from "@/lib/indexedDb";

interface PendingUploadsIndicatorProps {
  preferredLanguage?: "en" | "hi";
}

interface GroupedUpload {
  orderId: string;
  manifestId?: string;
  orderPlatformId?: string;
  type: "RECEIVER_REJECTION" | "INSPECTION_VIDEO";
  files: PendingUpload[];
  status: "idle" | "uploading" | "success" | "failed";
  error?: string;
  uploadedById?: string;
  reason?: string;
  lpnConditions?: Record<string, string>;
  lpnRecoveryTypes?: Record<string, string>;
}

export default function PendingUploadsIndicator({
  preferredLanguage = "en",
}: PendingUploadsIndicatorProps) {
  const lang = preferredLanguage === "hi" ? "hi" : "en";
  const [uploads, setUploads] = useState<PendingUpload[]>([]);
  const [grouped, setGrouped] = useState<GroupedUpload[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [overallStatus, setOverallStatus] = useState<"idle" | "uploading">("idle");

  // Fetch pending uploads from IndexedDB
  const fetchUploads = async () => {
    try {
      const all = await getPendingUploads();
      setUploads(all);

      // Group by orderId
      const groupsMap: Record<string, GroupedUpload> = {};
      all.forEach((item) => {
        const groupKey = `${item.type}_${item.orderId}`;
        if (!groupsMap[groupKey]) {
          groupsMap[groupKey] = {
            orderId: item.orderId,
            manifestId: item.manifestId,
            orderPlatformId: item.orderPlatformId,
            type: item.type,
            files: [],
            status: item.status === "uploading" ? "uploading" : "idle",
            uploadedById: item.uploadedById,
            reason: item.reason,
            lpnConditions: item.lpnConditions,
            lpnRecoveryTypes: item.lpnRecoveryTypes,
          };
        }
        groupsMap[groupKey].files.push(item);
        if (item.error) {
          groupsMap[groupKey].error = item.error;
        }
      });

      setGrouped(Object.values(groupsMap));
    } catch (err) {
      console.error("[PendingUploads] Failed to fetch from IndexedDB:", err);
    }
  };

  useEffect(() => {
    requestAnimationFrame(() => {
      fetchUploads();
    });

    // Listen for changes dispatched from dashboards
    const handleChanged = () => {
      fetchUploads();
    };
    window.addEventListener("pending-uploads-changed", handleChanged);
    return () => {
      window.removeEventListener("pending-uploads-changed", handleChanged);
    };
  }, []);

  if (uploads.length === 0) return null;

  // Helpers for Image Compression
  const compressImage = async (blob: Blob, quality = 0.65): Promise<Blob> => {
    try {
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return blob;
      ctx.drawImage(bmp, 0, 0);
      return await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", quality)
      );
    } catch {
      return blob;
    }
  };

  // Reusable small file upload logic
  const uploadSmallFile = async (
    f: { key: string; name: string; blob: Blob },
    url: string
  ) => {
    let uploadBlob = f.blob;
    if (f.blob.type === "image/jpeg" && f.blob.size > 5_000_000) {
      uploadBlob = await compressImage(f.blob, 0.8);
    }
    const timeoutMs = Math.max(30000, Math.min(120000, Math.ceil((uploadBlob.size / 100000) * 1000)));
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { method: "PUT", body: uploadBlob, signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.success === false && data?.driveUploadFailed) {
            lastError = new Error(`Drive upload failed for ${f.name}: ${data.error || "Unknown Drive error"}`);
          } else {
            return data;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (errData?.driveUploadFailed) {
            lastError = new Error(`Drive upload failed for ${f.name}: ${errData.error || `HTTP ${res.status}`}`);
          } else {
            lastError = new Error(`HTTP ${res.status} for ${f.name}`);
          }
        }
      } catch (err: any) {
        clearTimeout(tid);
        lastError = err;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    throw new Error(`Failed to upload ${f.name}: ${lastError?.message || "unknown"}`);
  };

  // Reusable Resumable Video upload logic
  const uploadVideoResumable = async (
    f: { key: string; name: string; mimeType: string; blob: Blob },
    targetFolderId: string
  ) => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalSize = f.blob.size;

    const sessionRes = await fetch("/api/upload/resumable-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: targetFolderId, name: f.name, mimeType: f.mimeType, fileSize: totalSize }),
    });
    if (!sessionRes.ok) {
      throw new Error(`Failed to create resumable session: ${sessionRes.status}`);
    }
    const { sessionUri } = await sessionRes.json();

    let uploadedBytes = 0;
    const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalSize);
      const chunk = f.blob.slice(start, end);

      let chunkOk = false;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 120000);
        try {
          const res = await fetch(sessionUri, {
            method: "PUT",
            headers: {
              "Content-Range": `bytes ${start}-${end - 1}/${totalSize}`,
              "Content-Type": f.mimeType,
            },
            body: chunk,
            signal: controller.signal,
          });
          clearTimeout(tid);
          if (res.status === 200 || res.status === 201 || res.status === 308) {
            uploadedBytes = end;
            chunkOk = true;
            break;
          }
          lastErr = new Error(`Google returned status ${res.status}`);
        } catch (err: any) {
          clearTimeout(tid);
          lastErr = err;
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt));
      }

      if (!chunkOk) {
        throw new Error(`Chunk ${i + 1}/${totalChunks} failed: ${lastErr?.message || "unknown"}`);
      }
    }

    const finalizeRes = await fetch("/api/upload/resumable-finalize-by-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: targetFolderId, name: f.name }),
    });
    if (!finalizeRes.ok) {
      console.warn("Resumable video finalize permissions failed, continuing.");
    }
  };

  // Run the upload workflow for a group
  const handleRetryGroup = async (group: GroupedUpload) => {
    // Update local UI states and IndexedDB statuses
    setGrouped((prev) =>
      prev.map((g) =>
        g.orderId === group.orderId && g.type === group.type
          ? { ...g, status: "uploading", error: undefined }
          : g
      )
    );

    for (const f of group.files) {
      await updatePendingUploadStatus(f.id, "uploading");
    }

    try {
      const filesMetaData = group.files.map((f) => ({
        key: f.key,
        name: f.name,
        mimeType: f.mimeType,
        lpn: f.lpn,
      }));

      // 1. Initialize upload folders / URLs
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: group.orderId,
          type: group.type,
          filesMetaData,
        }),
      });

      if (!initRes.ok) {
        throw new Error(`Upload initialization failed with HTTP ${initRes.status}`);
      }

      const { uploadUrls, folderLink, orderFolderId } = await initRes.json();

      // 2. Upload each file — route large files (> 4 MB) to direct resumable upload, and small files to raw upload.
      for (const f of group.files) {
        const rawUrl = uploadUrls[f.key];
        if (!rawUrl) throw new Error(`Missing upload URL for file key: ${f.key}`);
        
        let fileToUpload = f;
        if (f.blob.type === "image/jpeg" && f.blob.size > 5_000_000) {
          const compressed = await compressImage(f.blob, 0.8);
          console.log(`[Upload Retry] Compressed large image ${f.name}: ${(f.blob.size / 1024 / 1024).toFixed(1)} MB → ${(compressed.size / 1024 / 1024).toFixed(1)} MB`);
          fileToUpload = { ...f, blob: compressed };
        }

        if (fileToUpload.blob.size > 4_000_000) {
          console.log(`[Upload Retry] File ${f.name} is large (${(fileToUpload.blob.size / 1024 / 1024).toFixed(1)} MB) — using resumable upload.`);
          await uploadVideoResumable(fileToUpload, orderFolderId);
        } else {
          await uploadSmallFile(fileToUpload, rawUrl);
        }
      }

      // 3. Finalize upload metadata in DB
      const cleanUserId =
        group.uploadedById &&
        group.uploadedById !== "undefined" &&
        group.uploadedById !== "null"
          ? group.uploadedById
          : undefined;

      const finalizeRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: group.orderId,
          manifestId: group.manifestId,
          orderPlatformId: group.orderPlatformId,
          folderLink,
          orderFolderId,
          type: group.type,
          uploadedById: cleanUserId,
          reason: group.reason || "Manual upload retry",
          lpnConditions: group.lpnConditions,
          lpnRecoveryTypes: group.lpnRecoveryTypes,
        }),
      });

      if (!finalizeRes.ok) {
        throw new Error(`Database finalization failed with HTTP ${finalizeRes.status}`);
      }

      // 4. Update the dashboard evaluation database state
      if (group.type === "RECEIVER_REJECTION") {
        // Run dock receive to resolve any local placeholders
        await fetch("/api/dock/receive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            trackingId: group.orderId,
            tapeIntact: group.lpnConditions?.tapeIntact === "true",
            boxCrushed: group.lpnConditions?.boxCrushed === "true",
            isTampered: group.lpnConditions?.isTampered === "true",
            evidenceUrl: folderLink,
          }),
        }).catch((e) => console.warn("Retry dock receive warning:", e));
      } else if (group.type === "INSPECTION_VIDEO") {
        // Run inspector evaluate to resolve
        const itemsScanned = Object.keys(group.lpnConditions || {}).length;
        await fetch("/api/inspector/evaluate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-role": "INSPECTOR",
            "x-user-id": cleanUserId || "",
          },
          body: JSON.stringify({
            manifestId: group.manifestId,
            orderPlatformId: group.orderPlatformId,
            itemsScanned,
            itemsExpected: itemsScanned, // fallback assumption
            isMissingItemFlagged: false,
            lpnConditions: group.lpnConditions,
            lpnRecoveryTypes: group.lpnRecoveryTypes,
            evidenceUrl: folderLink,
            orderDriveLink: folderLink,
          }),
        }).catch((e) => console.warn("Retry inspector evaluate warning:", e));
      }

      // 5. Successful retry: remove from local IndexedDB
      for (const f of group.files) {
        await deletePendingUpload(f.id);
      }

      setGrouped((prev) =>
        prev.map((g) =>
          g.orderId === group.orderId && g.type === group.type
            ? { ...g, status: "success" }
            : g
        )
      );

      // Trigger standard refresh of pending list
      setTimeout(() => {
        fetchUploads();
      }, 1000);
    } catch (err: any) {
      console.error("[Retry Failed]", err);
      const errMsg = err.message || "Failed during re-upload.";

      // Update in IndexedDB for persistence
      for (const f of group.files) {
        await updatePendingUploadStatus(f.id, "failed", errMsg);
      }

      setGrouped((prev) =>
        prev.map((g) =>
          g.orderId === group.orderId && g.type === group.type
            ? { ...g, status: "failed", error: errMsg }
            : g
        )
      );
    }
  };

  const handleRetryAll = async () => {
    setOverallStatus("uploading");
    const activeGroups = grouped.filter((g) => g.status !== "success");
    for (const group of activeGroups) {
      await handleRetryGroup(group);
    }
    setOverallStatus("idle");
  };

  const handleDeleteGroup = async (group: GroupedUpload) => {
    if (
      confirm(
        lang === "hi"
          ? `क्या आप निश्चित रूप से ऑर्डर ${group.orderId} के लिए सभी लंबित अपलोड हटाना चाहते हैं?`
          : `Are you sure you want to discard pending uploads for order ${group.orderId}?`
      )
    ) {
      for (const f of group.files) {
        await deletePendingUpload(f.id);
      }
      fetchUploads();
    }
  };

  const t = {
    badgeText: lang === "hi" ? "लंबित अपलोड" : "Pending Uploads",
    modalTitle: lang === "hi" ? "लंबित / विफल अपलोड प्रबंधन" : "Pending & Failed Uploads Manager",
    modalSubtitle:
      lang === "hi"
        ? "नीचे दिए गए अपलोड ड्राइव विफलता के कारण स्थानीय स्टोरेज (इस डिवाइस) पर सुरक्षित हैं।"
        : "Uploads below were saved to device storage due to past Google Drive connection issues.",
    retryAll: lang === "hi" ? "सभी पुन: प्रयास करें" : "Retry All",
    order: lang === "hi" ? "ऑर्डर" : "Order",
    filesCount: lang === "hi" ? "फ़ाइलें" : "Files",
    typeRejection: lang === "hi" ? "इंटेक विजुअल अस्वीकृति" : "Intake Rejection Proof",
    typeInspection: lang === "hi" ? "आर्डर निरीक्षण सबूत" : "Inspection Media proof",
    discard: lang === "hi" ? "रद्द करें" : "Discard",
    retry: lang === "hi" ? "पुन: प्रयास" : "Retry",
    uploading: lang === "hi" ? "अपलोड हो रहा है..." : "Uploading...",
    success: lang === "hi" ? "सफलतापूर्वक पूर्ण!" : "Completed!",
    failed: lang === "hi" ? "विफल" : "Failed",
  };

  return (
    <>
      {/* Floating Status Indicator Pill */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-[#FF6700] hover:bg-orange-600 text-white font-black text-xs uppercase tracking-widest px-5 py-3 rounded-full shadow-2xl flex items-center space-x-3 border-2 border-white/20 select-none animate-bounce"
      >
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
        </div>
        <span>
          {t.badgeText} ({uploads.length})
        </span>
      </button>

      {/* Slide Drawer / Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => {
            if (overallStatus !== "uploading") setIsOpen(false);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 relative max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-br from-slate-950 to-indigo-950 p-6 text-white text-left relative shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                disabled={overallStatus === "uploading"}
                className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors disabled:opacity-30"
              >
                <X size={22} />
              </button>
              <h2 className="text-xl font-black uppercase tracking-widest text-[#FF6700]">
                {t.modalTitle}
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-md">{t.modalSubtitle}</p>
            </div>

            {/* List Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50">
              {grouped.map((group) => {
                const totalSizeMb = (
                  group.files.reduce((sum, f) => sum + f.blob.size, 0) /
                  1024 /
                  1024
                ).toFixed(1);

                return (
                  <div
                    key={`${group.type}_${group.orderId}`}
                    className="border border-slate-200 bg-white rounded-2xl p-4 shadow-sm flex flex-col space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#FF6700] bg-orange-50 px-2.5 py-1 rounded-md border border-[#FF6700]/10">
                          {group.type === "RECEIVER_REJECTION" ? t.typeRejection : t.typeInspection}
                        </span>
                        <h3 className="font-mono text-base font-black text-[#313079] mt-2">
                          AWB: {group.orderId}
                        </h3>
                        <p className="text-[11px] text-slate-500 font-bold uppercase mt-1 tracking-wider">
                          {t.filesCount}: {group.files.length} ({totalSizeMb} MB)
                        </p>
                      </div>

                      {/* Discard & Retry Buttons */}
                      <div className="flex space-x-2">
                        <button
                          disabled={group.status === "uploading"}
                          onClick={() => handleDeleteGroup(group)}
                          className="p-2 border border-slate-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 text-slate-400 rounded-xl transition-all disabled:opacity-40"
                          title={t.discard}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          disabled={group.status === "uploading"}
                          onClick={() => handleRetryGroup(group)}
                          className="px-4 py-2 bg-[#FF6700] hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                        >
                          {group.status === "uploading" ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )}
                          <span>
                            {group.status === "uploading"
                              ? t.uploading
                              : group.status === "success"
                              ? t.success
                              : t.retry}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Files details */}
                    <div className="bg-slate-50/70 border border-slate-100 rounded-xl p-2.5 space-y-1.5">
                      {group.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between text-xs text-slate-600"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            {file.mimeType.startsWith("video/") ? (
                              <FileVideo size={13} className="text-[#313079] shrink-0" />
                            ) : (
                              <FileImage size={13} className="text-[#FF6700] shrink-0" />
                            )}
                            <span className="font-mono truncate">{file.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                            {(file.blob.size / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Status & Error display */}
                    {group.status === "success" && (
                      <div className="flex items-center space-x-2 text-green-600 text-xs font-bold uppercase bg-green-50 border border-green-200 rounded-xl px-3 py-2 animate-in fade-in duration-300">
                        <CheckCircle size={16} />
                        <span>{t.success}</span>
                      </div>
                    )}
                    {group.error && (
                      <div className="flex items-start space-x-2 text-red-600 text-xs font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="leading-snug">{group.error}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 shrink-0 flex items-center justify-between gap-4">
              <button
                disabled={overallStatus === "uploading"}
                onClick={() => setIsOpen(false)}
                className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-40"
              >
                {lang === "hi" ? "बंद करें" : "Close"}
              </button>

              <button
                disabled={overallStatus === "uploading"}
                onClick={handleRetryAll}
                className="px-6 py-3 bg-[#313079] hover:bg-[#313079]/90 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center space-x-2"
              >
                <RefreshCw size={14} className={overallStatus === "uploading" ? "animate-spin" : ""} />
                <span>{t.retryAll}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
