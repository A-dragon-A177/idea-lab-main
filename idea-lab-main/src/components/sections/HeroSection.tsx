import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";

function DashboardPreview() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-full max-w-sm animate-float-slow">
        <div
          className="bg-white border border-[#09daed]/20 p-5"
          style={{ boxShadow: "0 20px 60px rgba(9,218,237,0.1), 0 4px 20px rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
            <img src="/neesh-logo.png" alt="Neesh AI" className="w-5 h-5 object-contain" />
            <span className="text-[#09daed] text-xs font-mono tracking-widest">VALIDATION.COMMAND.CENTER</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Clarity", val: "87%", color: "#09daed" },
              { label: "Signal", val: "72%", color: "#7c3aed" },
              { label: "Gaps", val: "3", color: "#f59e0b" },
            ].map((m) => (
              <div key={m.label} className="p-2 border border-gray-100 bg-gray-50 text-center">
                <div className="text-lg font-bold" style={{ color: m.color }}>{m.val}</div>
                <div className="text-[10px] text-gray-500 font-medium">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {[
              { label: "User Clarity", val: 87, color: "#09daed" },
              { label: "Market Fit", val: 72, color: "#7c3aed" },
              { label: "Engagement", val: 91, color: "#10b981" },
            ].map((bar, i) => (
              <div key={bar.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-[10px] text-gray-600 font-medium">{bar.label}</span>
                  <span className="text-[10px] text-gray-800 font-bold">{bar.val}%</span>
                </div>
                <div className="h-1 bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.val}%` }}
                    transition={{ duration: 1.2, delay: 0.5 + i * 0.2, ease: "easeOut" }}
                    style={{ background: bar.color, height: "100%", boxShadow: `0 0 8px ${bar.color}40` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[
              { text: "Why is the onboarding confusing?", confused: true },
              { text: "Love how the chatbot explains it!", confused: false },
              { text: "What does gap detection actually do?", confused: true },
            ].map((bubble, i) => (
              <div
                key={i}
                className={`px-3 py-1.5 text-[10px] font-medium border ${
                  bubble.confused
                    ? "border-red-200 text-red-600 bg-red-50"
                    : "border-[#09daed]/20 text-[#09daed] bg-[#09daed]/5"
                }`}
              >
                {bubble.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.6], [0, -80]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-[90vh] bg-white/50 flex items-center overflow-hidden"
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(#09daed 1px, transparent 1px), linear-gradient(90deg, #09daed 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[#09daed]/5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 bg-[#09daed]/4 blur-[100px] pointer-events-none" />



      <motion.div
        style={{ opacity, y, zIndex: 10, position: "relative" }}
        className="max-w-[1440px] mx-auto px-6 pt-20 pb-12 w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — Copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#09daed]/30 bg-[#09daed]/5 mb-6"
            >
              <div className="w-1.5 h-1.5 bg-[#09daed] animate-pulse" />
              <span className="text-[#09daed] text-xs font-semibold tracking-widest uppercase">AI-Powered Validation</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="text-3xl md:text-4xl lg:text-[3rem] xl:text-[3.5rem] font-extrabold text-gray-950 leading-[1.1] tracking-tight mb-5 whitespace-nowrap"
            >
              <span className="block">Stop Building{" "}
              <span className="text-[#09daed]">in the Dark.</span></span>
              <span className="block">Start Validating{" "}
              <span className="relative inline-block">
                in Real Time.
                <div className="absolute bottom-0 left-0 w-full h-1 bg-[#09daed]" />
              </span></span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-gray-600 text-lg leading-relaxed mb-8 max-w-lg font-medium"
            >
              Upload your raw ideas, generate a live blog + chatbot, and close the gap between what you think users want and what they actually need.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.6 }}
              className="flex flex-wrap gap-3"
            >
              <Link to="/signup" className="bg-[#09daed] text-black font-bold px-7 py-3.5 text-sm hover:bg-[#07c4d4] transition-all duration-200 animate-pulse-glow inline-block text-center">
                Start Validating for Free
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="flex items-center gap-6 mt-8 pt-5 border-t border-gray-200"
            >
              {[["89%", "Clarity Gain"], ["3x", "Faster Iteration"]].map(([val, label]) => (
                <div key={label}>
                  <div className="text-2xl font-extrabold text-[#09daed]">{val}</div>
                  <div className="text-xs text-gray-500 font-medium">{label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — Dashboard */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="relative h-72 lg:h-[380px]"
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-gray-500 text-xs tracking-widest uppercase font-medium">Scroll</span>
        <div className="w-0.5 h-8 bg-gradient-to-b from-[#09daed]/60 to-transparent animate-pulse" />
      </motion.div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#09daed]/20 to-transparent" />
    </section>
  );
}
