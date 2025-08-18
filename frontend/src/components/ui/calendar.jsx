import * as React from "react";

// Minimal stub to avoid react-day-picker dependency; replace with actual calendar if needed.
function Calendar({ className, ...props }) {
  return (
    <div className={"text-xs text-gray-500 p-3 border border-dashed rounded " + (className || "")}> 
      Calendar component is unavailable.
    </div>
  );
}

export { Calendar };
