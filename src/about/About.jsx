import React from "react";
import { motion as Motion } from "framer-motion";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const teamMembers = [
  { id: "1", name: "Oghenefegor Ovie", role: "Founder" },
  { id: "2", name: "[Name]", role: "[Role]" },
  { id: "3", name: "[Name]", role: "[Role]" },
  { id: "4", name: "[Name]", role: "[Role]" },
];

const values = [
  {
    n: "01",
    title: "Quality over volume",
    body: "Fewer pieces, chosen carefully — not a new drop every week.",
  },
  {
    n: "02",
    title: "Fair pricing",
    body: "No markup just for the sake of it.",
  },
  {
    n: "03",
    title: "Real materials",
    body: "Nothing that falls apart by the third wash.",
  },
  { n: "04", title: "Built for Lagos", body: "And wherever GRV travels next." },
];

const About = () => (
  <main className="min-h-screen w-full bg-white text-black">
    {/* Full-bleed image hero */}
    <Motion.section
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      variants={reveal}
      className="relative flex min-h-[90vh] w-full items-center justify-center overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('[HERO_IMAGE_URL]')" }}
      />
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-10 px-4 text-center text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
          About GRV
        </p>
        <AnimatedPageTitle
          title="Built on the details."
          className="mt-6 max-w-5xl text-5xl font-semibold leading-[0.95] text-white md:text-8xl"
        />
      </div>
    </Motion.section>

    {/* Brand story - asymmetric editorial layout */}
    <Motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      variants={reveal}
      className="px-4 py-24 md:px-12 md:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-12">
        <div className="md:col-span-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">
            Our story
          </p>
          <p className="mt-4 text-6xl font-semibold leading-none text-gray-200 md:text-8xl">
            01
          </p>
        </div>
        <div className="space-y-8 md:col-span-7 md:col-start-6">
          <p className="text-2xl font-medium leading-snug text-black md:text-3xl">
            GRV started with a simple frustration: too much of what's sold as
            fashion in Lagos was either priced for export markets or built to be
            disposable.
          </p>
          <p className="max-w-xl text-base leading-8 text-gray-500">
            We wanted something in between — pieces with real intention behind
            them, at prices that make sense for the people actually wearing
            them. Every collection is chosen the same way: for the cut, the
            material, and whether it earns a place in a wardrobe beyond one
            season.
          </p>
          <p className="max-w-xl text-base leading-8 text-gray-500">
            GRV is still early. What we want people to feel when they shop with
            us is simple — that someone paid attention before it reached them.
          </p>
        </div>
      </div>
    </Motion.section>

    {/* Values - numbered grid */}
    <Motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      variants={reveal}
      className="bg-gray-50 px-4 py-24 md:px-12 md:py-32"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">
          What guides the work
        </p>
        <div className="mt-10 grid gap-x-12 gap-y-14 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.n} className="flex gap-6">
              <span className="text-sm font-semibold text-orange-500">
                {v.n}
              </span>
              <div>
                <p className="text-lg font-semibold text-black">{v.title}</p>
                <p className="mt-2 max-w-xs text-sm leading-7 text-gray-500">
                  {v.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Motion.section>

    {/* Team - image grid */}
    <Motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      variants={reveal}
      className="px-4 py-24 md:px-12 md:py-32"
    >
      <p className="mx-auto max-w-6xl text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">
        The people behind it
      </p>
      <div className="mx-auto mt-10 grid max-w-6xl grid-cols-2 gap-8 md:grid-cols-4">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="flex flex-col items-center text-center"
          >
            <div className="flex aspect-[3/4] w-full items-center justify-center bg-gray-50">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
                [Photo]
              </p>
            </div>
            <p className="mt-4 text-sm font-semibold">{member.name}</p>
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500">
              {member.role}
            </p>
          </div>
        ))}
      </div>
    </Motion.section>
  </main>
);

export default About;
