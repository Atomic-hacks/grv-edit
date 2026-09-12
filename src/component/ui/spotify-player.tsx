import React from "react";

const SpotifyPlayer = () => {
  return (
    <iframe
      className="
        absolute z-50 bottom-5 left-5
        w-[90%] sm:w-[60%] md:w-[40%] lg:w-[25%] xl:w-[20%]
        h-[120px] sm:h-[130px] md:h-[140px] lg:h-[152px]
        rounded-xl
      "
      src="https://open.spotify.com/embed/playlist/37i9dQZF1DX5ll2DhWOB1F?utm_source=generator&si=fa5450abac4e4545"
      frameBorder="0"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      loading="lazy"
    ></iframe>
  );
};

export default SpotifyPlayer;
