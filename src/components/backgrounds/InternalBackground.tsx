export default function InternalBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      <div className="w-full h-full opacity-90 dark:opacity-25">
        {/* Main blob - right */}
        <div
          className="absolute animate-eclipse-float"
          style={{
            top: '20%',
            right: '-5%',
            width: 'min(50vw, 800px)',
            height: 'min(50vw, 800px)',
            background: 'radial-gradient(circle, rgba(172, 94, 58, 0.35) 0%, transparent 75%)',
            filter: 'blur(22px)',
            borderRadius: '50%',
          }}
        />

        {/* Secondary blob - left */}
        <div
          className="absolute animate-eclipse-float-reverse"
          style={{
            top: '40%',
            left: '-5%',
            width: 'min(35vw, 550px)',
            height: 'min(35vw, 550px)',
            background: 'radial-gradient(circle, rgba(172, 94, 58, 0.35) 0%, transparent 75%)',
            filter: 'blur(20px)',
            borderRadius: '50%',
          }}
        />

        {/* External glow - right */}
        <div
          className="absolute"
          style={{
            top: '15%',
            right: '-10%',
            width: 'min(60vw, 1000px)',
            height: 'min(60vw, 1000px)',
            background: 'radial-gradient(circle, rgba(172, 94, 58, 0.08) 0%, transparent 70%)',
            filter: 'blur(45px)',
            borderRadius: '50%',
          }}
        />

        {/* External glow - left */}
        <div
          className="absolute"
          style={{
            top: '35%',
            left: '-10%',
            width: 'min(45vw, 700px)',
            height: 'min(45vw, 700px)',
            background: 'radial-gradient(circle, rgba(172, 94, 58, 0.05) 0%, transparent 70%)',
            filter: 'blur(40px)',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Noise overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.045]" aria-hidden="true">
        <filter id="internal-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#internal-noise)" />
      </svg>
    </div>
  );
}
