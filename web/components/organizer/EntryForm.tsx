"use client";
import {
  useEffect,
  useRef,
  Children,
  isValidElement,
  cloneElement,
  type ReactElement,
} from "react";
import { todayIST } from "@/lib/subscriptions";
import { parseCardMoney } from "@/lib/cards";
import {
  expenseSchema,
  budgetSchema,
  jobSchema,
  goalSchema,
  noteSchema,
  manualReminderSchema,
  addContribution,
  jobStatuses,
  expenseCategories,
  type OrganizerDocument,
} from "@/lib/organizer";
export type FormKind =
  "expense" | "budget" | "job" | "goal" | "contribution" | "note" | "reminder";
export type ResumeChoice = { id: string; name: string; kind: string };
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="cards-field">
      <span>{label}</span>
      {Children.map(children, (child) =>
        isValidElement(child) &&
        ["input", "textarea", "select"].includes(String(child.type))
          ? cloneElement(child as ReactElement<{ "aria-label"?: string }>, {
              "aria-label": label,
            })
          : child,
      )}
    </label>
  );
}
function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((i) => i.id === item.id)
    ? list.map((i) => (i.id === item.id ? item : i))
    : [...list, item];
}
export function EntryForm({
  kind,
  id,
  goalId,
  doc,
  versions,
  busy,
  onSave,
  onClose,
  onError,
}: {
  kind: FormKind;
  id: string;
  goalId: string;
  doc: OrganizerDocument;
  versions: ResumeChoice[];
  busy: boolean;
  onSave: (next: OrganizerDocument) => Promise<void>;
  onClose: () => void;
  onError: (error: unknown) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      panel.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      panel.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [kind, id]);
  const expense = doc.expenses.find((e) => e.id === id),
    budget = doc.budgets.find((b) => b.id === id),
    job = doc.jobs.find((j) => j.id === id),
    goal = doc.goals.find(
      (g) => g.id === (kind === "contribution" ? goalId : id),
    ),
    note = doc.notes.find((n) => n.id === id),
    reminder = doc.reminders.find((r) => r.id === id);
  const titles = {
    expense: "expense",
    budget: "budget",
    job: "application",
    goal: "savings goal",
    contribution: "savings movement",
    note: "note or bookmark",
    reminder: "personal reminder",
  };
  const inputInterview = job?.interviewAt
    ? new Date(new Date(job.interviewAt).getTime() + 330 * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
  return (
    <section ref={panel} className="cards-panel organizer-form">
      <div className="cards-section-head">
        <h2>
          {id ? "Edit" : "Add"} {titles[kind]}
          {kind === "contribution" && goal ? " · " + goal.title : ""}
        </h2>
        <button type="button" disabled={busy} onClick={onClose}>
          Close form
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const f = new FormData(e.currentTarget),
              str = (k: string) => String(f.get(k) || ""),
              next = structuredClone(doc),
              recordId = id || crypto.randomUUID();
            if (kind === "expense") {
              next.expenses = upsert(
                next.expenses,
                expenseSchema.parse({
                  id: recordId,
                  date: str("date"),
                  description: str("description"),
                  amountMinor: parseCardMoney(str("amount")),
                  category: str("category"),
                  method: str("method"),
                  note: str("note"),
                }),
              );
            }
            if (kind === "budget") {
              next.budgets = upsert(
                next.budgets,
                budgetSchema.parse({
                  id: recordId,
                  month: str("month"),
                  category: str("category"),
                  amountMinor: parseCardMoney(str("amount")),
                }),
              );
            }
            if (kind === "job") {
              const status = str("status") as (typeof jobStatuses)[number],
                history = [...(job?.history || [])];
              if (!job || job.status !== status)
                history.push({
                  id: crypto.randomUUID(),
                  status,
                  at: new Date().toISOString(),
                });
              const versionId = str("resumeVersionId");
              next.jobs = upsert(
                next.jobs,
                jobSchema.parse({
                  id: recordId,
                  company: str("company"),
                  role: str("role"),
                  url: str("url"),
                  status,
                  appliedDate:
                    str("appliedDate") ||
                    (status === "Applied" ? todayIST() : ""),
                  followUpDate: str("followUpDate"),
                  interviewAt: str("interview")
                    ? new Date(str("interview") + ":00+05:30").toISOString()
                    : "",
                  contact: str("contact"),
                  notes: str("notes"),
                  resumeVersionId: versionId,
                  resumeVersionName:
                    versions.find((v) => v.id === versionId)?.name ||
                    (job?.resumeVersionId === versionId
                      ? job?.resumeVersionName
                      : ""),
                  archived: job?.archived || false,
                  history,
                }),
              );
            }
            if (kind === "goal") {
              next.goals = upsert(
                next.goals,
                goalSchema.parse({
                  id: recordId,
                  title: str("title"),
                  targetMinor: parseCardMoney(str("amount")),
                  deadline: str("deadline"),
                  notes: str("notes"),
                  archived: goal?.archived || false,
                  contributions: goal?.contributions || [],
                }),
              );
            }
            if (kind === "contribution") {
              await onSave(
                addContribution(
                  doc,
                  goalId,
                  str("kind") as "deposit" | "withdrawal",
                  parseCardMoney(str("amount")),
                  str("date"),
                  str("note"),
                ),
              );
              return;
            }
            if (kind === "note") {
              next.notes = upsert(
                next.notes,
                noteSchema.parse({
                  id: recordId,
                  title: str("title"),
                  kind: str("noteKind"),
                  url: str("url"),
                  body: str("body"),
                  tags: [
                    ...new Set(
                      str("tags")
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    ),
                  ],
                  pinned: f.has("pinned"),
                  archived: note?.archived || false,
                  updatedAt: new Date().toISOString(),
                }),
              );
            }
            if (kind === "reminder") {
              next.reminders = upsert(
                next.reminders,
                manualReminderSchema.parse({
                  id: recordId,
                  title: str("title"),
                  dueDate: str("dueDate"),
                  notes: str("notes"),
                  done: reminder?.done || false,
                }),
              );
            }
            await onSave(next);
          } catch (error) {
            onError(error);
          }
        }}
      >
        <div className="cards-fields">
          {kind === "expense" && (
            <>
              <Field label="Expense description">
                <input
                  name="description"
                  required
                  maxLength={100}
                  defaultValue={expense?.description}
                  placeholder="Lunch, groceries, train ticket…"
                />
              </Field>
              <Field label="Amount spent (INR)">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={
                    expense ? (expense.amountMinor / 100).toFixed(2) : ""
                  }
                />
              </Field>
              <Field label="Expense date">
                <input
                  name="date"
                  type="date"
                  required
                  max={todayIST()}
                  defaultValue={expense?.date || todayIST()}
                />
              </Field>
              <Field label="Expense category">
                <input
                  name="category"
                  list="expense-categories"
                  required
                  maxLength={40}
                  defaultValue={expense?.category || "Other"}
                />
                <datalist id="expense-categories">
                  {expenseCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Payment method">
                <select name="method" defaultValue={expense?.method || "UPI"}>
                  {["UPI", "Card", "Cash", "Bank", "Other"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Expense note (optional)">
                <input
                  name="note"
                  maxLength={300}
                  defaultValue={expense?.note}
                />
              </Field>
            </>
          )}
          {kind === "budget" && (
            <>
              <Field label="Budget month">
                <input
                  name="month"
                  type="month"
                  required
                  defaultValue={budget?.month || todayIST().slice(0, 7)}
                />
              </Field>
              <Field label="Budget category">
                <select name="category" defaultValue={budget?.category || ""}>
                  <option value="">All categories · overall budget</option>
                  {[
                    ...new Set([
                      ...expenseCategories,
                      ...doc.expenses.map((e) => e.category),
                      ...doc.budgets.map((b) => b.category).filter(Boolean),
                    ]),
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Budget limit (INR)">
                <input
                  name="amount"
                  inputMode="decimal"
                  required
                  defaultValue={
                    budget ? (budget.amountMinor / 100).toFixed(2) : ""
                  }
                />
              </Field>
            </>
          )}
          {kind === "job" && (
            <>
              <Field label="Company">
                <input
                  name="company"
                  required
                  maxLength={80}
                  defaultValue={job?.company}
                />
              </Field>
              <Field label="Role">
                <input
                  name="role"
                  required
                  maxLength={100}
                  defaultValue={job?.role}
                />
              </Field>
              <Field label="Application status">
                <select name="status" defaultValue={job?.status || "Saved"}>
                  {jobStatuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Job link (optional)">
                <input
                  name="url"
                  type="url"
                  defaultValue={job?.url}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Applied date (optional)">
                <input
                  name="appliedDate"
                  type="date"
                  max={todayIST()}
                  defaultValue={job?.appliedDate}
                />
              </Field>
              <Field label="Follow-up date (optional)">
                <input
                  name="followUpDate"
                  type="date"
                  defaultValue={job?.followUpDate}
                />
              </Field>
              <Field label="Interview date and time (IST)">
                <input
                  name="interview"
                  type="datetime-local"
                  defaultValue={inputInterview}
                />
              </Field>
              <Field label="Resume version used">
                <select
                  name="resumeVersionId"
                  defaultValue={job?.resumeVersionId || ""}
                >
                  <option value="">Not selected</option>
                  {job?.resumeVersionId &&
                    !versions.some((v) => v.id === job.resumeVersionId) && (
                      <option value={job.resumeVersionId}>
                        {job.resumeVersionName} · no longer available
                      </option>
                    )}
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.kind}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Contact / recruiter (optional)">
                <input
                  name="contact"
                  maxLength={100}
                  defaultValue={job?.contact}
                />
              </Field>
            </>
          )}
          {kind === "goal" && (
            <>
              <Field label="Goal name">
                <input
                  name="title"
                  required
                  maxLength={100}
                  defaultValue={goal?.title}
                  placeholder="Emergency fund"
                />
              </Field>
              <Field label="Savings target (INR)">
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  defaultValue={goal ? (goal.targetMinor / 100).toFixed(2) : ""}
                />
              </Field>
              <Field label="Target date (optional)">
                <input
                  name="deadline"
                  type="date"
                  defaultValue={goal?.deadline}
                />
              </Field>
            </>
          )}
          {kind === "contribution" && (
            <>
              <Field label="Savings movement">
                <select name="kind">
                  <option value="deposit">Add savings</option>
                  <option value="withdrawal">Withdraw savings</option>
                </select>
              </Field>
              <Field label="Movement amount (INR)">
                <input name="amount" inputMode="decimal" required />
              </Field>
              <Field label="Movement date">
                <input
                  name="date"
                  type="date"
                  max={todayIST()}
                  required
                  defaultValue={todayIST()}
                />
              </Field>
              <Field label="Movement note (optional)">
                <input name="note" maxLength={200} />
              </Field>
            </>
          )}
          {kind === "note" && (
            <>
              <Field label="Note title">
                <input
                  name="title"
                  required
                  maxLength={100}
                  defaultValue={note?.title}
                />
              </Field>
              <Field label="Entry type">
                <select name="noteKind" defaultValue={note?.kind || "note"}>
                  <option value="note">Note</option>
                  <option value="bookmark">Bookmark</option>
                </select>
              </Field>
              <Field label="Bookmark link (optional for notes)">
                <input
                  name="url"
                  type="url"
                  defaultValue={note?.url}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Tags (comma separated)">
                <input
                  name="tags"
                  defaultValue={note?.tags.join(", ")}
                  placeholder="Python, work, ideas"
                />
              </Field>
              <label className="organizer-check">
                <input
                  name="pinned"
                  type="checkbox"
                  defaultChecked={note?.pinned}
                />{" "}
                Pin this entry
              </label>
            </>
          )}
          {kind === "reminder" && (
            <>
              <Field label="Reminder title">
                <input
                  name="title"
                  required
                  maxLength={100}
                  defaultValue={reminder?.title}
                />
              </Field>
              <Field label="Reminder due date">
                <input
                  name="dueDate"
                  type="date"
                  required
                  defaultValue={reminder?.dueDate || todayIST()}
                />
              </Field>
            </>
          )}
        </div>
        {["job", "goal", "reminder"].includes(kind) && (
          <Field
            label={
              kind === "job"
                ? "Application notes"
                : kind === "goal"
                  ? "Goal notes"
                  : "Reminder notes"
            }
          >
            <textarea
              name="notes"
              maxLength={kind === "job" ? 4000 : kind === "goal" ? 1000 : 500}
              defaultValue={
                kind === "job"
                  ? job?.notes
                  : kind === "goal"
                    ? goal?.notes
                    : reminder?.notes
              }
            />
          </Field>
        )}
        {kind === "note" && (
          <Field label="Note content">
            <textarea
              placeholder="Write a note. For checklists, start each task with - [ ] "
              name="body"
              maxLength={8000}
              defaultValue={note?.body}
            />
          </Field>
        )}
        <p className="cards-note">
          Private manual records. Keep passwords, PINs and full account/card
          numbers out of notes.
        </p>
        <button className="cards-button" disabled={busy}>
          Save {titles[kind]}
        </button>
      </form>
    </section>
  );
}
