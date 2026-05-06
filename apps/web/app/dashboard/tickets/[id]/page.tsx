import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { submitEvidenceAction } from '../actions';
import { FlagLevelBadge } from '@/components/flag-level-badge';

type TicketDetail = {
  id: string;
  status: string;
  reportId: string;
  createdAt: string;
  updatedAt: string;
  evidenceLinks: unknown;
  adminNote: string | null;
  userMessage: string | null;
  targetDiscordId: string;
  reportStatus: string;
  reportReason: string;
  allegedFlagLevel?: string | null;
  attachments: Array<{
    id: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
};

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let t: TicketDetail;
  try {
    t = await dashboardApi<TicketDetail>(`/me/tickets/${id}`);
  } catch (e) {
    return (
      <section className="ds-card">
        <h1 className="ds-h1">Ticket</h1>
        <div className="ds-alert ds-alert-error" style={{ marginTop: '1rem' }}>
          {e instanceof Error ? e.message : 'Not found'}
        </div>
        <p style={{ marginTop: '1rem' }}>
          <Link href="/dashboard/tickets" className="ds-btn ds-btn-ghost">
            Back to tickets
          </Link>
        </p>
      </section>
    );
  }

  const links = Array.isArray(t.evidenceLinks)
    ? (t.evidenceLinks as string[]).filter((x) => typeof x === 'string')
    : [];
  const showEvidence = t.status === 'NEEDS_EVIDENCE';

  return (
    <section className="ds-card">
      <p>
        <Link href="/dashboard/tickets" className="ds-btn ds-btn-ghost">
          ← Tickets
        </Link>
      </p>
      <h1 className="ds-h1" style={{ marginTop: '0.75rem' }}>
        Ticket
        <span className="text-muted-foreground ds-muted ml-2 text-[0.55em] font-semibold tracking-wide uppercase">
          {t.status.replace(/_/g, ' ')}
        </span>
      </h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Report <strong>{t.reportStatus}</strong> · Target{' '}
        <span className="ds-mono">{t.targetDiscordId}</span>
      </p>

      <div style={{ marginTop: '1.25rem' }}>
        <h2 className="ds-h2" style={{ marginTop: 0 }}>
          Report
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <FlagLevelBadge level={t.allegedFlagLevel} />
        </div>
        <p style={{ marginTop: '0.65rem', maxWidth: '42rem' }}>{t.reportReason}</p>
      </div>

      {t.userMessage ? (
        <div style={{ marginTop: '1.25rem' }}>
          <h2 className="ds-h2" style={{ marginTop: 0 }}>
            Message from staff
          </h2>
          <p>{t.userMessage}</p>
        </div>
      ) : null}

      {t.adminNote ? (
        <div className="ds-alert ds-alert-warn" style={{ marginTop: '1.25rem' }}>
          <span className="ds-label" style={{ marginBottom: '0.25rem' }}>
            Staff note
          </span>
          {t.adminNote}
        </div>
      ) : null}

      {links.length > 0 ? (
        <div style={{ marginTop: '1.25rem' }}>
          <h2 className="ds-h2" style={{ marginTop: 0 }}>
            Evidence links
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {links.map((u) => (
              <li key={u} style={{ marginBottom: '0.35rem' }}>
                <a href={u} target="_blank" rel="noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {t.attachments.length > 0 ? (
        <div style={{ marginTop: '1.25rem' }}>
          <h2 className="ds-h2" style={{ marginTop: 0 }}>
            Images
          </h2>
          <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
            {t.attachments.map((a) => (
              <li key={a.id} style={{ marginBottom: '0.35rem' }}>
                <a
                  href={`/dashboard/tickets/${t.id}/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.mimeType} ({a.sizeBytes} bytes)
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showEvidence ? (
        <form
          action={submitEvidenceAction.bind(null, t.id)}
          encType="multipart/form-data"
          style={{ marginTop: '1.75rem', maxWidth: 520 }}
        >
          <h2 className="ds-h2">Submit evidence</h2>
          <p className="ds-muted">Images (JPEG, PNG, WebP, GIF) and optional links.</p>
          <div className="ds-field" style={{ marginTop: '0.75rem' }}>
            <label className="ds-label" htmlFor="linksText">
              Links (one per line)
            </label>
            <textarea
              id="linksText"
              className="ds-input"
              name="linksText"
              rows={4}
              style={{ display: 'block', maxWidth: '100%' }}
            />
          </div>
          <div className="ds-field">
            <label className="ds-label" htmlFor="evidence-images">
              Images
            </label>
            <input
              id="evidence-images"
              type="file"
              name="images"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="ds-input"
              style={{ padding: '0.45rem' }}
            />
          </div>
          <button type="submit" className="ds-btn">
            Submit evidence
          </button>
        </form>
      ) : null}
    </section>
  );
}
