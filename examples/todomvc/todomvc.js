// TodoMVC the way this repo's approach intends: defo binds a viewFn to every
// node that enters the DOM, so behaviour is split across two view functions —
//
//   todoItemViewFn  bound to each <li> (toggle / destroy / edit). Holds no
//                   state; it reads its id from the node and dispatches intents
//                   that bubble to the root. Edit mode is local DOM state.
//
//   todomvcViewFn   owns the todos, filter, and persistence. Renders with
//                   Orange Sherbet and *morphs* the list in (not innerHTML), so
//                   defo only binds/destroys the <li>s that actually enter or
//                   leave, and an item being edited survives an unrelated
//                   re-render untouched.
//
// morphlex / @icelab/defo are resolved via the import map in index.html (and
// via node_modules under test).
import { morph } from "morphlex";
import todoList from "./compiled/todo_list.js";
import todoFooter from "./compiled/todo_footer.js";

const STORAGE_KEY = "orange-sherbet-todomvc";

const seed = () => [
  { id: 1, title: "Taste the orange sherbet", completed: true },
  { id: 2, title: "Render this list with Orange Sherbet", completed: false },
];

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? seed();
  } catch {
    return seed();
  }
};

const filterFromHash = () => {
  const hash = location.hash.replace(/^#\//, "");
  return hash === "active" || hash === "completed" ? hash : "all";
};

const parse = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

const emit = (node, type, detail) =>
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));

// --- per-item view -------------------------------------------------------

export const todoItemViewFn = (li) => {
  const id = Number(li.dataset.id);
  const editInput = li.querySelector(".edit");
  const label = li.querySelector("label");

  const enterEdit = () => {
    li.classList.add("editing");
    li.setAttribute("data-editing", "");
    editInput.value = label.textContent;
    editInput.focus();
    editInput.setSelectionRange(editInput.value.length, editInput.value.length);
  };

  const exitEdit = () => {
    li.classList.remove("editing");
    li.removeAttribute("data-editing");
  };

  const commit = () => {
    const title = editInput.value.trim();
    exitEdit(); // before emitting, so the root's morph reconciles this <li>
    emit(li, title ? "todo:save" : "todo:destroy", { id, title });
  };

  const onChange = (event) => {
    if (event.target.matches(".toggle")) emit(li, "todo:toggle", { id });
  };
  const onClick = (event) => {
    if (event.target.matches(".destroy")) emit(li, "todo:destroy", { id });
  };
  const onDblclick = (event) => {
    if (event.target.matches("label")) enterEdit();
  };
  const onKeydown = (event) => {
    if (!event.target.matches(".edit")) return;
    if (event.key === "Enter") commit();
    else if (event.key === "Escape") {
      editInput.value = label.textContent;
      exitEdit();
    }
  };
  const onBlur = (event) => {
    if (event.target.matches(".edit") && li.classList.contains("editing")) commit();
  };

  li.addEventListener("change", onChange);
  li.addEventListener("click", onClick);
  li.addEventListener("dblclick", onDblclick);
  li.addEventListener("keydown", onKeydown);
  li.addEventListener("blur", onBlur, true);

  return {
    destroy() {
      li.removeEventListener("change", onChange);
      li.removeEventListener("click", onClick);
      li.removeEventListener("dblclick", onDblclick);
      li.removeEventListener("keydown", onKeydown);
      li.removeEventListener("blur", onBlur, true);
    },
  };
};

// --- root view -----------------------------------------------------------

export const todomvcViewFn = (root) => {
  let todos = load();
  let nextId = todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  let filter = filterFromHash();

  const listMount = root.querySelector(".list-mount");
  const footerMount = root.querySelector(".footer-mount");
  const main = root.querySelector(".main");
  const toggleAll = root.querySelector(".toggle-all");
  const newTodo = root.querySelector(".new-todo");

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  const find = (id) => todos.find((t) => t.id === id);
  const activeCount = () => todos.filter((t) => !t.completed).length;
  const visible = () =>
    todos.filter((t) =>
      filter === "active" ? !t.completed : filter === "completed" ? t.completed : true,
    );

  const render = () => {
    const has = todos.length > 0;
    main.hidden = !has;
    footerMount.innerHTML = has
      ? todoFooter({ active: activeCount(), filter, has_completed: todos.some((t) => t.completed) })
      : "";
    toggleAll.checked = has && activeCount() === 0;

    const next = parse(todoList({ todos: visible() }));
    const current = listMount.querySelector(".todo-list");
    if (current) {
      // Morph in place. Items being edited are left untouched, so an in-progress
      // edit survives a re-render triggered by another todo.
      morph(current, next, {
        beforeNodeVisited: (node) => !(node.nodeType === 1 && node.hasAttribute?.("data-editing")),
      });
    } else {
      listMount.replaceChildren(next);
    }
  };

  const update = (mutate) => {
    mutate();
    save();
    render();
  };

  // Intents bubbled up from the item views.
  const onToggle = (event) =>
    update(() => {
      const todo = find(event.detail.id);
      if (todo) todo.completed = !todo.completed;
    });
  const onDestroy = (event) =>
    update(() => (todos = todos.filter((t) => t.id !== event.detail.id)));
  const onSave = (event) =>
    update(() => {
      const todo = find(event.detail.id);
      if (todo) todo.title = event.detail.title;
    });

  // Collection-level controls (the static header/footer elements).
  const onKeydown = (event) => {
    if (event.target.matches(".new-todo") && event.key === "Enter") {
      const title = event.target.value.trim();
      if (!title) return;
      update(() => todos.push({ id: nextId++, title, completed: false }));
      event.target.value = "";
    }
  };
  const onChange = (event) => {
    if (event.target.matches(".toggle-all")) {
      const completed = event.target.checked;
      update(() => todos.forEach((t) => (t.completed = completed)));
    }
  };
  const onClick = (event) => {
    if (event.target.matches(".clear-completed")) {
      update(() => (todos = todos.filter((t) => !t.completed)));
    }
  };
  const onHashchange = () => {
    filter = filterFromHash();
    render();
  };

  root.addEventListener("todo:toggle", onToggle);
  root.addEventListener("todo:destroy", onDestroy);
  root.addEventListener("todo:save", onSave);
  root.addEventListener("keydown", onKeydown);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHashchange);

  render();
  newTodo.focus();

  return {
    destroy() {
      root.removeEventListener("todo:toggle", onToggle);
      root.removeEventListener("todo:destroy", onDestroy);
      root.removeEventListener("todo:save", onSave);
      root.removeEventListener("keydown", onKeydown);
      root.removeEventListener("change", onChange);
      root.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHashchange);
    },
  };
};
