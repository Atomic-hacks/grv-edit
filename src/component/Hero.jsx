"use client";

import React, { useEffect, useState } from "react";
import Button from "./ui/special-button";
import SpotifyPlayer from "./ui/spotify-player";
import { useNavigate } from "react-router-dom";
import AnimatedPageTitle from "./ui/AnimatedPageTitle";

const Hero = () => {
  const [time, setTime] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Africa/Lagos",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
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
          {["Shop", "Departments", "Brands", "About Us", "Contact"].map(
            (title) => (
              <Button
                key={title}
                title={title}
                onPress={() =>
                  navigate(title === "About Us" ? "/about" : `/${title}`)
                }
                containerClass="flex flex-col items-center justify-center gap-2"
              />
            ),
          )}
        </ul>
      </nav>

      {/* Time Display */}
      {time && (
        <div className="absolute bottom-0 z-30 flex items-center justify-center w-full py-4 text-xs md:text-sm">
          <p>Lagos {time}</p>
        </div>
      )}

      {/* Spotify Player */}
      <SpotifyPlayer />
    </section>
  );
};

export default Hero;
