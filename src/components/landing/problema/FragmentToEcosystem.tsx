import { useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  MessageCircle,
  CalendarDays,
  Table2,
  FileSignature,
  Landmark,
  Images,
  User,
  Wallet,
  Workflow,
  History,
  type LucideIcon,
} from "lucide-react";
import { TOKENS, uiFont } from "../primitives";
import lunariSymbol from "@/assets/branding/lunari-icon-black.png";

const EASE = [0.16, 1, 0.3, 1] as const;

type NodeDef = {
  id: string;
  before: string;
  after: string;
  Icon: LucideIcon;
  AfterIcon: LucideIcon;
  /** posição fragmentada (%) */
  from: [number, number];
  /** posição no hub (%) */
  to: [number, number];
  tilt: number;
  primary?: boolean;
};

/** Hub compacto (~15% mais próximo do centro), "Cliente" no topo. */
const NODES: NodeDef[] = [
  { id: "cliente", before: "WhatsApp", after: "Cliente", Icon: MessageCircle, AfterIcon: User, from: [16, 12], to: [50, 16], tilt: -1.5, primary: true },
  { id: "agenda", before: "Agenda", after: "Agenda", Icon: CalendarDays, AfterIcon: CalendarDays, from: [78, 8], to: [79, 37], tilt: 1.2 },
  { id: "financeiro", before: "Planilha", after: "Financeiro", Icon: Table2, AfterIcon: Wallet, from: [8, 52], to: [72, 70], tilt: 1.4 },
  { id: "historico", before: "Contratos", after: "Histórico", Icon: FileSignature, AfterIcon: History, from: [62, 44], to: [50, 84], tilt: -1.1 },
  { id: "workflow", before: "Banco", after: "Workflow", Icon: Landmark, AfterIcon: Workflow, from: [22, 86], to: [28, 70], tilt: 1.6 },
  { id: "gallery", before: "Galeria", after: "Gallery", Icon: Images, AfterIcon: Images, from: [80, 82], to: [21, 37], tilt: -1.3 },
];

const CARD_SHADOW = "0 8px 24px -16px rgba(10,10,10,0.18)";
const CARD_SHADOW_ON = "0 12px 26px -14px rgba(10,10,10,0.16)";
const CARD_SHADOW_HOVER = "0 14px 30px -12px rgba(10,10,10,0.22)";

/** raio do disco do símbolo em % do palco (x, y) */
const CORE_R: [number, number] = [6.5, 8.5];
/** recuo na chegada ao card */
const CARD_PULL = 0.14;

function pct(v: number) {
  return `${v}%`;
}

/** traço individual: sai da borda do disco central e termina na borda do card */
function linkPath(to: [number, number]) {
  const cx = 50;
  const cy = 50;
  const dx = to[0] - cx;
  const dy = to[1] - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const sx = cx + ux * CORE_R[0];
  const sy = cy + uy * CORE_R[1];
  const ex = to[0] - dx * CARD_PULL;
  const ey = to[1] - dy * CARD_PULL;

  return { d: `M${sx} ${sy} L${ex} ${ey}`, ex, ey };
}

/* ---------------- Card ---------------- */

