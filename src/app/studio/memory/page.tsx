"use client";

import { useState, useEffect } from "react";
import { BookOpen, Plus, Trash2, Clock } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

interface MemoryNote {
  id: string;
  text: string;
  createdAt: string;
}

const CHANGELOG: { date: string; items: string[] }[] = [
  {
    date: "2026-04-10",
    items: [
      "Removed AI chat (OrchestratorAgent) from the bottom-right corner of the studio layout",
      "Added Memory section to the sidebar with BookOpen icon",
      "Created this Memory page for workspace changelog and notes",
      "Launched security vulnerability audit (background agent)",
      "Launched bug discovery audit (background agent)",
      "Initialized per-workspace memory system",
    ],
  },
];

const STORAGE_KEY = "gs-memory-notes";

function loadNotes(): MemoryNote[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveNotes(notes: MemoryNote[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export default function MemoryPage() {
  const { t } = useLanguage();
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [input, setInput] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  const addNote = () => {
    const text = input.trim();
    if (!text) return;
    const note: MemoryNote = {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    saveNotes(updated);
    setInput("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const deleteNote = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t("mem_title")}</h1>
          <p className="text-sm text-gray-500">{t("mem_subtitle")}</p>
        </div>
      </div>

      {/* Changelog */}
      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
          {t("mem_changes")}
        </h2>
        <div className="space-y-4">
          {CHANGELOG.map((entry) => (
            <div key={entry.date} className="border border-gray-100 rounded-xl p-5 bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-400">{entry.date}</span>
              </div>
              <ul className="space-y-1.5">
                {entry.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
          {t("mem_notes")}
        </h2>

        {/* Add note */}
        <div className="flex gap-2 mb-5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("mem_notes_ph")}
            rows={2}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-300 leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addNote();
              }
            }}
          />
          <button
            onClick={addNote}
            disabled={!input.trim()}
            className="self-end flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors shrink-0"
          >
            {saved ? t("mem_saved") : (
              <>
                <Plus className="w-4 h-4" />
                {t("mem_save")}
              </>
            )}
          </button>
        </div>

        {/* Note list */}
        {notes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">{t("mem_no_notes")}</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div key={note.id} className="group flex items-start gap-3 border border-gray-100 rounded-xl px-4 py-3 bg-white">
                <p className="flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-300">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
