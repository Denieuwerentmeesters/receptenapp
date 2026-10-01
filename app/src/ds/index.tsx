import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'

export { Icon } from './Icon'
export type { IconName } from './Icon'
export { Woordmerk } from './Logo'

/* ---------------------------------------------------------------- Button */

type Tone = 'red' | 'redBright' | 'yellow' | 'gold' | 'orange' | 'green' | 'purple' | 'pink' | 'ink' | 'paper' | 'cream'

const TONES: Record<Tone, { bg: string; fg: string }> = {
  red: { bg: 'var(--c-red)', fg: 'var(--c-paper)' },
  redBright: { bg: 'var(--c-red-bright)', fg: 'var(--c-paper)' },
  yellow: { bg: 'var(--c-yellow)', fg: 'var(--c-ink)' },
  gold: { bg: 'var(--c-gold)', fg: 'var(--c-green)' },
  orange: { bg: 'var(--c-orange)', fg: 'var(--c-paper)' },
  green: { bg: 'var(--c-green)', fg: 'var(--c-yellow)' },
  purple: { bg: 'var(--c-purple)', fg: 'var(--c-paper)' },
  pink: { bg: 'var(--c-pink)', fg: 'var(--c-paper)' },
  ink: { bg: 'var(--c-ink)', fg: 'var(--c-yellow)' },
  paper: { bg: 'var(--c-paper)', fg: 'var(--c-ink)' },
  cream: { bg: 'var(--c-cream)', fg: 'var(--c-red)' },
}

const SIZES = {
  sm: { padding: '10px 18px', fontSize: 'var(--text-label)' },
  md: { padding: '14px 24px', fontSize: 'var(--text-body)' },
  lg: { padding: '18px 28px', fontSize: 'var(--text-body)' },
}

export function Button({
  variant = 'primary', tone = 'red', size = 'md', icon, disabled, children, style, ...props
}: {
  variant?: 'primary' | 'secondary' | 'ghost'
  tone?: Tone
  size?: keyof typeof SIZES
  icon?: string
  children?: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = TONES[tone] ?? TONES.red
  const variants: Record<string, CSSProperties> = {
    primary: { background: t.bg, color: t.fg, border: 'none' },
    secondary: { background: 'transparent', color: t.bg, border: `1.5px solid ${t.bg}` },
    ghost: { background: 'transparent', color: t.bg, border: 'none' },
  }
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        fontFamily: 'var(--font-body)', fontWeight: 'var(--fw-bold)' as unknown as number,
        borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'transform var(--motion-fast) var(--ease), opacity var(--motion-fast) var(--ease)',
        ...SIZES[size], ...variants[variant], ...style,
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

/* ------------------------------------------------------------ IconButton */

export function IconButton({
  icon, variant = 'ghost', tone = 'red', size = 40, label, style, ...props
}: {
  icon: string
  variant?: 'solid' | 'ghost' | 'outline'
  tone?: Tone
  size?: number
  label: string
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const t = TONES[tone] ?? TONES.red
  const variants: Record<string, CSSProperties> = {
    solid: { background: t.bg, color: t.fg },
    ghost: { background: 'var(--c-red-100)', color: 'var(--c-ink)' },
    outline: { background: 'transparent', color: t.bg, border: `1.5px solid ${t.bg}` },
  }
  return (
    <button
      {...props}
      aria-label={label}
      style={{
        width: size, height: size, borderRadius: 'var(--radius-full)', border: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'transform var(--motion-fast) var(--ease)', ...variants[variant], ...style,
      }}
      onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)' }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      <Icon name={icon} size={Math.round(size * 0.45)} />
    </button>
  )
}

/* ------------------------------------------------------------------ Chip */

export function Chip({ children, selected, tone, onClick }: {
  children: ReactNode
  selected?: boolean
  tone?: string
  onClick?: () => void
}) {
  const bg = tone ? `var(--cat-${tone})` : selected ? 'var(--color-action)' : 'transparent'
  const fg = tone ? `var(--cat-${tone}-fg)` : selected ? 'var(--color-on-brand)' : 'var(--color-ink)'
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: 'var(--font-body)', fontWeight: 'var(--fw-medium)' as unknown as number,
        fontSize: 'var(--text-label)', padding: '8px 16px', borderRadius: 'var(--radius-full)',
        border: tone || selected ? 'none' : '1.5px solid var(--color-ink)',
        background: bg, color: fg, cursor: 'pointer',
        transition: 'background var(--motion-fast) var(--ease)', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

/* ----------------------------------------------------------------- Input */

export function Input({ label, icon, placeholder, value, onChange, type = 'text' }: {
  label?: string
  icon?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)' }}>
      {label && <span style={{ fontSize: 'var(--text-label)', fontWeight: 700, color: 'var(--color-ink)' }}>{label}</span>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, background: 'var(--color-surface-card)',
        border: '1.5px solid var(--c-red-100)', borderRadius: 'var(--radius-sm)', padding: '12px 16px',
      }}>
        {icon && <Icon name={icon} size={18} style={{ color: 'var(--c-ink-300)', flexShrink: 0 }} />}
        <input
          type={type} placeholder={placeholder} value={value} onChange={onChange}
          style={{
            border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body)', color: 'var(--color-ink)', width: '100%', minWidth: 0,
          }}
        />
      </div>
    </label>
  )
}

