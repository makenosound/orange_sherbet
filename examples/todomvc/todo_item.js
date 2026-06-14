// A single todo. defo binds one of these to each <li> as morph creates them.
// It owns the todo's behaviour and dispatches directly — morph renders the
// content, so the only thing update() does is focus the field when editing.
import { dispatch } from "./store.js";

export const todoItemViewFn = (li, props) => {
  const id = props.id;
  const editValue = () => li.querySelector(".edit").value.trim();
  const commit = () => {
    const title = editValue();
    dispatch(title ? { type: "save", id, title } : { type: "destroy", id });
  };

  const onChange = (event) => {
    if (event.target.matches(".toggle")) dispatch({ type: "toggle", id });
  };
  const onClick = (event) => {
    if (event.target.matches(".destroy")) dispatch({ type: "destroy", id });
  };
  const onDblclick = (event) => {
    if (event.target.matches("label")) dispatch({ type: "edit", id });
  };
  const onKeydown = (event) => {
    if (!event.target.matches(".edit")) return;
    if (event.key === "Enter") commit();
    else if (event.key === "Escape") dispatch({ type: "cancel" });
  };
  const onBlur = (event) => {
    // Commit on blur, but not the blur from morph removing the field on exit —
    // by then the .editing class is gone.
    if (event.target.matches(".edit") && li.classList.contains("editing")) commit();
  };

  li.addEventListener("change", onChange);
  li.addEventListener("click", onClick);
  li.addEventListener("dblclick", onDblclick);
  li.addEventListener("keydown", onKeydown);
  li.addEventListener("blur", onBlur, true);

  return {
    update(todo) {
      if (!todo.editing) return;
      const edit = li.querySelector(".edit");
      if (edit && document.activeElement !== edit) {
        edit.focus();
        edit.setSelectionRange(edit.value.length, edit.value.length);
      }
    },
    destroy() {
      li.removeEventListener("change", onChange);
      li.removeEventListener("click", onClick);
      li.removeEventListener("dblclick", onDblclick);
      li.removeEventListener("keydown", onKeydown);
      li.removeEventListener("blur", onBlur, true);
    },
  };
};
