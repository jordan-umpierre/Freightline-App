export default function SimulatorCard() {
  return (
    <section className="workspace-panel stack">
      <div>
        <p className="eyebrow">Demo driver</p>
        <h2>Simulator command</h2>
      </div>
      <code className="command-block">cd backend && npm run simulate:pings</code>
      <code className="command-block">cd backend && npm run simulate:pings -- --off-route</code>
    </section>
  )
}
