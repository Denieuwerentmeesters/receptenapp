/**
 * Het hartje vliegt in een boogje van de kaart naar de tab "Mijn recepten":
 * zo zie je dat het recept bij Nog bestellen terechtkomt. Puur visueel; zonder
 * tab (bijvoorbeeld op de website) of bij "verminder beweging" gebeurt er niets.
 */
export function vliegHartje(van: HTMLElement): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const doel = document.querySelector<HTMLElement>('[data-tab="/mijn-recepten"]')
  if (!doel || !van.animate) return

  const a = van.getBoundingClientRect()
  const b = doel.getBoundingClientRect()
  const maat = 28
  const x0 = a.left + a.width / 2 - maat / 2
  const y0 = a.top + a.height / 2 - maat / 2
  const x1 = b.left + b.width / 2 - maat / 2
  const y1 = b.top + b.height / 2 - maat / 2 - 6
  // Het boogje: eerst omhoog, dan naar de tab. Hoogte naar afstand, nooit buiten beeld.
  const boog = Math.min(120, Math.max(50, Math.abs(y1 - y0) * 0.25))

  const hart = document.createElement('div')
  hart.setAttribute('aria-hidden', 'true')
  hart.style.cssText = `position:fixed;left:0;top:0;width:${maat}px;height:${maat}px;z-index:9999;pointer-events:none;color:var(--c-red);`
  hart.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>'
  document.body.appendChild(hart)

  const stappen = 16
  const frames: Keyframe[] = []
  for (let i = 0; i <= stappen; i++) {
    const p = i / stappen
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    const x = x0 + (x1 - x0) * ease
    const y = y0 + (y1 - y0) * p - Math.sin(Math.PI * p) * boog * 2
    const schaal = 1 + 0.4 * Math.sin(Math.PI * p) - 0.5 * p
    frames.push({
      transform: `translate(${x}px, ${y}px) scale(${schaal})`,
      opacity: p > 0.9 ? 1 - (p - 0.9) * 10 : 1,
      offset: p,
    })
  }
  const anim = hart.animate(frames, { duration: 750, easing: 'linear', fill: 'forwards' })
  anim.onfinish = () => {
    hart.remove()
    doel.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(0.95)' }, { transform: 'scale(1)' }],
      { duration: 380, easing: 'ease-out' },
    )
  }
  anim.oncancel = () => hart.remove()
}
