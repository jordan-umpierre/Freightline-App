export default function LiveBadge({ status }) {
  return <span className={`live-badge ${status}`}>{status.replace('_', ' ')}</span>
}
