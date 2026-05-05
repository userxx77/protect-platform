import Link from 'next/link';
import { dashboardApi } from '@/lib/api-server';
import { submitEvidenceAction } from '../actions';

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
          <Link href="/dashboard/tickets">Back to tickets</Link>
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
        <Link href="/dashboard/tickets">← Tickets</Link>
      </p>
      <h1 className="ds-h1" style={{ marginTop: '0.75rem' }}>
        Ticket · {t.status}
      </h1>
      <p className="ds-muted" style={{ marginTop: '0.35rem' }}>
        Report {t.reportStatus} · Target{' '}
        <span className="ds-mono">{t.targetDiscordId}</span>
      </p>
      {t.adminNote ? (
        <div className="ds-alert" style={{ marginTop: '1rem' }}>
          <strong>Staff note:</strong> {t.adminNote}
        </div>
      ) : null}
      <div style={{ marginTop: '1rem' }}>
        <strong>Reason</strong>
        <p>{t.reportReason}</p>
      </div>
      {links.length > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <strong>Links</strong>
          <ul>
            {links.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {t.attachments.length > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          <strong>Images</strong>
          <ul>
            {t.attachments.map((a) => (
              <li key={a.id}>
                <a href={`/dashboard/tickets/${t.id}/attachments/${a.id}`} target="_blank" rel="noreferrer">
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
          style={{ marginTop: '1.5rem', maxWidth: 480 }}
        >
          <h2 className="ds-h2">Submit evidence</h2>
          <p className="ds-muted">Images (JPEG, PNG, WebP, GIF) and optional links.</p>
          <label style={{ display: 'block', marginTop: '0.75rem' }}>
            Links (one per line)
            <textarea
              className="ds-input"
              name="linksText"
              rows={4}
              style={{ display: 'block', width: '100%', marginTop: '0.35rem' }}
            />
          </label>
          <label style={{ display: 'block', marginTop: '0.75rem' }}>
            Images
            <input
              type="file"
              name="images"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              style={{ display: 'block', marginTop: '0.35rem' }}
            />
          </label>
          <button type="submit" className="ds-btn" style={{ marginTop: '1rem' }}>
            Submit evidence
          </button>
        </form>
      ) : null}
    </section>
  );
}
