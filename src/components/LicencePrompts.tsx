import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Clock3, LogOut, ShieldAlert, Sparkles } from "lucide-react";
import { useTaw } from "../state/TawStore";
import { TAW_LICENSE_FEATURES, TRIAL_DAYS } from "../lib/licence";
import { shortDate } from "../lib/utils";
import { Modal } from "./ui";

const SNOOZE_KEY = "taw_trial_activation_prompt_v1";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

function readSnoozeUntil(): number {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSnoozeUntil(value: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(value));
  } catch {
    /* storage unavailable */
  }
}

/** Owner-only licence nudges, mounted in the authenticated owner shell. */
export function LicencePrompts() {
  const { state, mode, role, licence, acknowledgeActivation } = useTaw();
  const navigate = useNavigate();
  const [snoozeUntil, setSnoozeUntil] = useState(readSnoozeUntil);

  if (mode !== "cloud" || role !== "owner") return null;
  const settings = state.company;
  const snoozed = snoozeUntil > Date.now();
  const showTrialPrompt =
    licence.mode === "Trial" && licence.trialElapsed >= 14 && !snoozed;
  const activatedAt = settings.licenseActivatedAt;
  const showThankYou =
    licence.mode === "Active" &&
    Boolean(activatedAt) &&
    settings.licenceActivationAcknowledgedAt !== activatedAt;

  function snooze() {
    const until = Date.now() + SNOOZE_MS;
    writeSnoozeUntil(until);
    setSnoozeUntil(until);
  }

  function openLicence() {
    snooze();
    navigate("/settings", { state: { tab: "licence" } });
  }

  return (
    <>
      {showTrialPrompt && (
      <Modal
        onClose={snooze}
        title="Your TAW trial is still active"
        subtitle={`Day ${Math.min(licence.trialElapsed + 1, TRIAL_DAYS)} of ${TRIAL_DAYS} · every feature is unlocked`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={snooze}>
              Remind me tomorrow
            </button>
            <button className="btn btn-brand" onClick={openLicence}>
              Activate now <ArrowRight size={14} />
            </button>
          </>
        }
      >
        <div className="stack">
          <div className="alert-strip alert-info">
            <Clock3 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            <span>
              <strong>{licence.daysLeft} day{licence.daysLeft === 1 ? "" : "s"} left in your trial.</strong>{" "}
              You still have full access to every TAW feature. Activate now so dispatch,
              tracking and billing continue without interruption.
            </span>
          </div>
          <p className="sub">
            RAVBsoft activates the installation after payment. Open Settings → Licence to
            sync your installation ID or enter the activation key you received.
          </p>
        </div>
      </Modal>
      )}

      {showThankYou && (
      <Modal
        onClose={acknowledgeActivation}
        title="Thank you — your TAW copy is activated"
        subtitle="RAVBsoft has activated this installation"
        footer={
          <button className="btn btn-brand" onClick={acknowledgeActivation}>
            <BadgeCheck size={14} /> Continue
          </button>
        }
      >
        <div className="stack">
          <div className="alert-strip alert-ok">
            <Sparkles size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            <span>
              <strong>
                {licence.lifetime
                  ? "Lifetime licence — owned outright"
                  : `Licence active${licence.expiresAt ? ` until ${shortDate(licence.expiresAt)}` : ""}`}
              </strong>
              <br />
              The trial reminder has been removed. Your data, drivers and settings are unchanged.
            </span>
          </div>
          <div>
            <div className="label">Features on this licence</div>
            <div className="tag-list" style={{ marginTop: 6 }}>
              {TAW_LICENSE_FEATURES.map((feature) => (
                <span key={feature} className="badge badge-ok">
                  <BadgeCheck size={10} /> {feature}
                </span>
              ))}
            </div>
          </div>
          <p className="sub">
            If a feature is missing, contact RAVBsoft with installation ID{" "}
            <strong>{settings.installationId || licence.installationId || "—"}</strong>.
          </p>
        </div>
      </Modal>
      )}
    </>
  );
}

/** Expired or suspended cloud licences lock the app without deleting data. */
export function LicenceGate({ children }: { children: ReactNode }) {
  const { mode, licence, role, leave, notify } = useTaw();
  const navigate = useNavigate();

  if (mode === "demo" || !["Expired", "Suspended"].includes(licence.mode)) {
    return <>{children}</>;
  }

  async function signOut() {
    await leave();
    notify({ tone: "info", text: "Signed out." });
    navigate("/login", { replace: true });
  }

  const detail =
    licence.reason === "clock-rollback"
      ? "The device clock moved backwards. Connect to the licence server to verify this installation."
      : licence.reason === "offline-expired"
        ? "This copy has been offline longer than the 7-day grace period. Reconnect to verify the licence."
        : "This installation needs attention from RAVBsoft. All vehicles, trips, invoices and settings are safe — nothing has been deleted.";

  return (
    <div className="licence-lock">
      <div className="card licence-lock-card">
        <span className="licence-lock-icon"><ShieldAlert size={26} /></span>
        <h1>
          {licence.reason === "clock-rollback"
            ? "Clock change detected"
            : licence.reason === "offline-expired"
              ? "Reconnect to verify TAW"
              : `TAW licence ${licence.mode.toLowerCase()}`}
        </h1>
        <p>{detail}</p>
        <div className="kv">
          <dt>Installation</dt><dd>{licence.installationId || "—"}</dd>
          <dt>Plan</dt><dd>{licence.plan}</dd>
          <dt>Status</dt><dd>{licence.mode}</dd>
          {licence.expiresAt && <><dt>Expiry</dt><dd>{shortDate(licence.expiresAt)}</dd></>}
        </div>
        <div className="row wrap" style={{ marginTop: 16 }}>
          {role === "owner" ? (
            <button className="btn btn-brand" onClick={() => navigate("/settings", { state: { tab: "licence" } })}>
              Open licence settings <ArrowRight size={14} />
            </button>
          ) : (
            <p className="sub">Ask the owner to renew this installation.</p>
          )}
          <button className="btn btn-secondary" onClick={() => void signOut()}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
