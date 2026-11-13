import React from 'react';
import approvalsData from '../data/owner-approvals.json';

// Owner sign-off queue (owners portal): the team's pending suggestions and
// decisions that need Brandon's approval, in one place. Two action types:
//  - "console": the real signing happens with his wallet in the deploy
//    console, so the button just takes him there.
//  - "github": the button opens a prefilled GitHub issue under his account;
//    submitting it is the sign-off record the team actions.
// Items live in src/data/owner-approvals.json — the team edits that file to
// add or clear items; this component renders whatever is in it.

interface ApprovalItem {
  id: string;
  title: string;
  team: string;
  recommendation: string;
  cost: string;
  actionType: 'github' | 'console';
  consolePath: string | null;
}

const items = approvalsData as ApprovalItem[];

const REPO_NEW_ISSUE =
  'https://github.com/bran8912-ctrl/Matrix-Hub.org/issues/new';

function signOffUrl(item: ApprovalItem): string {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const issueTitle = `OWNER SIGN-OFF: ${item.title}`;
  const body = [
    `## ${item.title}`,
    '',
    `**Team recommendation (${item.team}):**`,
    item.recommendation,
    '',
    `**Cost / commitment:** ${item.cost}`,
    '',
    `Approved by Brandon (owner) from the owners portal on ${today}.`,
    '',
    'Team: action this and close the loop in the admin chat.',
  ].join('\n');
  return `${REPO_NEW_ISSUE}?title=${encodeURIComponent(
    issueTitle,
  )}&body=${encodeURIComponent(body)}`;
}

const styles: { [key: string]: React.CSSProperties } = {
  wrap: {
    maxWidth: 880,
    margin: '0 auto',
    color: '#fff',
  },
  heading: {
    fontSize: '1.6rem',
    margin: '0 0 0.5rem',
    color: '#00ff99',
  },
  intro: {
    color: '#ccc',
    lineHeight: 1.55,
    margin: '0 0 1.25rem',
  },
  card: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '10px',
    padding: '1.1rem 1.25rem',
    marginBottom: '1rem',
  },
  cardTitle: {
    fontSize: '1.15rem',
    margin: '0 0 0.35rem',
    color: '#fff',
  },
  team: {
    fontSize: '0.85rem',
    color: '#00ff99',
    margin: '0 0 0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  recommendation: {
    color: '#ccc',
    lineHeight: 1.55,
    margin: '0 0 0.6rem',
  },
  cost: {
    color: '#eee',
    lineHeight: 1.5,
    margin: '0 0 0.9rem',
  },
  costLabel: {
    color: '#00ff99',
    fontWeight: 700,
  },
  buttonBase: {
    display: 'inline-block',
    padding: '0.55rem 1rem',
    borderRadius: '6px',
    fontWeight: 700,
    fontSize: '0.95rem',
    textDecoration: 'none',
    cursor: 'pointer',
  },
  approveButton: {
    background: '#00ff99',
    color: '#0b0b0b',
    border: '1px solid #00ff99',
  },
  consoleButton: {
    background: 'transparent',
    color: '#00ff99',
    border: '1px solid #00ff99',
  },
  empty: {
    background: '#111',
    border: '1px solid #333',
    borderRadius: '10px',
    padding: '1.1rem 1.25rem',
    color: '#ccc',
  },
};

const OwnerApprovals: React.FC = () => {
  return (
    <div style={styles.wrap}>
      <h2 style={styles.heading}>✍️ Owner Sign-Off Queue</h2>
      <p style={styles.intro}>
        These are the team's open items that need your sign-off. Approving
        opens a prefilled record under your GitHub account — submit it and
        the team actions it. Items marked for the console are signed with
        your wallet there.
      </p>

      {items.length === 0 ? (
        <div style={styles.empty}>
          Nothing waiting on you. The team will post new items here.
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} style={styles.card}>
            <h3 style={styles.cardTitle}>{item.title}</h3>
            <p style={styles.team}>Recommended by: {item.team}</p>
            <p style={styles.recommendation}>{item.recommendation}</p>
            <p style={styles.cost}>
              <span style={styles.costLabel}>Cost / commitment: </span>
              {item.cost}
            </p>
            {item.actionType === 'console' && item.consolePath ? (
              <a
                href={item.consolePath}
                style={{ ...styles.buttonBase, ...styles.consoleButton }}
              >
                Open in the deploy console →
              </a>
            ) : (
              <a
                href={signOffUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...styles.buttonBase, ...styles.approveButton }}
              >
                Approve &amp; sign off
              </a>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default OwnerApprovals;
