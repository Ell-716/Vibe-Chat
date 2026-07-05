import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Sliders,
  Palette,
  Shield,
  AlertTriangle,
  ArrowLeft,
  Lock,
  Check,
  Loader2,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import type { Agent, UserPreferences } from "@shared/schema";

// ── Constants ─────────────────────────────────────────────────────────────────

interface AIModel {
  id: string;
  name: string;
  provider: string;
}

const CYAN = "#00B4D8";
const CARD_BG = "hsl(var(--card))";
const BORDER = "hsl(var(--border))";
const BORDER_BRIGHT = "rgba(0,180,216,0.3)";
const SURFACE_HOVER = "hsl(var(--muted))";

type SettingsTab = "account" | "preferences" | "appearance" | "privacy" | "danger";

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: Array<{ id: SettingsTab; label: string; Icon: React.ElementType; danger?: boolean }> = [
  { id: "account",     label: "Account",       Icon: User },
  { id: "preferences", label: "Preferences",   Icon: Sliders },
  { id: "appearance",  label: "Appearance",    Icon: Palette },
  { id: "privacy",     label: "Data & Privacy", Icon: Shield },
  { id: "danger",      label: "Danger Zone",   Icon: AlertTriangle, danger: true },
];

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Returns up to two uppercase initials from a display name.
 * @param name - Full display name.
 * @returns Initials string (e.g. "EB").
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Formats an ISO date string or Date into "Month YYYY".
 * @param date - Date string or Date object.
 * @returns Formatted date string.
 */
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Shared glass card ──────────────────────────────────────────────────────────

/** A glassmorphism card wrapper matching the app's design system. */
function GlassCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl p-6 ${className}`}
      style={{
        background: CARD_BG,
        border: `1px solid ${BORDER}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Section heading ────────────────────────────────────────────────────────────

/** Orbitron section heading, consistent with login + sidebar logo usage. */
function SectionHeading({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <h2
      className="text-xl font-bold mb-6"
      style={{
        fontFamily: "'Orbitron', sans-serif",
        color: danger ? "#F43F5E" : "hsl(var(--foreground))",
      }}
    >
      {children}
    </h2>
  );
}

/** A horizontal divider styled as a glass edge. */
function Divider() {
  return <div className="my-5" style={{ borderTop: `1px solid ${BORDER}` }} />;
}

// ── ACCOUNT TAB ───────────────────────────────────────────────────────────────

/**
 * Account settings tab — name editing, avatar display, read-only email/date fields.
 */
function AccountTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nameValue, setNameValue] = useState(user?.name ?? "");
  const [nameDirty, setNameDirty] = useState(false);

  // Keep input in sync if the user object refreshes after a save
  useEffect(() => {
    if (user?.name) setNameValue(user.name);
  }, [user?.name]);

  const updateProfile = useMutation({
    mutationFn: (name: string) => apiRequest("PATCH", "/api/user/profile", { name }),
    onSuccess: async (res) => {
      const updated = await res.json();
      // Refresh both auth caches
      queryClient.setQueryData(["/auth/me"], updated);
      queryClient.invalidateQueries({ queryKey: ["/api/user/me"] });
      setNameDirty(false);
      toast({ title: "Profile updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update profile", description: err.message, variant: "destructive" });
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNameValue(e.target.value);
    setNameDirty(e.target.value.trim() !== (user?.name ?? "").trim());
  };

  const handleSave = () => {
    if (nameDirty) updateProfile.mutate(nameValue);
  };

  return (
    <div>
      <SectionHeading>Account</SectionHeading>

      {/* Avatar */}
      <GlassCard className="mb-4">
        <div className="flex flex-col items-center gap-3">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${CYAN}` }}
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ background: `linear-gradient(135deg, #6366F1, ${CYAN})` }}
            >
              {user ? getInitials(user.name) : "?"}
            </div>
          )}
          <p className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
            Avatar synced from Google
          </p>
        </div>
      </GlassCard>

      {/* Profile fields */}
      <GlassCard>
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Display Name
          </label>
          <div className="flex gap-2">
            <Input
              value={nameValue}
              onChange={handleNameChange}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              maxLength={50}
              className="flex-1 focus-visible:ring-cyan-400"
              style={{ background: "hsl(var(--input))", borderColor: nameDirty ? CYAN : BORDER, color: "hsl(var(--foreground))" }}
            />
            {nameDirty && (
              <Button
                onClick={handleSave}
                disabled={updateProfile.isPending}
                size="sm"
                className="shrink-0 transition-all duration-150"
                style={{ background: "#00B4D8", color: "#050A14", border: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#0891B2"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,180,216,0.4)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#00B4D8"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {updateProfile.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span className="ml-1">Save</span>
              </Button>
            )}
          </div>
        </div>

        <Divider />

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>
            Email
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={user?.email ?? ""}
              readOnly
              className="flex-1 cursor-not-allowed opacity-60"
              style={{ background: "hsl(var(--input))", borderColor: BORDER, color: "hsl(var(--foreground))" }}
            />
            <Lock className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Managed by Google
          </p>
        </div>

        <Divider />

        {/* Member since */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
            Member since
          </span>
          <span className="text-sm" style={{ color: "hsl(var(--foreground))" }}>
            {user?.createdAt ? formatDate(user.createdAt) : "—"}
          </span>
        </div>
      </GlassCard>
    </div>
  );
}

// ── PREFERENCES TAB ───────────────────────────────────────────────────────────

/**
 * Preferences tab — default model and agent dropdowns with auto-save.
 */
function PreferencesTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const prefs = (user?.preferences as UserPreferences | null) ?? {} as UserPreferences;

  const [savedKey, setSavedKey] = useState<string | null>(null);

  const { data: models = [] } = useQuery<AIModel[]>({
    queryKey: ["/api/models"],
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const updatePrefs = useMutation({
    mutationFn: (data: Partial<UserPreferences>) =>
      apiRequest("PATCH", "/api/user/preferences", data),
    onSuccess: async (res, vars) => {
      const updated = await res.json();
      // Merge updated prefs back into cached user
      const current = queryClient.getQueryData<typeof user>(["/auth/me"]);
      if (current) queryClient.setQueryData(["/auth/me"], { ...current, preferences: updated });
      setSavedKey(Object.keys(vars)[0]);
      setTimeout(() => setSavedKey(null), 2000);
    },
    onError: (err: Error) => {
      toast({ title: "Could not save preferences", description: err.message, variant: "destructive" });
    },
  });

  const DEFAULT_MODEL = "openai/gpt-oss-120b";
  // Validate stored model against the loaded list — stale IDs (e.g. from a
  // model migration) won't match any SelectItem and would render an empty
  // dropdown, so fall back to the default when the value isn't recognised.
  const currentModel =
    prefs.defaultModel && models.some((m) => m.id === prefs.defaultModel)
      ? prefs.defaultModel
      : DEFAULT_MODEL;
  const currentAgent = prefs.defaultAgent ?? "general";

  return (
    <div>
      <SectionHeading>Preferences</SectionHeading>

      <GlassCard className="space-y-6">
        {/* Default Model */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
              Default Model
            </label>
            {savedKey === "defaultModel" && (
              <span className="flex items-center gap-1 text-xs" style={{ color: CYAN }}>
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
          <Select
            value={currentModel}
            onValueChange={(val) => updatePrefs.mutate({ defaultModel: val })}
          >
            <SelectTrigger
              className="w-full"
              style={{ background: "hsl(var(--input))", borderColor: BORDER, color: "hsl(var(--foreground))" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span>{m.name}</span>
                  <span className="ml-2 text-xs opacity-50">({m.provider})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Used when starting a new conversation
          </p>
        </div>

        <Divider />

        {/* Default Agent */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>
              Default Agent
            </label>
            {savedKey === "defaultAgent" && (
              <span className="flex items-center gap-1 text-xs" style={{ color: CYAN }}>
                <Check className="h-3 w-3" /> Saved
              </span>
            )}
          </div>
          <Select
            value={currentAgent}
            onValueChange={(val) => updatePrefs.mutate({ defaultAgent: val })}
          >
            <SelectTrigger
              className="w-full"
              style={{ background: "hsl(var(--input))", borderColor: BORDER, color: "hsl(var(--foreground))" }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            Active agent when opening a new chat
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

// ── APPEARANCE TAB ────────────────────────────────────────────────────────────

/** Mini preview mockup rendered inside each appearance card. */
function MiniPreview({ mode }: { mode: "light" | "dark" | "system" }) {
  const isDark = mode === "dark" || mode === "system";
  const bg = isDark ? "#0A0E1A" : "#F8FAFC";
  const sidebar = isDark ? "#111827" : "#FFFFFF";
  const bubble = isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.15)";
  const text = isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.3)";

  return (
    <div
      className="w-full rounded-lg overflow-hidden"
      style={{ background: bg, height: 72, display: "flex" }}
      aria-hidden
    >
      {/* Mock sidebar strip */}
      <div style={{ width: 20, background: sidebar, borderRight: `1px solid rgba(255,255,255,0.06)` }} />
      {/* Mock content area */}
      <div className="flex-1 p-2 flex flex-col justify-end gap-1">
        {mode === "system" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Monitor className="h-6 w-6 opacity-30" style={{ color: isDark ? "#fff" : "#000" }} />
          </div>
        )}
        <div className="flex justify-end">
          <div className="h-2 rounded-full" style={{ width: "55%", background: bubble }} />
        </div>
        <div className="flex justify-start">
          <div className="h-2 rounded-full" style={{ width: "70%", background: text }} />
        </div>
      </div>
    </div>
  );
}

type AppearanceMode = "light" | "dark" | "system";

const APPEARANCE_OPTIONS: Array<{ id: AppearanceMode; label: string; Icon: React.ElementType }> = [
  { id: "light",  label: "Light",  Icon: Sun },
  { id: "dark",   label: "Dark",   Icon: Moon },
  { id: "system", label: "System", Icon: Monitor },
];

/**
 * Appearance tab — three card selectors (Light / Dark / System) with live preview.
 * Selection is immediately applied to the DOM and saved to the server.
 */
function AppearanceTab() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const prefs = (user?.preferences as UserPreferences | null) ?? {} as UserPreferences;
  // Use stored server preference as canonical; fall back to context theme
  const activeMode: AppearanceMode = (prefs.appearance as AppearanceMode) ?? theme;

  const updatePrefs = useMutation({
    mutationFn: (appearance: AppearanceMode) =>
      apiRequest("PATCH", "/api/user/preferences", { appearance }),
    onSuccess: async (res) => {
      const updated = await res.json();
      const current = queryClient.getQueryData<typeof user>(["/auth/me"]);
      if (current) queryClient.setQueryData(["/auth/me"], { ...current, preferences: updated });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save appearance", description: err.message, variant: "destructive" });
    },
  });

  const handleSelect = (mode: AppearanceMode) => {
    setTheme(mode);
    updatePrefs.mutate(mode);
  };

  return (
    <div>
      <SectionHeading>Appearance</SectionHeading>

      <GlassCard>
        <p className="text-sm mb-5" style={{ color: "hsl(var(--muted-foreground))" }}>
          Choose how Vibe Chat looks to you.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {APPEARANCE_OPTIONS.map(({ id, label, Icon }) => {
            const isActive = activeMode === id;
            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className="rounded-xl p-3 flex flex-col gap-2 transition-all duration-200 cursor-pointer focus-visible:outline-none"
                style={{
                  background: isActive ? "rgba(0,180,216,0.08)" : CARD_BG,
                  border: `2px solid ${isActive ? CYAN : BORDER}`,
                  boxShadow: isActive ? `0 0 16px rgba(0,180,216,0.2)` : "none",
                }}
                aria-pressed={isActive}
              >
                <div className="relative">
                  <MiniPreview mode={id} />
                </div>
                <div className="flex items-center justify-center gap-1.5">
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: isActive ? CYAN : "hsl(var(--muted-foreground))" }}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: isActive ? CYAN : "hsl(var(--muted-foreground))" }}
                  >
                    {label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ── DATA & PRIVACY TAB ────────────────────────────────────────────────────────

/**
 * Data & Privacy tab — placeholder with "Coming Soon" badge and disabled toggles.
 */
function DataPrivacyTab() {
  return (
    <div>
      <SectionHeading>Data & Privacy</SectionHeading>

      <GlassCard className="mb-4">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(0,180,216,0.12)" }}
          >
            <Shield className="h-4 w-4" style={{ color: CYAN }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
                Privacy Controls
              </span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: "rgba(0,180,216,0.15)", color: CYAN, border: "1px solid rgba(0,180,216,0.3)" }}
              >
                Coming Soon
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              We're working on giving you more control over your data.
              Check back soon.
            </p>
          </div>
        </div>

        <Divider />

        {/* Disabled toggle rows */}
        {[
          { label: "Help improve Vibe Chat", desc: "Share anonymous usage data" },
          { label: "Conversation history",   desc: "Retain past conversations" },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-center justify-between py-3 opacity-40 cursor-not-allowed">
            <div className="flex items-center gap-3">
              <Lock className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{label}</p>
                <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{desc}</p>
              </div>
            </div>
            {/* Fake toggle */}
            <div
              className="w-9 h-5 rounded-full relative"
              style={{ background: BORDER }}
            >
              <div
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full"
                style={{ background: "hsl(var(--muted-foreground))" }}
              />
            </div>
          </div>
        ))}
      </GlassCard>
    </div>
  );
}

// ── DANGER ZONE TAB ───────────────────────────────────────────────────────────

/**
 * Danger Zone tab — delete account with "DELETE" confirmation modal.
 */
function DangerZoneTab() {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const deleteAccount = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/user/account", { confirm: true }),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/";
    },
    onError: (err: Error) => {
      toast({ title: "Deletion failed", description: err.message, variant: "destructive" });
      setShowModal(false);
    },
  });

  const canConfirm = confirmText === "DELETE" && !deleteAccount.isPending;

  return (
    <div>
      <SectionHeading danger>Danger Zone</SectionHeading>

      <GlassCard style={{ border: "1px solid rgba(244,63,94,0.25)" }}>
        <div className="flex items-start gap-3 mb-5">
          <div
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(244,63,94,0.12)" }}
          >
            <AlertTriangle className="h-4 w-4" style={{ color: "#F43F5E" }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "hsl(var(--foreground))" }}>
              Delete Account
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              Permanently deletes your account, all conversations, messages,
              and uploaded documents. This action{" "}
              <strong style={{ color: "#F43F5E" }}>cannot be undone</strong>.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowModal(true)}
          className="cursor-pointer transition-colors duration-150"
          style={{
            borderColor: "rgba(244,63,94,0.5)",
            color: "#F43F5E",
            background: "rgba(244,63,94,0.05)",
          }}
        >
          Delete Account
        </Button>
      </GlassCard>

      {/* Confirmation modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div
            className="w-full max-w-[480px] rounded-xl p-6"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid rgba(244,63,94,0.3)",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              animation: "modalEnter 250ms cubic-bezier(0.34,1.56,0.64,1) forwards",
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(244,63,94,0.15)" }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: "#F43F5E" }} />
              </div>
              <h3
                id="delete-modal-title"
                className="text-lg font-bold"
                style={{ fontFamily: "'Orbitron', sans-serif", color: "hsl(var(--foreground))" }}
              >
                Confirm Deletion
              </h3>
            </div>

            <p className="text-sm mb-5 leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
              This will permanently delete your account and all associated data.
              To confirm, type{" "}
              <strong style={{ color: "#F43F5E", fontFamily: "monospace" }}>DELETE</strong>{" "}
              below.
            </p>

            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="mb-4 font-mono"
              style={{
                background: "hsl(var(--input))",
                borderColor: confirmText === "DELETE" ? "#F43F5E" : BORDER,
                color: "hsl(var(--foreground))",
              }}
              autoFocus
            />

            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => { setShowModal(false); setConfirmText(""); }}
                disabled={deleteAccount.isPending}
                className="cursor-pointer"
                style={{ color: "hsl(var(--muted-foreground))" }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => deleteAccount.mutate()}
                disabled={!canConfirm}
                className="cursor-pointer"
                style={{
                  background: canConfirm ? "#F43F5E" : "rgba(244,63,94,0.2)",
                  color: canConfirm ? "#fff" : "rgba(244,63,94,0.5)",
                  border: "none",
                  transition: "all 150ms ease-out",
                }}
              >
                {deleteAccount.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Delete My Account
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalEnter {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── MAIN SETTINGS PAGE ────────────────────────────────────────────────────────

/**
 * Full-page settings view at /settings.
 * Two-column layout: 200px nav sidebar + scrollable content area.
 * Collapses to horizontal tab strip on mobile.
 */
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");

  const TAB_CONTENT: Record<SettingsTab, React.ReactElement> = {
    account:     <AccountTab />,
    preferences: <PreferencesTab />,
    appearance:  <AppearanceTab />,
    privacy:     <DataPrivacyTab />,
    danger:      <DangerZoneTab />,
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "hsl(var(--background))", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ── Desktop sidebar nav ─────────────────────────────────────────── */}
      <nav
        className="hidden md:flex flex-col shrink-0 py-6 px-3"
        style={{
          width: 200,
          background: "hsl(var(--sidebar))",
          borderRight: "1px solid rgba(0,180,216,0.08)",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <Link href="/">
          <button
            className="flex items-center gap-2 mb-8 px-3 py-2 rounded-lg w-full transition-colors duration-150 cursor-pointer"
            style={{ color: "hsl(var(--muted-foreground))" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = CYAN)}
            onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Chat</span>
          </button>
        </Link>

        <p
          className="px-3 mb-3 text-xs font-semibold uppercase tracking-widest"
          style={{ color: "hsl(var(--muted-foreground))", fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: "0.15em", fontWeight: 600 }}
        >
          Settings
        </p>

        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, Icon, danger }) => {
            const isActive = activeTab === id;
            return (
              <li key={id}>
                <button
                  onClick={() => setActiveTab(id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 cursor-pointer"
                  style={{
                    color: isActive ? (danger ? "#F43F5E" : CYAN) : danger ? "rgba(244,63,94,0.7)" : "hsl(var(--muted-foreground))",
                    background: isActive
                      ? danger
                        ? "rgba(244,63,94,0.08)"
                        : "rgba(0,180,216,0.08)"
                      : "transparent",
                    borderLeft: isActive
                      ? `2px solid ${danger ? "#F43F5E" : CYAN}`
                      : "2px solid transparent",
                    fontWeight: isActive ? 500 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = SURFACE_HOVER;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Mobile tab strip ────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 overflow-x-auto" style={{ background: "hsl(var(--sidebar))", borderBottom: "1px solid rgba(0,180,216,0.08)" }}>
        <div className="flex min-w-max px-2 py-2 gap-1">
          {NAV_ITEMS.map(({ id, label, Icon, danger }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors duration-150 cursor-pointer"
                style={{
                  color: isActive ? (danger ? "#F43F5E" : CYAN) : danger ? "rgba(244,63,94,0.6)" : "hsl(var(--muted-foreground))",
                  background: isActive
                    ? danger ? "rgba(244,63,94,0.1)" : "rgba(0,180,216,0.1)"
                    : "transparent",
                  border: `1px solid ${isActive ? (danger ? "rgba(244,63,94,0.4)" : "rgba(6,182,212,0.4)") : "transparent"}`,
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[680px] mx-auto px-4 py-8 md:py-10 mt-12 md:mt-0">
          {/* Back link — mobile only (desktop has sidebar) */}
          <Link href="/">
            <button
              className="md:hidden flex items-center gap-2 mb-6 text-sm cursor-pointer transition-colors duration-150"
              style={{ color: "hsl(var(--muted-foreground))" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CYAN)}
              onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chat
            </button>
          </Link>

          {TAB_CONTENT[activeTab]}
        </div>
      </main>
    </div>
  );
}
