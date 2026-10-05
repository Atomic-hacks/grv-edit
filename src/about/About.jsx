import React from "react";
import { motion as Motion } from "framer-motion";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";

const reveal = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

const ease = [0.22, 1, 0.36, 1];

const values = [
  {
    title: "Quality over volume",
    body: "Fewer pieces, chosen carefully — not a new drop every week.",
  },
  {
    title: "Fair pricing",
    body: "No markup just for the sake of it.",
  },
  {
    title: "Real materials",
    body: "Nothing that falls apart by the third wash.",
  },
  {
    title: "Built for Lagos",
    body: "And wherever GRV travels next.",
  },
];

const About = () => (
  <main className="min-h-screen w-full bg-white text-black">
    {/* Hero */}
    <Motion.section
      initial="hidden"
      animate="visible"
      transition={{ duration: 1, ease }}
      variants={reveal}
      className="relative flex min-h-[85vh] w-full items-end overflow-hidden bg-black"
    >
      <div
        className="absolute inset-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: "url('/img/heromodel.jpg')" }}
      />
      <div className="relative z-10 w-full px-6 pb-16 md:px-12 md:pb-24">
        <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/70">
          About
        </p>
        <AnimatedPageTitle
          title="Built on the details."
          className="mt-6 max-w-4xl text-4xl font-light uppercase leading-[1.05] tracking-[0.08em] text-white md:text-7xl"
        />
      </div>
    </Motion.section>

    {/* Story */}
    <Motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
      variants={reveal}
      className="px-6 py-28 md:px-12 md:py-40"
    >
      <div className="mx-auto max-w-2xl space-y-10 text-center">
        <p className="text-xl font-light leading-relaxed md:text-2xl">
          GRV started with a simple frustration: too much of what's sold as
          fashion in Lagos was either priced for export markets or built to be
          disposable.
        </p>
        <p className="text-sm leading-8 tracking-wide text-gray-500">
          We wanted something in between — pieces with real intention behind
          them, at prices that make sense for the people actually wearing them.
          Every collection is chosen the same way: for the cut, the material,
          and whether it earns a place in a wardrobe beyond one season.
        </p>
        <p className="text-sm leading-8 tracking-wide text-gray-500">
          GRV is still early. What we want people to feel when they shop with us
          is simple — that someone paid attention before it reached them.
        </p>
      </div>
    </Motion.section>

    {/* Values */}
    <Motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
      variants={reveal}
      className="px-6 pb-28 md:px-12 md:pb-40"
    >
      <div className="mx-auto max-w-4xl border-t border-black">
        {values.map((v) => (
          <div
            key={v.title}
            className="grid gap-2 border-b border-gray-200 py-8 md:grid-cols-2 md:gap-12"
          >
            <p className="text-xs font-medium uppercase tracking-[0.3em]">
              {v.title}
            </p>
            <p className="text-sm leading-7 text-gray-500">{v.body}</p>
          </div>
        ))}
      </div>
    </Motion.section>
  </main>
);

export default About;
