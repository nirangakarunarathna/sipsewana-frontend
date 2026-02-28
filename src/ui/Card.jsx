export default function Card({ title, children }) {
  return (
    <div className="card">
      {title ? <div className="cardTitle">{title}</div> : null}
      {children}
    </div>
  );
}