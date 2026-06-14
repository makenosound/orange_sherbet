// The "mark all complete" checkbox. The app sets its checked state on render;
// this dispatches when the user flips it.
import { dispatch } from "./store.js";

export const toggleAllViewFn = (input) => {
  const onChange = () => dispatch({ type: "toggleAll", completed: input.checked });

  input.addEventListener("change", onChange);

  return {
    destroy() {
      input.removeEventListener("change", onChange);
    },
  };
};