function NodeCard({
  node,
  p,
  scrollDriven,
  hovered,
  onHover,
}: {
  node: NodeDef;
  p: MotionValue<number> | null;
  scrollDriven: boolean;
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const zero = useTransform(() => 1);
  const prog = p ?? zero;

  const left = useTransform(prog, [0.3, 0.65], [pct(node.from[0]), pct(node.to[0])]);
  const top = useTransform(prog, [0.3, 0.65], [pct(node.from[1]), pct(node.to[1])]);
  const rotate = useTransform(prog, [0.3, 0.65], [node.tilt, 0]);
  const beforeOpacity = useTransform(prog, [0.38, 0.54], [1, 0]);
  const afterOpacity = useTransform(prog, [0.5, 0.68], [0, 1]);

  const isHovered = hovered === node.id;
  const { Icon, AfterIcon } = node;

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={
        scrollDriven
          ? { left, top, rotate }
          : { left: pct(node.to[0]), top: pct(node.to[1]) }
      }
      onHoverStart={() => onHover(node.id)}
      onHoverEnd={() => onHover(null)}
    >
      <motion.div
        className="flex items-center gap-2 rounded-[10px] border bg-white px-3 py-2"
        animate={{
          y: isHovered ? -2 : 0,
          boxShadow: isHovered ? CARD_SHADOW_HOVER : CARD_SHADOW_ON,
        }}
        transition={{ duration: 0.22, ease: EASE }}
        style={{ borderColor: TOKENS.hair, ...uiFont }}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            style={scrollDriven ? { opacity: beforeOpacity } : { opacity: 0 }}
          >
            <Icon className="h-[14px] w-[14px]" strokeWidth={1.5} />
          </motion.span>
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            style={scrollDriven ? { opacity: afterOpacity } : { opacity: 1 }}
          >
            <AfterIcon className="h-[14px] w-[14px]" strokeWidth={1.5} />
          </motion.span>
        </span>

        <span className="relative block h-[16px] min-w-[62px] text-[12px] leading-[16px]">
          <motion.span
            className="absolute inset-0 whitespace-nowrap"
            style={
              scrollDriven
                ? { opacity: beforeOpacity, color: "rgba(10,10,10,0.62)" }
                : { opacity: 0 }
            }
          >
            {node.before}
          </motion.span>
          <motion.span
            className="absolute inset-0 whitespace-nowrap"
            style={{
              ...(scrollDriven ? { opacity: afterOpacity } : { opacity: 1 }),
              color: node.primary ? TOKENS.ink : "rgba(10,10,10,0.78)",
              fontWeight: node.primary ? 500 : 400,
            }}
          >
            {node.after}
          </motion.span>
        </span>
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Núcleo (símbolo) ---------------- */

function Core({
  p,
  scrollDriven,
  hovered,
}: {
  p: MotionValue<number> | null;
  scrollDriven: boolean;
  hovered: string | null;
}) {
  const one = useTransform(() => 1);
  const prog = p ?? one;
  const opacity = useTransform(prog, [0.72, 0.95], [0, 1]);
  const scale = useTransform(prog, [0.72, 0.95], [0.92, 1]);

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={scrollDriven ? { opacity, scale } : undefined}
    >
      <motion.div
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full"
        animate={{ scale: hovered ? 1.03 : 1 }}
        transition={{ duration: 0.22, ease: EASE }}
        style={{
          background: `radial-gradient(circle, ${TOKENS.paper} 58%, rgba(250,250,247,0) 100%)`,
        }}
      >
        <img
          src={lunariSymbol}
          alt="Símbolo Lunari"
          className="h-[44px] w-[44px] object-contain"
          loading="lazy"
        />
      </motion.div>
    </motion.div>
  );
}

/* ---------------- Linhas ---------------- */

function Links({
  p,
  scrollDriven,
  hovered,
  alive,
}: {
  p: MotionValue<number> | null;
  scrollDriven: boolean;
  hovered: string | null;
  alive: boolean;
}) {
  const one = useTransform(() => 1);
  const prog = p ?? one;

  const ringOpacity = useTransform(prog, [0.72, 0.98], [0, 1]);

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* anel de órbita fantasma */}
      <motion.ellipse
        cx={50}
        cy={50}
        rx={29}
        ry={34}
        fill="none"
        stroke="rgba(10,10,10,0.045)"
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
        style={scrollDriven ? { opacity: ringOpacity } : undefined}
      />

      {NODES.map((n, i) => (
        <Link
          key={n.id}
          node={n}
          index={i}
          prog={prog}
          scrollDriven={scrollDriven}
          active={hovered === n.id}
          alive={alive}
        />
      ))}
    </svg>
  );
}

function Link({
  node,
  index,
  prog,
  scrollDriven,
  active,
  alive,
}: {
  node: NodeDef;
  index: number;
  prog: MotionValue<number>;
  scrollDriven: boolean;
  active: boolean;
  alive: boolean;
}) {
  const { d, ex, ey } = linkPath(node.to);

  // stagger por índice dentro do estágio 2
  const start = 0.34 + index * 0.02;
  const drawn = useTransform(prog, [start, start + 0.3], [0, 1]);
  const partial = useTransform(prog, [start, start + 0.3], [0, 0.6]);
  const full = useTransform(prog, [0.72, 0.95], [0.6, 1]);
  const opacity = useTransform([partial, full, prog] as const, (v) => {
    const [a, b, t] = v as [number, number, number];
    return (t as number) >= 0.72 ? b : a;
  });
  const dotOpacity = useTransform(prog, [0.82, 0.98], [0, 1]);

  return (
    <g>
      {/* halo de profundidade */}
      <motion.path
        d={d}
        fill="none"
        stroke="rgba(176,99,47,0.06)"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
        style={scrollDriven ? { opacity, pathLength: drawn } : undefined}
      />
      {/* traço principal */}
      <motion.path
        d={d}
        fill="none"
        vectorEffect="non-scaling-stroke"
        animate={{
          stroke: active ? "rgba(10,10,10,0.34)" : "rgba(10,10,10,0.21)",
          strokeWidth: active ? 0.95 : 0.75,
        }}
        transition={{ duration: 0.22, ease: EASE }}
        style={scrollDriven ? { opacity, pathLength: drawn } : undefined}
      />
      {/* pulso de "sistema vivo" */}
      {alive && (
        <motion.path
          d={d}
          fill="none"
          stroke="rgba(10,10,10,0.28)"
          strokeWidth={1.1}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          strokeDasharray="0.1 1"
          initial={{ strokeDashoffset: 0.1, opacity: 0 }}
          animate={{ strokeDashoffset: [0.1, -1], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.6,
            times: [0, 0.15, 0.85, 1],
            ease: "linear",
            repeat: Infinity,
            repeatDelay: 4.4,
            delay: index * 0.12,
          }}
        />
      )}
      {/* nó de chegada */}
      <motion.circle
        cx={ex}
        cy={ey}
        r={0.55}
        fill="rgba(10,10,10,0.28)"
        vectorEffect="non-scaling-stroke"
        style={scrollDriven ? { opacity: dotOpacity } : undefined}
      />
    </g>
  );
}

