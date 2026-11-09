
export default function StatCard({ title, value, note, tone = 'green' }: { title: string; value: string; note: string; tone?: string }) {
  return <article className="stat-card">
    <div className="stat-top"><span>{title}</span><span className={`stat-dot ${tone}`}/></div>
    <div className="stat-value">{value}<small> SR</small></div>
    <div className="stat-note">{note}</div>
  </article>
}
