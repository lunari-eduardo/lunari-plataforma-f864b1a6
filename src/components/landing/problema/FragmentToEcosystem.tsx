import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
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
import { TOKENS, displayFont, uiFont } from "../primitives";

type NodeDef = {
  id: string;
  before: string;
  after: string;
  Icon: LucideIcon;
  AfterIcon: LucideIcon;
  /** posição fragmentada (%) */
  from: [number, number];
  /** posição em órbita (%) */
  to: [number, number];
  tilt: number;
};

const NODES: NodeDef[] = [
  { id: "whats", before: "WhatsApp", after: "Cliente", Icon: MessageCircle, AfterIcon: User, from: [16, 12], to: [50, 12], tilt: -1.5 },
  { id: "agenda", before: "Agenda", after: "Agenda", Icon: CalendarDays, AfterIcon: CalendarDays, from: [76, 8], to: [84, 32], tilt: 1.2 },
  { id: "plan", before: "Planilha", after: "Financeiro", Icon: Table2, AfterIcon: Wallet, from: [8, 52], to: [84, 72], tilt: 1.4 },
  { id: "contr", before: "Contratos", after: "Workflow", Icon: FileSignature, AfterIcon: Workflow, from: [62, 44], to: [50, 90], tilt: -1.1 },
  { id: "banco", before: "Banco", after: "Gallery", Icon: Landmark, AfterIcon: Images, from: [22, 86], to: [16, 72], tilt: 1.6 },
  { id: "gal", before: "Galeria", after: "Histórico", Icon: Images, AfterIcon: History, from: [80, 82], to: [16, 32], tilt: -1.3 },
];

const CARD_SHADOW = "0 8px 24px -16px rgba(10,10,10,0.18)";
const CARD_SHADOW_ON = "0 12px 28px -12px rgba(10,10,10,0.16)";

function pct(v: number) {
  return `${v}%`;
}

/* ---------------- Card ---------------- */

function NodeCard({
  node,
  p,
  scrollDriven,
}: {
  node: NodeDef;
  p: MotionValue<number> | null;
  scrollDriven: boolean;
}) {
  const zero = useTransform(() => 0);
  const prog = p ?? zero;

  const left = useTransform(prog, [0, 1], [pct(node.from[0]), pct(node.to[0])]);
  const top = useTransform(prog, [0, 1], [pct(node.from[1]), pct(node.to[1])]);
  const rotate = useTransform(prog, [0, 1], [node.tilt, 0]);
  const beforeOpacity = useTransform(prog, [0.3, 0.5], [1, 0]);
  const afterOpacity = useTransform(prog, [0.45, 0.7], [0, 1]);
  const shadowBlend = useTransform(prog, [0, 1], [0, 1]);

  const { Icon, AfterIcon } = node;

  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={
        scrollDriven
          ? { left, top, rotate }
          : { left: pct(node.to[0]), top: pct(node.to[1]) }
      }
    >
      <motion.div
        className="flex items-center gap-2 rounded-[10px] border bg-white px-3 py-2"
        style={{
          borderColor: TOKENS.hair,
          boxShadow: scrollDriven ? undefined : CARD_SHADOW_ON,
          ...uiFont,
        }}
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
            style={
              scrollDriven
                ? { opacity: afterOpacity, color: TOKENS.ink }
                : { opacity: 1, color: TOKENS.ink }
            }
          >
            {node.after}
          </motion.span>
        </span>
      </motion.div>
      <motion.div aria-hidden style={{ opacity: shadowBlend }} />
    </motion.div>
  );
}

/* ---------------- Núcleo ---------------- */

