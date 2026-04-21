"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Key, Info, Loader2, Eye, EyeOff } from "lucide-react";
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

export default function SettingsPage() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const settingsRes = await fetch("/api/settings");
      const data: Settings = await settingsRes.json();
      setSettings(data);
      setWorkspaceName(data.workspaceName);
    })();
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
