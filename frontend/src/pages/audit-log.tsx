import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { PageHeader } from "@/components/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, RefreshCw, Search, MapPin } from "lucide-react";

type Event = "" | "login_success" | "login_failed" | "logout";

interface AuditRow {
  id: number;
  userId: number | null;
  userName: string | null;
  userRole: string | null;
  userSiteId: number | null;
  userSiteName: string | null;
  userDepartment: string | null;
  email: string;
  event: "login_success" | "login_failed" | "logout";
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

interface AuditResponse {
  rows: AuditRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface SiteOpt { id: number; name: string }
interface DeptOpt { id: number; name: string }
interface UserOpt { id: number; name: string; email: string; department?: string | null; siteId?: number | null }

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function eventBadge(ev: AuditRow["event"]) {
  if (ev === "login_success") return <Badge className="bg-green-600 hover:bg-green-600">Login success</Badge>;
  if (ev === "login_failed") return <Badge variant="destructive">Login failed</Badge>;
  return <Badge variant="secondary">Logout</Badge>;
}

function locationOf(r: AuditRow) {
  const parts = [r.city, r.region, r.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function shortUA(ua: string | null) {
  if (!ua) return "—";
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera|Postman|curl)[\/\s]([0-9.]+)/i);
  const osMatch = ua.match(/\(([^)]+)\)/);
  const browser = browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : "Unknown";
  const os = osMatch ? osMatch[1].split(";")[0].trim() : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [event, setEvent] = useState<Event>("");
  const [emailFilter, setEmailFilter] = useState("");
  const [emailFilterDraft, setEmailFilterDraft] = useState("");
  const [siteId, setSiteId] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Lookup data for the dropdowns
  const sitesQ = useQuery<SiteOpt[]>({
    queryKey: ["/api/sites"],
    queryFn: async () => {
      const r = await apiFetch("/api/sites");
      if (!r.ok) return [];
      return r.json();
    },
  });
  const deptsQ = useQuery<DeptOpt[]>({
    queryKey: ["/api/departments"],
    queryFn: async () => {
      const r = await apiFetch("/api/departments");
      if (!r.ok) return [];
      return r.json();
    },
  });
  const usersQ = useQuery<UserOpt[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await apiFetch("/api/users");
      if (!r.ok) return [];
      return r.json();
    },
  });

  const sortedSites = useMemo(
    () => (sitesQ.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [sitesQ.data]
  );
  const sortedDepts = useMemo(
    () => (deptsQ.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [deptsQ.data]
  );
  const sortedUsers = useMemo(
    () => (usersQ.data ?? []).slice().sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)),
    [usersQ.data]
  );

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    if (event) p.set("event", event);
    if (emailFilter) p.set("email", emailFilter);
    if (siteId) p.set("siteId", siteId);
    if (department) p.set("department", department);
    if (userId) p.set("userId", userId);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    return p.toString();
  }, [page, pageSize, event, emailFilter, siteId, department, userId, from, to]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ["audit-logs", queryString],
    queryFn: async () => {
      const resp = await apiFetch(`/api/security/audit-logs?${queryString}`);
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `Request failed (${resp.status})`);
      }
      return resp.json();
    },
  });

  function applyEmailFilter() {
    setEmailFilter(emailFilterDraft.trim());
    setPage(1);
  }

  function resetFilters() {
    setEvent("");
    setEmailFilter("");
    setEmailFilterDraft("");
    setSiteId("");
    setDepartment("");
    setUserId("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const rows = data?.rows ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Login Activity"
        description="Audit log of all login attempts and logouts, with IP-based location."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-filter">Event</Label>
              <Select value={event || "all"} onValueChange={(v) => { setEvent((v === "all" ? "" : v) as Event); setPage(1); }}>
                <SelectTrigger id="event-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="login_success">Login success</SelectItem>
                  <SelectItem value="login_failed">Login failed</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-filter">User</Label>
              <Select value={userId || "all"} onValueChange={(v) => { setUserId(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger id="user-filter">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {sortedUsers.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="site-filter">Site</Label>
              <Select value={siteId || "all"} onValueChange={(v) => { setSiteId(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sortedSites.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dept-filter">Department</Label>
              <Select value={department || "all"} onValueChange={(v) => { setDepartment(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger id="dept-filter">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {sortedDepts.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-filter">Email contains</Label>
              <div className="flex gap-2">
                <Input
                  id="email-filter"
                  value={emailFilterDraft}
                  onChange={(e) => setEmailFilterDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyEmailFilter(); }}
                  placeholder="user@example.com"
                />
                <Button type="button" size="icon" variant="outline" onClick={applyEmailFilter} aria-label="Search">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {(siteId || department || userId) && (
                <span className="italic">
                  Note: site/department/user filters exclude rows with no matched account
                  (e.g. failed logins for unknown emails).
                </span>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {isLoading ? "Loading…" : `${total.toLocaleString()} event${total === 1 ? "" : "s"}`}
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Page {data?.page ?? 1} of {totalPages}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-4 text-sm text-red-600">
              Failed to load audit log: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Time</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Event</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">User</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Site</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Department</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Reason</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">IP</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Location</th>
                    <th className="text-left px-4 py-2 whitespace-nowrap">Device</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        No events match these filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{eventBadge(r.event)}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.userName ?? <span className="text-muted-foreground italic">unknown</span>}</div>
                          <div className="text-xs text-muted-foreground">{r.email}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {r.userSiteName ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {r.userDepartment ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2 max-w-[260px]">
                          {r.failureReason ? (
                            <span className="text-xs text-red-600">{r.failureReason}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap font-mono text-xs">{r.ipAddress ?? "—"}</td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {r.country || r.city ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {locationOf(r)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 max-w-[260px] truncate" title={r.userAgent ?? ""}>
                          {shortUA(r.userAgent)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || isFetching}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1}
          {rows.length > 0 ? `–${(page - 1) * pageSize + rows.length}` : ""} of {total}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages || isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
