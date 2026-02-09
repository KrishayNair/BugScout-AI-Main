"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import { HeadingPlayfair } from "@/components/HeadingPlayfair";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { HiddenBugs } from "@/components/HiddenBugs";
import { Tooltip } from "@/components/Tooltip";

const smoothEase = [0.16, 1, 0.3, 1] as const;
const fadeInUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, ease: smoothEase },
};

const stagger = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

/** Reusable on-scroll animation wrapper */
function AnimateOnScroll({
  children,
  className,
  delay = 0,
  y = 32,
  variant = "fadeUp",
  amount = 0.2,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  variant?: "fadeUp" | "fadeLeft" | "fadeRight" | "scaleIn" | "fadeIn";
  amount?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount, margin: "-50px" });

  const variants = {
    fadeUp: { initial: { opacity: 0, y }, animate: { opacity: 1, y: 0 } },
    fadeLeft: { initial: { opacity: 0, x: -60 }, animate: { opacity: 1, x: 0 } },
    fadeRight: { initial: { opacity: 0, x: 60 }, animate: { opacity: 1, x: 0 } },
    scaleIn: { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 } },
    fadeIn: { initial: { opacity: 0 }, animate: { opacity: 1 } },
  };

  const v = variants[variant];

  return (
    <motion.div
      ref={ref}
      initial={v.initial}
      animate={isInView ? v.animate : {}}
      transition={{ duration: 0.7, delay, ease: smoothEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Parallax layer - moves slower/faster than scroll */
function ParallaxLayer({
  children,
  speed = 0.5,
  className,
}: {
  children?: React.ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200 * speed]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

function AnimatedBackground() {
  const { scrollYProgress } = useScroll();
  const orb1Y = useTransform(scrollYProgress, [0, 0.5, 1], [0, -80, -150]);
  const orb2Y = useTransform(scrollYProgress, [0, 0.4, 0.8], [0, 60, 100]);
  const orb3Y = useTransform(scrollYProgress, [0, 0.6], [0, -120]);
  const orb1Scale = useTransform(scrollYProgress, [0, 0.3], [1, 1.15]);
  const orb2Scale = useTransform(scrollYProgress, [0.2, 0.6], [0.95, 1.2]);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-100" />
      {/* Parallax orbs - move with scroll */}
      <motion.div style={{ y: orb1Y, scale: orb1Scale }} className="absolute -left-20 -top-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-primary/30 via-primary/15 to-transparent blur-3xl animate-mesh-gradient" />
      <motion.div style={{ y: orb2Y, scale: orb2Scale }} className="absolute -right-20 top-1/3 h-[450px] w-[450px] rounded-full bg-gradient-to-bl from-primary/25 via-primary/12 to-transparent blur-3xl animate-mesh-gradient [animation-delay:-5s]" />
      <motion.div style={{ y: orb3Y, animationDelay: "-10s" }} className="absolute bottom-1/4 left-1/2 h-[350px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-t from-primary/20 via-transparent to-transparent blur-3xl animate-mesh-gradient" />
      {/* Glowing orbs */}
      <div className="absolute left-1/4 top-40 h-72 w-72 rounded-full bg-primary/25 blur-3xl animate-glow-pulse" />
      <div className="absolute right-1/3 top-80 h-56 w-56 rounded-full bg-primary/20 blur-3xl animate-glow-pulse" style={{ animationDelay: "-3s" }} />
      {/* Floating dots */}
      {[...Array(16)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-primary/50"
          style={{
            left: `${8 + (i * 5) % 85}%`,
            top: `${5 + (i * 6) % 85}%`,
          }}
          animate={{
            y: [0, -8, 0],
            x: [0, (i % 2) * 6 - 3, 0],
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{
            duration: 3 + (i % 3),
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
      {/* Grid pattern - stronger */}
      <div className="absolute inset-0 bg-grid-pattern opacity-60" />
      {/* Soft fade - don't wash out gradients */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% 20%, transparent 40%, rgba(255,255,255,0.4) 100%)",
        }}
      />
    </div>
  );
}

/** Hero illustration: Dashboard mockup with session replay + AI detection */
function HeroIllustration() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease: smoothEase }}
      className="relative mx-auto w-full max-w-2xl"
    >
      {/* Glow behind */}
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 to-primary/10 blur-2xl" />
      {/* Floating bug badge - outside overflow so fully visible */}
      <motion.div
        className="absolute right-4 top-0 z-10 -translate-y-1/2 rounded-full border-2 border-white bg-primary-darker px-3 py-1.5 text-xs font-bold text-white shadow-xl shadow-primary/30"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.4, ease: smoothEase }}
      >
        <motion.span
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block"
        >
          🐛 2 issues
        </motion.span>
      </motion.div>
      {/* Main card - browser/dashboard mockup */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 shadow-2xl shadow-gray-300/50 backdrop-blur-xl">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-gray-200/80 bg-gray-50/80 px-4 py-3">
          <div className="flex gap-1.5">
            {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => (
              <motion.div
                key={i}
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: c }}
                whileHover={{ scale: 1.2 }}
              />
            ))}
          </div>
          <div className="flex-1 rounded-lg border border-gray-200/60 bg-white px-4 py-2 text-center text-xs text-gray-400">
            app.example.com/session/abc123
          </div>
        </div>
        {/* Content area */}
        <div className="relative flex gap-4 p-6">
          {/* Left: Session replay preview */}
          <div className="flex-1 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-100/80">
            <div className="relative aspect-video overflow-hidden bg-white">
              {/* Realistic mock app background - simulates recorded session replay */}
              <div className="absolute inset-0 flex">
                {/* Sidebar */}
                <div className="w-16 shrink-0 border-r border-gray-200 bg-gray-50/90 py-4">
                  <div className="flex flex-col items-center gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-7 w-7 rounded-lg bg-gray-200/80" />
                    ))}
                  </div>
                </div>
                {/* Main content */}
                <div className="min-w-0 flex-1">
                  {/* Navbar */}
                  <div className="flex h-10 items-center justify-between border-b border-gray-200 bg-white px-4">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-20 rounded bg-gray-300/80" />
                      <div className="hidden h-3 w-14 rounded bg-gray-200/60 sm:block" />
                      <div className="hidden h-3 w-12 rounded bg-gray-200/60 sm:block" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-gray-300/80" />
                      <div className="h-6 w-24 rounded bg-gray-200/60" />
                    </div>
                  </div>
                  {/* Page content */}
                  <div className="p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="h-5 w-32 rounded bg-gray-300/70" />
                      <div className="h-8 w-24 rounded-lg bg-primary/20" />
                    </div>
                    {/* Stats row */}
                    <div className="mb-4 flex gap-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex-1 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                          <div className="mb-2 h-3 w-16 rounded bg-gray-200/70" />
                          <div className="h-5 w-12 rounded bg-gray-300/70" />
                        </div>
                      ))}
                    </div>
                    {/* Table / list area */}
                    <div className="rounded-lg border border-gray-200 bg-white">
                      <div className="flex gap-2 border-b border-gray-200 px-3 py-2">
                        <div className="h-3 w-20 rounded bg-gray-200/70" />
                        <div className="h-3 w-24 rounded bg-gray-200/60" />
                        <div className="h-3 w-16 rounded bg-gray-200/60" />
                      </div>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-0">
                          <div className="h-4 w-4 rounded bg-gray-200/60" />
                          <div className="h-3 flex-1 rounded bg-gray-200/50" />
                          <div className="h-3 w-16 rounded bg-gray-200/40" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Play button overlay */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <div className="ml-1 h-0 w-0 border-y-8 border-l-[14px] border-y-transparent border-l-primary" />
                </div>
              </motion.div>
              {/* Subtle scan line */}
              <div className="absolute inset-0 overflow-hidden opacity-20">
                <motion.div
                  className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
                  animate={{ y: [0, 200] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              {/* Rage click indicator - critical error */}
              <motion.div
                className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border border-primary-dark/20 bg-primary-darker/90 px-3 py-1.5 text-xs font-semibold text-white shadow-md"
                animate={{ opacity: [0.9, 1, 0.9], scale: [1, 1.02, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
                😤 Rage click
              </motion.div>
              {/* Dead click indicator - warning on button */}
              <motion.div
                className="absolute bottom-14 left-1/3 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/90 px-3 py-1.5 text-xs font-semibold text-white shadow-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <span className="h-2 w-2 rounded-full bg-white/80" />
                👻 Dead click
              </motion.div>
            </div>
            <div className="border-t border-gray-200/60 bg-white/80 px-3 py-2 text-xs font-medium text-gray-600">
              Session replay · 2:34
            </div>
          </div>
          {/* Right: AI analysis panel */}
          <div className="w-52 space-y-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                  <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-gray-900">AI detected issues</span>
              </div>
              <p className="mt-2 text-[10px] text-gray-600">3 errors found</p>
            </div>
            <div className="space-y-2">
              {[
                { label: "Rage click", severity: "Critical", icon: "😤" },
                { label: "Dead click", severity: "Warning", icon: "👻" },
                { label: "Console error", severity: "Error", icon: "⚠" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                  className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-white px-3 py-2 text-[11px] font-medium text-gray-700"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span className="flex-1">{item.icon} {item.label}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    {item.severity}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const stepVariants = {
  fadeUp: { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 } },
  fadeLeft: { initial: { opacity: 0, x: -48 }, animate: { opacity: 1, x: 0 } },
  fadeRight: { initial: { opacity: 0, x: 48 }, animate: { opacity: 1, x: 0 } },
  scaleIn: { initial: { opacity: 0, scale: 0.92 }, animate: { opacity: 1, scale: 1 } },
};

function StepCard({
  step,
  title,
  description,
  icon,
  children,
  delay = 0,
  variant = "fadeUp",
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  delay?: number;
  variant?: keyof typeof stepVariants;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2, margin: "-60px" });
  const v = stepVariants[variant];

  return (
    <motion.div
      ref={ref}
      initial={v.initial}
      animate={isInView ? v.animate : v.initial}
      transition={{ duration: 0.7, delay, ease: smoothEase }}
      className="group relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white/80 p-8 shadow-xl shadow-gray-200/50 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div className="absolute -right-8 -top-8 text-8xl font-bold text-primary/5">{step}</div>
      <div className="relative">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-lg shadow-primary/30 transition-transform duration-300 group-hover:scale-110">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
        <p className="mt-3 text-gray-600">{description}</p>
        {children && <div className="mt-6">{children}</div>}
      </div>
    </motion.div>
  );
}

/** Blinking arrow between step cards to show progression */
function StepArrow({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="flex shrink-0 items-center justify-center"
      aria-hidden
    >
      <motion.div
        className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 text-primary"
        animate={{
          opacity: [0.6, 1, 0.6],
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </motion.div>
    </motion.div>
  );
}

function FeatureBadge({
  icon,
  label,
  tooltip,
}: {
  icon: string;
  label: string;
  tooltip?: string;
}) {
  const badge = (
    <span className="inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/60 px-4 py-2 text-sm font-medium text-gray-700 backdrop-blur-sm transition-colors hover:border-primary/30 hover:text-primary">
      <span>{icon}</span>
      {label}
    </span>
  );
  return tooltip ? (
    <Tooltip content={tooltip} side="top">
      {badge}
    </Tooltip>
  ) : (
    badge
  );
}


export default function HomePage() {
  const heroRef = useRef(null);
  const stepsRef = useRef(null);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gray-50/80">
      <AnimatedBackground />
      <HiddenBugs />

      {/* Nav */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="fixed left-0 right-0 top-0 z-50 border-b border-gray-200/50 bg-white/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo href="/" size="md" />
          <div className="flex items-center gap-8">
            <Link href="/#features" className="text-sm font-medium text-gray-600 transition-all duration-200 hover:text-gray-900">
              Features
            </Link>
            <Link href="/#how-it-works" className="text-sm font-medium text-gray-600 transition-all duration-200 hover:text-gray-900">
              How it works
            </Link>
            <SignedOut>
              <Link href="/sign-in" className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900">
                Login
              </Link>
              <Link
                href="/sign-up"
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark hover:shadow-primary/30"
              >
                Get started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark"
              >
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </motion.nav>

      <main className="relative z-10">
        {/* Hero - UXBoost style: centered headline + Playfair first line */}
        <section ref={heroRef} className="relative min-h-[88vh] overflow-x-hidden pt-28 pb-20 sm:pt-36 sm:pb-28 lg:min-h-[82vh]">
          {/* 3D-style floating decorative elements */}
          <ParallaxLayer speed={-0.3} className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute -left-16 top-1/3 h-72 w-72 rounded-full bg-gradient-to-br from-primary/25 via-primary/15 to-transparent blur-2xl"
              animate={{ scale: [1, 1.1, 1], rotate: [0, 10, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -right-16 top-1/4 h-96 w-96 rounded-full bg-gradient-to-bl from-primary/20 via-primary/10 to-transparent blur-2xl"
              animate={{ scale: [1.05, 1, 1.05], rotate: [0, -15, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute bottom-1/4 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-2xl"
              animate={{ y: [0, -20, 0], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
          </ParallaxLayer>
          {/* Subtle dot grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(rgba(0,102,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
              {/* Left: Copy - UXBoost centered/left layout */}
              <motion.div
                variants={stagger}
                initial="initial"
                animate="animate"
                className="text-center lg:text-left"
              >
                <motion.div variants={fadeInUp} className="mb-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    AI-powered bug detection
                  </span>
                  <span className="text-sm text-gray-500">★★★★★ 1,743+ developers</span>
                </motion.div>
                <motion.div variants={fadeInUp}>
                  <HeadingPlayfair
                    firstLine="See every bug"
                    secondLine="your users experience"
                    as="h1"
                    size="2xl"
                    className="text-center lg:text-left"
                  />
                </motion.div>
                <motion.p variants={fadeInUp} className="mx-auto mt-6 max-w-xl text-center text-lg text-gray-600 sm:text-xl lg:mx-0 lg:text-left">
                  Our cutting-edge AI watches your session replays to detect bugs,{" "}
                  <Tooltip content="Rapid repeated clicks—user frustration signal" side="bottom">
                    <span className="cursor-help border-b border-dashed border-gray-400/60 transition-colors hover:border-primary/60 hover:text-primary">
                      rage clicks
                    </span>
                  </Tooltip>
                  , and{" "}
                  <Tooltip content="Clicks on non-interactive elements—broken UI" side="bottom">
                    <span className="cursor-help border-b border-dashed border-gray-400/60 transition-colors hover:border-primary/60 hover:text-primary">
                      dead clicks
                    </span>
                  </Tooltip>
                  —so you fix issues before users complain.
                </motion.p>
                <motion.div variants={fadeInUp} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:gap-6 lg:justify-start">
                  <SignedOut>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                      <Link
                        href="/sign-up"
                        className="group relative block w-full overflow-hidden rounded-xl bg-gray-900 px-8 py-4 text-center text-base font-semibold text-white shadow-xl transition-all hover:bg-gray-800 sm:w-auto"
                      >
                        <span className="relative z-10">Get Started Now</span>
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                      </Link>
                    </motion.div>
                  </SignedOut>
                  <SignedIn>
                    <Link
                      href="/dashboard"
                      className="w-full rounded-xl bg-gray-900 px-8 py-4 text-center text-base font-semibold text-white shadow-xl transition-all hover:bg-gray-800 sm:w-auto"
                    >
                      Go to Dashboard
                    </Link>
                  </SignedIn>
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
                    <Link
                      href="/#how-it-works"
                      className="block w-full rounded-xl border border-gray-300 bg-white px-8 py-4 text-center text-base font-semibold text-gray-700 transition-all hover:border-primary/50 hover:text-primary sm:w-auto"
                    >
                      See how it works
                    </Link>
                  </motion.div>
                </motion.div>
              </motion.div>
              {/* Right: Hero illustration with parallax */}
              <ParallaxLayer speed={0.15} className="relative order-first flex items-center justify-center overflow-visible lg:order-last lg:justify-center">
                <div className="w-full max-w-xl lg:max-w-2xl">
                  <HeroIllustration />
                </div>
              </ParallaxLayer>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" ref={stepsRef} className="relative overflow-hidden py-24 sm:py-32">
          {/* Decorative filled and border circles - left/right alternating */}
          <div className="pointer-events-none absolute -left-16 top-1/4 h-40 w-40 rounded-full border-2 border-primary/15" />
          <div className="pointer-events-none absolute -right-20 top-1/2 h-24 w-24 rounded-full bg-primary/10" />
          <div className="pointer-events-none absolute -left-8 bottom-1/3 h-20 w-20 rounded-full bg-primary/10" />
          <div className="pointer-events-none absolute -right-12 bottom-1/4 h-32 w-32 rounded-full border-2 border-primary/12" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll className="mx-auto max-w-2xl text-center" variant="scaleIn" y={0}>
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">How it works</span>
              <HeadingPlayfair
                firstLine="Three simple steps"
                secondLine="to bug-free releases"
                as="h2"
                size="md"
                className="mx-auto mt-4"
              />
              <p className="mt-4 text-lg text-gray-600">
                From integration to actionable alerts—bugScoutAI automates the entire workflow.
              </p>
            </AnimateOnScroll>

            <div className="mt-16 flex flex-col items-stretch gap-8 md:flex-row md:items-center md:justify-center md:gap-4 lg:gap-6">
              <div className="min-w-0 flex-1">
                <StepCard
                step={1}
                variant="fadeLeft"
                title="Connect PostHog"
                description="Integrate bugScoutAI with your PostHog project in under 2 minutes. We pull session recordings and event data automatically—no code changes needed."
                delay={0}
                icon={
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                }
              >
                <div className="flex flex-wrap gap-2">
                  <FeatureBadge icon="📊" label="Session recordings" tooltip="Watch what users did before a bug occurred" />
                  <FeatureBadge icon="⚡" label="Event streams" tooltip="Real-time event data from your app" />
                </div>
              </StepCard>
              </div>

              <StepArrow />

              <div className="min-w-0 flex-1">
                <StepCard
                step={2}
                variant="scaleIn"
                title="AI detects issues"
                description="Our AI watches every session replay and identifies rage clicks, dead clicks, console errors, and UX friction—all automatically surfaced in your dashboard."
                delay={0.1}
                icon={
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                }
              >
                <div className="flex flex-wrap gap-2">
                  <FeatureBadge icon="😤" label="Rage clicks" />
                  <FeatureBadge icon="👻" label="Dead clicks" />
                  <FeatureBadge icon="🐛" label="Console errors" />
                </div>
              </StepCard>
              </div>

              <StepArrow delay={0.9} />

              <div className="min-w-0 flex-1">
                <StepCard
                  step={3}
                  variant="fadeRight"
                title="Get alerted"
                description="Receive instant alerts via Email and Slack when bugs are detected. Each issue includes AI-suggested fixes and code locations—so your team ships faster."
                delay={0.2}
                icon={
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                }
              >
                <div className="flex flex-wrap gap-2">
                  <FeatureBadge icon="📧" label="Email" tooltip="Instant alerts delivered to your inbox" />
                  <FeatureBadge icon="💬" label="Slack" tooltip="Notify your team in Slack channels" />
                  <FeatureBadge icon="🤖" label="AI fixes" tooltip="AI-suggested fixes and code locations" />
                </div>
              </StepCard>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section id="features" className="relative overflow-hidden py-24 sm:py-32">
          {/* Decorative filled and border circles - left/right alternating */}
          <div className="pointer-events-none absolute -left-12 top-1/4 h-28 w-28 rounded-full bg-primary/10" />
          <div className="pointer-events-none absolute -right-16 top-1/3 h-36 w-36 rounded-full border-2 border-primary/15" />
          <div className="pointer-events-none absolute -left-8 bottom-1/4 h-20 w-20 rounded-full border-2 border-primary/12" />
          <div className="pointer-events-none absolute -right-10 bottom-1/3 h-24 w-24 rounded-full bg-primary/10" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll className="mx-auto max-w-4xl text-center" variant="fadeUp" y={24}>
              <span className="text-sm font-semibold uppercase tracking-wider text-primary">Features</span>
              <HeadingPlayfair
                firstLine="Automatically watches your sessions"
                secondLine="alerts you when users hit bugs"
                as="h2"
                size="md"
                className="mx-auto mt-4"
              />
              <p className="mt-4 text-lg text-gray-600">
                You&apos;re recording thousands of sessions but nobody&apos;s watching them. bugScout Ai does. Catching silent issues breaking your product that you&apos;d otherwise never know about.
              </p>
            </AnimateOnScroll>

            {/* Bento grid - varied rectangles, relevant images, complete rectangle */}
            <motion.div
              initial="initial"
              animate="animate"
              variants={stagger}
              transition={{ staggerChildren: 0.08, delayChildren: 0.05 }}
              className="mt-16 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-4"
            >
              {/* 1. Bug overview - rectangular, metrics */}
              <motion.div
                variants={fadeInUp}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5"
              >
                <h3 className="font-semibold text-gray-900">Bug overview</h3>
                <p className="mt-1 text-sm text-gray-600">Our analysis covers key metrics to help you identify areas for improvement.</p>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Session health</span>
                    <span className="rounded-full bg-green-500/90 px-2.5 py-0.5 text-xs font-semibold text-white">GOOD</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">87%</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Alerts</span>
                    <span className="rounded-full bg-amber-500/90 px-2.5 py-0.5 text-xs font-semibold text-white">ATTENTION</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">52%</div>
                </div>
                <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-block h-4 w-4 rounded bg-primary/10 p-1">
                    <svg className="h-full w-full text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  QR code for requesting funds is valid for only 1 minute.
                </p>
              </motion.div>

              {/* 2. AI analysis - wider, bar chart visual */}
              <motion.div
                variants={fadeInUp}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 sm:col-span-2"
              >
                <h3 className="font-semibold text-gray-900">AI analysis</h3>
                <p className="mt-1 text-sm text-gray-600">Gain insights into how bugScout detects rage clicks, dead clicks, and UX friction.</p>
                <div className="mt-4 flex gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10" />
                  ))}
                </div>
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Rage clicks", value: 95, color: "bg-primary" },
                    { label: "Dead clicks", value: 47, color: "bg-gray-800" },
                    { label: "Console errors", value: 24, color: "bg-gray-300" },
                    { label: "UX friction", value: 18, color: "bg-gray-200" },
                    { label: "Silent failures", value: 11, color: "bg-gray-200" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-24 shrink-0 text-xs text-gray-600">{item.label}</div>
                      <div className="h-6 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-medium text-gray-700">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* 3. Advanced analytics - tall, radar + donut, filled with data */}
              <motion.div
                variants={fadeInUp}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 lg:row-span-2"
              >
                <h3 className="font-semibold text-gray-900">Advanced analytics</h3>
                <p className="mt-1 text-sm text-gray-600">Harness extensive data analysis to drive UX improvements.</p>
                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="relative h-28 w-28 shrink-0">
                    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle cx="50" cy="50" r="40" fill="none" stroke="url(#donut)" strokeWidth="8" strokeDasharray="120 132" strokeLinecap="round" />
                      <defs><linearGradient id="donut" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0066ff" /><stop offset="100%" stopColor="#3385ff" /></linearGradient></defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-gray-900">826</span>
                      <span className="text-[10px] text-gray-500">Sessions</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                      <span className="text-xs text-gray-700">Resolved</span>
                      <span className="text-sm font-semibold text-primary">48%</span>
                    </div>
                    <div className="text-xs text-gray-500">396 sessions</div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-gray-600"><span>Rage clicks</span><span>78%</span></div>
                      <div className="flex justify-between text-[10px] text-gray-600"><span>Dead clicks</span><span>67%</span></div>
                      <div className="flex justify-between text-[10px] text-gray-600"><span>Clarity</span><span>46%</span></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-2">
                  <svg viewBox="0 0 100 100" className="h-16 w-16">
                    <polygon points="50,10 61,35 88,35 67,52 73,78 50,63 27,78 33,52 12,35 39,35" fill="none" stroke="#0066ff" strokeWidth="2" opacity="0.3" />
                    <polygon points="50,25 56,42 74,42 60,52 65,68 50,58 35,68 40,52 26,42 44,42" fill="rgba(0,102,255,0.2)" stroke="#0066ff" strokeWidth="1.5" />
                  </svg>
                  <span className="text-[10px] font-medium text-gray-500">UX score by metric</span>
                </div>
                <div className="mt-4 space-y-2 rounded-lg border border-gray-100 bg-gray-50/80 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Bugs this week</span>
                    <span className="font-semibold text-gray-900">23</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Avg. resolution</span>
                    <span className="font-semibold text-gray-900">2.4 hrs</span>
                  </div>
                </div>
              </motion.div>

              {/* 4. Flow insights - square, green bg, 3D graphic */}
              <motion.div
                variants={fadeInUp}
                className="relative overflow-hidden rounded-2xl bg-primary p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-primary/20"
              >
                <h3 className="font-semibold text-white">Flow insights</h3>
                <p className="mt-1 text-sm text-white/90">Understand the efficiency of user flows within your platform.</p>
                <div className="relative mt-6 flex h-32 items-center justify-center">
                  <div className="absolute h-24 w-24 rounded-full bg-white/20 blur-xl" />
                  <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-white/40 to-white/10" />
                  <div className="absolute bottom-2 right-4">
                    <svg className="h-6 w-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                  </div>
                </div>
              </motion.div>

              {/* 5. Insights history - wider, table */}
              <motion.div
                variants={fadeInUp}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 sm:col-span-2"
              >
                <h3 className="font-semibold text-gray-900">Insights history</h3>
                <p className="mt-1 text-sm text-gray-600">Track the progress of implemented changes and their impact.</p>
                <div className="mt-4 overflow-hidden rounded-xl border border-gray-200/80">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/80 bg-gray-50/80">
                        <th className="px-3 py-2 font-medium text-gray-700">Screen</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Insight</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Status</th>
                        <th className="px-3 py-2 font-medium text-gray-700">Boost</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-900">Login Page</td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">Missing Remember Me checkbox increases friction</td>
                        <td className="px-3 py-2"><span className="rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-semibold text-white">Resolved</span></td>
                        <td className="px-3 py-2 font-medium text-green-600">+02%</td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-900">Account Overview</td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">Too many contrasting colors create cognitive load</td>
                        <td className="px-3 py-2"><span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-white">In Progress</span></td>
                        <td className="px-3 py-2 font-medium text-amber-600">+08%</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-gray-900">Funds Transfer</td>
                        <td className="max-w-[140px] truncate px-3 py-2 text-gray-600">Submit button placement not intuitive</td>
                        <td className="px-3 py-2"><span className="rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-semibold text-white">Resolved</span></td>
                        <td className="px-3 py-2 font-medium text-green-600">+02%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* 6. AI reports - full width bottom row, filled with data */}
              <motion.div
                variants={fadeInUp}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm transition-all hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 sm:col-span-2 lg:col-span-4"
              >
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">AI reports</h3>
                    <p className="mt-1 text-sm text-gray-600">Receive AI-generated reports with actionable recommendations.</p>
                    <div className="mt-4 flex gap-4">
                      <div className="rounded-lg bg-primary/5 px-4 py-2">
                        <span className="text-2xl font-bold text-primary">12</span>
                        <span className="ml-1 text-xs text-gray-600">reports this week</span>
                      </div>
                      <div className="rounded-lg bg-gray-50 px-4 py-2">
                        <span className="text-2xl font-bold text-gray-900">8</span>
                        <span className="ml-1 text-xs text-gray-600">actionable</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-wrap justify-center gap-8 sm:justify-end lg:gap-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-primary bg-primary/5">
                        <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      </div>
                      <span className="text-center text-xs font-medium text-gray-700">Session replay</span>
                      <span className="text-[10px] text-gray-500">5 reports</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50">
                        <svg className="h-7 w-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                      </div>
                      <span className="text-center text-xs font-medium text-gray-600">Task flow</span>
                      <span className="text-[10px] text-gray-500">4 reports</span>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-14 w-14 items-center justify-center rounded-xl border-2 border-gray-200 bg-gray-50">
                        <svg className="h-7 w-7 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                      </div>
                      <span className="text-center text-xs font-medium text-gray-600">User journey</span>
                      <span className="text-[10px] text-gray-500">3 reports</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <p className="truncate text-xs font-medium text-gray-900">Login flow rage clicks</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">Generated 2 hrs ago</p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3">
                    <p className="truncate text-xs font-medium text-gray-900">Checkout dead zone</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">Generated 5 hrs ago</p>
                  </div>
                  <div className="rounded-lg border border-gray-100 bg-gray-50/80 px-4 py-3 sm:col-span-2 lg:col-span-1">
                    <p className="truncate text-xs font-medium text-gray-900">Weekly UX summary</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">Generated yesterday</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Session path analysis - Flow insights dashboard + heading + image */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="pointer-events-none absolute -left-16 top-1/3 h-32 w-32 rounded-full border-2 border-primary/15" />
          <div className="pointer-events-none absolute -right-12 top-1/4 h-20 w-20 rounded-full bg-primary/10" />
          <div className="pointer-events-none absolute -left-10 bottom-1/4 h-24 w-24 rounded-full bg-primary/10" />
          <div className="pointer-events-none absolute -right-16 bottom-1/3 h-36 w-36 rounded-full border-2 border-primary/12" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
              {/* Left: Flow insights dashboard + feature descriptions */}
              <div>
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6 }}
                  className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xl shadow-gray-200/50"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Flow insights</h3>
                    <div className="flex gap-2">
                      <button type="button" className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Add">+</button>
                      <button type="button" className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Expand">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {/* Session flow */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Session flow</span>
                        <span className="rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-semibold text-white">GOOD</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">87%</div>
                      <div className="text-xs text-gray-500">Screens: 12</div>
                      <div className="mt-2 flex gap-1">
                        <div className="h-8 flex-1 rounded bg-green-500/20 px-2 py-1 text-center text-xs font-medium text-green-700">91%</div>
                        <div className="h-8 flex-1 rounded bg-green-500/20 px-2 py-1 text-center text-xs font-medium text-green-700">82%</div>
                        <div className="h-8 flex-1 rounded bg-green-500/20 px-2 py-1 text-center text-xs font-medium text-green-700">79%</div>
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600">✓</span>
                        All sessions recorded. No rage clicks detected.
                      </p>
                    </div>
                    {/* Bug detection flow */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Bug detection flow</span>
                        <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-semibold text-white">ATTENTION</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">52%</div>
                      <div className="text-xs text-gray-500">Screens: 8</div>
                      <div className="mt-2 flex gap-1">
                        <div className="h-8 flex-1 rounded bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-600">67%</div>
                        <div className="relative h-8 flex-1 rounded bg-amber-100 px-2 py-1 text-center text-xs font-medium text-amber-700">51%</div>
                        <div className="h-8 flex-1 rounded bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-600">59%</div>
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-600">!</span>
                        Rage clicks detected on checkout. Review session replay.
                      </p>
                    </div>
                    {/* Replay flow */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Replay flow</span>
                        <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-xs font-semibold text-white">NORMAL</span>
                      </div>
                      <div className="text-2xl font-bold text-gray-900">72%</div>
                      <div className="text-xs text-gray-500">Screens: 13</div>
                      <div className="mt-2 flex gap-1">
                        <div className="h-8 flex-1 rounded bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-600">73%</div>
                        <div className="relative h-8 flex-1 rounded bg-amber-100 px-2 py-1 text-center text-xs font-medium text-amber-700">62%</div>
                        <div className="h-8 flex-1 rounded bg-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-600">68%</div>
                      </div>
                      <p className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary">○</span>
                        Dead click on non-button. AI suggested fix available.
                      </p>
                    </div>
                  </div>
                </motion.div>
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex gap-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5">
                      <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <p className="text-sm text-gray-600">bugScout analyzes each session independently, identifying rage clicks, dead clicks, and silent UX issues.</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex gap-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50">
                      <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    </div>
                    <p className="text-sm text-gray-600">Receive actionable recommendations to fix bugs based on session replay analysis and AI insights.</p>
                  </motion.div>
                </div>
              </div>
              {/* Right: Heading + image */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center lg:items-end"
              >
                <HeadingPlayfair
                  firstLine="Session path"
                  secondLine="analysis"
                  as="h2"
                  size="lg"
                  className="text-center lg:text-right"
                />
                <div className="mt-8 overflow-hidden rounded-2xl bg-gray-100 shadow-xl">
                  <img
                    src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=500&h=400&fit=crop"
                    alt="Developer reviewing session replays"
                    className="h-72 w-full object-cover sm:h-80 lg:h-96"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA - UXBoost style: accent background section with Playfair heading */}
        <section id="contact" className="relative overflow-hidden py-24 sm:py-32">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.75, ease: smoothEase }}
            className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-primary px-8 py-20 text-center sm:px-16 sm:py-24"
          >
            {/* Decorative filled and border circles - left and right alternating */}
            {/* Left: large border circle + smaller filled circle */}
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full border-2 border-white/25" />
            <div className="pointer-events-none absolute -left-10 bottom-1/4 h-24 w-24 rounded-full bg-white/15" />
            {/* Right: large border circle + smaller filled circle */}
            <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full border-2 border-white/25" />
            <div className="pointer-events-none absolute -right-8 top-1/4 h-20 w-20 rounded-full bg-white/15" />
            {/* Top-right: small filled circle */}
            <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-white/12" />
            {/* Top-left: small border circle */}
            <div className="pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full border-2 border-white/20" />
            <div className="relative z-10">
              <h2 className="font-playfair text-3xl font-bold italic text-white sm:text-4xl lg:text-5xl">
                Ready to catch every bug your users hit?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-white/90">
                bugScout watches your session replays and alerts you when rage clicks, dead clicks, or UX issues surface. Fix issues before users complain.
              </p>
              <div className="mt-8">
                <SignedOut>
                  <Link
                    href="/sign-up"
                    className="inline-flex rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary shadow-xl transition-all hover:bg-gray-100"
                  >
                    Get Started Now
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className="inline-flex rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary shadow-xl transition-all hover:bg-gray-100"
                  >
                    Go to Dashboard
                  </Link>
                </SignedIn>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer - full-width dark bar, logo left, nav center, social right, large Playfair heading */}
        <footer className="relative z-10 pb-0 pt-12">
          <div className="w-full overflow-hidden rounded-t-[2rem] bg-[#1A1E24] px-6 py-6 sm:px-12 sm:py-8">
            {/* Nav row: logo left, links center, social right */}
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <Logo href="/" size="md" variant="light" />
              <nav className="flex items-center justify-center gap-10">
                <Link href="/#features" className="text-sm font-medium text-white transition-colors hover:text-white/90">
                  Features
                </Link>
                <Link href="/#how-it-works" className="text-sm font-medium text-white transition-colors hover:text-white/90">
                  How it works
                </Link>
                <Link href="/#contact" className="text-sm font-medium text-white transition-colors hover:text-white/90">
                  Contact
                </Link>
              </nav>
              <div className="flex items-center gap-8">
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-white/80" aria-label="X (Twitter)">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                </a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-white/80" aria-label="Facebook">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-white/80" aria-label="Instagram">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                </a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-white transition-colors hover:text-white/80" aria-label="GitHub">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                </a>
              </div>
            </div>
            {/* Large Playfair heading below nav */}
            <div className="mt-8 flex justify-center sm:mt-12">
              <span className="font-playfair text-5xl font-bold italic text-white sm:text-6xl md:text-7xl lg:text-8xl">
                bugScout Ai
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
