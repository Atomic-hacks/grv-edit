import React from "react";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "../component/ui/AnimatedPageTitle";

// Measurement tables are intentionally static reference content: they
// describe how GRV garments are cut, not what is currently in stock.
const APPAREL_SIZES = [
  { size: "XS", chest: "86 – 91", waist: "71 – 76", hip: "86 – 91" },
  { size: "S", chest: "91 – 97", waist: "76 – 81", hip: "91 – 97" },
  { size: "M", chest: "97 – 102", waist: "81 – 86", hip: "97 – 102" },
  { size: "L", chest: "102 – 107", waist: "86 – 91", hip: "102 – 107" },
  { size: "XL", chest: "107 – 112", waist: "91 – 97", hip: "107 – 112" },
  { size: "XXL", chest: "112 – 118", waist: "97 – 102", hip: "112 – 118" },
];

const FOOTWEAR_SIZES = [
  { eu: "40", uk: "6", us: "7", cm: "25.0" },
  { eu: "41", uk: "7", us: "8", cm: "25.7" },
  { eu: "42", uk: "8", us: "9", cm: "26.5" },
  { eu: "43", uk: "9", us: "10", cm: "27.3" },
  { eu: "44", uk: "10", us: "11", cm: "28.0" },
  { eu: "45", uk: "11", us: "12", cm: "28.8" },
];

const MEASURE_STEPS = [
  {
    title: "Chest",
    body: "Measure around the fullest part of the chest, keeping the tape level and under the arms.",
  },
  {
    title: "Waist",
    body: "Measure around the natural waistline, the narrowest part of the torso, without pulling the tape tight.",
  },
  {
    title: "Hip",
    body: "Measure around the fullest part of the hips, roughly 20cm below the natural waist.",
  },
  {
    title: "Foot",
    body: "Stand on a sheet of paper, mark heel to longest toe, and measure the distance in centimetres.",
  },
];

const Table = ({ caption, columns, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-128 border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-black">
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="py-3 pr-6 text-xs font-semibold uppercase tracking-[0.14em]"
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-gray-200">
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={`py-3.5 pr-6 ${cellIndex === 0 ? "font-medium" : "text-gray-600"}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SizeGuide = () => (
  <main className="mx-auto min-h-screen max-w-4xl bg-white px-[var(--gutter)] pb-24">
    <div className="pb-10 pt-10 md:pt-14">
      <AnimatedPageTitle
        title="Size Guide"
        subtitle="Measurements are in centimetres and describe the body, not the garment. If you fall between two sizes, take the larger one."
      />
    </div>

    <section>
      <h2 className="section-title">Apparel</h2>
      <div className="mt-6">
        <Table
          caption="Apparel sizes in centimetres"
          columns={["Size", "Chest", "Waist", "Hip"]}
          rows={APPAREL_SIZES.map((row) => [
            row.size,
            row.chest,
            row.waist,
            row.hip,
          ])}
        />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Pieces listed as One Size are cut to fit XS–L.
      </p>
    </section>

    <section className="mt-16">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
        Footwear
      </h2>
      <div className="mt-6">
        <Table
          caption="Footwear size conversions"
          columns={["EU", "UK", "US", "Foot length (cm)"]}
          rows={FOOTWEAR_SIZES.map((row) => [row.eu, row.uk, row.us, row.cm])}
        />
      </div>
      <p className="mt-4 text-sm text-gray-500">
        Footwear is listed in UK sizing on the product page.
      </p>
    </section>

    <section className="mt-16 border-t border-gray-200 pt-12">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
        How to measure
      </h2>
      <dl className="mt-6 grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {MEASURE_STEPS.map((step) => (
          <div key={step.title}>
            <dt className="text-sm font-medium">{step.title}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-gray-600">
              {step.body}
            </dd>
          </div>
        ))}
      </dl>
    </section>

    <section className="mt-16 border-t border-gray-200 pt-12">
      <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">
        Still unsure?
      </h2>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-600">
        Tell us the piece you have in mind and we will confirm the fit before
        you order.
      </p>
      <Link
        to="/contact"
        className="mt-6 inline-block border border-black bg-black px-7 py-3 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
      >
        Contact us
      </Link>
    </section>
  </main>
);

export default SizeGuide;
