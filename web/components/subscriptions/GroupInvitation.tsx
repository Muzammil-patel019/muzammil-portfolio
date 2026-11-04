"use client";
import { useEffect, useState } from "react";
import { GroupMembers } from "./GroupMembers";
export function GroupInvitation({ code }: { code: string }) {
  const [group, setGroup] = useState<{
      name: string;
      members: { firstName: string }[];
    } | null>(null),
    [status, setStatus] = useState("Opening invitation…"),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/subscriptions/group", {
      method: "PATCH",
      cache: "no-store",
      headers: { Authorization: `Bearer ${code}` },
      referrerPolicy: "no-referrer",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) {
          setGroup(data);
          setStatus("");
        }
      })
      .catch((error) => {
        if (active) setStatus(error.message || "Invitation unavailable.");
      });
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <main className="plan-app plan-viewer">
      <header className="plan-header">
        <span className="plan-brand">
          Shared<span>plan.</span>
        </span>
        <span className="plan-label">GROUP INVITATION</span>
      </header>
      <div className="plan-title">
        <div>
          <p className="plan-label">YOU’RE INVITED</p>
          <h1>{group?.name || "Shared subscription"}</h1>
          <p>Request a place in the group. The manager approves new members.</p>
        </div>
      </div>
      <p role="status" className="plan-status">
        {status}
      </p>
      {group && (
        <>
          <GroupMembers members={group.members} />
          <section className="plan-box">
            {sent ? (
              <>
                <h2>Request sent</h2>
                <p>
                  The manager will review your request and share your personal
                  link if approved.
                </p>
              </>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  setBusy(true);
                  setStatus("");
                  try {
                    const response = await fetch("/api/subscriptions/group", {
                      method: "PUT",
                      cache: "no-store",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${code}`,
                      },
                      referrerPolicy: "no-referrer",
                      body: JSON.stringify({
                        name: values.get("name"),
                        email: values.get("email"),
                      }),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    setSent(true);
                    setStatus("Your request is awaiting manager approval.");
                  } catch (error) {
                    setStatus((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <h2>Request to join</h2>
                <label>
                  Your name
                  <input
                    name="name"
                    required
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <label>
                  Email for the manager
                  <input
                    name="email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                  />
                </label>
                <p className="plan-fine-print">
                  Only the manager can see your email. Your first name will be
                  visible to the group after approval.
                </p>
                <button className="plan-button" disabled={busy}>
                  {busy ? "Sending…" : "Request to join"}
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
