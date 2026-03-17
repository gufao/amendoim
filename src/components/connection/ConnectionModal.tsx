import { useState } from "react";
import {
  CheckCircle,
  Loader2,
  X,
  AlertCircle,
  Database,
  Server,
  User,
  Lock,
  HardDrive,
  Tag,
} from "lucide-react";
import { useConnectionStore } from "../../stores/connectionStore";
import type { ConnectionConfig } from "../../lib/tauri";
import { useT } from "../../i18n";

interface Props {
  onClose: () => void;
  existing?: ConnectionConfig;
}

export function ConnectionModal({ onClose, existing }: Props) {
  const t = useT();
  const { saveConnection, testConnection } = useConnectionStore();

  const [form, setForm] = useState({
    name: existing?.name || "",
    host: existing?.host || "localhost",
    port: existing?.port || 5432,
    user: existing?.user || "postgres",
    password: existing?.password || "",
    database: existing?.database || "postgres",
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildConfig = (): ConnectionConfig => ({
    id: existing?.id || crypto.randomUUID(),
    ...form,
  });

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      await testConnection(buildConfig());
      setTestResult("success");
    } catch (e) {
      setTestResult("error");
      setError(String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError(t("connection.nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveConnection(buildConfig());
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[480px] bg-bg-elevated rounded-xl border border-border shadow-2xl shadow-black/40 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center">
              <Database size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                {existing ? t("connection.edit") : t("connection.new")}
              </h3>
              <p className="text-[11px] text-text-muted">{t("connection.postgresql")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <FormField icon={<Tag size={13} />} label={t("connection.name")}>
            <input
              className="form-input"
              placeholder={t("connection.name.placeholder")}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </FormField>

          <div className="flex gap-3">
            <FormField icon={<Server size={13} />} label={t("connection.host")} className="flex-1">
              <input
                className="form-input"
                placeholder="localhost"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </FormField>
            <FormField label={t("connection.port")} className="w-24">
              <input
                className="form-input"
                placeholder="5432"
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 5432 })}
              />
            </FormField>
          </div>

          <div className="flex gap-3">
            <FormField icon={<User size={13} />} label={t("connection.user")} className="flex-1">
              <input
                className="form-input"
                placeholder="postgres"
                value={form.user}
                onChange={(e) => setForm({ ...form, user: e.target.value })}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </FormField>
            <FormField icon={<Lock size={13} />} label={t("connection.password")} className="flex-1">
              <input
                className="form-input"
                placeholder="********"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </FormField>
          </div>

          <FormField icon={<HardDrive size={13} />} label={t("connection.database")}>
            <input
              className="form-input"
              placeholder="postgres"
              value={form.database}
              onChange={(e) => setForm({ ...form, database: e.target.value })}
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </FormField>

          {/* Feedback */}
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-error-muted text-error text-xs animate-fade-in">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {testResult === "success" && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success-muted text-success text-xs animate-fade-in">
              <CheckCircle size={14} />
              <span className="font-medium">{t("connection.success")}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-5 border-t border-border">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-50 transition-colors"
          >
            {testing && <Loader2 size={12} className="animate-spin" />}
            {t("connection.test")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-[13px] font-medium bg-accent hover:bg-accent-hover text-white disabled:opacity-50 transition-all active:scale-[0.98] shadow-sm shadow-accent/20"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {existing ? t("connection.update") : t("connection.save")}
          </button>
        </div>
      </div>

    </div>
  );
}

function FormField({
  icon,
  label,
  children,
  className = "",
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2 pl-0.5">
        {icon && <span className="text-text-faint">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
