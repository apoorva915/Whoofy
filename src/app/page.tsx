"use client"

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f7f8fb',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 520,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '32px 28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: '#1d4ed8',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
            }}
          >
            W
          </div>
          <div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Whoofy</p>
            <h1 style={{ fontSize: 20, color: '#111827', margin: 0 }}>AI Reel Verification</h1>
          </div>
        </div>

        <p style={{ fontSize: 14, color: '#4b5563', marginBottom: 20 }}>
          Enter a reel URL to kick off verification. This UI is intentionally minimal and does not yet call the backend.
        </p>

        <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label htmlFor="reelUrl" style={{ fontSize: 14, color: '#111827', fontWeight: 600 }}>
            Reel URL
          </label>
          <input
            id="reelUrl"
            name="reelUrl"
            type="url"
            placeholder="https://www.instagram.com/reel/..."
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />

          <button
            type="button"
            style={{
              marginTop: 4,
              padding: '12px 14px',
              borderRadius: 10,
              border: 'none',
              background: '#1d4ed8',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 10px 25px rgba(37,99,235,0.25)',
            }}
          >
            Submit (UI only)
          </button>
        </form>
      </section>
    </main>
  )
}

