"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch";

export default function SecurityPage() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodeCount, setBackupCodeCount] = useState<number>(0);
  const [copiedCodes, setCopiedCodes] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await apiFetch("/api/users");
        const data = await res.json();
        if (data.success && data.data.length > 0) {
          // Find current user — we check all users and look for matching session
          // For simplicity, fetch the first user that has totp info
          // In reality we'd have a /api/auth/me endpoint
          setTotpEnabled(data.data.some((u: { totpEnabled: string }) => u.totpEnabled === "true"));
        }
      } catch {
        // Ignore — we'll show disabled by default
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, []);

  async function handleSetup() {
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await apiFetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSecret(data.data.secret);
        setUri(data.data.uri);
        setSetupMode(true);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to initiate 2FA setup");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(action: "enable" | "disable") {
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await apiFetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, action }),
      });
      const data = await res.json();
      if (data.success) {
        setTotpEnabled(action === "enable");
        setSetupMode(false);
        setDisableMode(false);
        setCode("");
        setSecret("");
        setUri("");
        setCopiedCodes(false);
        if (action === "enable" && data.data?.backupCodes) {
          setBackupCodes(data.data.backupCodes);
          setBackupCodeCount(data.data.backupCodes.length);
          setSuccess("Two-factor authentication has been enabled. Save your backup codes below.");
        } else {
          setBackupCodes([]);
          setBackupCodeCount(0);
          setSuccess(
            action === "enable"
              ? "Two-factor authentication has been enabled."
              : "Two-factor authentication has been disabled.",
          );
        }
      } else {
        setError(data.error);
      }
    } catch {
      setError("Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your account security</p>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>}
      {success && (
        <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-600">{success}</div>
      )}

      <div className="mt-6 space-y-6">
        {/* 2FA Section */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Two-Factor Authentication (2FA)</h2>
              <p className="mt-1 text-sm text-gray-500">
                Add an extra layer of security to your account using a TOTP authenticator app.
              </p>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                totpEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
              }`}
            >
              {totpEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          {/* Setup mode */}
          {setupMode && (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-medium text-blue-900">Set Up Authenticator</h3>
              <p className="mt-2 text-sm text-blue-800">
                1. Install an authenticator app (Google Authenticator, Authy, or similar).
              </p>
              <p className="mt-1 text-sm text-blue-800">
                2. Add a new account using the secret key below:
              </p>
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className="text-xs font-medium text-gray-500 uppercase">
                  Secret Key (manual entry)
                </p>
                <p className="mt-1 font-mono text-sm font-bold tracking-wider break-all text-gray-900">
                  {secret}
                </p>
              </div>
              <div className="mt-3 rounded-lg bg-white p-3">
                <p className="text-xs font-medium text-gray-500 uppercase">OTPAuth URI</p>
                <p className="mt-1 font-mono text-xs break-all text-gray-700">{uri}</p>
              </div>
              <p className="mt-3 text-sm text-blue-800">
                3. Enter the 6-digit code from your authenticator app to verify:
              </p>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => handleVerify("enable")}
                  disabled={code.length !== 6 || submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Verifying..." : "Verify & Enable"}
                </button>
                <button
                  onClick={() => {
                    setSetupMode(false);
                    setCode("");
                    setError("");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Disable mode */}
          {disableMode && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <h3 className="font-medium text-red-900">Disable 2FA</h3>
              <p className="mt-2 text-sm text-red-800">
                Enter your current 2FA code to confirm disabling two-factor authentication.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                />
                <button
                  onClick={() => handleVerify("disable")}
                  disabled={code.length !== 6 || submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {submitting ? "Verifying..." : "Disable 2FA"}
                </button>
                <button
                  onClick={() => {
                    setDisableMode(false);
                    setCode("");
                    setError("");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!setupMode && !disableMode && (
            <div className="mt-4 flex items-center gap-3">
              {totpEnabled ? (
                <>
                  <button
                    onClick={() => {
                      setDisableMode(true);
                      setCode("");
                      setError("");
                      setSuccess("");
                    }}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Disable 2FA
                  </button>
                  {backupCodeCount > 0 && (
                    <span className="text-sm text-gray-500">
                      {backupCodeCount} backup code{backupCodeCount !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                </>
              ) : (
                <button
                  onClick={handleSetup}
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? "Setting up..." : "Enable 2FA"}
                </button>
              )}
            </div>
          )}

          {/* Backup codes display */}
          {backupCodes.length > 0 && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-medium text-amber-900">Backup Codes</h3>
              <p className="mt-2 text-sm text-amber-800">
                Save these codes in a safe place. Each code can only be used once. If you lose
                access to your authenticator app, you can use one of these codes to sign in.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {backupCodes.map((bc, i) => (
                  <div
                    key={i}
                    className="rounded-md bg-white px-3 py-2 text-center font-mono text-sm font-semibold tracking-wider text-gray-900"
                  >
                    {bc}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join("\n"));
                    setCopiedCodes(true);
                    setTimeout(() => setCopiedCodes(false), 2000);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {copiedCodes ? "Copied!" : "Copy All"}
                </button>
                <button
                  onClick={() => {
                    setBackupCodes([]);
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  I have saved my codes
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Password Section (placeholder) */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="mt-1 text-sm text-gray-500">
            Change your account password. You will need to enter your current password.
          </p>
          <button
            disabled
            className="mt-4 cursor-not-allowed rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-400"
          >
            Change Password (Coming Soon)
          </button>
        </section>

        {/* Active Sessions (placeholder) */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Active Sessions</h2>
          <p className="mt-1 text-sm text-gray-500">View and manage your active login sessions.</p>
          <div className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
            Session management will be available in a future update.
          </div>
        </section>
      </div>
    </div>
  );
}