function Core({ p, scrollDriven }: { p: MotionValue<number> | null; scrollDriven: boolean }) {
  const zero = useTransform(() => 1);
  const prog = p ?? zero;
  const opacity = useTransform(prog, [0.35, 0.75], [0, 1]);
  const scale = useTransform(prog, [0.35, 0.85], [0.94, 1]);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={scrollDriven ? { opacity, scale } : undefined}
    >
      <div
        className="rounded-[14px] border bg-white px-6 py-4 text-center"
        style={{ borderColor: "rgba(10,10,10,0.14)", boxShadow: CARD_SHADOW_ON }}
      >
        <div className="text-[19px] leading-none" style={{ ...displayFont, color: TOKENS.ink }}>
          Lunari
        </div>
        <div
          className="mt-1.5 text-[10px] uppercase tracking-[0.2em]"
          style={{ ...uiFont, color: "rgba(10,10,10,0.42)" }}
        >
          um só sistema
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Linhas ---------------- */

function Links({ p, scrollDriven }: { p: MotionValue<number> | null; scrollDriven: boolean }) {
  const one = useTransform(() => 1);
  const prog = p ?? one;

  const brokenOpacity = useTransform(prog, [0, 0.35], [1, 0]);
  const drawn = useTransform(prog, [0.4, 0.95], [0, 1]);
  const linkOpacity = useTransform(prog, [0.4, 0.6], [0, 1]);

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {/* fragmentação: traços que terminam no vazio */}
      {scrollDriven && (
        <motion.g style={{ opacity: brokenOpacity }}>
          {[
            "M20 20 L34 27",
            "M70 16 L58 24",
            "M14 56 L26 60",
            "M64 50 L74 58",
            "M28 82 L40 76",
            "M74 78 L64 72",
          ].map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke="rgba(10,10,10,0.16)"
              strokeWidth={0.35}
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </motion.g>
      )}

      {/* ecossistema: cada módulo ligado ao núcleo */}
      <motion.g style={scrollDriven ? { opacity: linkOpacity } : undefined}>
        {NODES.map((n) => {
          const d = `M50 50 L${n.to[0]} ${n.to[1]}`;
          return (
            <g key={n.id}>
              <path
                d={d}
                fill="none"
                stroke="rgba(176,99,47,0.10)"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
              <motion.path
                d={d}
                fill="none"
                stroke="rgba(10,10,10,0.18)"
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
                style={scrollDriven ? { pathLength: drawn } : undefined}
              />
            </g>
          );
        })}
      </motion.g>
    </svg>
  );
}

/* ---------------- Composição desktop ---------------- */

function Stage({ p, scrollDriven }: { p: MotionValue<number> | null; scrollDriven: boolean }) {
  return (
    <div className="relative h-[460px] w-full">
      <Links p={p} scrollDriven={scrollDriven} />
      <Core p={p} scrollDriven={scrollDriven} />
      {NODES.map((n) => (
        <NodeCard key={n.id} node={n} p={p} scrollDriven={scrollDriven} />
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
        <div
          className="mb-3 rounded-[12px] border bg-white px-4 py-3 text-center"
          style={{ borderColor: "rgba(10,10,10,0.14)", boxShadow: CARD_SHADOW_ON }}
        >
          <div className="text-[18px] leading-none" style={{ ...displayFont, color: TOKENS.ink }}>
            Lunari
          </div>
          <div
            className="mt-1.5 text-[10px] uppercase tracking-[0.2em]"
            style={{ ...uiFont, color: "rgba(10,10,10,0.42)" }}
          >
            um só sistema
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {NODES.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-2 rounded-[10px] border bg-white px-3 py-2.5"
              style={{ borderColor: TOKENS.hair, boxShadow: CARD_SHADOW_ON, ...uiFont }}
            >
              <n.AfterIcon className="h-[14px] w-[14px]" strokeWidth={1.5} />
              <span className="text-[12px]" style={{ color: TOKENS.ink }}>
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
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ["start 70%", "end 90%"],
  });

  return (
    <>
      {/* Desktop: trilho de scroll + palco sticky */}
      <div ref={railRef} className="relative hidden lg:block" style={{ height: "115vh" }}>
        <div className="sticky top-[22vh]">
          <Stage p={reduce ? null : scrollYProgress} scrollDriven={!reduce} />
        </div>
      </div>

      <MobileFrames />
    </>
  );
}
