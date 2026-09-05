"use client";

import React, { useEffect, useState } from "react";
import Button from "./ui/special-button";
import SpotifyPlayer from "./ui/spotify-player";
import { Link } from "react-router-dom";
import AnimatedPageTitle from "./ui/AnimatedPageTitle";

const Hero = () => {
  const [time, setTime] = useState(null);

  useEffect(() => {
    // Mock API data (for demo)
    const mockData = {
      dateTime: "2025-11-07T12:45:32",
      timeZone: "London",
    };

    const timer = setTimeout(() => {
      console.log("✅ Using mock time data:", mockData);
      setTime(mockData);
    }, 500);

    return () => clearTimeout(timer); // Clean up timeout
  }, []);

  return (
    <section className="relative h-screen w-full overflow-hidden text-white bg-[#161616]">
      {/* Background Video */}
      <video
        src="/videos/hero.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 z-10 h-full w-full object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-black/50 to-transparent" />

      {/* Main Content */}
      <nav className="relative z-30 flex flex-col items-center justify-center text-center mt-48 md:mt-72">
        <AnimatedPageTitle
          title="GRV."
          className="uppercase tracking-[3px] text-4xl md:text-8xl font-normal mb-8 text-white"
        />

        <ul className="space-y-2">
          {["Shop", "Accessories", "Brand", "Journal", "Contact"].map(
            (title) => (
              <Link
                to={`/${title}`}
                key={title}
                className=" flex flex-col items-center justify-center gap-2"
              >
                <Button title={title} />
              </Link>
            ),
          )}
        </ul>
      </nav>

      {/* Time Display */}
      {time && (
        <div className="absolute bottom-0 z-30 flex items-center justify-center w-full py-4 text-xs md:text-sm">
          <h2 className="font-heading mr-2">{time.timeZone}:</h2>
          <p>
            {new Date(time.dateTime).toLocaleTimeString("en-GB", {
              hour12: false,
            })}
          </p>
        </div>
      )}

      {/* Spotify Player */}
      <SpotifyPlayer />
    </section>
  );
};

export default Hero;
