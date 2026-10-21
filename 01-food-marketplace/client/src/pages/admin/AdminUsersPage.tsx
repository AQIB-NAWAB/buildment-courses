import { useState } from "react";
import { useAdminUsers } from "../../api/queries";
import { AdminHeader } from "../../components/AdminHeader";
import { Pagination } from "../../components/Pagination";
import { ErrorState, Input, Spinner } from "../../components/ui";
import { formatDate } from "../../lib/utils";

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const usersQuery = useAdminUsers(page, search);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AdminHeader
        title="Users"
        description="Read-only identity overview. Password hashes, refresh hashes, and OTP data never leave the server."
      />

      <div className="mt-6 w-full max-w-sm">
        <label htmlFor="user-search" className="mb-1 block text-sm font-semibold">
          Search by email
        </label>
        <Input
          id="user-search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="vendor-a@…"
        />
      </div>

      {usersQuery.isLoading ? <Spinner label="Loading users" /> : null}
      {usersQuery.isError ? (
        <div className="mt-6">
          <ErrorState message="Users could not be loaded." onRetry={() => void usersQuery.refetch()} />
        </div>
      ) : null}

      {usersQuery.data ? (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-cream/70 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {usersQuery.data.items.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium">{user.displayName}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3">{user.isVerified ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-ink/60">{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={usersQuery.data.page}
            totalPages={usersQuery.data.totalPages}
            onPage={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}
