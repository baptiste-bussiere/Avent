import React from 'react'




type Gift = {
  title: string
  subtitle?: string
}

type GiftBannerProps = {
  gift: Gift
  onClose: () => void
}

export function GiftBanner({ gift, onClose }: GiftBannerProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(22, 14, 10, 0.95)',
        borderRadius: '999px',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        color: '#ffe4c8',
        boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255, 184, 120, 0.4)',
        zIndex: 1000,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{gift.title}</span>
        {gift.subtitle && (
          <span
            style={{
              fontSize: '0.85rem',
              color: '#f3c48b',
              opacity: 0.9,
            }}
          >
            {gift.subtitle}
          </span>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          marginLeft: 8,
          padding: '4px 10px',
          borderRadius: '999px',
          border: 'none',
          background: 'linear-gradient(135deg, #ffb878, #ff8c45)',
          color: '#2b1408',
          fontWeight: 600,
          fontSize: '0.75rem',
          cursor: 'pointer',
        }}
      >
        OK
      </button>
    </div>
  )
}
