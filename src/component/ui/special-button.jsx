import React from "react";
import clsx from "clsx";

const Button = ({
  id,
  title,
  leftIcon,
  rightIcon,
  containerClass,
  onPress,
}) => {
  return (
    <button
      id={id?.toString()}
      className={clsx(" text-xs group relative z-10 w-fit ", containerClass)}
      onClick={onPress}
    >
      
      {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}

      <span className="relative inline-flex overflow-hidden text-base font-semibold tracking-widest ">
        <span className="translate-y-0 skew-y-0 transition duration-700 ease-in-out group-hover:-translate-y-[160%] group-hover:skew-y-12">
          {title}
        </span>
        <span className="absolute translate-y-[164%] skew-y-12 transition duration-700 ease-in-out group-hover:translate-y-0 group-hover:skew-y-0">
          {title}
        </span>
      </span>

      {rightIcon && (
        <span className="ml-2 inline-flex items-center">{rightIcon}</span>
      )}
    </button>
  );
};

export default Button;
