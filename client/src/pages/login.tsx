import { useRef, useEffect, useState, type CSSProperties } from "react";

/**
 * Google G logo mark — official four-colour SVG.
 */
function GoogleLogo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Sign-in button with hover lift and intensified shadow.
 * Navigates to /auth/google on click to start the OAuth flow.
 */
function SignInButton() {
  const [hovered, setHovered] = useState(false);

  const style: CSSProperties = {
    width: "100%",
    maxWidth: 320,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 8,
    background: "#FFFFFF",
    border: "none",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 500,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: "#0F172A",
    transition: "transform 150ms ease, box-shadow 150ms ease",
    transform: hovered ? "translateY(-2px)" : "translateY(0)",
    boxShadow: hovered
      ? "0 8px 24px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)"
      : "0 2px 6px rgba(0,0,0,0.18)",
    outline: "none",
  };

  return (
    <button
      type="button"
      style={style}
      onClick={() => {
        window.location.href = "/auth/google";
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={(e) => {
        e.currentTarget.style.outline = "2px solid #06B6D4";
        e.currentTarget.style.outlineOffset = "2px";
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = "none";
      }}
      aria-label="Sign in with Google"
    >
      <GoogleLogo />
      Sign in with Google
    </button>
  );
}

/**
 * Full-screen video login page.
 *
 * Layers (bottom → top):
 *   0  — video: fixed, full-viewport, object-fit cover
 *   1  — gradient overlay: darkens left→right so right side is readable
 *   2  — sign-in content: absolute, right 8%, vertically centred, no card bg
 *
 * Content fades in with translateY 16px→0 on mount (500ms ease-out).
 * Respects prefers-reduced-motion.
 */
export default function LoginPage() {
  const [visible, setVisible] = useState(false);
  const reducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    if (reducedMotion.current) {
      setVisible(true);
      return;
    }
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(true))
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const contentStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    minWidth: 320,
    maxWidth: 400,
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(16px)",
    transition: reducedMotion.current
      ? "none"
      : "opacity 500ms ease-out, transform 500ms ease-out",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0A0E1A",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* Layer 0 — full-screen video */}
      <video
        src="/ai-head.mp4"
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      {/* Layer 1 — gradient overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background:
            "linear-gradient(to right, transparent 0%, transparent 40%, rgba(10,14,26,0.4) 55%, rgba(10,14,26,0.75) 70%, rgba(10,14,26,0.92) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Layer 2 — sign-in content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          maxWidth: 520,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 40px",
          zIndex: 2,
        }}
      >
        <div style={contentStyle}>
          {/* Heading */}
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "'Orbitron', system-ui, sans-serif",
              color: "#FFFFFF",
              textAlign: "center",
              letterSpacing: "0.02em",
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              marginBottom: 32,
            }}
          >
            Welcome to Vibe Chat
          </h1>

          {/* Sign-in button */}
          <SignInButton />

          {/* Terms */}
          <p
            style={{
              marginTop: 16,
              fontSize: 12,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              color: "rgba(255,255,255,0.35)",
              textAlign: "center",
              lineHeight: 1.65,
              maxWidth: 280,
            }}
          >
            By signing in you agree to our{" "}
            <span
              style={{
                color: "rgba(255,255,255,0.55)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                cursor: "pointer",
              }}
            >
              Privacy Policy
            </span>{" "}
            and{" "}
            <span
              style={{
                color: "rgba(255,255,255,0.55)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                cursor: "pointer",
              }}
            >
              Terms of Service
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
