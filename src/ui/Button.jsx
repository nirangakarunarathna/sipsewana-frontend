export default function Button({ variant = "primary", ...props }) {
  const cls = variant === "ghost" ? "btn btnGhost" : "btn";
  return <button className={cls} {...props} />;
}