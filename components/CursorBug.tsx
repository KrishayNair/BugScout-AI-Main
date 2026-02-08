"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DOT_SIZE = 8;
const FOLLOW_SPEED = 0.08;
const CATCH_INTERVAL_MS = 10000; // 10 sec - time-based
const CATCH_THRESHOLD = 400; // px movement - backup trigger
const CAUGHT_DURATION_MS = 400;

type BugState = "following" | "caught";

export function CursorBug() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<BugState>("following");
  const [caughtPos, setCaughtPos] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({ x: -100, y: -100 });
  const bugRef = useRef({ x: -100, y: -100 });
  const bugElRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>();
  const lastMouseRef = useRef({ x: -100, y: -100 });
  const totalDistRef = useRef(0);
  const followStartRef = useRef<number>(0);
  const catchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    followStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const handleMove = (e: MouseEvent) => {
      const pos = { x: e.clientX, y: e.clientY };
      mouseRef.current = pos;
      if (bugRef.current.x < 0) {
        bugRef.current = { ...pos };
        if (bugElRef.current) {
          bugElRef.current.style.left = `${pos.x - DOT_SIZE / 2}px`;
          bugElRef.current.style.top = `${pos.y - DOT_SIZE / 2}px`;
        }
        lastMouseRef.current = { ...pos };
      }
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [mounted]);

  const triggerCatch = () => {
    setCaughtPos({ ...bugRef.current });
    setState("caught");
  };

  useEffect(() => {
    if (!mounted || state !== "following") return;

    // Time-based catch - reliable
    catchTimerRef.current = setTimeout(triggerCatch, CATCH_INTERVAL_MS);
    return () => {
      if (catchTimerRef.current) clearTimeout(catchTimerRef.current);
    };
  }, [mounted, state]);

  useEffect(() => {
    if (!mounted) return;

    const animate = () => {
      const mouse = mouseRef.current;
      const bug = bugRef.current;

      if (state === "following") {
        const dx = mouse.x - bug.x;
        const dy = mouse.y - bug.y;
        const next = {
          x: bug.x + dx * FOLLOW_SPEED,
          y: bug.y + dy * FOLLOW_SPEED,
        };
        bugRef.current = next;
        if (bugElRef.current) {
          bugElRef.current.style.left = `${next.x - DOT_SIZE / 2}px`;
          bugElRef.current.style.top = `${next.y - DOT_SIZE / 2}px`;
        }

        // Movement-based backup trigger
        const dist = Math.hypot(mouse.x - lastMouseRef.current.x, mouse.y - lastMouseRef.current.y);
        if (dist > 1) totalDistRef.current += dist;
        lastMouseRef.current = { ...mouse };

        if (totalDistRef.current > CATCH_THRESHOLD && catchTimerRef.current) {
          clearTimeout(catchTimerRef.current);
          catchTimerRef.current = null;
          triggerCatch();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, state]);

  useEffect(() => {
    if (state !== "caught") return;
    const t = setTimeout(() => {
      hasTriggeredRef.current = false;
      setState("following");
      totalDistRef.current = 0;
      followStartRef.current = Date.now();
    }, CAUGHT_DURATION_MS);
    return () => clearTimeout(t);
  }, [state]);

  const [isPointer, setIsPointer] = useState(true);
  useEffect(() => {
    setIsPointer(window.matchMedia("(pointer: fine)").matches);
  }, []);

  if (!mounted || !isPointer) return null;

  const bug = bugRef.current;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
      {state === "following" && (
        <div
          ref={bugElRef}
          className="absolute"
          style={{
            left: bug.x - DOT_SIZE / 2,
            top: bug.y - DOT_SIZE / 2,
            width: DOT_SIZE,
            height: DOT_SIZE,
          }}
          aria-hidden
        >
          <div
            className="h-full w-full rounded-full bg-primary"
            style={{ opacity: 0.6 }}
          />
        </div>
      )}

      <AnimatePresence>
        {state === "caught" && (
          <motion.div
            className="absolute"
            style={{
              left: caughtPos.x - 16,
              top: caughtPos.y - 16,
              width: 32,
              height: 32,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/60"
              initial={{ scale: 0.5, opacity: 0.7 }}
              animate={{
                scale: 2,
                opacity: 0,
                transition: { duration: 0.3, ease: "easeOut" },
              }}
            />
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{
                scale: 0.5,
                opacity: 0,
                transition: { duration: 0.25, ease: "easeOut" },
              }}
            >
              <div className="h-2 w-2 rounded-full bg-primary/80" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
