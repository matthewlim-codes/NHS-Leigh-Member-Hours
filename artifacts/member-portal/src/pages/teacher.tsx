import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, LogOut, Users } from "lucide-react";
import {
  completeTutoringRequest,
  createTutoringRequest,
  listTutoringRequests,
  type TutoringRequest,
} from "@/tutoros/lib/api";
import { useAuthUser, logoutLocalTeacher } from "@/hooks/use-auth-user";

const SUBJECTS = [
  "Algebra I",
  "Algebra II / IM2",
  "Geometry",
  "Precalculus",
  "Biology",
  "Chemistry",
  "Chemistry Honors",
  "English",
  "Digital SAT Math",
];

const GRADES = ["9", "10", "11", "12"];

const emptyForm = {
  studentName: "",
  grade: "10",
  assignedBy: "",
  subject: "Algebra II / IM2",
  topic: "",
  notes: "",
};

export default function TeacherPortalPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuthUser();
  const logout = useLogout();

  const [requests, setRequests] = useState<TutoringRequest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "claimed" | "done">("all");
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [whatChangedToday, setWhatChangedToday] = useState("");
  const [completing, setCompleting] = useState(false);

  const refresh = async () => {
    try {
      const data = await listTutoringRequests(
        filter === "all" ? undefined : { status: filter },
      );
      setRequests(data.requests);
    } catch {
      setRequests([]);
    }
  };

  useEffect(() => {
    if (user && user.role !== "teacher") {
      setLocation("/tutoros");
    }
  }, [user, setLocation]);

  useEffect(() => {
    void refresh();
  }, [filter]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createTutoringRequest({
        studentName: form.studentName,
        grade: form.grade,
        assignedBy: form.assignedBy,
        subject: form.subject,
        topic: form.topic,
        notes: form.notes || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create request");
    } finally {
      setLoading(false);
    }
  };

  const onCompleteRequest = async (id: string) => {
    if (!whatChangedToday.trim()) return;
    setCompleting(true);
    setError(null);
    try {
      await completeTutoringRequest(id, { whatChangedToday: whatChangedToday.trim() });
      setCompletingId(null);
      setWhatChangedToday("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete request");
    } finally {
      setCompleting(false);
    }
  };

  const onLogout = () => {
    logoutLocalTeacher();
    logout.mutate(undefined, {
      onSettled: () => {
        queryClient.setQueryData(getGetMeQueryKey(), undefined);
        queryClient.clear();
        setLocation("/login");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] bg-[#f6f8fc]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            "radial-gradient(ellipse 80% 80% at 50% 0%, rgba(16,185,129,0.16), transparent)",
        }}
      />

      <div className="relative mx-auto max-w-lg px-5 pb-16 pt-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Teacher portal
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
              Assign tutoring
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create requests NHS tutors can claim in TutorOS
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            data-testid="button-teacher-logout"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </header>

        <div className="mt-6 flex items-center gap-2">
          {(["all", "open", "claimed", "done"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={
                filter === key
                  ? "rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200"
              }
            >
              {key === "all" ? "All" : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-emerald-700"
            data-testid="button-new-request"
          >
            <Plus className="h-5 w-5" />
            Assign a student
          </button>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-5 space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            data-testid="form-create-request"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New tutoring request</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm font-semibold text-slate-500"
              >
                Cancel
              </button>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-800">Student name</span>
              <input
                value={form.studentName}
                onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-emerald-600 focus:bg-white"
                placeholder="Jordan Lee"
                required
                data-testid="input-student-name"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Grade</span>
                <select
                  value={form.grade}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-emerald-600"
                  data-testid="select-grade"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-slate-800">Subject</span>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-emerald-600"
                  data-testid="select-subject"
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-800">Assigned by</span>
              <input
                value={form.assignedBy}
                onChange={(e) => setForm((f) => ({ ...f, assignedBy: e.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-emerald-600 focus:bg-white"
                placeholder="Ms. Patel · IM2 Period 2"
                required
                data-testid="input-assigned-by"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-800">Topic</span>
              <input
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base outline-none focus:border-emerald-600 focus:bg-white"
                placeholder="factoring"
                required
                data-testid="input-topic"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-800">Notes (optional)</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="min-h-[80px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none focus:border-emerald-600 focus:bg-white"
                placeholder="Needs help before the unit quiz; prefers worked examples"
                data-testid="input-notes"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center rounded-full bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              data-testid="button-submit-request"
            >
              {loading ? "Saving..." : "Post request for tutors"}
            </button>
          </form>
        )}

        <section className="mt-8">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-bold text-slate-900">Requests</h2>
          </div>

          {requests.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No requests yet. Assign a student to get tutors started.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                  data-testid={`request-card-${req.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-slate-900">{req.studentName}</p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        Grade {req.grade} · {req.subject} · {req.topic}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Assigned by {req.assignedBy}</p>
                      {req.notes && (
                        <p className="mt-2 text-sm text-slate-600">{req.notes}</p>
                      )}
                      {req.claimedByUsername && (
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          Claimed by {req.claimedByUsername}
                        </p>
                      )}
                      {req.whatChangedToday && (
                        <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-[#1865F2]">
                          What changed: {req.whatChangedToday}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={req.status} />
                      {req.status === "claimed" && completingId !== req.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setCompletingId(req.id);
                            setWhatChangedToday("");
                          }}
                          className="rounded-full border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          Mark complete
                        </button>
                      )}
                    </div>
                  </div>
                  {completingId === req.id && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-bold text-emerald-800">
                          What changed today?
                        </span>
                        <p className="text-xs text-slate-600">
                          Not what happened — what shifted in this student&apos;s learning?
                        </p>
                        <input
                          value={whatChangedToday}
                          onChange={(e) => setWhatChangedToday(e.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-emerald-600"
                          placeholder="Ready for quadratics now"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={completing || !whatChangedToday.trim()}
                          onClick={() => void onCompleteRequest(req.id)}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {completing ? "Saving…" : "Complete request"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompletingId(null)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TutoringRequest["status"] }) {
  const styles =
    status === "open"
      ? "bg-blue-50 text-[#1865F2]"
      : status === "claimed"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${styles}`}>
      {status}
    </span>
  );
}
