import { useState } from "react";
import { PageHeader, Card, Button, Input, Label } from "@/components/shared";
import { useAuth } from "@/hooks/use-auth";
import { User, Lock, CheckCircle } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setErrorMsg("New password must be at least 6 characters.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to update password.");
        setStatus("error");
      } else {
        setStatus("success");
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="My Profile" description="View your account details and manage your password." />

      {/* Profile Info */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Role</p>
            <p className="font-semibold capitalize">{user.role}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-4">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Department</p>
            <p className="font-semibold">{user.department || '—'}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-4 col-span-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Job Title</p>
            <p className="font-semibold">{user.jobTitle || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Change Password */}
      <Card className="p-6">
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" /> Change Password
        </h3>
        <p className="text-sm text-muted-foreground mb-6">Update your login password. You'll need your current password to confirm.</p>

        {status === "success" && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Password updated successfully.
          </div>
        )}
        {(status === "error" || errorMsg) && (
          <div className="text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label>Current Password</Label>
            <Input
              type="password"
              value={pwForm.currentPassword}
              onChange={e => { setPwForm({ ...pwForm, currentPassword: e.target.value }); setStatus("idle"); setErrorMsg(""); }}
              required
            />
          </div>
          <div>
            <Label>New Password</Label>
            <Input
              type="password"
              placeholder="Minimum 6 characters"
              value={pwForm.newPassword}
              onChange={e => { setPwForm({ ...pwForm, newPassword: e.target.value }); setStatus("idle"); setErrorMsg(""); }}
              required
            />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={pwForm.confirmPassword}
              onChange={e => { setPwForm({ ...pwForm, confirmPassword: e.target.value }); setStatus("idle"); setErrorMsg(""); }}
              required
            />
          </div>
          <Button type="submit" isLoading={status === "loading"} className="w-full mt-2">
            Update Password
          </Button>
        </form>
      </Card>
    </div>
  );
}
