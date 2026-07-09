"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  Copy,
  Dices,
  Loader2,
  Lock,
  LockKeyhole,
  LockKeyholeOpen,
  Unlock,
} from "lucide-react";
import {
  STYLE_OPTIONS,
  DEFAULT_STYLE_ID,
  detectStyleId,
} from "../lib/alphabets";
import { generateUserKey } from "../lib/keygen";
import type { CipherMode, CipherResponse } from "../types";

/** localStorage slot for a user-locked key that should survive reloads. */
const STORAGE_KEY = "message-cipher:userKey";

export function MessageCipherTool() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<CipherMode>("encrypt");
  const [input, setInput] = useState("");
  const [userKey, setUserKey] = useState("");
  const [locked, setLocked] = useState(false);
  const [styleId, setStyleId] = useState(DEFAULT_STYLE_ID);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"key" | "output" | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On first mount, restore a previously locked key from localStorage so it
  // survives reloads; otherwise start with a fresh random key.
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage may be unavailable (private mode, etc.) */
    }
    if (saved) {
      setUserKey(saved);
      setLocked(true);
    } else {
      setUserKey(generateUserKey());
    }
  }, []);

  // Lock/unlock persists the current key to (or clears it from) localStorage.
  const toggleLock = () => {
    setLocked((prev) => {
      const next = !prev;
      try {
        if (next) localStorage.setItem(STORAGE_KEY, userKey);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore storage failures */
      }
      return next;
    });
  };

  const inputLabel = mode === "encrypt" ? "Tin nhắn gốc" : "Bản mã cần giải";
  const outputLabel = mode === "encrypt" ? "Bản mã" : "Tin nhắn gốc";
  const inputPlaceholder =
    mode === "encrypt"
      ? "Nhập tin nhắn... (dịch ngay khi gõ)"
      : "Dán bản mã vào đây...";

  const runTranslate = useCallback(
    async (
      curMode: CipherMode,
      curText: string,
      curKey: string,
      curStyle: string,
    ) => {
      if (!curText) {
        setOutput("");
        setError("");
        setBusy(false);
        return;
      }
      // Cancel any in-flight request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        const res = await fetch("/api/tools/message-cipher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: curMode,
            text: curText,
            userKey: curKey,
            styleId: curStyle,
          }),
          signal: controller.signal,
        });
        const data = (await res.json()) as CipherResponse;
        if (data.error) {
          setError(data.error);
          setOutput("");
        } else {
          setOutput(data.result);
          setError("");
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Không gọi được máy chủ. Thử lại nhé.");
        }
      } finally {
        // Only clear busy if this is still the latest request.
        if (abortRef.current === controller) setBusy(false);
      }
    },
    [],
  );

  // Debounced real-time translate whenever any input changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runTranslate(mode, input, userKey, styleId);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [mode, input, userKey, styleId, runTranslate]);

  // In decrypt mode, sniff the pasted ciphertext and switch to the matching
  // style automatically — the user only needs to paste, not pick the "font".
  const [autoDetected, setAutoDetected] = useState(false);
  useEffect(() => {
    if (mode !== "decrypt" || !input) {
      setAutoDetected(false);
      return;
    }
    const detected = detectStyleId(input);
    if (detected) {
      setAutoDetected(true);
      if (detected !== styleId) setStyleId(detected);
    } else {
      setAutoDetected(false);
    }
  }, [mode, input, styleId]);

  const swapDirection = () => {
    // Move current output into input and flip the mode.
    setMode((m) => (m === "encrypt" ? "decrypt" : "encrypt"));
    setInput(output);
    setOutput("");
    setError("");
  };

  const copy = async (what: "key" | "output") => {
    const value = what === "key" ? userKey : output;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      /* clipboard may be blocked; ignore */
    }
  };

  const currentStyle = useMemo(
    () => STYLE_OPTIONS.find((s) => s.id === styleId),
    [styleId],
  );

  const modes: { id: CipherMode; label: string; icon: typeof Lock }[] = [
    { id: "encrypt", label: "Mã hóa", icon: Lock },
    { id: "decrypt", label: "Giải mã", icon: Unlock },
  ];

  return (
    <motion.div
      className="panel"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
    >
      {/* Mode + style controls */}
      <div className="cipher-toolbar">
        <div className="segmented" role="tablist" aria-label="Chế độ">
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              className={mode === id ? "active" : ""}
              onClick={() => setMode(id)}
              type="button"
            >
              {mode === id && (
                <motion.span
                  layoutId="seg-indicator"
                  className="seg-indicator"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 34 }
                  }
                />
              )}
              <span className="seg-label">
                <Icon size={16} strokeWidth={2.2} /> {label}
              </span>
            </button>
          ))}
        </div>

        <div className="cipher-style">
          <select
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            aria-label="Kiểu chữ"
          >
            {STYLE_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.sample}
              </option>
            ))}
          </select>
          {mode === "decrypt" && autoDetected ? (
            <p className="hint" style={{ marginTop: 6 }}>
              <Check size={13} strokeWidth={2.4} /> Đã tự nhận diện kiểu chữ
            </p>
          ) : null}
        </div>
      </div>

      {/* Key */}
      <div className="field">
        <label className="field-label">
          Key của bạn (kết hợp cùng key riêng của web để mã hóa)
        </label>
        <div className="key-row">
          <input
            type="text"
            value={userKey}
            onChange={(e) => setUserKey(e.target.value)}
            placeholder="Dán key vào đây hoặc bấm Tạo key"
            spellCheck={false}
            readOnly={locked}
            title={locked ? "Key đang khóa — mở khóa để chỉnh" : undefined}
          />
          <button
            type="button"
            className="btn small"
            onClick={() => setUserKey(generateUserKey())}
            title="Tạo key ngẫu nhiên"
            disabled={locked}
          >
            <Dices size={16} strokeWidth={2.2} /> Tạo key
          </button>
          <button
            type="button"
            className={locked ? "btn small locked" : "btn small"}
            onClick={toggleLock}
            title={
              locked
                ? "Mở khóa key (xóa khỏi trình duyệt)"
                : "Khóa key (lưu vào trình duyệt, giữ nguyên khi tải lại)"
            }
            aria-pressed={locked}
          >
            {locked ? (
              <>
                <LockKeyhole size={16} strokeWidth={2.2} /> Đã khóa
              </>
            ) : (
              <>
                <LockKeyholeOpen size={16} strokeWidth={2.2} /> Khóa
              </>
            )}
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => copy("key")}
            title="Sao chép key"
          >
            {copied === "key" ? (
              <>
                <Check size={16} strokeWidth={2.4} /> Đã chép
              </>
            ) : (
              <>
                <Copy size={16} strokeWidth={2.2} /> Chép
              </>
            )}
          </button>
        </div>
        <p className="hint">
          Người nhận cần <strong>đúng key này</strong> và{" "}
          <strong>đúng kiểu chữ</strong> để giải mã. Key riêng của web được giữ
          bí mật ở máy chủ nên chỉ có bản mã thôi thì không giải được. Bấm{" "}
          <strong>Khóa</strong> để lưu key vào trình duyệt — key sẽ giữ nguyên
          mỗi lần tải lại trang.
        </p>
      </div>

      {/* Input / Output */}
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <label className="field-label">{inputLabel}</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={inputPlaceholder}
            spellCheck={false}
          />
        </div>
        <div>
          <label className="field-label">
            {outputLabel}
            {currentStyle && mode === "encrypt"
              ? ` (${currentStyle.name})`
              : ""}
          </label>
          <div
            className="output-box"
            aria-live="polite"
            data-placeholder={
              mode === "encrypt"
                ? "Kết quả mã hóa hiện ở đây…"
                : "Tin nhắn giải mã hiện ở đây…"
            }
          >
            {output}
          </div>
        </div>
      </div>

      <div className="status" aria-live="polite">
        {busy ? (
          <>
            <Loader2 className="spin" size={14} strokeWidth={2.4} /> Đang dịch…
          </>
        ) : !error && output ? (
          <>
            <span className="dot" /> Đã dịch
          </>
        ) : null}
      </div>
      {error ? (
        <div className="error" role="alert">
          <AlertCircle size={16} strokeWidth={2.2} /> {error}
        </div>
      ) : null}

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={swapDirection}>
          <ArrowLeftRight size={17} strokeWidth={2.2} /> Đảo chiều
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={() => copy("output")}
          disabled={!output}
        >
          {copied === "output" ? (
            <>
              <Check size={17} strokeWidth={2.4} /> Đã chép kết quả
            </>
          ) : (
            <>
              <Copy size={17} strokeWidth={2.2} /> Chép kết quả
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
