export function Brand({ onClick, product = true }: { onClick?: () => void; product?: boolean }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Breath Journey by Light School, home">
      <img src="/brand/light-school-mark-transparent.svg" alt="" width={30} height={30} />
      <span>LightSchool</span>
      {product ? <small>Breath Journey</small> : null}
    </button>
  )
}
