// The new-todo input. Dispatches `add` on Enter — directly, no event plumbing.
import { dispatch } from "./store.js";

export const newTodoViewFn = (input) => {
  const onKeydown = (event) => {
    if (event.key !== "Enter") return;
    const title = input.value.trim();
    if (!title) return;
    dispatch({ type: "add", title });
    input.value = "";
  };

  input.addEventListener("keydown", onKeydown);
  input.focus();

  return {
    destroy() {
      input.removeEventListener("keydown", onKeydown);
    },
  };
};