/* -------------------------------------------------------------- Checkbox */

export function Checkbox({ checked, onChange, children }: {
  checked?: boolean
  onChange?: () => void
  children?: ReactNode
}) {
  return (
    <label
      onClick={onChange}
      style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: 'var(--radius-sm)',
        border: checked ? 'none' : '1.5px solid var(--color-ink)',
        background: checked ? 'var(--color-action)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transition: 'background var(--motion-fast) var(--ease)',
      }}>
        {checked && <Icon name="check" size={14} style={{ color: 'var(--color-on-brand)' }} />}
      </span>
      <span style={{
        fontSize: 'var(--text-body)', color: checked ? 'var(--c-ink-300)' : 'var(--color-ink)',
        textDecoration: checked ? 'line-through' : 'none',
        transition: 'color var(--motion-base) var(--ease)',
      }}>{children}</span>
    </label>
  )
}

/* ----------------------------------------------------------------- Badge */

export function Badge({ children, tone = 'success' }: {
  children: ReactNode
  tone?: 'success' | 'warning' | 'action' | 'neutral'
}) {
  const map = {
    success: { bg: 'var(--c-yellow)', fg: 'var(--c-ink)' },
    warning: { bg: 'var(--c-red-900)', fg: 'var(--c-cream)' },
    action: { bg: 'var(--color-action)', fg: 'var(--color-on-brand)' },
    neutral: { bg: 'var(--c-warm-300)', fg: 'var(--color-ink)' },
  }
  const c = map[tone]
  return (
    <span style={{
      display: 'inline-block', fontFamily: 'var(--font-body)', fontWeight: 500,
      fontSize: 'var(--text-label)', background: c.bg, color: c.fg,
      borderRadius: 'var(--radius-full)', padding: '5px 12px',
    }}>{children}</span>
  )
}

/* ----------------------------------------------------------- ProgressBar */

export function ProgressBar({ value, max = 100, tone = 'action', trackTone = 'onDark' }: {
  value: number
  max?: number
  tone?: 'action' | 'signal'
  trackTone?: 'onDark' | 'onLight'
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={{
      height: 8, borderRadius: 'var(--radius-full)',
      background: trackTone === 'onDark' ? 'rgba(255,246,232,0.3)' : 'var(--c-red-100)',
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: tone === 'action' ? 'var(--color-action)' : 'var(--c-yellow)',
        borderRadius: 'var(--radius-full)', transition: 'width var(--motion-slow) var(--ease)',
      }} />
    </div>
  )
}

/* ---------------------------------------------------- NotificationStrip */

export function NotificationStrip({ title, items }: {
  title?: string
  items: { icon: string; text: string; tone?: string }[]
}) {
  return (
    <div style={{ background: 'var(--color-surface-card)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
      {title && (
        <h3 style={{
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-card-title)',
          color: 'var(--color-action)', margin: '0 0 var(--space-3) 0',
        }}>{title}</h3>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            background: `var(--cat-${it.tone}-tint, var(--c-red-100))`,
            borderRadius: 'var(--radius-sm)', padding: '10px 12px',
          }}>
            <Icon name={it.icon} size={18} style={{ color: 'var(--color-ink)', opacity: 0.7, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-meta)', color: 'var(--color-ink)' }}>{it.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