/* ---------------- Palco ---------------- */

function Stage({
  p,
  scrollDriven,
  alive,
}: {
  p: MotionValue<number> | null;
  scrollDriven: boolean;
  alive: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative h-[460px] w-full">
      <Links p={p} scrollDriven={scrollDriven} hovered={hovered} alive={alive} />
      <Core p={p} scrollDriven={scrollDriven} hovered={hovered} />
      {NODES.map((n) => (
        <NodeCard
          key={n.id}
          node={n}
          p={p}
          scrollDriven={scrollDriven}
          hovered={hovered}
          onHover={setHovered}
        />
      ))}
    </div>
  );
}

/* ---------------- Mobile: dois quadros ---------------- */

function MobileFrames() {
  return (
    <div className="flex flex-col gap-4 lg:hidden">
      <Frame label="Hoje">
        <div className="grid grid-cols-2 gap-2.5">
          {NODES.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 rounded-[10px] border bg-white px-3 py-2.5"
              style={{ borderColor: TOKENS.hair, boxShadow: CARD_SHADOW, ...uiFont }}
            >
              <n.Icon className="h-[14px] w-[14px]" strokeWidth={1.5} />
              <span className="text-[12px]" style={{ color: "rgba(10,10,10,0.62)" }}>
                {n.before}
              </span>
            </div>
          ))}
        </div>
      </Frame>

      <Frame label="Com Lunari">
        <div className="mb-4 flex flex-col items-center">
          <img
            src={lunariSymbol}
            alt="Símbolo Lunari"
            className="h-[36px] w-[36px] object-contain"
            loading="lazy"
          />
          <div
            className="mt-3 h-6 w-px"
            style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.21), rgba(10,10,10,0))" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {NODES.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 rounded-[10px] border bg-white px-3 py-2.5"
              style={{ borderColor: TOKENS.hair, boxShadow: CARD_SHADOW_ON, ...uiFont }}
            >
              <n.AfterIcon className="h-[14px] w-[14px]" strokeWidth={1.5} />
              <span
                className="text-[12px]"
                style={{
                  color: n.primary ? TOKENS.ink : "rgba(10,10,10,0.78)",
                  fontWeight: n.primary ? 500 : 400,
                }}
              >
                {n.after}
              </span>
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}

function Frame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] border p-4" style={{ borderColor: TOKENS.hair }}>
      <div
        className="mb-3 text-[10px] uppercase tracking-[0.22em]"
        style={{ ...uiFont, color: "rgba(10,10,10,0.42)" }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Export ---------------- */

export function FragmentToEcosystem() {
  const reduce = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);
  const inView = useInView(railRef, { margin: "-10% 0px -10% 0px" });
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 75%", "end 90%"],
  });

  const [assembled, setAssembled] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setAssembled(v >= 0.95);
  });
  useEffect(() => {
    if (reduce) setAssembled(true);
  }, [reduce]);

  const alive = !reduce && assembled && inView;

  return (
    <>
      {/* Desktop: trilho de scroll + palco sticky */}
      <div ref={railRef} className="relative hidden lg:block" style={{ height: "150vh" }}>
        <div className="sticky top-[22vh]">
          <Stage p={reduce ? null : scrollYProgress} scrollDriven={!reduce} alive={alive} />
        </div>
      </div>

      <MobileFrames />
    </>
  );
}
