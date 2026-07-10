"use client";

/**
 * Admin user directory: list users, change roles, grant credits.
 *
 * All mutations go through the admin API (`/api/admin/users*`) via `authedFetch`
 * so the server re-verifies the caller is an admin — the UI gate (<RoleGate>)
 * is convenience only. After changing your OWN role isn't possible here (server
 * blocks self-demotion), so no local token refresh is needed.
 */
import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/modules/auth/AuthProvider";
import { authedFetch } from "@/lib/auth/authedFetch";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import type {
  AdminUser,
  ListUsersResponse,
  UpdateUserResponse,
} from "@/modules/admin/types";

export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/admin/users");
      const data = (await res.json()) as ListUsersResponse;
      if (!res.ok) throw new Error(data.error || "Không tải được danh sách.");
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchUser(
    uid: string,
    body: { role?: Role; grantCredits?: number },
  ) {
    setBusyUid(uid);
    setError(null);
    try {
      const res = await authedFetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as UpdateUserResponse;
      if (!res.ok || !data.user) {
        throw new Error(data.error || "Không cập nhật được.");
      }
      const updated = data.user;
      setUsers((prev) => prev.map((u) => (u.uid === uid ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setBusyUid(null);
    }
  }

  function onGrant(uid: string) {
    const raw = window.prompt("Nạp bao nhiêu credits?", "20");
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Số credits phải là số nguyên dương.");
      return;
    }
    patchUser(uid, { grantCredits: amount });
  }

  if (loading) {
    return (
      <div className="admin-loading">
        <Loader2 className="spin" size={22} /> Đang tải danh sách người dùng…
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-toolbar">
        <span className="admin-count">{users.length} người dùng</span>
        <button type="button" className="btn small" onClick={load}>
          <RefreshCw size={15} /> Tải lại
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Credits</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.uid === user?.uid;
              const busy = busyUid === u.uid;
              return (
                <tr key={u.uid} className={busy ? "row-busy" : undefined}>
                  <td>
                    <div className="admin-user-cell">
                      <span className="admin-user-name">
                        {u.displayName || u.email || u.uid}
                        {isSelf && <span className="admin-self"> (bạn)</span>}
                      </span>
                      {u.email && u.displayName && (
                        <span className="admin-user-email">{u.email}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      className="admin-select"
                      value={u.role}
                      disabled={busy}
                      onChange={(e) =>
                        patchUser(u.uid, { role: e.target.value as Role })
                      }
                    >
                      {ROLES.map((r) => (
                        <option
                          key={r}
                          value={r}
                          // Can't demote yourself out of admin.
                          disabled={isSelf && r !== "admin"}
                        >
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{u.credits === null ? "—" : u.credits}</td>
                  <td>
                    <button
                      type="button"
                      className="btn small"
                      disabled={busy}
                      onClick={() => onGrant(u.uid)}
                    >
                      Nạp credits
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
