import {
  useRef,
  useEffect,
  useMemo,
  useState,
  Component,
  type ReactNode,
  type CSSProperties,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MessageSquare, FileText, BarChart3 } from "lucide-react";

// ---------------------------------------------------------------------------
// Module-level mouse tracker — shared across renders, no re-renders needed.
// ---------------------------------------------------------------------------
const mousePos = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// WebGL error boundary — renders a CSS fallback if WebGL is unavailable.
// ---------------------------------------------------------------------------

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * Catches WebGL / R3F initialisation errors and renders a static fallback.
 */
class WebGLBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };
  componentDidCatch() {
    this.setState({ failed: true });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Three.js — Icosahedron head
// ---------------------------------------------------------------------------

interface SceneNodeProps {
  reducedMotion: boolean;
  isDark: boolean;
}

/**
 * Low-poly icosahedron with:
 *  - Slow base rotation (Y: 0.003, X: 0.001 rad/frame)
 *  - 4-second breathing scale (sine, amplitude 0.08)
 *  - Emissive color lerp between AI Indigo and Cyber Cyan
 *  - Mouse parallax (lerp factor 0.05)
 *  - Wireframe overlay at 8% opacity for depth
 *
 * @param reducedMotion - Skip animations when prefers-reduced-motion is set.
 */
function IcoHead({ reducedMotion }: Pick<SceneNodeProps, "reducedMotion">) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const wireRef = useRef<THREE.Mesh>(null!);

  // Accumulated base rotation (avoid drift from additive updates)
  const baseRotY = useRef(0);
  const baseRotX = useRef(0);

  // Smoothed parallax offsets
  const parallaxX = useRef(0);
  const parallaxY = useRef(0);

  // Pre-allocated colors to avoid per-frame allocations
  const indigo = useMemo(() => new THREE.Color("#6366F1"), []);
  const cyan = useMemo(() => new THREE.Color("#06B6D4"), []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.getElapsedTime();
    const mesh = meshRef.current;
    const wire = wireRef.current;
    if (!mesh) return;

    // Accumulate base rotation
    baseRotY.current += 0.003;
    baseRotX.current += 0.001;

    // Lerp parallax toward current mouse position
    const targetPX = (mousePos.y / window.innerHeight - 0.5) * 0.6;
    const targetPY = (mousePos.x / window.innerWidth - 0.5) * 0.6;
    parallaxX.current += (targetPX - parallaxX.current) * 0.05;
    parallaxY.current += (targetPY - parallaxY.current) * 0.05;

    // Apply total rotation (base + parallax)
    mesh.rotation.x = baseRotX.current + parallaxX.current;
    mesh.rotation.y = baseRotY.current + parallaxY.current;

    // Breathing scale — sine, 4s period, amplitude 0.08
    const scale = 1.0 + 0.08 * Math.sin((t / 4) * Math.PI * 2);
    mesh.scale.setScalar(scale);

    if (wire) {
      wire.rotation.x = mesh.rotation.x;
      wire.rotation.y = mesh.rotation.y;
      wire.scale.setScalar(scale);
    }

    // Emissive color lerp between indigo and cyan
    const mat = mesh.material as THREE.MeshStandardMaterial;
    mat.emissive.lerpColors(indigo, cyan, (Math.sin(t * 0.5) + 1) / 2);
    mat.emissiveIntensity = 0.3 + 0.1 * Math.sin(t * 0.3);
  });

  return (
    <>
      {/* Main solid icosahedron */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[2, 1]} />
        <meshStandardMaterial
          color="#6366F1"
          metalness={0.4}
          roughness={0.6}
          emissive="#6366F1"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Wireframe overlay at 8% opacity for facet depth */}
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[2.02, 1]} />
        <meshBasicMaterial color="#ffffff" wireframe transparent opacity={0.08} />
      </mesh>
    </>
  );
}

// ---------------------------------------------------------------------------
// Three.js — Particle field
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 180;

/**
 * 180-point particle field drifting inside a sphere of radius 4–6 around the
 * icosahedron. Particles that drift beyond radius ~7.5 are reset to a random
 * position within the starting band.
 *
 * @param isDark       - Particle color adapts to dark/light mode.
 * @param reducedMotion - Skip drift animation when prefers-reduced-motion is set.
 */
