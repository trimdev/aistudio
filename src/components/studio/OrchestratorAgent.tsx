"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Brain, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { AgentMessage } from "@/lib/ai/gemini";

interface OrchestratorAgentProps {
  projectId?: string;
  onTriggerRefine?: (feedback: string) => void;
}

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  isTyping?: boolean;
}

export function OrchestratorAgent({ projectId, onTriggerRefine }: OrchestratorAgentProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", text: t("agent_welcome") }]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const newUserMsg: DisplayMessage = { role: "user", text };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsSending(true);

    // Build history for API (exclude typing indicators)
    const apiMessages: AgentMessage[] = updatedMessages
      .filter(m => !m.isTyping)
      .map(m => ({ role: m.role === "assistant" ? "model" : "user", text: m.text }));

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, projectId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent error");

      const reply: string = data.reply;

      // Check if agent wants to trigger a refinement
      try {
        const jsonMatch = reply.match(/\{"action"\s*:\s*"refine"\s*,\s*"feedback"\s*:\s*"([^"]+)"\}/);
        if (jsonMatch && onTriggerRefine) {
          const feedback = jsonMatch[1];
          onTriggerRefine(feedback);
          setMessages(prev => [...prev, {
            role: "assistant",
            text: `${t("agent_trigger_refine")} "${feedback}"`,
          }]);
        } else {
          setMessages(prev => [...prev, { role: "assistant", text: reply }]);
        }
      } catch {
        setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("agent_error");
      setMessages(prev => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, messages, projectId, onTriggerRefine, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl",
          "bg-gray-900 text-white font-semibold text-sm hover:bg-gray-700 transition-all duration-200",
          "hover:scale-105 active:scale-95",
          open && "hidden"
        )}
        aria-label={t("agent_title")}
      >
        <Brain className="w-4 h-4" />
        {t("agent_title")}
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
      </button>

      {/* Slide-in sidebar */}
      <div className={cn(
        "fixed right-0 top-0 h-full z-50 flex flex-col bg-white border-l border-gray-100 shadow-2xl transition-all duration-300 ease-out",
        open ? "w-[380px] translate-x-0" : "w-[380px] translate-x-full"
      )}>
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold">{t("agent_title")}</p>
              <p className="text-[11px] text-white/60">{t("agent_subtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-white/60 bg-white/10 rounded-full px-2.5 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Gemini 2.5
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors ml-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Brain className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-gray-900 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-800 rounded-bl-sm"
              )}>
                {msg.isTyping ? (
                  <div className="flex gap-1 items-center py-1">
                    {[0,1,2].map(j => (
                      <div key={j} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                        style={{ animationDelay: `${j * 150}ms` }} />
                    ))}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                )}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-xl bg-gray-900 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                <Brain className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  {[0,1,2].map(j => (
                    <div key={j} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
                      style={{ animationDelay: `${j * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Context info */}
        {projectId && (
          <div className="shrink-0 px-4 py-2 border-t border-gray-50">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Projekt kontextus aktív
            </div>
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("agent_ph")}
              disabled={isSending}
              rows={2}
              className="resize-none text-sm border-gray-200 leading-relaxed"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="self-end h-9 w-9 p-0 bg-gray-900 text-white hover:bg-gray-700 shrink-0"
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Enter = küldés · Shift+Enter = sortörés</p>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
