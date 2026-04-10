"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Save, Key, Info, Loader2, Eye, EyeOff, User, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/components/providers/LanguageProvider";

interface Settings {
  workspaceId: string;
  workspaceName: string;
  hasCustomApiKey: boolean;
  modules: string[];
}

interface ModelRefs {
  blonde: string | null;
  brunette: string | null;
}

function ModelRefUpload({
  variant,
  label,
  borderColor,
  bgColor,
  iconColor,
  textColor,
  currentUrl,
  onUploaded,
  onRemoved,
}: {
  variant: "blonde" | "brunette";
  label: string;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  textColor: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Csak képfájl tölthető fel.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("variant", variant);
      fd.append("file", file);
      const res = await fetch("/api/settings/model-refs", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUploaded(data.url);
      toast.success(`${label} feltöltve.`);
    } catch {
      toast.error("Feltöltés sikertelen.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const res = await fetch(`/api/settings/model-refs?variant=${variant}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onRemoved();
      toast.success(`${label} törölve.`);
    } catch {
      toast.error("Törlés sikertelen.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>

      {currentUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={label}
            className="w-full aspect-square object-cover"
          />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 hover:opacity-100">
            <button
              onClick={() => inputRef.current?.click()}
              className="p-2 rounded-lg bg-white/90 text-gray-700 hover:bg-white transition-colors"
              title="Csere"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="p-2 rounded-lg bg-white/90 text-red-600 hover:bg-white transition-colors"
              title="Törlés"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed ${borderColor} ${bgColor} p-6 text-center cursor-pointer hover:opacity-80 transition-opacity`}
        >
          {uploading ? (
            <Loader2 className={`w-6 h-6 ${iconColor} animate-spin`} />
          ) : (
            <div className={`w-10 h-10 rounded-full bg-white/60 flex items-center justify-center`}>
              <Upload className={`w-4 h-4 ${iconColor}`} />
            </div>
          )}
          <p className={`text-xs font-medium ${textColor}`}>
            {uploading ? "Feltöltés…" : `${label} feltöltése`}
          </p>
          <p className="text-[11px] text-gray-400">JPG · PNG · WebP</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelRefs, setModelRefs] = useState<ModelRefs>({ blonde: null, brunette: null });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data: Settings) => {
        setSettings(data);
        setWorkspaceName(data.workspaceName);
      });

    fetch("/api/settings/model-refs")
      .then((r) => r.json())
      .then((data: ModelRefs) => setModelRefs(data))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, string | null> = { workspaceName };
      if (geminiApiKey !== "") body.geminiApiKey = geminiApiKey || null;

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Save failed");
      toast.success(t("settings_saved"));
      setSettings((s) => s ? { ...s, workspaceName, hasCustomApiKey: !!geminiApiKey } : s);
      setGeminiApiKey("");
    } catch {
      toast.error("Mentés sikertelen");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">{t("settings_title")}</h1>
        <p className="text-sm text-gray-500 mt-1">Kezeld a munkaterületed és az API konfigurációdat.</p>
      </div>

      <Card className="border-gray-100 shadow-none p-6 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">Munkaterület</h2>
        <p className="text-xs text-gray-500 mb-5">A személyes izolált munkaterületed.</p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">{t("settings_name")}</Label>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="border-gray-200"
              placeholder={t("settings_name_ph")}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">{t("settings_id")}</Label>
            <Input
              value={settings.workspaceId}
              readOnly
              className="border-gray-200 text-gray-400 font-mono text-xs"
            />
          </div>
        </div>
      </Card>

      <Card className="border-gray-100 shadow-none p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Key className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-gray-900">{t("settings_api_key")}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-5">{t("settings_api_key_desc")}</p>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <Info className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-xs text-gray-600">
              {settings.hasCustomApiKey
                ? "Saját API kulcsod van beállítva. Töröld az alábbi mezőt, és ments a kulcs eltávolításához."
                : "A GhostStudio megosztott kulcsát használja (korlátozott). Add meg a sajátod a korlátlan hozzáféréshez."}
            </p>
            <Badge className={`ml-auto shrink-0 text-[11px] px-2 border-0 ${settings.hasCustomApiKey ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
              {settings.hasCustomApiKey ? t("settings_using_custom") : t("settings_using_shared")}
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">
              {t("settings_api_key")} {!settings.hasCustomApiKey && <span className="font-normal text-gray-400">({t("up_optional").toLowerCase()})</span>}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={settings.hasCustomApiKey ? "••••••••••••••••" : t("settings_api_key_ph")}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="border-gray-200 pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400">A kulcsod titkosítva tárolódik és soha nem kerül a böngészőbe.</p>
          </div>
        </div>
      </Card>

      {/* Model reference photos — Fashion Studio only */}
      {settings.modules.includes("fashion") && (
        <Card className="border-gray-100 shadow-none p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-gray-600" />
            <h2 className="font-semibold text-gray-900">Modell referencia képek</h2>
            <Badge className="ml-2 text-[11px] px-2 border-0 bg-violet-100 text-violet-700">Fashion Studio</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Töltsd fel a saját modell referencia képeidet. A generált fotókon a modellek ezekre fognak hasonlítani.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <ModelRefUpload
              variant="blonde"
              label="Szőke modell"
              borderColor="border-amber-200"
              bgColor="bg-amber-50/40"
              iconColor="text-amber-500"
              textColor="text-amber-700"
              currentUrl={modelRefs.blonde}
              onUploaded={(url) => setModelRefs((r) => ({ ...r, blonde: url }))}
              onRemoved={() => setModelRefs((r) => ({ ...r, blonde: null }))}
            />
            <ModelRefUpload
              variant="brunette"
              label="Barna modell"
              borderColor="border-stone-200"
              bgColor="bg-stone-50/40"
              iconColor="text-stone-500"
              textColor="text-stone-700"
              currentUrl={modelRefs.brunette}
              onUploaded={(url) => setModelRefs((r) => ({ ...r, brunette: url }))}
              onRemoved={() => setModelRefs((r) => ({ ...r, brunette: null }))}
            />
          </div>
        </Card>
      )}

      <Separator className="my-6 bg-gray-100" />

      <Button
        onClick={save}
        disabled={saving}
        className="bg-gray-900 text-white hover:bg-gray-700 gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? t("settings_saving") : t("settings_save")}
      </Button>
    </div>
  );
}