function Particles({ isDark, reducedMotion }: SceneNodeProps) {
  // All data lives outside React state — mutated directly in useFrame.
  const { positions, velocities, geo } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 4 + Math.random() * 2; // band between r=4 and r=6

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      velocities[i * 3] = (Math.random() - 0.5) * 0.004;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.004;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }

    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", posAttr);

    return { positions, velocities, geo };
  }, []);

  useFrame(() => {
    if (reducedMotion) return;
    const posAttr = geo.attributes.position;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] += velocities[i * 3];
      positions[i * 3 + 1] += velocities[i * 3 + 1];
      positions[i * 3 + 2] += velocities[i * 3 + 2];

      const dx = positions[i * 3];
      const dy = positions[i * 3 + 1];
      const dz = positions[i * 3 + 2];

      // Reset particles that drift beyond r=7.5 (r²=56.25)
      if (dx * dx + dy * dy + dz * dz > 56) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 4 + Math.random() * 2;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points geometry={geo}>
      <pointsMaterial
        size={0.05}
        color={isDark ? "#94A3B8" : "#4F46E5"}
        opacity={isDark ? 0.45 : 0.25}
        transparent
        sizeAttenuation
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Three.js — Full scene
// ---------------------------------------------------------------------------

/**
 * Assembles lights, icosahedron head, and particle field.
 *
 * @param isDark       - Passed to particles for colour adaptation.
 * @param reducedMotion - Disables animation when prefers-reduced-motion is set.
 */
function Scene({ isDark, reducedMotion }: SceneNodeProps) {
  return (
    <>
      <ambientLight intensity={0.2} />
      {/* Indigo key light — upper-left */}
      <pointLight position={[-4, 4, 2]} color="#6366F1" intensity={3} />
      {/* Cyan fill light — lower-right */}
      <pointLight position={[4, -4, -2]} color="#06B6D4" intensity={2} />
      <IcoHead reducedMotion={reducedMotion} />
      <Particles isDark={isDark} reducedMotion={reducedMotion} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const FEATURES = [
  { icon: MessageSquare, label: "Chat with GPT-4o, Llama 3, Claude & Gemini" },
  { icon: FileText, label: "Upload PDFs and ask questions about your documents" },
  { icon: BarChart3, label: "AI-powered customer support dashboard" },
] as const;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Gradient logo mark — indigo → cyan diagonal gradient with chat bubble icon.
 *
 * @param size - Width and height in px. Defaults to 40.
 */
function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        background: "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.52}
        height={size * 0.52}
        viewBox="0 0 22 20"
        fill="none"
      >
        <path
          d="M11 1C5.48 1 1 4.92 1 9.75c0 2.05.75 3.94 2 5.4L2 19l4.5-1.5A10.4 10.4 0 0011 18.5c5.52 0 10-3.92 10-8.75S16.52 1 11 1z"
          fill="white"
          opacity="0.9"
        />
        <circle cx="7.5" cy="9.75" r="1.3" fill="white" opacity="0.55" />
        <circle cx="11" cy="9.75" r="1.3" fill="white" />
        <circle cx="14.5" cy="9.75" r="1.3" fill="white" opacity="0.55" />
      </svg>
    </div>
  );
}

/**
 * Official Google "G" multi-colour logo for the sign-in button.
 */
function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
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

// ---------------------------------------------------------------------------
// Main login page
// ---------------------------------------------------------------------------

/**
 * Premium AI-Native login page.
 *
 * Desktop layout:
 *   Left half  — app identity (logo, tagline, feature bullets)
 *   Right half — Three.js animated icosahedron scene with glass sign-in card
 *
 * Mobile layout:
 *   Three.js scene as blurred full-bleed background
 *   Sign-in card centred on top
 *
 * Respects prefers-color-scheme and prefers-reduced-motion.
 */
export default function LoginPage() {
  const [cardVisible, setCardVisible] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const reducedMotion = useRef(false);

  useEffect(() => {
    // Colour scheme detection
    const colorMq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(colorMq.matches);
    const onColorChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    colorMq.addEventListener("change", onColorChange);

    // Reduced-motion detection
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Mouse tracking for parallax
    const onMouseMove = (e: MouseEvent) => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // Double rAF ensures initial opacity:0 renders before transition fires
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setCardVisible(true));
      return raf2;
    });

    return () => {
      colorMq.removeEventListener("change", onColorChange);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(raf1);
    };
  }, []);

  // Design-system token shortcuts
  const textPrimary = isDark ? "#F1F5F9" : "#0F172A";
  const textSecondary = isDark ? "#94A3B8" : "#475569";
  const textMuted = isDark ? "#475569" : "#94A3B8";
  const canvasBg = isDark ? "#0A0E1A" : "#F8FAFC";

  // Glass card — dark mode uses frosted glass, light uses opaque white
  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    padding: "40px 36px",
    opacity: cardVisible ? 1 : 0,
    transform: cardVisible ? "translateY(0)" : "translateY(20px)",
    transition: reducedMotion.current
      ? "none"
      : "opacity 300ms ease-out, transform 300ms ease-out",
    ...(isDark
      ? {
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.10)",
        }
      : {
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          boxShadow:
            "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08)",
        }),
  };

  // Static fallback shown if WebGL is unavailable
  const fallback = (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: isDark
          ? "radial-gradient(ellipse at 60% 50%, #1e1b4b 0%, #0A0E1A 70%)"
          : "radial-gradient(ellipse at 60% 50%, #e0e7ff 0%, #F8FAFC 70%)",
      }}
    />
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        overflow: "hidden",
        background: canvasBg,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Left identity panel — desktop only                                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between"
        style={{ padding: "48px 56px", position: "relative", zIndex: 2 }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LogoMark size={44} />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              color: textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            Vibe Chat
          </span>
        </div>

        {/* Headline + tagline + feature bullets */}
        <div>
          <h1
            style={{
              fontSize: 42,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              color: textPrimary,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            Your AI,<br />every model.
          </h1>
          <p
            style={{
              fontSize: 16,
              color: textSecondary,
              lineHeight: 1.65,
              marginBottom: 44,
              maxWidth: 340,
            }}
          >
            One workspace for all the AI models you use — with memory,
            documents, and smart automation built in.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                style={{ display: "flex", alignItems: "center", gap: 14 }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: isDark
                      ? "rgba(99,102,241,0.15)"
                      : "rgba(99,102,241,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <Icon size={16} color="#6366F1" />
                </div>
                <span
                  style={{
                    fontSize: 14,
                    color: textSecondary,
                    lineHeight: 1.4,
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12, color: textMuted }}>© 2026 Vibe Chat</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right panel — Three.js canvas + sign-in card                        */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex-1 lg:w-1/2"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Canvas wrapper — blurred on mobile, sharp on desktop */}
        <div
          className="blur-sm lg:blur-none"
          style={{ position: "absolute", inset: 0 }}
        >
          <WebGLBoundary fallback={fallback}>
            <Canvas
              camera={{ position: [0, 0, 8], fov: 45 }}
              gl={{ alpha: true, antialias: true }}
              dpr={[1, 1.5]}
              style={{ width: "100%", height: "100%" }}
            >
              <Scene isDark={isDark} reducedMotion={reducedMotion.current} />
            </Canvas>
          </WebGLBoundary>
        </div>

        {/* Sign-in card (z above canvas) */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            maxWidth: 420,
            padding: "0 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Mobile-only logo (left panel hidden on small screens) */}
          <div
            className="flex lg:hidden"
            style={{
              alignItems: "center",
              gap: 10,
              marginBottom: 28,
            }}
          >
            <LogoMark size={40} />
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                color: isDark ? "#F1F5F9" : "#0F172A",
                letterSpacing: "-0.02em",
              }}
            >
              Vibe Chat
            </span>
          </div>

          {/* Glass / opaque card */}
          <div style={cardStyle} role="main">
            {/* Heading */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <h2
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  color: textPrimary,
                  letterSpacing: "-0.025em",
                  marginBottom: 8,
                }}
              >
                Welcome back
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: textSecondary,
                  lineHeight: 1.55,
                }}
              >
                Sign in to continue to Vibe Chat
              </p>
            </div>

            {/* Google sign-in button */}
            <GoogleButton />

            {/* Footer */}
            <p
              style={{
                textAlign: "center",
                fontSize: 12,
                color: textMuted,
                marginTop: 24,
                lineHeight: 1.6,
              }}
            >
              By signing in you agree to our{" "}
              <span
                style={{
                  color: textSecondary,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                  cursor: "pointer",
                }}
              >
                terms of service
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google sign-in button — isolated so hover state stays local
// ---------------------------------------------------------------------------

/**
 * White-background Google sign-in button with subtle shadow and lift-on-hover.
 * Navigates to /auth/google on click to initiate the OAuth flow.
 */
function GoogleButton() {
  const [hovered, setHovered] = useState(false);

  const style: CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "13px 20px",
    borderRadius: 10,
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 500,
    color: "#0F172A",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    transition: "transform 150ms ease-out, box-shadow 150ms ease-out",
    boxShadow: hovered
      ? "0 4px 14px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)"
      : "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
    transform: hovered ? "translateY(-1px)" : "translateY(0)",
    outline: "none",
  };

  return (
    <button
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
      aria-label="Continue with Google"
      type="button"
    >
      <GoogleLogo />
      Continue with Google
    </button>
  );
}
