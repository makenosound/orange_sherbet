// The root view: subscribes to the store and renders the whole list on every
// change, morphing it onto the live DOM. It owns no item behaviour — it just
// reflects state. List-wide concerns (clear-completed, hash filters) dispatch
// directly.
import { morph } from "morphlex";
import { dispatch, filterFromHash, getState, subscribe } from "./store.js";
import todoList from "../compiled/todo_list.js";
import todoFooter from "../compiled/todo_footer.js";

const visible = (state) =>
  state.todos.filter((t) =>
    state.filter === "active" ? !t.completed : state.filter === "completed" ? t.completed : true,
  );

const isEditing = (node) => node.nodeType === 1 && node.classList.contains("editing");

const parse = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

export const appViewFn = (root) => {
  const listMount = root.querySelector(".list-mount");
  const footerMount = root.querySelector(".footer-mount");
  const main = root.querySelector(".main");
  const toggleAll = root.querySelector(".toggle-all");

  const ensureList = () => {
    let ul = listMount.querySelector(".todo-list");
    if (!ul) {
      ul = document.createElement("ul");
      ul.className = "todo-list";
      listMount.appendChild(ul);
    }
    return ul;
  };

  const render = (state) => {
    const has = state.todos.length > 0;
    const active = state.todos.filter((t) => !t.completed).length;
    main.hidden = !has;
    footerMount.innerHTML = has
      ? todoFooter({ active, filter: state.filter, has_completed: state.todos.some((t) => t.completed) })
      : "";
    toggleAll.checked = has && active === 0;

    const todos = visible(state).map((t) => ({ ...t, editing: t.id === state.editing }));
    morph(ensureList(), parse(todoList({ todos })), {
      // Skip a todo that's being edited (in both old and new) so an in-progress
      // edit survives a re-render triggered by another todo.
      beforeNodeVisited: (from, to) => !(isEditing(from) && isEditing(to)),
    });
  };

  const onHashchange = () => dispatch({ type: "filter", filter: filterFromHash() });
  const onClick = (event) => {
    if (event.target.matches(".clear-completed")) dispatch({ type: "clearCompleted" });
  };

  const unsubscribe = subscribe(render);
  window.addEventListener("hashchange", onHashchange);
  root.addEventListener("click", onClick);
  render(getState());

  return {
    destroy() {
      unsubscribe();
      window.removeEventListener("hashchange", onHashchange);
      root.removeEventListener("click", onClick);
    },
  };
};
