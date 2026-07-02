import React from 'react';
import { motion } from 'motion/react';

export const GlowBackground: React.FC = () => {
  // Generate coordinates and parameters for 8 floating crosses
  const crosses = [
    { id: 1, top: '10%', left: '15%', size: 24, delay: 0, duration: 8 },
    { id: 2, top: '25%', left: '80%', size: 32, delay: 2, duration: 10 },
    { id: 3, top: '60%', left: '8%', size: 20, delay: 4, duration: 7 },
    { id: 4, top: '75%', left: '75%', size: 28, delay: 1, duration: 9 },
    { id: 5, top: '40%', left: '45%', size: 22, delay: 3, duration: 11 },
    { id: 6, top: '85%', left: '30%', size: 30, delay: 5, duration: 12 },
    { id: 7, top: '15%', left: '60%', size: 18, delay: 2, duration: 6 },
    { id: 8, top: '50%', left: '85%', size: 26, delay: 0, duration: 9 },
  ];

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#071426]">
      {/* Soft color glowing spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#0E3D75]/30 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-[#F39C3D]/10 blur-[150px]" />
      <div className="absolute top-[40%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-[#0E3D75]/20 blur-[130px]" />

      {/* Floating glowing crosses */}
      {crosses.map((cross) => (
        <motion.div
          key={cross.id}
          className="absolute text-orange-400/20 drop-shadow-[0_0_10px_rgba(243,156,61,0.3)] flex items-center justify-center"
          style={{
            top: cross.top,
            left: cross.left,
            width: cross.size,
            height: cross.size,
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0.15, 0.45, 0.15],
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: cross.duration,
            repeat: Infinity,
            delay: cross.delay,
            ease: "easeInOut",
          }}
        >
          {/* A simple cross SVG */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-full h-full"
            style={{ color: '#F39C3D' }}
          >
            <path d="M11 2h2v7h7v2h-7v11h-2v-11H4V9h7z" />
          </svg>
        </motion.div>
      ))}
    </div>
  );
};
